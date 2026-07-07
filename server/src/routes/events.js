import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_SOURCES,
  defaultKeywords,
  buildScanQueries,
  buildSearchLinks,
  sourceFromUrl,
  normalizeExtractedEvent,
  rawItemToEvent,
  EXTRACTION_PROMPT,
  extractionResponseSchema,
} from '../events/parse.js';

const router = Router();

// ── CRUD ──

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM events';
  const params = [];
  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }
  // Soonest first, unknown dates last, newest discoveries first within each group.
  sql += ' ORDER BY (event_date IS NULL) ASC, event_date ASC, date_discovered DESC';
  res.json(db.prepare(sql).all(...params));
});

router.post('/', (req, res) => {
  const { title, host, event_type = 'other', url, source = 'manual', location, is_virtual, event_date, description, notes } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });
  if (!EVENT_TYPES.includes(event_type)) return res.status(400).json({ error: 'Invalid event_type' });
  if (!EVENT_SOURCES.includes(source)) return res.status(400).json({ error: 'Invalid source' });

  if (url) {
    const existing = db.prepare('SELECT id FROM events WHERE url = ?').get(url);
    if (existing) return res.status(409).json({ error: 'An event with this URL already exists' });
  }

  const result = db.prepare(`
    INSERT INTO events (title, host, event_type, url, source, location, is_virtual, event_date, description, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title, host || null, event_type, url || null, source, location || null,
    is_virtual == null ? null : (is_virtual ? 1 : 0), event_date || null, description || null, notes || null
  );
  res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const { title, host, event_type, url, source, location, is_virtual, event_date, description, status, notes } = req.body;
  if (status && !EVENT_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  if (event_type && !EVENT_TYPES.includes(event_type)) return res.status(400).json({ error: 'Invalid event_type' });

  db.prepare(`
    UPDATE events SET
      title = COALESCE(?, title),
      host = COALESCE(?, host),
      event_type = COALESCE(?, event_type),
      url = COALESCE(?, url),
      source = COALESCE(?, source),
      location = COALESCE(?, location),
      is_virtual = COALESCE(?, is_virtual),
      event_date = COALESCE(?, event_date),
      description = COALESCE(?, description),
      status = COALESCE(?, status),
      notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(
    title ?? null, host ?? null, event_type ?? null, url ?? null, source ?? null,
    location ?? null, is_virtual == null ? null : (is_virtual ? 1 : 0), event_date ?? null,
    description ?? null, status ?? null, notes ?? null, req.params.id
  );
  res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM events WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
});

// ── One-click public search links (always available — zero API keys needed) ──

router.get('/search-links', (req, res) => {
  const q = (req.query.q || '').trim() || defaultKeywords()[0];
  res.json({ query: q, links: buildSearchLinks(q) });
});

// ── Scan (SSE): CSE X-ray of public results → Gemini extraction → upsert ──

async function cseSearch(query) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx = process.env.GOOGLE_CSE_ID;
  if (!key || !cx) return null; // keyless mode

  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!resp.ok) throw new Error(`Google CSE: HTTP ${resp.status}`);
  const data = await resp.json();
  return data.items || [];
}

const EXTRACT_BATCH = 10;

