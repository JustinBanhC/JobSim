// Stage 1 evaluator: cheap regex pass before any LLM call.
// Returns { pass: boolean, reason: string|null, boost: number }
// Profile: EE/CE dual-degree intern candidate who HOLDS a security clearance —
// clearance requirements are a boost, never a discard.

const DISCARD_TITLE = [
  /\b(it|desktop|help\s*desk|helpdesk|service\s*desk)\s+(support|technician|analyst)\b/i,
  /\btechnical\s+support\b/i,
  /\b(sales|account)\s+(executive|manager|representative|development)\b/i,
  /\b(staff|principal|distinguished|senior\s+staff)\s+/i,
  /\b(director|vp|vice\s+president|head\s+of)\b/i,
  /\brecruiter|talent\s+acquisition|human\s+resources\b/i,
  /\b(marketing|legal|finance|accounting|payroll)\b/i,
];

const DISCARD_DESCRIPTION = [
  /\b(7|8|9|10|\d{2})\+?\s*(?:or more\s*)?years?\s+(?:of\s+)?(?:relevant\s+|professional\s+|industry\s+)?experience\b/i,
];

const BOOST_PATTERNS = [
  { re: /\bintern(ship)?\b/i, boost: 3, label: 'intern role' },
  { re: /\b(new\s*grad|entry[\s-]*level|university\s+grad|early\s+career|campus)\b/i, boost: 2, label: 'new grad / entry level' },
  { re: /\b(security\s+clearance|ts\/sci|secret\s+clearance|top\s+secret|cleared)\b/i, boost: 1, label: 'clearance role (candidate holds clearance)' },
];

export function hardFilter(job) {
  const title = job.role || '';
  const description = job.description || '';

  for (const re of DISCARD_TITLE) {
    if (re.test(title)) {
      return { pass: false, reason: `title matched discard pattern: ${re.source}`, boost: 0 };
    }
  }

  for (const re of DISCARD_DESCRIPTION) {
    const m = description.match(re);
    if (m) {
      return { pass: false, reason: `requires too much experience: "${m[0].trim()}"`, boost: 0 };
    }
  }

  let boost = 0;
  const labels = [];
  for (const { re, boost: b, label } of BOOST_PATTERNS) {
    if (re.test(title) || re.test(description)) {
      boost += b;
      labels.push(label);
    }
  }

  return { pass: true, reason: labels.length ? labels.join('; ') : null, boost };
}
