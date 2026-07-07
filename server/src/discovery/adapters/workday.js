// Workday's public CXS endpoints — the same JSON API the career-site frontend calls.
// No auth, no scraping, no DOM. Config: { tenant, site, wd, company, searchText?, fetchDetails?, maxDetails? }
//   List:   POST {base}/wday/cxs/{tenant}/{site}/jobs      → { total, jobPostings: [...] }
//   Detail: GET  {base}/wday/cxs/{tenant}/{site}{extPath}  → { jobPostingInfo: {...} }
// e.g. https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs
const PAGE_SIZE = 20; // Workday caps CXS page size at 20
const MAX_PAGES = 10;
const DEFAULT_MAX_DETAILS = 10;

export function workdayBase(tenant, wd = 5) {
  return `https://${tenant}.wd${wd}.myworkdayjobs.com`;
}

/**
 * Parse a myworkdayjobs.com posting URL into { tenant, wd, site, externalPath, base }.
 * Handles optional locale segments and both /job/... and /details/... path styles:
 *   https://nvidia.wd5.myworkdayjobs.com/NVIDIAExternalCareerSite/job/US-CA/Title_JR123
 *   https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/details/Title_JR123
 * Returns null if the URL is not a Workday career-site URL.
 */
export function parseWorkdayUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.match(/^([a-z0-9-]+)\.wd(\d+)\.myworkdayjobs\.com$/i);
  if (!host) return null;
  const [, tenant, wd] = host;

  const segments = u.pathname.split('/').filter(Boolean);
  let i = 0;
  if (segments[i] && /^[a-z]{2,3}-[A-Za-z]{2,4}$/.test(segments[i])) i++; // locale, e.g. en-US
  const site = segments[i];
  if (!site) return null;
  const rest = segments.slice(i + 1);

  return {
    tenant: tenant.toLowerCase(),
    wd: Number(wd),
    site,
    externalPath: rest.length ? `/${rest.join('/')}` : null, // e.g. /job/US-CA-Santa-Clara/Title_JR123
    base: workdayBase(tenant.toLowerCase(), Number(wd)),
  };
}

/**
 * Bootstrap GET against the career site so Workday issues the session cookies
 * some tenants expect on CXS calls. Non-fatal: many tenants answer CXS without
 * cookies, so failures here just return an empty cookie string.
 */
export async function bootstrapCookies(base, site, doFetch = fetch) {
  try {
    const res = await doFetch(`${base}/${site}`, { redirect: 'follow' });
    return res.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') || '';
  } catch {
    return '';
  }
}

/**
 * Fetch one posting's detail from the CXS API. Returns jobPostingInfo
 * (jobDescription HTML, qualifications, location, postedOn, startDate, jobReqId, …).
 */
export async function fetchJobDetail({ tenant, wd = 5, site, externalPath }, { doFetch = fetch, cookies = '' } = {}) {
  if (!tenant || !site || !externalPath) throw new Error('fetchJobDetail requires tenant, site and externalPath');
  const url = `${workdayBase(tenant, wd)}/wday/cxs/${tenant}/${site}${externalPath}`;
  const res = await doFetch(url, {
    headers: { Accept: 'application/json', ...(cookies ? { Cookie: cookies } : {}) },
  });
  if (!res.ok) throw new Error(`Workday detail HTTP ${res.status} for ${url}`);
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Workday detail returned non-JSON for ${url}`);
  }
  if (!data.jobPostingInfo) throw new Error(`Workday detail response missing jobPostingInfo for ${url}`);
  return data.jobPostingInfo;
}

/** Workday returns relative "Posted Today / Yesterday / N Days Ago" strings → ISO date (or null). */
export function parsePostedOn(text) {
  if (!text) return null;
  const t = String(text).toLowerCase();
  let daysAgo = null;
  if (t.includes('today')) daysAgo = 0;
  else if (t.includes('yesterday')) daysAgo = 1;
  else {
    const m = t.match(/(\d+)\+?\s*days?\s*ago/);
    if (m) daysAgo = Number(m[1]);
  }
  if (daysAgo === null || t.includes('+')) return null; // "30+ Days Ago" is unbounded
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Crude but dependency-free HTML → text for jobDescription caching. */
export function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<(br|\/p|\/li|\/div|\/h[1-6]|\/tr)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default {
  type: 'workday',
  async fetch(config, { politeFetch, log }) {
    const { tenant, site, wd = 5 } = config;
    if (!tenant || !site) throw new Error('workday adapter requires config.tenant and config.site');

    const base = workdayBase(tenant, wd);
    const cxs = `${base}/wday/cxs/${tenant}/${site}/jobs`;

    // Cookie bootstrap is best-effort — most tenants answer CXS without it.
    const cookies = await bootstrapCookies(base, site, politeFetch);

    const jobs = [];
    let total = null; // only reliable on the first page's response
    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await politeFetch(cxs, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(cookies ? { Cookie: cookies } : {}),
        },
        body: JSON.stringify({
          appliedFacets: {},
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
          searchText: config.searchText || '',
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Workday ${tenant}: HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`);
      }
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Workday ${tenant}: non-JSON response from CXS — check tenant/site/wd in the source config`);
      }

      const postings = Array.isArray(data.jobPostings) ? data.jobPostings : [];
      if (page === 0 && !Array.isArray(data.jobPostings)) {
        throw new Error(`Workday ${tenant}: unexpected CXS response shape (no jobPostings array) — check tenant/site/wd`);
      }

      for (const p of postings) {
        if (!p.externalPath) continue;
        jobs.push({
          external_id: `wd-${tenant}-${p.bulletFields?.[0] || p.externalPath}`,
          company: config.company || tenant,
          role: p.title,
          url: `${base}/${site}${p.externalPath.startsWith('/') ? '' : '/'}${p.externalPath}`,
          location: p.locationsText || null,
          description: null, // detail fetch is opt-in (config.fetchDetails) to keep runs fast
          posted_date: parsePostedOn(p.postedOn),
          _externalPath: p.externalPath.startsWith('/') ? p.externalPath : `/${p.externalPath}`,
        });
      }

      if (total === null && typeof data.total === 'number') total = data.total;
      log?.(`Workday ${tenant}: page ${page + 1}, ${jobs.length}/${total ?? '?'}`);
      if (postings.length === 0 || (total !== null && (page + 1) * PAGE_SIZE >= total)) break;
    }

    // Optional per-job detail fetch (description + true posted date), capped to stay polite.
    if (config.fetchDetails) {
      const max = Math.min(jobs.length, Number(config.maxDetails) || DEFAULT_MAX_DETAILS);
      for (let i = 0; i < max; i++) {
        const job = jobs[i];
        try {
          const info = await fetchJobDetail(
            { tenant, wd, site, externalPath: job._externalPath },
            { doFetch: politeFetch, cookies },
          );
          job.description = stripHtml(info.jobDescription).slice(0, 8000) || null;
          job.posted_date = info.startDate || job.posted_date;
        } catch (err) {
          log?.(`Workday ${tenant}: detail fetch failed for ${job.role}: ${err.message}`);
        }
      }
    }
    for (const j of jobs) delete j._externalPath;

    return jobs;
  },
};
