# Setup — Discovery Pipeline

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
