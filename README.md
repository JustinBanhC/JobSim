# Tech Job Hunt HQ

A full-stack personal job hunt management app with a Kanban-style application tracker, networking CRM, AI message drafter, and skill building roadmap.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Express + better-sqlite3
- **AI:** Anthropic API (Claude) for message drafting

## Setup

### Prerequisites
- Node.js 18+

### Install & Run

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install

# Start both (in separate terminals)
cd server && npm run dev    # → http://localhost:3001
cd client && npm run dev    # → http://localhost:5173
```

The client proxies `/api` requests to the server automatically.

## Project Structure

```
├── client/                  # React frontend
│   └── src/
│       ├── components/      # UI components
│       ├── hooks/           # Custom React hooks
│       └── lib/             # API client, utilities
├── server/                  # Express backend
│   └── src/
│       ├── routes/          # API route handlers
│       ├── db.js            # SQLite database setup & schema
│       └── index.js         # Server entry point
└── README.md
```

## Features

- **Dashboard** — pipeline funnel, 8-week application velocity, response-rate stats, and follow-up reminders for stale applications and unanswered outreach
- **Application Tracker** — Kanban board with drag-and-drop, filters, activity logging, and follow-up flagging
- **Radar (Job Discovery)** — polls Greenhouse/Lever/Ashby/Workday public APIs + GitHub intern-list repos, hard-filters, then AI-scores every posting 1–100 against your profile; promote winners straight into the pipeline
- **Target Roles** — editable search preferences (target roles with score bands, seniority levels, boost/avoid/discard keywords, clearance status, experience cap, custom AI instructions) drive both the hard filter and the AI judge, with "Save & rescore all"
- **Events Radar** — finds job fairs, hiring events, info sessions, and invite events from public LinkedIn/Instagram/Eventbrite/Luma results (Google CSE X-ray — no logins, no ToS-breaking scraping), AI-normalizes and scores them, and tracks them saved → registered → attended; works keyless via one-click manual search links
- **Workday Form Preview** — for Workday postings, renders the standard application form in-app with AI-prefilled answers you edit side by side; saved answers are used authoritatively when the Apply Co-pilot fills the real form
- **Networker** — per-job contact discovery via Google CSE X-ray + GitHub API, with one-click LinkedIn search links; contacts land in the CRM tagged "Discovered"
- **Apply Co-pilot** — opens a visible browser on a job's application form and autofills it from your profile vault (you always review and submit)
- **Networking CRM** — Contact management with outreach tracking and follow-up reminders
- **AI Agent** — chat panel that can read and populate your data via function calling
- **Skill Roadmap** — Track learning progress and project ideas

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SETUP.md](docs/SETUP.md), and [docs/LEGAL.md](docs/LEGAL.md) for the discovery pipeline details.

> The discovery pipeline (Radar / Networker / Co-pilot) is **local-only** — browser
> automation can't run on serverless deploys. The deployed client shows a "local only"
> notice on those pages.
