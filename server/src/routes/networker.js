import { Router } from 'express';
import db from '../db.js';

const router = Router();

// ---- Google Programmable Search X-ray (official API, public results only) ----

async function cseSearch(query) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null; // keyless mode

  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Google CSE: HTTP ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// LinkedIn result titles look like "Jane Doe - Technical Recruiter - Acme | LinkedIn"
function parseLinkedInResult(item) {
  const title = (item.title || '').replace(/\s*[|·-]\s*LinkedIn\s*$/i, '');
  const parts = title.split(/\s[-–|]\s/);
  if (!parts[0]) return null;
  return {
    name: parts[0].trim(),
    title: parts.slice(1).join(' — ').trim() || null,
    linkedin_url: item.link,
    snippet: item.snippet || null,
  };
}

// ---- GitHub org member lookup (official API) ----

async function githubOrgMembers(company) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const slug = company.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug) return [];

  const orgRes = await fetch(`https://api.github.com/orgs/${slug}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!orgRes.ok) return []; // org slug guess failed — fine

  const membersRes = await fetch(`https://api.github.com/orgs/${slug}/members?per_page=10`, { headers, signal: AbortSignal.timeout(15000) });
  if (!membersRes.ok) return [];
  const members = await membersRes.json();

  // Pull display names from individual profiles (public data only)
  const detailed = [];
  for (const m of members.slice(0, 5)) {
    try {
      const userRes = await fetch(m.url, { headers, signal: AbortSignal.timeout(10000) });
      if (userRes.ok) {
        const u = await userRes.json();
        detailed.push({ login: u.login, name: u.name || u.login, html_url: u.html_url, blog: u.blog || null });
      }
    } catch { /* skip individual failures */ }
  }
  return detailed;
}

// ---- One-click LinkedIn people-search URLs (opened by the user, never fetched) ----

function linkedInSearchLinks(company) {
  const mk = (keywords) =>
    `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
  return [
    { label: 'Recruiters', url: mk(`${company} technical recruiter`) },
    { label: 'University recruiting', url: mk(`${company} university recruiter`) },
    { label: 'Engineering managers', url: mk(`${company} engineering manager`) },
    { label: 'Engineers', url: mk(`${company} software engineer`) },
  ];
}

const insertContact = db.prepare(`
  INSERT INTO contacts (name, title, company, linkedin_url, how_connected, notes, outreach_status, tags, discovered_job_id)
  VALUES (?, ?, ?, ?, ?, ?, 'not_contacted', ?, ?)
`);

function saveContact({ name, title, company, linkedin_url, notes, tags, jobId }) {
  if (linkedin_url) {
    const existing = db.prepare('SELECT id FROM contacts WHERE linkedin_url = ?').get(linkedin_url);
    if (existing) return { id: existing.id, duplicate: true };
  }
  const result = insertContact.run(
    name,
    title,
    company,
    linkedin_url || null,
    'Auto-discovered (Networker)',
    notes || null,
    JSON.stringify(tags),
    jobId
  );
  return { id: Number(result.lastInsertRowid), duplicate: false };
}

router.post('/jobs/:id/find-contacts', async (req, res) => {
  const job = db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const company = job.company;
  let saved = 0;

  // Always emit manual search links first — works with zero API keys.
  send('links', { company, links: linkedInSearchLinks(company) });

  // 1. Google CSE X-ray for recruiters and engineering managers
  try {
    const queries = [
      { q: `site:linkedin.com/in "${company}" technical recruiter`, tag: 'Recruiter' },
      { q: `site:linkedin.com/in "${company}" engineering manager`, tag: 'Hiring Manager' },
    ];
    for (const { q, tag } of queries) {
      const items = await cseSearch(q);
      if (items === null) {
        send('log', { msg: 'Google CSE keys not set — skipping X-ray search (using links only)' });
        break;
      }
      for (const item of items) {
        const person = parseLinkedInResult(item);
        if (!person || !person.linkedin_url?.includes('linkedin.com/in')) continue;
        const result = saveContact({
          ...person,
          company,
          notes: person.snippet,
          tags: ['Discovered', tag],
          jobId: job.id,
        });
        if (!result.duplicate) {
          saved++;
          send('contact', { id: result.id, name: person.name, title: person.title, tag, source: 'google-cse' });
        }
      }
    }
  } catch (err) {
    send('log', { msg: `CSE search failed: ${err.message}` });
  }

  // 2. GitHub org members (engineer/peer outreach)
  try {
    const members = await githubOrgMembers(company);
    if (!members.length) send('log', { msg: `No public GitHub org members found for "${company}" (org slug guess may not match)` });
    for (const m of members) {
      const result = saveContact({
        name: m.name,
        title: `Engineer at ${company} (GitHub: ${m.login})`,
        company,
        linkedin_url: null,
        notes: `GitHub profile: ${m.html_url}${m.blog ? ` | ${m.blog}` : ''}`,
        tags: ['Discovered', 'Engineer'],
        jobId: job.id,
      });
      if (!result.duplicate) {
        saved++;
        send('contact', { id: result.id, name: m.name, title: `GitHub: ${m.login}`, tag: 'Engineer', source: 'github' });
      }
    }
  } catch (err) {
    send('log', { msg: `GitHub lookup failed: ${err.message}` });
  }

  send('done', { saved });
  res.end();
});

export default router;
