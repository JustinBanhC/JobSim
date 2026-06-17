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

async function mapFields(fields, profile) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are filling a job application form for a candidate. Given the form fields and the candidate profile, return the value to type into each field you can confidently fill. Skip fields you cannot map (don't include them). Never invent data not in the profile. For yes/no or select fields, the value must EXACTLY match one of the listed options.

CANDIDATE PROFILE (JSON):
${JSON.stringify(profile, null, 2)}

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
      let mappings;
      try {
        mappings = await mapFields(fresh, profile);
      } catch (err) {
        send('log', { msg: `AI mapping failed: ${err.message}` });
        return;
      }

      for (const m of mappings) {
        const field = fresh[m.index];
        if (!field || !m.value) continue;
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
            }, selector, m.value);
          } else if (field.type === 'checkbox' || field.type === 'radio') {
            continue; // too risky to auto-toggle consent boxes — user decides
          } else if (field.type === 'file') {
            send('log', { msg: `File upload "${field.label}" — attach manually: ${profile.resume_path || 'set resume_path in profile'}` });
            continue;
          } else {
            await page.click(selector, { clickCount: 3 }).catch(() => {});
            await page.type(selector, String(m.value), { delay: 25 });
          }
          filledLabels.add(field.label);
          send('filled', { label: field.label, value: String(m.value).slice(0, 80) });
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
