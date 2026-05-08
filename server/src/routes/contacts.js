import { Router } from 'express';
import db from '../db.js';

const router = Router();

const VALID_STATUS = ['not_contacted', 'reached_out', 'responded', 'call_scheduled', 'connected'];

function parseTags(raw) {
  try {
    const t = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(t) ? t : [];
  } catch {
    return [];
  }
}

function row(c) {
  if (!c) return c;
  return { ...c, tags: parseTags(c.tags) };
}

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM contacts ORDER BY date_updated DESC').all();
  res.json(rows.map(row));
});

router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const interactions = db.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY date_created DESC'
  ).all(req.params.id);
  res.json({ ...row(c), interactions });
});

router.post('/', (req, res) => {
  const {
    name,
    title,
    company,
    email,
    linkedin_url,
    how_connected,
    notes,
    outreach_status = 'not_contacted',
    tags = [],
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!VALID_STATUS.includes(outreach_status)) {
    return res.status(400).json({ error: 'Invalid outreach status' });
  }
  const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
  const result = db.prepare(`
    INSERT INTO contacts (name, title, company, email, linkedin_url, how_connected, notes, outreach_status, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    name,
    title || null,
    company || null,
    email || null,
    linkedin_url || null,
    how_connected || null,
    notes || null,
    outreach_status,
    tagsJson
  );
  const created = db.prepare('SELECT * FROM contacts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row(created));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const {
    name,
    title,
    company,
    email,
    linkedin_url,
    how_connected,
    notes,
    outreach_status,
    tags,
  } = req.body;

  if (outreach_status && !VALID_STATUS.includes(outreach_status)) {
    return res.status(400).json({ error: 'Invalid outreach status' });
  }

  const tagsJson = tags !== undefined
    ? JSON.stringify(Array.isArray(tags) ? tags : parseTags(tags))
    : existing.tags;

  db.prepare(`
    UPDATE contacts SET
      name = COALESCE(?, name),
      title = COALESCE(?, title),
      company = COALESCE(?, company),
      email = COALESCE(?, email),
      linkedin_url = COALESCE(?, linkedin_url),
      how_connected = COALESCE(?, how_connected),
      notes = COALESCE(?, notes),
      outreach_status = COALESCE(?, outreach_status),
      tags = COALESCE(?, tags),
      date_updated = datetime('now')
    WHERE id = ?
  `).run(
    name ?? null,
    title ?? null,
    company ?? null,
    email ?? null,
    linkedin_url ?? null,
    how_connected ?? null,
    notes ?? null,
    outreach_status ?? null,
    tagsJson,
    req.params.id
  );

  res.json(row(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id)));
});

router.post('/:id/interactions', (req, res) => {
  const { note } = req.body;
  if (!note || !String(note).trim()) return res.status(400).json({ error: 'Note is required' });

  const c = db.prepare('SELECT id FROM contacts WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });

  const result = db.prepare(
    'INSERT INTO interactions (contact_id, note) VALUES (?, ?)'
  ).run(req.params.id, note.trim());

  db.prepare('UPDATE contacts SET date_updated = datetime(\'now\') WHERE id = ?').run(req.params.id);

  const interaction = db.prepare('SELECT * FROM interactions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(interaction);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
