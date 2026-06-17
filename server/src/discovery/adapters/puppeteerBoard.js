import { checkRobots } from '../fetcher.js';

// Last-resort adapter for boards with no API. Deliberate constraints:
//  - visible (non-headless) browser, standard Chrome — no stealth, no fingerprint spoofing
//  - robots.txt checked before navigating
//  - one page, no crawling
// Config: { url, company, jobSelector, titleSelector?, linkSelector?, locationSelector? }
export default {
  type: 'puppeteer',
  async fetch(config, { log }) {
    const { url, jobSelector } = config;
    if (!url || !jobSelector) throw new Error('puppeteer adapter requires config.url and config.jobSelector');

    await checkRobots(url);

    const { default: puppeteer } = await import('puppeteer');
    log?.(`Launching visible browser for ${url}`);

    const browser = await puppeteer.launch({ headless: false, defaultViewport: null });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector(jobSelector, { timeout: 20000 });

      const jobs = await page.evaluate((cfg) => {
        const rows = document.querySelectorAll(cfg.jobSelector);
        return [...rows].map((row) => {
          const titleEl = cfg.titleSelector ? row.querySelector(cfg.titleSelector) : row;
          const linkEl = cfg.linkSelector ? row.querySelector(cfg.linkSelector) : row.closest('a') || row.querySelector('a');
          const locEl = cfg.locationSelector ? row.querySelector(cfg.locationSelector) : null;
          return {
            role: titleEl?.textContent?.trim() || null,
            url: linkEl?.href || null,
            location: locEl?.textContent?.trim() || null,
          };
        }).filter((j) => j.role && j.url);
      }, config);

      return jobs.map((j) => ({
        external_id: null,
        company: config.company || new URL(url).hostname,
        role: j.role,
        url: j.url,
        location: j.location,
        description: null,
        posted_date: null,
      }));
    } finally {
      await browser.close();
    }
  },
};
