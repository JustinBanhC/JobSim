// Search preferences: the user-editable candidate targeting used by the
// discovery pipeline (hard filter + AI scoring rubric). Stored as a single
// JSON row in the search_prefs table; DEFAULT_PREFS reproduces the behavior
// that used to be hardcoded (EE/CE dual-degree intern holding a clearance)
// so nothing regresses until the user edits prefs.

import db from '../db.js';

export const SENIORITY_LEVELS = ['intern', 'new_grad', 'junior', 'mid', 'senior'];

export const DEFAULT_PREFS = {
  // Free-text role targets, in priority order. `band` is an optional score
  // band hint shown to the AI judge (e.g. "90+", "80-95").
  target_roles: [
    {
      description:
        'Foundational AI research — reinforcement learning, NLP, algorithm architecture, ML systems',
      band: '90+',
    },
    {
      description:
        'Deep technical development — Python, C, embedded systems, microcontrollers, Verilog/FPGA, KiCAD/PCB design, Docker/infrastructure',
      band: '80-95',
    },
  ],
  // Accepted seniority levels, in priority order (first = most wanted).
  // Levels above `senior` (staff/principal/director/VP) are always discarded.
  seniority: ['intern', 'new_grad', 'junior', 'mid'],
  // Keywords that nudge a job up / down at the hard-filter stage and in the
  // AI rubric. Matched case-insensitively as whole words/phrases.
  boost_keywords: [],
  avoid_keywords: ['pure frontend / web-only', 'pure QA / manual testing'],
  // Title keywords that discard a job outright before any LLM call.
  discard_title_keywords: [
    'IT support',
    'desktop support',
    'help desk',
    'helpdesk',
    'service desk',
    'technical support',
    'sales executive',
    'sales manager',
    'sales representative',
    'sales development',
    'account executive',
    'account manager',
    'account representative',
    'account development',
    'recruiter',
    'talent acquisition',
    'human resources',
    'marketing',
    'legal',
    'finance',
    'accounting',
    'payroll',
  ],
  // Discard jobs whose description demands this many or more years of experience.
  max_experience_years: 7,
  // When true, clearance-required roles are a boost (candidate holds one);
  // when false they become an avoid signal.
  has_clearance: true,
  // Free-text special interests the AI judge should flag and score highly.
  priority_flags: 'human-centered design / assistive technology',
  // Free text appended verbatim to the AI judge rubric.
  extra_instructions: '',
};

/** Coerce arbitrary stored/user JSON into a well-formed prefs object. */
export function normalizePrefs(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};

  const strArray = (v, fallback) =>
    Array.isArray(v) ? v.map((s) => String(s).trim()).filter(Boolean) : fallback;

  const target_roles = Array.isArray(src.target_roles)
    ? src.target_roles
        .map((r) => ({
          description: String(r?.description ?? '').trim(),
          band: String(r?.band ?? '').trim(),
        }))
        .filter((r) => r.description)
    : DEFAULT_PREFS.target_roles.map((r) => ({ ...r }));

  const seniority = Array.isArray(src.seniority)
    ? src.seniority.filter((s) => SENIORITY_LEVELS.includes(s))
    : [...DEFAULT_PREFS.seniority];

  const maxYears = Number(src.max_experience_years);

  return {
    target_roles,
    seniority,
    boost_keywords: strArray(src.boost_keywords, [...DEFAULT_PREFS.boost_keywords]),
    avoid_keywords: strArray(src.avoid_keywords, [...DEFAULT_PREFS.avoid_keywords]),
    discard_title_keywords: strArray(src.discard_title_keywords, [...DEFAULT_PREFS.discard_title_keywords]),
    max_experience_years:
      Number.isFinite(maxYears) && maxYears > 0
        ? Math.floor(maxYears)
        : src.max_experience_years === null || src.max_experience_years === 0
          ? null
          : DEFAULT_PREFS.max_experience_years,
    has_clearance:
      typeof src.has_clearance === 'boolean' ? src.has_clearance : DEFAULT_PREFS.has_clearance,
    priority_flags:
      typeof src.priority_flags === 'string' ? src.priority_flags : DEFAULT_PREFS.priority_flags,
    extra_instructions:
      typeof src.extra_instructions === 'string' ? src.extra_instructions : DEFAULT_PREFS.extra_instructions,
  };
}

/** Load prefs from the DB, falling back to defaults for anything unset. */
export function loadPrefs() {
  const row = db.prepare('SELECT data FROM search_prefs WHERE id = 1').get();
  if (!row) return normalizePrefs(DEFAULT_PREFS);
  let stored = {};
  try {
    stored = JSON.parse(row.data);
  } catch {
    /* corrupt row — fall back to defaults */
  }
  return normalizePrefs(stored);
}

/** Persist prefs (normalized) and return the stored object. */
export function savePrefs(raw) {
  const prefs = normalizePrefs(raw);
  db.prepare(`
    INSERT INTO search_prefs (id, data, date_updated) VALUES (1, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, date_updated = datetime('now')
  `).run(JSON.stringify(prefs));
  return prefs;
}
