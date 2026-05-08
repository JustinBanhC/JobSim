import { Router } from 'express';
import db from '../db.js';

const router = Router();

const VALID_STATUSES = [
  'researching', 'applied', 'screen_scheduled',
  'interviewing', 'offer', 'rejected', 'ghosted', 'withdrawn'
];

router.get('/', (req, res) => {
  const { status, source, from, to } = req.query;
  let sql = 'SELECT * FROM applications WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (source) {
    sql += ' AND source = ?';
    params.push(source);
  }
  if (from) {
    sql += ' AND date_applied >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND date_applied <= ?';
    params.push(to);
  }

  sql += ' ORDER BY position ASC, date_created DESC';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', (req, res) => {
  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });

  const activity = db.prepare(
    'SELECT * FROM application_activity WHERE application_id = ? ORDER BY date_created DESC'
  ).all(req.params.id);

  res.json({ ...app, activity });
});

router.post('/', (req, res) => {
  const { company, role, status = 'researching', source, url, salary_range, location, notes, date_applied } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'Company and role are required' });
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as next FROM applications WHERE status = ?').get(status);

  const result = db.prepare(`
    INSERT INTO applications (company, role, status, source, url, salary_range, location, notes, date_applied, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(company, role, status, source || null, url || null, salary_range || null, location || null, notes || null, date_applied || null, maxPos.next);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);

  db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)').run(
    app.id, 'created', `Added ${company} - ${role}`
  );

  res.status(201).json(app);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { company, role, status, source, url, salary_range, location, notes, date_applied } = req.body;
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare(`
    UPDATE applications SET
      company = COALESCE(?, company),
      role = COALESCE(?, role),
      status = COALESCE(?, status),
      source = COALESCE(?, source),
      url = COALESCE(?, url),
      salary_range = COALESCE(?, salary_range),
      location = COALESCE(?, location),
      notes = COALESCE(?, notes),
      date_applied = COALESCE(?, date_applied),
      date_updated = datetime('now')
    WHERE id = ?
  `).run(company, role, status, source, url, salary_range, location, notes, date_applied, req.params.id);

  if (status && status !== existing.status) {
    db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)').run(
      req.params.id, 'status_change', `Moved from ${existing.status} to ${status}`
    );
  }

  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
});

router.put('/:id/move', (req, res) => {
  const { status, position } = req.body;
  if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const reorder = db.transaction(() => {
    if (existing.status !== status) {
      db.prepare('UPDATE applications SET position = position - 1 WHERE status = ? AND position > ?')
        .run(existing.status, existing.position);
      db.prepare('UPDATE applications SET position = position + 1 WHERE status = ? AND position >= ?')
        .run(status, position);
    } else {
      if (position < existing.position) {
        db.prepare('UPDATE applications SET position = position + 1 WHERE status = ? AND position >= ? AND position < ?')
          .run(status, position, existing.position);
      } else if (position > existing.position) {
        db.prepare('UPDATE applications SET position = position - 1 WHERE status = ? AND position > ? AND position <= ?')
          .run(status, existing.position, position);
      }
    }

    db.prepare('UPDATE applications SET status = ?, position = ?, date_updated = datetime(\'now\') WHERE id = ?')
      .run(status, position, req.params.id);

    if (existing.status !== status) {
      db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)').run(
        req.params.id, 'status_change', `Moved from ${existing.status} to ${status}`
      );
    }
  });

  reorder();
  res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id));
});

router.post('/:id/activity', (req, res) => {
  const { type, note } = req.body;
  if (!type || !note) return res.status(400).json({ error: 'Type and note are required' });

  const app = db.prepare('SELECT id FROM applications WHERE id = ?').get(req.params.id);
  if (!app) return res.status(404).json({ error: 'Not found' });

  db.prepare('UPDATE applications SET date_updated = datetime(\'now\') WHERE id = ?').run(req.params.id);

  const result = db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)')
    .run(req.params.id, type, note);

  res.status(201).json(db.prepare('SELECT * FROM application_activity WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
