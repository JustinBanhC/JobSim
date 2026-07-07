// Stage 1 evaluator: cheap regex pass before any LLM call.
// Returns { pass: boolean, reason: string|null, boost: number }
// All discard/boost logic is derived from the user's search prefs
// (see prefs.js — DEFAULT_PREFS reproduces the old hardcoded behavior).

import { DEFAULT_PREFS } from './prefs.js';

// Roles above the selectable seniority scale are never wanted.
const ABOVE_SCALE_TITLE = [
  /\b(staff|principal|distinguished|senior\s+staff)\s+/i,
  /\b(director|vp|vice\s+president|head\s+of)\b/i,
];

// Title markers per seniority level — used to discard levels the user did
// NOT accept, and (for early-career levels) to boost the ones they did.
const SENIORITY_MARKERS = {
  intern: /\bintern(ship)?\b/i,
  new_grad: /\b(new\s*grad|entry[\s-]*level|university\s+grad|early\s+career|campus)\b/i,
  junior: /\b(junior|jr\.?)\s+/i,
  mid: null, // no reliable title marker
  senior: /\b(senior|sr\.?)\s+/i,
};

const SENIORITY_BOOSTS = {
  intern: { boost: 3, label: 'intern role' },
  new_grad: { boost: 2, label: 'new grad / entry level' },
};

const CLEARANCE_RE = /\b(security\s+clearance|ts\/sci|secret\s+clearance|top\s+secret|cleared)\b/i;

// Generic "N+ years of experience" matcher; the captured number is compared
// against prefs.max_experience_years in code.
const EXPERIENCE_RE = /\b(\d{1,2})\s*\+?\s*(?:or more\s*)?years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+)?experience\b/gi;

/** Compile a plain keyword/phrase into a word-boundary, whitespace-flexible regex. */
function keywordToRegex(keyword) {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

function compile(prefs) {
  const seniority = prefs.seniority || [];

  const discardTitle = [
    ...(prefs.discard_title_keywords || []).map(keywordToRegex),
    ...ABOVE_SCALE_TITLE,
  ];
  for (const [level, re] of Object.entries(SENIORITY_MARKERS)) {
    if (re && !seniority.includes(level)) discardTitle.push(re);
  }

  const boosts = [];
  for (const level of seniority) {
    const b = SENIORITY_BOOSTS[level];
    if (b) boosts.push({ re: SENIORITY_MARKERS[level], ...b });
  }
  if (prefs.has_clearance) {
    boosts.push({ re: CLEARANCE_RE, boost: 1, label: 'clearance role (candidate holds clearance)' });
  } else {
    boosts.push({ re: CLEARANCE_RE, boost: -2, label: 'mentions clearance (candidate has none)' });
  }
  for (const kw of prefs.boost_keywords || []) {
    boosts.push({ re: keywordToRegex(kw), boost: 1, label: `boost keyword: ${kw}` });
  }
  for (const kw of prefs.avoid_keywords || []) {
    boosts.push({ re: keywordToRegex(kw), boost: -2, label: `avoid keyword: ${kw}` });
  }

  return { discardTitle, boosts, maxYears: prefs.max_experience_years ?? null };
}

// Compiled matchers are cached per prefs object so callers can pass the same
// prefs for a whole run without recompiling per job. hardFilter stays pure.
const compiledCache = new WeakMap();
function getCompiled(prefs) {
  let c = compiledCache.get(prefs);
  if (!c) {
    c = compile(prefs);
    compiledCache.set(prefs, c);
  }
  return c;
}

export function hardFilter(job, prefs = DEFAULT_PREFS) {
  const { discardTitle, boosts, maxYears } = getCompiled(prefs);
  const title = job.role || '';
  const description = job.description || '';

  for (const re of discardTitle) {
    if (re.test(title)) {
      return { pass: false, reason: `title matched discard pattern: ${re.source}`, boost: 0 };
    }
  }

  if (maxYears != null) {
    for (const m of description.matchAll(EXPERIENCE_RE)) {
      if (Number(m[1]) >= maxYears) {
        return { pass: false, reason: `requires too much experience: "${m[0].trim()}"`, boost: 0 };
      }
    }
  }

  let boost = 0;
  const labels = [];
  for (const { re, boost: b, label } of boosts) {
    if (re.test(title) || re.test(description)) {
      boost += b;
      labels.push(label);
    }
  }

  return { pass: true, reason: labels.length ? labels.join('; ') : null, boost };
}
