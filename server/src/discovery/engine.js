import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../db.js';
import { politeFetch } from './fetcher.js';
import { hardFilter } from './hardFilter.js';
import { loadPrefs } from './prefs.js';
import greenhouse from './adapters/greenhouse.js';
import lever from './adapters/lever.js';
import ashby from './adapters/ashby.js';
import github from './adapters/github.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const adapters = {
  greenhouse,
  lever,
  ashby,
  github,
};

// Lazy-loaded adapters that pull heavy deps (puppeteer) only when used.
const lazyAdapters = {
  workday: () => import('./adapters/workday.js').then((m) => m.default),
  puppeteer: () => import('./adapters/puppeteerBoard.js').then((m) => m.default),
};

export function seedSourcesIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM job_sources').get();
  if (count.n > 0) return;
  const seeds = JSON.parse(readFileSync(join(__dirname, 'seedSources.json'), 'utf8'));
  const insert = db.prepare('INSERT INTO job_sources (company, board_type, config) VALUES (?, ?, ?)');
  const tx = db.transaction(() => {
    for (const s of seeds) insert.run(s.company, s.board_type, JSON.stringify(s.config));
  });
  tx();
}

async function getAdapter(boardType) {
  if (adapters[boardType]) return adapters[boardType];
  if (lazyAdapters[boardType]) return lazyAdapters[boardType]();
  throw new Error(`Unknown board type: ${boardType}`);
}

let running = false;
export function isRunning() {
  return running;
}

const insertJob = db.prepare(`
  INSERT OR IGNORE INTO discovered_jobs
    (source, source_id, external_id, company, role, url, location, description, posted_date, hard_filter_result, status)
  VALUES (@source, @source_id, @external_id, @company, @role, @url, @location, @description, @posted_date, @hard_filter_result, @status)
`);

/**
 * Run the full ingestion pipeline. `emit(event, data)` streams progress (SSE-friendly).
 * Returns summary { sources, fetched, inserted, filtered, errors }.
 */
export async function runIngestion({ sourceIds = null, emit = () => {}, score = null } = {}) {
  if (running) throw Object.assign(new Error('Ingestion already running'), { code: 'BUSY' });
  running = true;

  const summary = { sources: 0, fetched: 0, inserted: 0, filtered: 0, errors: [] };

  try {
    const prefs = loadPrefs(); // load once per run; hardFilter compiles matchers per prefs object
    let sql = 'SELECT * FROM job_sources WHERE enabled = 1';
    const params = [];
    if (sourceIds?.length) {
      sql += ` AND id IN (${sourceIds.map(() => '?').join(',')})`;
      params.push(...sourceIds);
    }
    const sources = db.prepare(sql).all(...params);
    summary.sources = sources.length;

    const newJobIds = [];

    for (const source of sources) {
      emit('source_start', { id: source.id, company: source.company, board_type: source.board_type });
      try {
        const adapter = await getAdapter(source.board_type);
        const config = JSON.parse(source.config || '{}');
        const jobs = await adapter.fetch(config, { politeFetch, log: (msg) => emit('log', { source: source.company, msg }) });
        summary.fetched += jobs.length;

        let inserted = 0;
        let filtered = 0;

        const tx = db.transaction(() => {
          for (const job of jobs) {
            const verdict = hardFilter(job, prefs);
            const result = insertJob.run({
              source: source.board_type,
              source_id: source.id,
              external_id: job.external_id,
              company: job.company,
              role: job.role,
              url: job.url,
              location: job.location,
              description: job.description,
              posted_date: job.posted_date,
              hard_filter_result: verdict.reason,
              status: verdict.pass ? 'new' : 'dismissed',
            });
            if (result.changes > 0) {
              if (verdict.pass) {
                inserted++;
                newJobIds.push(Number(result.lastInsertRowid));
              } else {
                filtered++;
              }
            }
          }
        });
        tx();

        summary.inserted += inserted;
        summary.filtered += filtered;

        db.prepare("UPDATE job_sources SET last_run = datetime('now'), last_result = ? WHERE id = ?")
          .run(`ok: ${jobs.length} fetched, ${inserted} new, ${filtered} filtered`, source.id);
        emit('source_done', { id: source.id, company: source.company, fetched: jobs.length, inserted, filtered });
      } catch (err) {
        summary.errors.push({ source: source.company, error: err.message });
        db.prepare("UPDATE job_sources SET last_run = datetime('now'), last_result = ? WHERE id = ?")
          .run(`error: ${err.message}`, source.id);
        emit('source_error', { id: source.id, company: source.company, error: err.message });
      }
    }

    // Stage 2: LLM scoring of newly inserted jobs (if scorer provided)
    if (score && newJobIds.length) {
      await score(newJobIds, emit);
    }

    emit('done', summary);
    return summary;
  } finally {
    running = false;
  }
}