// Extract normalized events from raw CSE items. Per-batch failures fall back to
// unscored raw rows so a single Gemini hiccup never loses results.
async function extractEvents(items, emit = () => {}) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const out = [];
  for (let i = 0; i < items.length; i += EXTRACT_BATCH) {
    const batch = items.slice(i, i + EXTRACT_BATCH);
    const lines = batch
      .map((it, idx) => `RESULT id=${idx}\nTitle: ${it.title || ''}\nSnippet: ${it.snippet || ''}\nURL: ${it.link}`)
      .join('\n\n');
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: `${EXTRACTION_PROMPT}\n\nSEARCH RESULTS:\n\n${lines}` }] }],
        config: { responseMimeType: 'application/json', responseSchema: extractionResponseSchema },
      });
      const parsed = JSON.parse(response.candidates?.[0]?.content?.parts?.[0]?.text || '[]');
      if (!Array.isArray(parsed)) throw new Error('Unexpected response shape');
      for (const r of parsed) {
        const ev = normalizeExtractedEvent(r, batch[r.id]);
        if (ev) out.push(ev);
      }
    } catch (err) {
      emit('log', { msg: `Gemini extraction batch failed (${err.message}) — keeping raw results unscored` });
      for (const it of batch) {
        const ev = rawItemToEvent(it);
        if (ev) out.push(ev);
      }
    }
    emit('extract_progress', { done: Math.min(i + EXTRACT_BATCH, items.length), total: items.length });
  }
  return out;
}

const insertEvent = db.prepare(`
  INSERT OR IGNORE INTO events (title, host, event_type, url, source, location, is_virtual, event_date, description, score, score_reasons, status)
  VALUES (@title, @host, @event_type, @url, @source, @location, @is_virtual, @event_date, @description, @score, @score_reasons, 'new')
`);

router.post('/scan', async (req, res) => {
  const { keywords: rawKeywords, location } = req.body || {};
  const cleaned = Array.isArray(rawKeywords) ? rawKeywords.map((k) => String(k).trim()).filter(Boolean) : [];
  const keywords = cleaned.length ? cleaned : defaultKeywords();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  // Always emit the manual search links first — works with zero API keys.
  const linkQuery = [keywords[0], location].filter(Boolean).join(' ');
  send('links', { query: linkQuery, links: buildSearchLinks(linkQuery) });

  if (!process.env.GOOGLE_CSE_KEY || !process.env.GOOGLE_CSE_ID) {
    send('log', { msg: 'Google CSE keys not set — keyless mode. Use the manual search links above.' });
    send('done', { found: 0, saved: 0 });
    return res.end();
  }

  // 1. CSE X-ray across LinkedIn events/posts, Instagram, Eventbrite, Luma (public results only).
  const queries = buildScanQueries(keywords, location);
  const seen = new Map(); // url → raw item
  let qi = 0;
  for (const { q } of queries) {
    qi++;
    send('progress', { done: qi, total: queries.length, query: q });
    try {
      const items = await cseSearch(q);
      for (const item of items || []) {
        if (item.link && !seen.has(item.link)) seen.set(item.link, item);
      }
    } catch (err) {
      send('log', { msg: `Query failed: ${err.message}` });
    }
  }

  // Skip URLs we already track (keeps Gemini tokens for genuinely new results).
  const hasUrl = db.prepare('SELECT id FROM events WHERE url = ?');
  const rawItems = [...seen.values()].filter((item) => !hasUrl.get(item.link));
  send('log', { msg: `${seen.size} public results found, ${rawItems.length} new` });

  // 2. Gemini extraction (or raw unscored fallback when the key is missing).
  let extracted = [];
  if (rawItems.length) {
    if (!process.env.GEMINI_API_KEY) {
      send('log', { msg: 'GEMINI_API_KEY not set — saving raw results unscored (title/snippet only)' });
      extracted = rawItems.map(rawItemToEvent);
    } else {
      extracted = await extractEvents(rawItems, send);
    }
  }

  // 3. Upsert by url — INSERT OR IGNORE keeps existing rows untouched.
  let saved = 0;
  for (const ev of extracted) {
    if (!ev) continue;
    const result = insertEvent.run(ev);
    if (result.changes > 0) {
      saved++;
      send('event', {
        id: Number(result.lastInsertRowid),
        title: ev.title,
        event_type: ev.event_type,
        source: ev.source,
        event_date: ev.event_date,
        score: ev.score,
      });
    }
  }

  send('done', { found: seen.size, saved });
  res.end();
});

export default router;
export { cseSearch, extractEvents, sourceFromUrl };
