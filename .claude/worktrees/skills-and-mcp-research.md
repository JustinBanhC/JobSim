# Skills & MCP Integrations for Your Job Hunt App

This doc covers Claude Skills and MCP servers that can supercharge your project — both in the Claude project workflow and when you build the full app.

---

## Claude Skills You Should Enable Right Now

These are built-in skills available in Claude.ai under **Settings > Capabilities**. Toggle them on.

### 1. Enhanced Excel / Spreadsheet Skill (`xlsx`)
- **Why:** If you want to export your application tracker or contact list to a spreadsheet, Claude can generate properly formatted .xlsx files on the fly
- **Use case:** "Export my application tracker to a spreadsheet" or "Create a spreadsheet template for tracking my networking contacts"

### 2. Document Skill (`docx`)
- **Why:** Generate tailored cover letters, follow-up letters, or networking briefs as polished Word docs
- **Use case:** "Write a cover letter for this role at Stripe and save it as a Word doc"

### 3. PDF Skill (`pdf`)
- **Why:** Read and parse job descriptions from PDFs, extract info from your resume PDF
- **Use case:** "Read this job posting PDF and compare it to my resume — what gaps do I need to address?"

### 4. Frontend Design Skill
- **Why:** When you're building the actual app, this skill helps Claude Code generate better-looking UI components
- **Use case:** Automatically used when building React components in your app

---

## Custom Skills Worth Creating

You can create your own skills as folders with a SKILL.md file. Here are ones that would be super useful for your workflow:

### Cold Outreach Drafter Skill
```
---
name: cold-outreach-drafter
description: Draft personalized cold emails and LinkedIn messages for job networking. Use whenever the user mentions outreach, cold email, networking message, LinkedIn message, or reaching out to someone about a job.
---

## Instructions
When drafting outreach messages:
1. Ask for: recipient name, title, company, platform (email or LinkedIn), and any context
2. Select the right template type: Recruiter, Engineer/Peer, or Hiring Manager
3. Always personalize — reference something specific about the person or company
4. Keep emails to 4-6 sentences max, LinkedIn messages even shorter
5. Include exactly one clear ask (a call, a referral, advice — not all three)
6. Match the tone to the platform — slightly more formal for email, conversational for LinkedIn
7. Never sound like a template
```

### Job Posting Analyzer Skill
```
---
name: job-posting-analyzer
description: Analyze job postings to extract key requirements, compare against the user's resume, and identify gaps. Use whenever the user shares a job posting, job description, or asks about role requirements.
---

## Instructions
When analyzing a job posting:
1. Extract: required skills, preferred skills, years of experience, education requirements, key responsibilities
2. Compare against the user's resume (if available in project files)
3. Identify: strong matches, partial matches, and gaps
4. Suggest: how to address gaps in the cover letter or interview
5. Flag any red flags (unrealistic requirements, vague descriptions)
6. Rate the overall fit on a scale of 1-5
```

### Interview Prep Skill
```
---
name: interview-prep
description: Help prepare for technical and behavioral interviews. Use whenever the user mentions interview prep, upcoming interviews, practice questions, or mock interviews.
---

## Instructions
When helping with interview prep:
1. Ask what type of interview (technical, behavioral, system design, take-home)
2. Ask what company and role
3. For technical: generate practice problems at the appropriate level
4. For behavioral: use STAR format and generate likely questions based on the company
5. For system design: walk through a structured approach
6. Provide feedback on practice answers
7. Research the company's interview process if possible
```

---

## MCP Servers for Claude Code / Cowork

These connect Claude to external services. You set them up in Claude Code or Claude Desktop.

### Gmail MCP Server
- **What it does:** Lets Claude read, draft, and send emails through your Gmail
- **Why you want it:** Draft cold emails in your app → send them directly without leaving the workflow
- **Setup:** Use `@gongrzhe/server-gmail-autoauth-mcp` via npx, or use Composio's Gmail MCP for managed OAuth
- **Config for Claude Code:**
```json
{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["@gongrzhe/server-gmail-autoauth-mcp"]
    }
  }
}
```

### LinkedIn MCP Server
- **What it does:** Access LinkedIn profiles, search for jobs, send messages
- **Why you want it:** Research contacts and companies directly from Claude
- **Options:**
  - `stickerdaniel/linkedin-mcp-server` (open source, browser-based)
  - Composio's LinkedIn MCP (managed, easier OAuth)
  - ConnectSafely.ai MCP (remote server, easiest setup)
  - MyFeedIn MCP (read-only analytics on your own posts)
- **Heads up:** LinkedIn's ToS technically prohibits automated tools, so use responsibly and don't mass-blast people

### Google Calendar MCP
- **What it does:** Read and create calendar events
- **Why you want it:** Schedule interview prep blocks, set follow-up reminders, track networking calls
- **Available through:** Composio or Google's own MCP connectors

### Notion / Obsidian MCP (if you go that route)
- **What it does:** Read/write to your notes
- **Why you want it:** If you want to keep detailed research notes alongside your tracker
- **Available through:** Community MCP servers on GitHub

---

## Recommended Setup Order

1. **Right now:** Enable the built-in xlsx, docx, and pdf skills in Claude.ai settings
2. **When you set up your Claude project:** Add the project files we already created
3. **When you start using Claude Code:** Set up the Gmail MCP server first (most impactful for outreach)
4. **As you build the app:** Create the custom skills (outreach drafter, job analyzer, interview prep) as SKILL.md files in your project's `.claude/skills/` directory
5. **Later:** Add LinkedIn MCP and Calendar MCP as your workflow matures

---

## Useful Links
- Anthropic Skills docs: https://support.claude.com/en/articles/12512180-use-skills-in-claude
- Claude Code MCP setup: https://code.claude.com/docs/en/mcp
- Awesome Claude Skills repo: https://github.com/travisvn/awesome-claude-skills
- Official Anthropic skills repo: https://github.com/anthropics/skills
- Agent Skills standard: https://agentskills.io
