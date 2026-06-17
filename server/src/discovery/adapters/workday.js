// Workday's public CXS endpoint — the same JSON API the career-site frontend calls.
// No auth, no scraping, no DOM. Config: { tenant, site, wd, company, searchText? }
// e.g. https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs
const PAGE_SIZE = 20;
const MAX_PAGES = 10;

export default {
  type: 'workday',
  async fetch(config, { politeFetch, log }) {
    const { tenant, site, wd = 5 } = config;
    if (!tenant || !site) throw new Error('workday adapter requires config.tenant and config.site');

    const base = `https://${tenant}.wd${wd}.myworkdayjobs.com`;
    const cxs = `${base}/wday/cxs/${tenant}/${site}/jobs`;

    // Bootstrap GET so Workday issues the session cookies the CXS endpoint expects.
    const bootstrap = await politeFetch(`${base}/${site}`, { redirect: 'follow' });
    const cookies = bootstrap.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') || '';

    const jobs = [];
    let total = null; // only present on the first page's response
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
      if (!res.ok) throw new Error(`Workday ${tenant}: HTTP ${res.status}`);
      const data = await res.json();

      const postings = data.jobPostings || [];
      for (const p of postings) {
        if (!p.externalPath) continue;
        jobs.push({
          external_id: `wd-${tenant}-${p.bulletFields?.[0] || p.externalPath}`,
          company: config.company || tenant,
          role: p.title,
          url: `${base}/${site}${p.externalPath.startsWith('/') ? '' : '/'}${p.externalPath}`,
          location: p.locationsText || null,
          description: null, // detail fetch is opt-in to keep runs fast
          posted_date: null,
        });
      }

      if (total === null && typeof data.total === 'number') total = data.total;
      log?.(`Workday ${tenant}: page ${page + 1}, ${jobs.length}/${total ?? '?'}`);
      if (postings.length === 0 || (total !== null && (page + 1) * PAGE_SIZE >= total)) break;
    }

    return jobs;
  },
};
