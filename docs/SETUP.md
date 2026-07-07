# Setup

JobSim has two runtime targets:

1. **Production (Vercel + Supabase)** — the static Vite client (`client/dist`) plus one
   serverless function (`api/[...path].js`), backed by Supabase (Postgres + Auth + RLS).
2. **Local discovery pipeline (`server/`)** — Express + SQLite. Local-only; it is
   **not** deployed to Vercel. See the second half of this document.

## Deploying to Vercel + Supabase

### 1. Supabase project

1. Create a project at https://supabase.com/dashboard.
2. **SQL Editor** → paste the full contents of `supabase-migration.sql` → Run.
   The file is idempotent — safe to re-run after pulling updates.
3. **Authentication → Sign In / Providers → Email**: leave **Confirm email** enabled.
   The app's auth flow expects it (sign-up shows a "check your inbox" screen and
   sign-in is blocked until the address is confirmed).
4. **Authentication → URL Configuration**:
   - **Site URL**: your production URL, e.g. `https://your-app.vercel.app`.
     Confirmation-email links redirect here (the client does not pass a custom
     `emailRedirectTo`, so the Site URL is what's used).
   - **Redirect URLs**: add the production URL, and `http://localhost:5173` for local dev.
5. **Project Settings → API**: copy the **Project URL**, the **anon** key, and the
   **service_role** key for the next step.

### 2. Vercel project

Import the repo into Vercel. `vercel.json` already configures the build
(`cd client && npm install && npm run build`), the output directory
(`client/dist`), the API function, and the SPA rewrite — no framework preset needed.

Set these **Environment Variables** (Production + Preview). Names must match exactly
(they are what `api/[...path].js` and `client/src/lib/supabase.js` read):

| Variable | Used by | Value |
|---|---|---|
| `SUPABASE_URL` | API function | Supabase Project URL |
| `SUPABASE_ANON_KEY` | API function | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | API function (agent endpoint only) | Supabase service_role key — **secret**, never expose to the client |
| `GEMINI_API_KEY` | API function (agent endpoint) | Google AI Studio key |
| `GEMINI_MODEL` | API function, optional | Overrides the default `gemini-3.5-flash` |
| `VITE_SUPABASE_URL` | client build | same Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY` | client build | same anon key |

Notes:
- `VITE_*` values are baked into the static bundle **at build time** — after changing
  them, trigger a redeploy. Without them the client runs in no-auth dev mode and the
  deployed API will reject requests.
- The function `maxDuration` is 60s in `vercel.json`. That is the exact Hobby-plan
  maximum on the legacy runtime; with Fluid compute (the default for new projects)
  Hobby allows up to 300s, so 60 is valid either way.
- The agent endpoint streams Server-Sent Events. Response streaming is enabled by
  default for Node.js functions on all Vercel plans — no extra config required.

### 3. Verify the deploy

1. `https://your-app.vercel.app/api/health` → `{"status":"ok"}`.
2. Load the root URL — the SPA should render (any non-`/api/` path serves `index.html`).
3. Sign up → receive the confirmation email → click the link → sign in.
4. Create an application/skill/contact; open the agent panel and send a message
   (exercises `SUPABASE_SERVICE_ROLE_KEY` + `GEMINI_API_KEY`).

### Local client development

```bash
cd client
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Leaving the two `VITE_*` vars unset makes the client skip Supabase auth entirely and
talk to the local `server/` API instead (dev mode).

---

# Local discovery pipeline (`server/` — not deployed)

## Prerequisites
- Node.js 18+ (uses built-in `fetch`)
- ~500 MB disk for Puppeteer's Chrome (co-pilot + fallback adapter only)

## Install

```bash
cd server
npm install
npx puppeteer browsers install chrome   # one-time; only needed for the co-pilot / puppeteer adapter
```

> **Windows note:** antivirus can interrupt the Chrome download. If the co-pilot
> reports "Could not find Chrome", delete `%USERPROFILE%\.cache\puppeteer\chrome`
> and re-run the install command.

## Environment variables (`server/.env`)

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | Yes (scoring, co-pilot mapping, agent) | Google AI Studio key |
| `GEMINI_MODEL` | Optional | Override the model (default `gemini-3.5-flash`). E.g. `gemini-3.1-pro-preview` for higher-quality scoring, or `gemini-2.5-flash-lite` for cheaper/faster. |
| `GOOGLE_CSE_KEY` | Optional | Custom Search JSON API key — enables recruiter X-ray search |
| `GOOGLE_CSE_ID` | Optional | Programmable Search Engine ID (create one that searches the whole web) |
| `GITHUB_TOKEN` | Optional | Raises GitHub API rate limit (60/hr → 5000/hr) for repo + org lookups |
| `DISCOVERY_CRON` | Optional | Cron expression for automatic runs, e.g. `0 8 * * *` |

Without the optional keys everything still works — the Networker degrades to
one-click LinkedIn search links, and GitHub lookups use anonymous rate limits.

### Getting the Google CSE keys (free tier: 100 queries/day)
1. https://programmablesearchengine.google.com → create engine → "Search the entire web"
2. Copy the **Search engine ID** → `GOOGLE_CSE_ID`
3. https://developers.google.com/custom-search/v1/introduction → get an API key → `GOOGLE_CSE_KEY`

## Managing sources

Sources are seeded on first boot (SimplifyJobs repos + a few Greenhouse/Ashby boards)
and managed via `GET/POST/PUT/DELETE /api/discovery/sources`. Config per board type:

```jsonc
{ "board_type": "greenhouse", "config": { "org": "anthropic", "company": "Anthropic" } }
{ "board_type": "lever",      "config": { "org": "figma", "company": "Figma" } }
{ "board_type": "ashby",      "config": { "org": "ramp", "company": "Ramp" } }
{ "board_type": "workday",    "config": { "tenant": "nvidia", "site": "NVIDIAExternalCareerSite", "wd": 5, "searchText": "intern" } }
{ "board_type": "github",     "config": { "repo": "SimplifyJobs/Summer2026-Internships" } }
{ "board_type": "puppeteer",  "config": { "url": "https://...", "jobSelector": ".job-row", "titleSelector": ".title" } }
```

Finding a company's Workday tenant: open their careers site, watch the network tab for
`*.myworkdayjobs.com/wday/cxs/{tenant}/{site}/jobs` — that gives you `tenant`, `site`,
and the `wd` number from the hostname (`nvidia.wd5.…` → `wd: 5`).

## Daily workflow

1. **Radar → Run discovery** — polls sources, filters, scores. Watch the console log.
2. Review the feed (90+ first). **Promote** the good ones into the Pipeline.
3. For high-fit jobs: **Find contacts** → recruiters land in your Contacts tab.
4. **Profile vault** (fill once) → **Apply with co-pilot** → a Chrome window opens,
   the AI fills the form, you review, attach your resume, and click submit.

## Tuning the AI

- Hard filter patterns: `server/src/discovery/hardFilter.js`
- Scoring rubric / your profile description: `RUBRIC` in `server/src/discovery/scorer.js`
- Unscored jobs (e.g. after an API failure): `POST /api/discovery/rescore`
