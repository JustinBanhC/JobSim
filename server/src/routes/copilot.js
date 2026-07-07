import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';

const router = Router();

// ---- Profile vault ----

router.get('/profile', (_req, res) => {
  const row = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  res.json(row ? JSON.parse(row.data) : {});
});

router.put('/profile', (req, res) => {
  const data = JSON.stringify(req.body || {});
  db.prepare(`
    INSERT INTO profile (id, data, date_updated) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, date_updated = datetime('now')
  `).run(data);
  res.json(JSON.parse(data));
});

// ---- Field → profile mapping via Gemini ----

const mappingSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      index: { type: 'integer' },
      value: { type: 'string' },
    },
    required: ['index', 'value'],
  },
};

async function mapFields(fields, profile, approvedAnswers = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });

  const approvedBlock = approvedAnswers.length
    ? `\nUSER-APPROVED ANSWERS (authoritative — when a form field asks for one of these, use this exact answer instead of deriving from the profile):\n${approvedAnswers.map((a) => `- ${a.label}: ${a.value}`).join('\n')}\n`
    : '';

  const prompt = `You are filling a job application form for a candidate. Given the form fields and the candidate profile, return the value to type into each field you can confidently fill. Skip fields you cannot map (don't include them). Never invent data not in the profile. For yes/no or select fields, the value must EXACTLY match one of the listed options.

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}
${approvedBlock}
FORM FIELDS (index, type, label, options):
${fields.map((f, i) => `${i}. [${f.type}] "${f.label}"${f.options?.length ? ` options: ${f.options.join(' / ')}` : ''}`).join('\n')}

Return a JSON array of {index, value}.`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: { responseMimeType: 'application/json', responseSchema: mappingSchema },
  });
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text || '[]');
}

// ---- Saved per-job answers (see routes/workday.js) ----
// Stored as [{key, label, value}]. Exact/close label matches are filled
// directly (no LLM); the rest are passed to the AI as authoritative context.

const normalizeLabel = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function loadApprovedAnswers(jobId) {
  try {
    const row = db.prepare('SELECT data FROM application_answers WHERE job_id = ?').get(jobId);
    const parsed = row ? JSON.parse(row.data) : [];
    return (Array.isArray(parsed) ? parsed : []).filter((a) => a && a.label && a.value);
  } catch {
    return [];
  }
}

function matchApprovedAnswer(fieldLabel, approved) {
  const fl = normalizeLabel(fieldLabel);
  if (!fl) return null;
  let close = null;
  for (const a of approved) {
    const al = normalizeLabel(a.label);
    if (!al) continue;
    if (al === fl) return a; // exact
    if (!close && Math.min(al.length, fl.length) >= 5 && (fl.includes(al) || al.includes(fl))) close = a;
  }
  return close;
}

// ---- Browser session (one at a time, headed, never submits) ----

let activeSession = false;

const SCAN_SCRIPT = () => {
  const isVisible = (el) => {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const labelFor = (el) => {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    return el.getAttribute('aria-label') || el.placeholder || el.name || '';
  };
  const fields = [];
  const els = document.querySelectorAll('input, textarea, select');
  els.forEach((el, idx) => {
    if (!isVisible(el)) return;
    const type = el.tagName === 'SELECT' ? 'select' : el.tagName === 'TEXTAREA' ? 'textarea' : (el.type || 'text');
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) return;
    if (el.value && type !== 'checkbox' && type !== 'radio') return; // already filled — leave user edits alone
    const label = labelFor(el).slice(0, 200);
    if (!label) return;
    el.setAttribute('data-copilot-idx', String(idx));
    fields.push({
      idx,
      type,
      label,
      options: el.tagName === 'SELECT' ? [...el.options].map((o) => o.textContent.trim()).filter(Boolean).slice(0, 30) : undefined,
    });
  });
  return fields;
};

