import * as cheerio from 'cheerio';

// Greenhouse returns HTML-ESCAPED markup (&lt;div&gt;…), so the first cheerio pass
// only decodes entities; the second pass strips the now-real tags.
export function stripHtml(content) {
  const decoded = cheerio.load(content).text();
  return cheerio.load(decoded).text().replace(/\s+\n/g, '\n').trim().slice(0, 6000);
}

// Public Greenhouse job board API — no auth, no scraping.
// https://developers.greenhouse.io/job-board.html
export default {
  type: 'greenhouse',
  async fetch(config, { politeFetch }) {
    const { org } = config;
    if (!org) throw new Error('greenhouse adapter requires config.org');

    const url = `https://boards-api.greenhouse.io/v1/boards/${org}/jobs?content=true`;
    const res = await politeFetch(url);
    if (!res.ok) throw new Error(`Greenhouse ${org}: HTTP ${res.status}`);
    const data = await res.json();

    return (data.jobs || []).map((job) => ({
      external_id: `gh-${org}-${job.id}`,
      company: config.company || org,
      role: job.title,
      url: job.absolute_url,
      location: job.location?.name || null,
      description: job.content ? stripHtml(job.content) : null,
      posted_date: job.updated_at?.split('T')[0] || null,
    }));
  },
};
