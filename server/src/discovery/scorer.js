import { GoogleGenAI } from '@google/genai';
import db from '../db.js';
import { loadPrefs } from './prefs.js';

const BATCH_SIZE = 9;

const SENIORITY_LABELS = {
  intern: 'internships',
  new_grad: 'new-grad / entry-level roles',
  junior: 'junior roles',
  mid: 'mid-level roles',
  senior: 'senior roles',
};

/** Build the AI judge rubric from the user's search prefs. */
export function buildRubric(prefs) {
  const lines = [];

  const seniority = prefs.seniority?.length ? prefs.seniority : ['intern'];
  const labels = seniority.map((s) => SENIORITY_LABELS[s] || s);
  let seeking = `Seeking ${labels[0].toUpperCase()} first`;
  if (labels[1]) seeking += `, ${labels[1]} second`;
  if (labels.length > 2) seeking += ` (also open to: ${labels.slice(2).join(', ')})`;
  lines.push(`- ${seeking}`);

  if (prefs.has_clearance) {
    lines.push('- HOLDS an active security clearance — clearance-required roles are a PLUS (+5), never a negative');
  } else {
    lines.push('- Does NOT hold a security clearance — roles requiring an active clearance are a significant NEGATIVE (subtract 15-30)');
  }

  prefs.target_roles?.forEach((role, i) => {
    const letter = String.fromCharCode(65 + i);
    const band = role.band ? ` (${role.band} band)` : '';
    lines.push(`- Target ${letter}${band}: ${role.description}`);
  });

  if (prefs.priority_flags?.trim()) {
    lines.push(`- HIGH PRIORITY FLAG: roles in ${prefs.priority_flags.trim()} — score these 85+ and mention the flag in reasons`);
  }

  if (prefs.boost_keywords?.length) {
    lines.push(`- BONUS: nudge scores up for roles mentioning: ${prefs.boost_keywords.join(', ')}`);
  }

  if (prefs.discard_title_keywords?.length) {
    lines.push(`- PENALIZE heavily (<30): non-technical and off-target roles, e.g. ${prefs.discard_title_keywords.join(', ')}`);
  }

  const penalties = [...(prefs.avoid_keywords || [])];
  if (prefs.max_experience_years != null) {
    penalties.push(`roles needing ${prefs.max_experience_years}+ years experience`);
  }
  const excluded = Object.keys(SENIORITY_LABELS).filter((s) => !seniority.includes(s));
  if (excluded.length) {
    penalties.push(`wrong seniority (${excluded.map((s) => SENIORITY_LABELS[s] || s).join(', ')})`);
  }
  penalties.push('management roles');
  lines.push(`- PENALIZE (<50): ${penalties.join(', ')}`);

  const topTargets = prefs.target_roles?.length
    ? prefs.target_roles.map((r) => r.description).join('; ')
    : 'the target roles';
  const dreamExtras = prefs.priority_flags?.trim() ? `, or ${prefs.priority_flags.trim()}` : '';
  const strongExtras = prefs.has_clearance ? ', cleared engineering roles' : '';

  let rubric = `You are a job-fit judge for a specific candidate. Score each job 1-100 for relevance.

CANDIDATE PROFILE:
${lines.join('\n')}

SCORING BANDS:
90-100: dream fit (direct hit on the top target roles${dreamExtras})
75-89: strong fit (adjacent to the targets: ${topTargets}${strongExtras})
50-74: plausible (related technical work at an acceptable seniority)
25-49: weak (off-target focus or wrong seniority)
1-24: wrong (penalized categories, non-technical)`;

  if (prefs.extra_instructions?.trim()) {
    rubric += `\n\nADDITIONAL INSTRUCTIONS FROM THE CANDIDATE:\n${prefs.extra_instructions.trim()}`;
  }

  rubric += '\n\nReturn ONLY a JSON array. For each job: {"id": <id>, "score": <1-100>, "reasons": ["<short reason>", ...]} with 1-3 concise reasons each.';
  return rubric;
}

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

async function scoreBatch(ai, jobs, rubric) {
  const prompt = `${rubric}\n\nJOBS TO SCORE:\n\n${jobs.map(jobToPromptLine).join('\n\n---\n\n')}`;

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
  const rubric = buildRubric(loadPrefs());
  const placeholders = jobIds.map(() => '?').join(',');
  const jobs = db.prepare(`SELECT * FROM discovered_jobs WHERE id IN (${placeholders}) AND status = 'new'`).all(...jobIds);

  let scored = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreBatch(ai, batch, rubric);
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
