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

- **Application Tracker** — Kanban board with drag-and-drop, filters, activity logging, and follow-up flagging
- **Networking CRM** — Contact management with outreach tracking and follow-up reminders
- **Message Drafter** — AI-powered cold email/LinkedIn message drafting via Claude
- **Skill Roadmap** — Track learning progress and project ideas
- **Dashboard** — Daily priorities, weekly stats, quick-add actions
