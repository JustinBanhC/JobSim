# JobSim Discovery Pipeline — Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        STAGE 1: INGESTION                          │
│                                                                    │
│  job_sources (DB)            adapters (server/src/discovery/)     │
│  ┌──────────────┐            ┌──────────────────────────────┐     │
│  │ greenhouse   │──────────▶ │ boards-api.greenhouse.io     │     │
│  │ lever        │──────────▶ │ api.lever.co/v0/postings     │     │
│  │ ashby        │──────────▶ │ api.ashbyhq.com/posting-api  │     │
│  │ workday      │──────────▶ │ {tenant}.myworkdayjobs CXS   │     │
│  │ github       │──────────▶ │ GitHub API (README tables)   │     │
│  │ puppeteer    │──────────▶ │ headed browser (fallback)    │     │
│  └──────────────┘            └──────────────────────────────┘     │
│         all HTTP goes through fetcher.js:                         │
│         robots.txt check · 2s/domain rate limit · retries         │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                       STAGE 2: AI EVALUATOR                        │
│                                                                    │
│  hardFilter.js (regex, free)        scorer.js (Gemini, batched)   │
│  ├─ discard: IT support, sales,     ├─ 1-100 vs candidate profile │
│  │  Staff+/Director, 7+ yrs exp     ├─ structured JSON output     │
│  └─ boost: intern, new grad,        ├─ batches of 9, retry once   │
│     clearance (candidate holds one) └─ failures → stay unscored   │
│                                                                    │
│  discovered_jobs: new → scored → promoted | dismissed              │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                       STAGE 3: NETWORKER                           │
│  (on-demand per job; highlighted for score > 85)                   │
│  ├─ Google CSE X-ray (official API): recruiters / EMs              │
│  ├─ GitHub org members (official API): engineers                   │
│  ├─ One-click LinkedIn search URLs (user opens, never fetched)     │
│  └─ saves into contacts table, tagged "Discovered", linked to job  │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: APPLY CO-PILOT                         │
│  profile (DB, single row) + headed Chrome via Puppeteer            │
│  ├─ scans visible form fields (label/aria/placeholder)             │
│  ├─ Gemini maps fields → profile values (structured output)        │
│  ├─ types values; rescans on navigation (multi-step forms)         │
│  ├─ NEVER clicks submit; skips checkboxes/radio (consent = human)  │
│  └─ session ends when user closes browser (15 min cap)             │
└────────────────────────────────────────────────────────────────────┘
```

## Data model additions

| Table | Purpose |
|---|---|
| `job_sources` | Configured boards (type + JSON config), enable/disable, last run result |
| `discovered_jobs` | Normalized postings, dedup on `url` + `(source, external_id)`, score + reasons |
| `profile` | Single-row JSON vault for the co-pilot |
| `contacts.discovered_job_id` | Links auto-discovered contacts to the job that triggered them |

## Adapter interface

Every adapter is one module exporting `{ type, async fetch(config, { politeFetch, log }) }`
returning `NormalizedJob[]`:

```js
{ external_id, company, role, url, location, description, posted_date }
```

To support a new board, add one file in `server/src/discovery/adapters/` and register it
in `engine.js`. `politeFetch` enforces robots.txt and rate limits for free.

## API routes (all behind auth)

- `POST /api/discovery/run` — SSE: `source_start/source_done/source_error/score_progress/done`
- `GET  /api/discovery/jobs?status=&min_score=&q=` · `POST /jobs/:id/promote|dismiss|restore`
- `GET/POST/PUT/DELETE /api/discovery/sources`
- `POST /api/networker/jobs/:id/find-contacts` — SSE: `links/contact/log/done`
- `GET/PUT /api/copilot/profile` · `POST /api/copilot/apply/:jobId` — SSE: `fields_found/filled/log/done`

## Promotion flow

Radar (discovered_jobs) → **Promote** → creates a row in `applications` (status
`researching`, AI score + reasons copied into notes) → appears in the Pipeline page.
The discovered job keeps `application_id` so it shows "In pipeline".

## Deployment note

The pipeline is **local-only by design** — Puppeteer and long-running SSE don't fit
Vercel serverless. The deployed client detects the missing routes (404) and shows a
"Local only" state on the Radar page. Everything else deploys unchanged.
