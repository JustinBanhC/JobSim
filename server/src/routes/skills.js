import { Router } from 'express';
import db from '../db.js';

const router = Router();

const VALID_PRIORITY = ['high', 'medium', 'nice'];
const VALID_STATUS = ['not_started', 'in_progress', 'completed', 'paused'];

router.get('/', (_req, res) => {
  const skills = db.prepare('SELECT * FROM skills ORDER BY date_created DESC').all();
  res.json(skills);
});

router.get('/:id', (req, res) => {
  const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Not found' });
  const logs = db.prepare(
    'SELECT * FROM learning_logs WHERE skill_id = ? ORDER BY date_created DESC'
  ).all(req.params.id);
  res.json({ ...skill, learning_logs: logs });
});

router.post('/', (req, res) => {
  const {
    name,
    priority = 'medium',
    current_level,
    target_level,
    status = 'not_started',
    resources,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!VALID_PRIORITY.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const result = db.prepare(`
    INSERT INTO skills (name, priority, current_level, target_level, status, resources)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    priority,
    current_level || null,
    target_level || null,
    status,
    resources || null
  );
  const created = db.prepare('SELECT * FROM skills WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { name, priority, current_level, target_level, status, resources } = req.body;
  if (priority && !VALID_PRIORITY.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority' });
  }
  if (status && !VALID_STATUS.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.prepare(`
    UPDATE skills SET
      name = COALESCE(?, name),
      priority = COALESCE(?, priority),
      current_level = COALESCE(?, current_level),
      target_level = COALESCE(?, target_level),
      status = COALESCE(?, status),
      resources = COALESCE(?, resources)
    WHERE id = ?
  `).run(name, priority, current_level, target_level, status, resources, req.params.id);

  res.json(db.prepare('SELECT * FROM skills WHERE id = ?').get(req.params.id));
});

router.post('/:id/learning-logs', (req, res) => {
  const { topic, time_spent, notes } = req.body;
  if (!topic || !String(topic).trim()) return res.status(400).json({ error: 'Topic is required' });

  const skill = db.prepare('SELECT id FROM skills WHERE id = ?').get(req.params.id);
  if (!skill) return res.status(404).json({ error: 'Not found' });

  const result = db.prepare(`
    INSERT INTO learning_logs (skill_id, topic, time_spent, notes)
    VALUES (?, ?, ?, ?)
  `).run(
    req.params.id,
    topic.trim(),
    time_spent != null ? Number(time_spent) : null,
    notes || null
  );

  const log = db.prepare('SELECT * FROM learning_logs WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(log);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM skills WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

export default router;
