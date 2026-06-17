// Reads community-maintained job-list repos (e.g. SimplifyJobs/Summer2026-Internships)
// via the official GitHub REST API. Parses README markdown tables by header name
// so column reordering doesn't break us.
export default {
  type: 'github',
  async fetch(config, { politeFetch }) {
    const { repo } = config; // e.g. "SimplifyJobs/Summer2026-Internships"
    if (!repo) throw new Error('github adapter requires config.repo');

    const headers = { Accept: 'application/vnd.github.raw+json' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

    const res = await politeFetch(`https://api.github.com/repos/${repo}/readme`, { headers });
    if (!res.ok) throw new Error(`GitHub ${repo}: HTTP ${res.status}`);
    const markdown = await res.text();

    return parseJobTables(markdown, repo);
  },
};

function parseJobTables(markdown, repo) {
  const jobs = [];
  const lines = markdown.split('\n');
  let headerMap = null;
  let lastCompany = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      headerMap = null;
      continue;
    }

    const cells = trimmed.split('|').slice(1, -1).map((c) => c.trim());

    // Header row: locate the columns we care about by name.
    if (!headerMap) {
      const lower = cells.map((c) => c.toLowerCase());
      const company = lower.findIndex((c) => c.includes('company'));
      const role = lower.findIndex((c) => c.includes('role') || c.includes('position') || c.includes('title'));
      const link = lower.findIndex((c) => c.includes('application') || c.includes('link') || c.includes('apply'));
      const location = lower.findIndex((c) => c.includes('location'));
      const date = lower.findIndex((c) => c.includes('date') || c.includes('age') || c.includes('posted'));
      if (company >= 0 && role >= 0) {
        headerMap = { company, role, link, location, date };
      }
      continue;
    }

    // Separator row
    if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue;

    const rawCompany = cells[headerMap.company] || '';
    const rawRole = cells[headerMap.role] || '';
    const rawLink = headerMap.link >= 0 ? cells[headerMap.link] || '' : '';

    // Skip closed postings (🔒 marker convention in these repos)
    if (rawLink.includes('🔒') || rawRole.includes('🔒')) continue;

    // "↳" rows inherit the company from the previous row
    let company = stripMarkdown(rawCompany);
    if (company === '↳' || company === '') {
      company = lastCompany;
    } else {
      lastCompany = company;
    }
    if (!company) continue;

    const role = stripMarkdown(rawRole);
    const url = extractUrl(rawLink) || extractUrl(rawRole) || extractUrl(rawCompany);
    if (!role || !url) continue;

    jobs.push({
      external_id: null, // URL is the dedup key for these listings
      company,
      role,
      url,
      location: headerMap.location >= 0 ? stripMarkdown(cells[headerMap.location]) || null : null,
      description: null,
      posted_date: headerMap.date >= 0 ? normalizeDate(cells[headerMap.date]) : null,
      _repo: repo,
    });
  }

  return jobs;
}

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]+>/g, '')                  // html tags
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // [text](url) -> text
    .replace(/\*\*?/g, '')
    .trim();
}

function extractUrl(text) {
  if (!text) return null;
  const md = text.match(/\((https?:\/\/[^)\s]+)\)/);
  if (md) return md[1];
  const href = text.match(/href="(https?:\/\/[^"]+)"/);
  if (href) return href[1];
  const bare = text.match(/https?:\/\/[^\s|<>"]+/);
  return bare ? bare[0] : null;
}

function normalizeDate(text) {
  const clean = stripMarkdown(text);
  if (!clean) return null;
  // "5d", "2mo" style ages
  const age = clean.match(/^(\d+)\s*(d|mo|h)$/i);
  if (age) {
    const n = Number(age[1]);
    const ms = age[2].toLowerCase() === 'mo' ? n * 30 * 86400000 : age[2] === 'h' ? n * 3600000 : n * 86400000;
    return new Date(Date.now() - ms).toISOString().split('T')[0];
  }
  // "Oct 03" style
  const parsed = new Date(`${clean} ${new Date().getFullYear()}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
}