router.post('/apply/:jobId', async (req, res) => {
  if (activeSession) return res.status(409).json({ error: 'A co-pilot session is already open. Close that browser window first.' });

  const job = db.prepare('SELECT * FROM discovered_jobs WHERE id = ?').get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const profileRow = db.prepare('SELECT data FROM profile WHERE id = 1').get();
  const profile = profileRow ? JSON.parse(profileRow.data) : null;
  if (!profile || !Object.keys(profile).length) {
    return res.status(400).json({ error: 'Profile vault is empty. Fill in your profile first.' });
  }

  // User-approved answers saved from the Workday preview panel — authoritative over raw profile data.
  const approvedAnswers = loadApprovedAnswers(job.id);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  activeSession = true;
  let browser;

  try {
    const { default: puppeteer } = await import('puppeteer');
    send('log', { msg: 'Launching browser — log in / navigate to the application form. I will fill fields as they appear. YOU click submit.' });

    browser = await puppeteer.launch({ headless: false, defaultViewport: null, args: ['--start-maximized'] });
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    send('log', { msg: `Opened ${job.url}` });

    const filledLabels = new Set();

    const fillPass = async () => {
      let fields;
      try {
        fields = await page.evaluate(SCAN_SCRIPT);
      } catch {
        return; // mid-navigation — next pass will catch it
      }
      const fresh = fields.filter((f) => !filledLabels.has(f.label));
      if (!fresh.length) return;

      send('fields_found', { count: fresh.length, labels: fresh.map((f) => f.label).slice(0, 20) });

      // Saved answers with an exact/close label match are used directly — no LLM.
      const toFill = [];
      const needAI = [];
      for (const f of fresh) {
        const hit = approvedAnswers.length ? matchApprovedAnswer(f.label, approvedAnswers) : null;
        if (hit && (f.type !== 'select' || !f.options || f.options.includes(hit.value))) {
          toFill.push({ field: f, value: hit.value, saved: true });
        } else {
          needAI.push(f);
        }
      }
      if (toFill.length) send('log', { msg: `Using ${toFill.length} saved answer(s) directly (no AI).` });

      if (needAI.length) {
        let mappings = [];
        try {
          mappings = await mapFields(needAI, profile, approvedAnswers);
        } catch (err) {
          send('log', { msg: `AI mapping failed: ${err.message}` });
        }
        for (const m of mappings) {
          const field = needAI[m.index];
          if (field && m.value) toFill.push({ field, value: m.value });
        }
      }

      for (const { field, value, saved } of toFill) {
        if (!field || !value) continue;
        const selector = `[data-copilot-idx="${field.idx}"]`;
        try {
          if (field.type === 'select') {
            await page.evaluate((sel, val) => {
              const el = document.querySelector(sel);
              const opt = [...el.options].find((o) => o.textContent.trim() === val);
              if (opt) {
                el.value = opt.value;
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }, selector, value);
          } else if (field.type === 'checkbox' || field.type === 'radio') {
            continue; // too risky to auto-toggle consent boxes — user decides
          } else if (field.type === 'file') {
            send('log', { msg: `File upload "${field.label}" — attach manually: ${profile.resume_path || 'set resume_path in profile'}` });
            continue;
          } else {
            await page.click(selector, { clickCount: 3 }).catch(() => {});
            await page.type(selector, String(value), { delay: 25 });
          }
          filledLabels.add(field.label);
          send('filled', { label: field.label, value: String(value).slice(0, 80), ...(saved ? { source: 'saved' } : {}) });
        } catch (err) {
          send('log', { msg: `Could not fill "${field.label}": ${err.message.split('\n')[0]}` });
        }
      }
      send('log', { msg: 'Pass complete. Review the values, fix anything, and click submit yourself.' });
    };

    await new Promise((r) => setTimeout(r, 2500));
    await fillPass();

    // Re-scan on navigation (multi-step forms) and every 8s (dynamically revealed fields),
    // until the user closes the browser or the client disconnects.
    let closed = false;
    browser.on('disconnected', () => { closed = true; });
    req.on('close', () => {
      // Client gave up (tab closed, abort clicked) — don't leave an orphaned browser.
      if (!closed) browser.close().catch(() => {});
    });
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame() && !closed) {
        send('log', { msg: `Navigated to ${frame.url().slice(0, 100)} — rescanning…` });
        await new Promise((r) => setTimeout(r, 2000));
        await fillPass().catch(() => {});
      }
    });

    const deadline = Date.now() + 15 * 60 * 1000;
    while (!closed && Date.now() < deadline && !res.writableEnded) {
      await new Promise((r) => setTimeout(r, 8000));
      if (!closed) await fillPass().catch(() => {});
    }

    send('done', { msg: closed ? 'Browser closed — session ended.' : 'Session timed out (15 min).' });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    activeSession = false;
    try { if (browser?.connected) await browser.close(); } catch { /* user already closed it */ }
    res.end();
  }
});

export default router;
