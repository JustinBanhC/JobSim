// Public Ashby job board API — no auth, no scraping.
// https://developers.ashbyhq.com/docs/public-job-posting-api
export default {
  type: 'ashby',
  async fetch(config, { politeFetch }) {
    const { org } = config;
    if (!org) throw new Error('ashby adapter requires config.org');

    const url = `https://api.ashbyhq.com/posting-api/job-board/${org}?includeCompensation=true`;
    const res = await politeFetch(url);
    if (!res.ok) throw new Error(`Ashby ${org}: HTTP ${res.status}`);
    const data = await res.json();

    return (data.jobs || []).map((job) => ({
      external_id: `ashby-${org}-${job.id}`,
      company: config.company || org,
      role: job.title,
      url: job.jobUrl || job.applyUrl,
      location: job.location || null,
      description: (job.descriptionPlain || '').slice(0, 6000) || null,
      posted_date: job.publishedAt?.split('T')[0] || null,
    }));
  },
};
