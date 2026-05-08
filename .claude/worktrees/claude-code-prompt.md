# Claude Code Prompt — Tech Job Hunt HQ App

Paste this into Claude Code when you're ready to start building. Feel free to tweak any of the details before you do.

---

## The Prompt

```
I'm building a full-stack personal job hunt management app called "Tech Job Hunt HQ." This is a web app I'll use daily to manage my software/tech job search. I want it to be clean, functional, and something I can show off as a portfolio piece.

## Core Features

### 1. Application Tracker (Kanban-style)
- Kanban board with columns: Researching → Applied → Screen Scheduled → Interviewing → Offer / Rejected / Ghosted / Withdrawn
- Each card shows: Company name, role title, date applied, source (LinkedIn, company site, referral, etc.), and notes
- Drag and drop cards between columns
- Click a card to expand and see full details, add notes, and log activity
- Auto-flag applications that haven't had activity in 7+ days as "needs follow-up"
- Simple filters: by status, by date range, by source

### 2. Networking & Outreach CRM
- Contact list with fields: Name, Title, Company, Email, LinkedIn URL, How We Connected, Notes
- Track outreach status per contact: Not Contacted → Reached Out → Responded → Call Scheduled → Connected
- Log interactions (date + what happened)
- Follow-up reminders: flag contacts where I reached out 5+ days ago with no response
- Tag contacts: Recruiter, Engineer, Hiring Manager, Referral, Mentor

### 3. Cold Email / LinkedIn Message Drafter
- Built-in AI message drafter using the Anthropic API
- I select a contact from my CRM, pick a template type (Recruiter Outreach, Engineer/Peer, Hiring Manager, LinkedIn Connection Request, Follow-Up)
- The app sends the contact's info + template type to Claude and returns a personalized draft
- I can edit the draft before copying it
- Save drafts tied to the contact in the CRM

### 4. Skill Building Roadmap
- Simple table/list view with columns: Skill, Priority (High/Medium/Nice-to-Have), Current Level, Target Level, Status, Resources
- Learning log: date, what I worked on, time spent, notes
- Project ideas section linked to skills they cover

### 5. Dashboard (Home Page)
- Today's priorities: applications needing follow-up, outreach due, skill building reminders
- Weekly stats: applications sent, responses received, interviews scheduled
- Quick-add buttons for new applications, new contacts, new learning log entries

## Tech Stack Preferences
- React frontend with Tailwind CSS
- Node.js/Express backend (or Next.js if that's simpler)
- SQLite or PostgreSQL for the database (whatever's easier to get running locally)
- Anthropic API integration for the message drafter (use claude-sonnet-4-6 model)
- Should run locally but be structured so I could deploy it later

## Design Notes
- Clean, modern UI — this is going on my portfolio so it should look good
- Dark mode support
- Responsive but desktop-first (I'll mainly use this on my laptop)
- Minimal dependencies — don't over-engineer it

## File Structure
Set up a clean project structure with separate directories for frontend components, backend routes, database models, and API integrations. Include a README with setup instructions.

## Getting Started
Start by scaffolding the project, setting up the database schema, and building the Application Tracker kanban board first. We'll iterate on the other features from there.
```

---

## Tips for Using This Prompt

1. **Start with just the kanban board.** Don't try to build everything at once. Get the tracker working, then move to the CRM, then the AI drafter, etc.

2. **You'll need an Anthropic API key** for the message drafter feature. You can get one at console.anthropic.com. Store it in a `.env` file.

3. **Iterate in Claude Code.** After the initial scaffold, you can say things like:
   - "Add drag and drop to the kanban board"
   - "Build out the contact CRM page"
   - "Wire up the Anthropic API for message drafting"
   - "Add the dashboard with today's priorities"

4. **Save your CLAUDE.md file.** Claude Code uses a CLAUDE.md file in your project root for persistent context. Add notes about your project decisions so Claude remembers them across sessions.

5. **Test as you go.** After each feature, run the app and make sure it works before moving to the next one.
