import { Router } from 'express';
import db from '../db.js';
import { runIngestion, isRunning, seedSourcesIfEmpty } from '../discovery/engine.js';
import { scoreJobs } from '../discovery/scorer.js';
import { loadPrefs, savePrefs } from '../discovery/prefs.js';

const router = Router();

seedSourcesIfEmpty();

// ---- Jobs feed ----

router.get('/jobs', (req, res) => {
  const { status, source, min_score, q } = req.query;
  let sql = 'SELECT * FROM discovered_jobs WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  } else {
    sql += " AND status != 'dismissed'";
  }
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  if (min_score) {
    sql += ' AND score >= ?';
    params.push(Number(min_score));
  }
  if (q) {
    sql += ' AND (company LIKE ? OR role LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY score DESC NULLS LAST, date_discovered DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.post('/jobs/:id/promote', (req, res) => {
  const job = db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  if (job.application_id) return res.status(409).json({ error: 'Already promoted' });

  const tx = db.transaction(() => {
    const maxPos = db.prepare(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next FROM applications WHERE status = 'researching'"
    ).get();

    const result = db.prepare(`
      INSERT INTO applications (company, role, status, source, url, location, notes, position)
      VALUES (?, ?, 'researching', ?, ?, ?, ?, ?)
    `).run(
      job.company,
      job.role,
      'Other',
      job.url,
      job.location,
      job.score ? `Discovered via ${job.source}. AI score: ${job.score}/100. ${JSON.parse(job.score_reasons || '[]').join(' ')}` : `Discovered via ${job.source}.`,
      maxPos.next
    );

    const appId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)')
      .run(appId, 'created', `Promoted from discovery feed (score: ${job.score ?? 'unscored'})`);
    db.prepare("UPDATE discovered_jobs SET status = 'promoted', application_id = ? WHERE id = ?")
      .run(appId, job.id);
    return appId;
  });

  const applicationId = tx();
  res.status(201).json({ application_id: applicationId, job: db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(job.id) });
});

router.post('/jobs/:id/dismiss', (req, res) => {
  const result = db.prepare("UPDATE discovered_jobs SET status = 'dismissed' WHERE id = ? AND status != 'promoted'").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found or already promoted' });
  res.json({ ok: true });
});

router.post('/jobs/:id/restore', (req, res) => {
  const job = db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Not found' });
  const status = job.score != null ? 'scored' : 'new';
  db.prepare('UPDATE discovered_jobs SET status = ? WHERE id = ?').run(status, job.id);
  res.json({ ok: true });
});

// ---- Run pipeline (SSE) ----

router.post('/run', async (req, res) => {
  if (isRunning()) return res.status(409).json({ error: 'Ingestion already running' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const sourceIds = req.body?.source_ids || null;
    await runIngestion({
      sourceIds,
      emit: send,
      score: (jobIds, emit) => scoreJobs(jobIds, emit),
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
});

// Re-score jobs. Default: only jobs still unscored (e.g. scoring failed mid-run).
// With { all: true }: reset scores on every non-dismissed, non-promoted job and
// rescore the lot (use after changing search prefs).
router.post('/rescore', async (req, res) => {
  if (req.body?.all) {
    db.prepare(
      "UPDATE discovered_jobs SET score = NULL, score_reasons = NULL, status = 'new' WHERE status IN ('new', 'scored')"
    ).run();
  }
  const unscored = db.prepare("SELECT id FROM discovered_jobs WHERE status = 'new'").all().map((r) => r.id);
  if (!unscored.length) return res.json({ scored: 0, failed: 0 });
  const result = await scoreJobs(unscored);
  res.json(result);
});

// ---- Search preferences (target roles / scoring prefs) ----

router.get('/prefs', (_req, res) => {
  res.json(loadPrefs());
});

router.put('/prefs', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a prefs object' });
  }
  res.json(savePrefs(req.body));
});

// ---- Sources CRUD ----

router.get('/sources', (_req, res) => {
  res.json(db.prepare('SELECT * FROM job_sources ORDER BY company').all());
});

router.post('/sources', (req, res) => {
  const { company, board_type, config = {} } = req.body;
  if (!company || !board_type) return res.status(400).json({ error: 'company and board_type are required' });
  const valid = ['greenhouse', 'lever', 'ashby', 'workday', 'github', 'puppeteer'];
  if (!valid.includes(board_type)) return res.status(400).json({ error: `board_type must be one of: ${valid.join(', ')}` });

  const result = db.prepare('INSERT INTO job_sources (company, board_type, config) VALUES (?, ?, ?)')
    .run(company, board_type, JSON.stringify(config));
  res.status(201).json(db.prepare('SELECT * FROM job_sources WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/sources/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM job_sources WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { company, board_type, config, enabled } = req.body;
  db.prepare(`
    UPDATE job_sources SET
      company = COALESCE(?, company),
      board_type = COALESCE(?, board_type),
      config = COALESCE(?, config),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(
    company ?? null,
    board_type ?? null,
    config !== undefined ? JSON.stringify(config) : null,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM job_sources WHERE id = ?').get(req.params.id));
});

router.delete('/sources/:id', (req, res) => {
  const result = db.prepare('DELETE FROM job_sources WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
