// Public Lever postings API — no auth, no scraping.
// https://github.com/lever/postings-api
export default {
  type: 'lever',
  async fetch(config, { politeFetch }) {
    const { org } = config;
    if (!org) throw new Error('lever adapter requires config.org');

    const url = `https://api.lever.co/v0/postings/${org}?mode=json`;
    const res = await politeFetch(url);
    if (!res.ok) throw new Error(`Lever ${org}: HTTP ${res.status}`);
    const data = await res.json();

    return (Array.isArray(data) ? data : []).map((job) => ({
      external_id: `lever-${org}-${job.id}`,
      company: config.company || org,
      role: job.text,
      url: job.hostedUrl,
      location: job.categories?.location || null,
      description: (job.descriptionPlain || '').slice(0, 6000) || null,
      posted_date: job.createdAt ? new Date(job.createdAt).toISOString().split('T')[0] : null,
    }));
  },
};
