// Pure helpers for Events Radar — no imports, so these can be unit-exercised
// standalone and mirrored by the serverless app (api/[...path].js keeps its own
// self-contained copy since it deploys as an isolated Vercel function).

export const EVENT_TYPES = ['career_fair', 'hiring_event', 'info_session', 'invite_event', 'conference', 'other'];
export const EVENT_STATUSES = ['new', 'saved', 'registered', 'attended', 'dismissed'];
export const EVENT_SOURCES = ['linkedin', 'instagram', 'eventbrite', 'luma', 'manual', 'other'];

export function defaultKeywords() {
  return ['engineering career fair', 'tech hiring event', 'university recruiting event'];
}

// CSE X-ray queries over PUBLIC search results only (never logs into or crawls
// LinkedIn/Instagram directly — same approach as the networker route).
export function buildScanQueries(keywords, location) {
  const loc = location ? ` "${location}"` : '';
  const queries = [];
  for (const kw of keywords) {
    queries.push(
      { q: `site:linkedin.com/events ${kw}${loc}` },
      { q: `site:linkedin.com/posts "hiring event" ${kw}${loc}` },
      { q: `site:instagram.com ("career fair" OR "hiring event") ${kw}${loc}` },
      { q: `site:eventbrite.com ${kw}${loc}` },
      { q: `site:lu.ma ${kw}${loc}` },
    );
  }
  return queries;
}

// One-click public search URLs the USER opens themselves — works with zero API keys.
export function buildSearchLinks(q) {
  const enc = encodeURIComponent(q);
  const tag = q.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 30) || 'careerfair';
  const g = (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  return [
    { label: 'LinkedIn events', url: `https://www.linkedin.com/search/results/events/?keywords=${enc}` },
    { label: 'LinkedIn posts', url: `https://www.linkedin.com/search/results/content/?keywords=${enc}` },
    { label: 'Instagram keyword', url: `https://www.instagram.com/explore/search/keyword/?q=${enc}` },
    { label: `Instagram #${tag}`, url: `https://www.instagram.com/explore/tags/${tag}/` },
    { label: 'Eventbrite x-ray', url: g(`site:eventbrite.com ${q}`) },
    { label: 'Luma x-ray', url: g(`site:lu.ma ${q}`) },
    { label: 'Google', url: g(`${q} ("career fair" OR "hiring event")`) },
  ];
}

export function sourceFromUrl(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('linkedin.com')) return 'linkedin';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('eventbrite.')) return 'eventbrite';
  if (u.includes('lu.ma')) return 'luma';
  return 'other';
}

// Search-result titles look like "Spring Tech Career Fair | LinkedIn" / "... - Eventbrite"
export function cleanResultTitle(title) {
  return (title || '')
    .replace(/\s*[|·–—-]\s*(LinkedIn|Instagram|Eventbrite|Luma|lu\.ma)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Accepts "2026-09-14", "2026-09-14T18:00:00Z", "2026-09" → ISO date or null.
export function normalizeEventDate(value) {
  if (!value || typeof value !== 'string') return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3] || '01'}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/**
 * Normalize one Gemini extraction result (paired with the raw CSE item it came
 * from) into an insertable event row. Returns null for non-events / junk.
 */
export function normalizeExtractedEvent(raw, item) {
  if (!raw || raw.is_event !== true) return null;
  const title = (raw.title || '').trim() || cleanResultTitle(item?.title);
  if (!title || !item?.link) return null;
  const score = Number.isFinite(raw.relevance_score)
    ? Math.min(100, Math.max(1, Math.round(raw.relevance_score)))
    : null;
  return {
    title: title.slice(0, 300),
    host: (raw.host || '').trim() || null,
    event_type: EVENT_TYPES.includes(raw.event_type) ? raw.event_type : 'other',
    url: item.link,
    source: sourceFromUrl(item.link),
    location: (raw.location || '').trim() || null,
    is_virtual: raw.is_virtual === true ? 1 : raw.is_virtual === false ? 0 : null,
    event_date: normalizeEventDate(raw.event_date),
    description: item.snippet || null,
    score,
    score_reasons: JSON.stringify(Array.isArray(raw.reasons) ? raw.reasons.slice(0, 5) : []),
  };
}

// Keyless-Gemini path: save the raw public result unscored (title/snippet only).
export function rawItemToEvent(item) {
  const title = cleanResultTitle(item?.title);
  if (!title || !item?.link) return null;
  return {
    title: title.slice(0, 300),
    host: null,
    event_type: 'other',
    url: item.link,
    source: sourceFromUrl(item.link),
    location: null,
    is_virtual: null,
    event_date: null,
    description: item.snippet || null,
    score: null,
    score_reasons: '[]',
  };
}

export const EXTRACTION_PROMPT = `You are an event triage judge for a job-seeking engineering student. You receive raw PUBLIC web search results (title / snippet / url) that may mention recruiting events.

For EACH result decide whether it describes an actual EVENT a candidate could attend: a career fair, hiring event, invite-only recruiting event, info session, or recruiting-relevant conference. Job postings, news articles, generic company or profile pages, and past-event photo dumps are NOT events — mark those is_event=false.

For results that ARE events, extract:
- title: concise event title
- host: hosting company/org if identifiable, else ""
- event_type: one of career_fair | hiring_event | info_session | invite_event | conference | other
- event_date: ISO date (YYYY-MM-DD) ONLY if inferable from the text, else ""
- location: city/venue if mentioned, else ""
- is_virtual: true only if clearly online/virtual
- relevance_score: 1-100 relevance for a CS/EE student seeking tech internships and new-grad roles (university/tech recruiting events score high; unrelated industries score low)
- reasons: 1-3 short reasons for the score

Return ONLY a JSON array with one object per input result, echoing each result's id.`;

export const extractionResponseSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      is_event: { type: 'boolean' },
      title: { type: 'string' },
      host: { type: 'string' },
      event_type: { type: 'string' },
      event_date: { type: 'string' },
      location: { type: 'string' },
      is_virtual: { type: 'boolean' },
      relevance_score: { type: 'integer' },
      reasons: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'is_event'],
  },
};
