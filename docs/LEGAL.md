# Legal & Ethical Posture

This document explains what the discovery pipeline does and — more importantly — what it
deliberately does **not** do. It is written for a personal-use, single-user tool running
on the owner's machine. (This is an engineering summary, not legal advice.)

## What we rely on

### 1. Official / public JSON APIs (primary ingestion)
Greenhouse, Lever, and Ashby publish **documented public job-board APIs** intended for
exactly this kind of consumption:

- Greenhouse: https://developers.greenhouse.io/job-board.html
- Lever: https://github.com/lever/postings-api
- Ashby: https://developers.ashbyhq.com/docs/public-job-posting-api

Workday's CXS endpoint is the same JSON API the public career site frontend calls —
unauthenticated, public job data, accessed at low volume with an honest User-Agent.

### 2. GitHub REST API
Community job lists (SimplifyJobs repos) are MIT-licensed and maintained *for* job
seekers. Org-member lookups use only public profile data via the documented API,
within rate limits.

### 3. Google Programmable Search (Custom Search JSON API)
"X-ray" searches (`site:linkedin.com/in ...`) run through **Google's official paid/free
API**, returning the same public snippets a manual Google search shows. We never fetch
LinkedIn pages themselves.

### 4. robots.txt compliance + rate limiting
Every adapter request goes through `fetcher.js`, which:
- fetches and honors `robots.txt` before any request (request is refused if disallowed)
- enforces ≥2s between requests per domain
- identifies itself with a custom User-Agent
- backs off on 429/5xx

This aligns with the post-*hiQ v. LinkedIn* (9th Cir.) consensus: accessing publicly
available data without circumventing technical barriers is not CFAA "unauthorized
access" — and we add voluntary politeness (robots, rate limits) on top.

## What we deliberately do NOT do

| Excluded | Why |
|---|---|
| `puppeteer-extra-plugin-stealth` or any anti-bot evasion | Circumventing technical access controls is exactly what creates CFAA/ToS exposure, and it's fragile. If a site blocks bots, we respect that. |
| LinkedIn scraping / automated LinkedIn browsing | LinkedIn's User Agreement §8.2 prohibits scraping and automation; they litigate aggressively. We only *generate search URLs* the user opens manually in their own logged-in browser. |
| Instagram data collection | No permitted API for this use; scraping violates Meta's ToS. |
| Auto-submitting applications | The co-pilot fills forms but never clicks submit, never toggles consent checkboxes, and runs in a visible browser. The human reviews and submits. |
| Credential storage / automated login | The user logs in themselves in the visible browser window. The app never sees or stores credentials. |
| High-volume crawling | Hard caps: 10 pages per Workday tenant, 1 page for the Puppeteer fallback, 2s/domain spacing. |

## The Puppeteer fallback

Used only for boards with **no API**, with constraints: visible (non-headless) standard
Chrome, robots.txt checked first, single page load, no stealth, no fingerprint spoofing.
If a board blocks this, the correct response is to remove the source, not to evade.

## Co-pilot scope

The Apply Co-pilot is functionally a **form-filling assistant** (same category as the
browser's own autofill or extensions like Simplify): it acts on the user's machine, in
a browser the user controls, on data the user typed in, with the user present. The
human makes every consequential decision (login, file uploads, consent boxes, submit).
