import { GoogleGenAI } from '@google/genai';
import db from '../db.js';

const BATCH_SIZE = 9;

const RUBRIC = `You are a job-fit judge for a specific candidate. Score each job 1-100 for relevance.

CANDIDATE PROFILE:
- Dual degree in Electrical Engineering and Computer Engineering
- Seeking INTERNSHIPS first, new-grad roles second
- HOLDS an active security clearance — clearance-required roles are a PLUS (+5), never a negative
- Target A (90+ band): foundational AI research — reinforcement learning, NLP, algorithm architecture, ML systems
- Target B (80-95 band): deep technical development — Python, C, embedded systems, microcontrollers, Verilog/FPGA, KiCAD/PCB design, Docker/infrastructure
- HIGH PRIORITY FLAG: roles in human-centered design or assistive technology — score these 85+ and mention the flag in reasons
- PENALIZE heavily (<30): generic IT support, helpdesk, pure QA/manual testing, non-technical roles
- PENALIZE (<50): pure frontend/web-only roles, roles needing 5+ years experience, management roles

SCORING BANDS:
90-100: dream fit (AI research intern, embedded/silicon intern at strong company, assistive tech)
75-89: strong fit (SWE intern with systems flavor, hardware-adjacent, cleared engineering roles)
50-74: plausible (general SWE intern, data engineering)
25-49: weak (web-only, wrong seniority)
1-24: wrong (IT support, non-technical)

Return ONLY a JSON array. For each job: {"id": <id>, "score": <1-100>, "reasons": ["<short reason>", ...]} with 1-3 concise reasons each.`;

const responseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      score: { type: 'integer' },
      reasons: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'score', 'reasons'],
  },
};

function jobToPromptLine(job) {
  const desc = job.description ? job.description.slice(0, 1500) : '(no description available — judge from title/company)';
  return `JOB id=${job.id}\nCompany: ${job.company}\nTitle: ${job.role}\nLocation: ${job.location || 'unknown'}\nHard-filter notes: ${job.hard_filter_result || 'none'}\nDescription: ${desc}`;
}

async function scoreBatch(ai, jobs) {
  const prompt = `${RUBRIC}\n\nJOBS TO SCORE:\n\n${jobs.map(jobToPromptLine).join('\n\n---\n\n')}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema,
        },
      });
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  return [];
}

const updateScore = db.prepare(
  "UPDATE discovered_jobs SET score = ?, score_reasons = ?, status = 'scored' WHERE id = ? AND status = 'new'"
);

/**
 * Score discovered jobs by id. Emits score_progress events. Failures never throw —
 * unscored jobs stay status 'new' and can be re-scored later.
 */
export async function scoreJobs(jobIds, emit = () => {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    emit('log', { msg: 'GEMINI_API_KEY not set — skipping scoring' });
    return { scored: 0, failed: jobIds.length };
  }

  const ai = new GoogleGenAI({ apiKey });
  const placeholders = jobIds.map(() => '?').join(',');
  const jobs = db.prepare(`SELECT * FROM discovered_jobs WHERE id IN (${placeholders}) AND status = 'new'`).all(...jobIds);

  let scored = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreBatch(ai, batch);
      const byId = new Map(results.map((r) => [r.id, r]));
      for (const job of batch) {
        const r = byId.get(job.id);
        if (r && r.score >= 1 && r.score <= 100) {
          updateScore.run(r.score, JSON.stringify(r.reasons || []), job.id);
          scored++;
        } else {
          failed++;
        }
      }
    } catch (err) {
      failed += batch.length;
      emit('log', { msg: `Scoring batch failed: ${err.message}` });
    }
    emit('score_progress', { done: Math.min(i + BATCH_SIZE, jobs.length), total: jobs.length, scored, failed });
  }

  return { scored, failed };
}
