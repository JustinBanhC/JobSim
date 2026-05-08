import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import db from '../db.js';

const router = Router();

const SYSTEM_INSTRUCTION = `You are JobSim AI — an interactive assistant embedded in a job-hunting command console. Your personality is sharp, efficient, and encouraging. You speak in a concise, terminal-like tone but you're warm underneath.

You help users populate and manage three data collections:

1. **Job Applications** — track companies, roles, statuses, sources, URLs, salary ranges, locations, notes
   Valid statuses: researching, applied, screen_scheduled, interviewing, offer, rejected, ghosted, withdrawn
   Valid sources: LinkedIn, Company Site, Referral, Indeed, Handshake, AngelList, Other

2. **Skills** — track learning goals with priority and progress
   Valid priorities: high, medium, nice
   Valid statuses: not_started, in_progress, completed, paused

3. **Contacts** — networking connections with outreach tracking
   Valid outreach statuses: not_contacted, reached_out, responded, call_scheduled, connected

INTERACTION RULES:
- When the user asks you to generate/populate data, be proactive — create realistic, diverse entries immediately using the bulk tools.
- When creating sample data, make it realistic and varied. Use real company names, realistic roles, varied statuses.
- Always confirm what you created with a brief summary.
- If the user is vague, ask ONE focused follow-up question, then act.
- You can read existing data to give context-aware suggestions.
- When you create items, call the appropriate function — don't just describe what you would create.
- Keep responses concise. No walls of text. Use line breaks for readability.
- Use the list tools first to understand what already exists before creating duplicates.`;

const tools = [
  {
    functionDeclarations: [
      {
        name: 'list_applications',
        description: 'List all current job applications to see what exists',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'create_application',
        description: 'Create a single job application entry',
        parameters: {
          type: 'object',
          properties: {
            company: { type: 'string', description: 'Company name' },
            role: { type: 'string', description: 'Job title/role' },
            status: { type: 'string', description: 'Application status' },
            source: { type: 'string', description: 'Where you found the job' },
            url: { type: 'string', description: 'Job posting URL' },
            salary_range: { type: 'string', description: 'Salary range e.g. $120k-$160k' },
            location: { type: 'string', description: 'Job location' },
            notes: { type: 'string', description: 'Additional notes' },
            date_applied: { type: 'string', description: 'Date applied in ISO format' },
          },
          required: ['company', 'role'],
        },
      },
      {
        name: 'bulk_create_applications',
        description: 'Create multiple job applications at once. Use this when generating sample data or adding several entries.',
        parameters: {
          type: 'object',
          properties: {
            applications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  company: { type: 'string' },
                  role: { type: 'string' },
                  status: { type: 'string' },
                  source: { type: 'string' },
                  url: { type: 'string' },
                  salary_range: { type: 'string' },
                  location: { type: 'string' },
                  notes: { type: 'string' },
                  date_applied: { type: 'string' },
                },
                required: ['company', 'role'],
              },
            },
          },
          required: ['applications'],
        },
      },
      {
        name: 'list_skills',
        description: 'List all current skills to see what exists',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'create_skill',
        description: 'Create a single skill entry',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Skill name' },
            priority: { type: 'string', description: 'high, medium, or nice' },
            current_level: { type: 'string', description: 'Current proficiency level' },
            target_level: { type: 'string', description: 'Target proficiency level' },
            status: { type: 'string', description: 'Learning status' },
            resources: { type: 'string', description: 'Learning resources or links' },
          },
          required: ['name'],
        },
      },
      {
        name: 'bulk_create_skills',
        description: 'Create multiple skills at once',
        parameters: {
          type: 'object',
          properties: {
            skills: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  priority: { type: 'string' },
                  current_level: { type: 'string' },
                  target_level: { type: 'string' },
                  status: { type: 'string' },
                  resources: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
          required: ['skills'],
        },
      },
      {
        name: 'list_contacts',
        description: 'List all current contacts to see what exists',
        parameters: { type: 'object', properties: {} },
      },
      {
        name: 'create_contact',
        description: 'Create a single contact/networking entry',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Contact name' },
            title: { type: 'string', description: 'Job title' },
            company: { type: 'string', description: 'Company' },
            email: { type: 'string', description: 'Email address' },
            linkedin_url: { type: 'string', description: 'LinkedIn profile URL' },
            how_connected: { type: 'string', description: 'How you know them' },
            notes: { type: 'string', description: 'Notes about this contact' },
            outreach_status: { type: 'string', description: 'Outreach status' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
          },
          required: ['name'],
        },
      },
      {
        name: 'bulk_create_contacts',
        description: 'Create multiple contacts at once',
        parameters: {
          type: 'object',
          properties: {
            contacts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  title: { type: 'string' },
                  company: { type: 'string' },
                  email: { type: 'string' },
                  linkedin_url: { type: 'string' },
                  how_connected: { type: 'string' },
                  notes: { type: 'string' },
                  outreach_status: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                },
                required: ['name'],
              },
            },
          },
          required: ['contacts'],
        },
      },
    ],
  },
];

function execFunction(name, args) {
  switch (name) {
    case 'list_applications': {
      const rows = db.prepare('SELECT id, company, role, status, source, location FROM applications ORDER BY date_created DESC LIMIT 50').all();
      return { count: rows.length, applications: rows };
    }
    case 'create_application': {
      const { company, role, status = 'researching', source, url, salary_range, location, notes, date_applied } = args;
      const maxPos = db.prepare("SELECT COALESCE(MAX(position), -1) + 1 as next FROM applications WHERE status = ?").get(status);
      const result = db.prepare(
        `INSERT INTO applications (company, role, status, source, url, salary_range, location, notes, date_applied, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(company, role, status, source || null, url || null, salary_range || null, location || null, notes || null, date_applied || null, maxPos.next);
      db.prepare('INSERT INTO application_activity (application_id, type, note) VALUES (?, ?, ?)').run(result.lastInsertRowid, 'created', `Added ${company} - ${role}`);
      return { id: Number(result.lastInsertRowid), company, role, status };
    }
    case 'bulk_create_applications': {
      const created = [];
      const insert = db.transaction((apps) => {
        for (const app of apps) {
          const r = execFunction('create_application', app);
          created.push(r);
        }
      });
      insert(args.applications || []);
      return { created: created.length, applications: created };
    }
    case 'list_skills': {
      const rows = db.prepare('SELECT id, name, priority, status, current_level, target_level FROM skills ORDER BY date_created DESC LIMIT 50').all();
      return { count: rows.length, skills: rows };
    }
    case 'create_skill': {
      const { name, priority = 'medium', current_level, target_level, status = 'not_started', resources } = args;
      const result = db.prepare(
        `INSERT INTO skills (name, priority, current_level, target_level, status, resources) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(name, priority, current_level || null, target_level || null, status, resources || null);
      return { id: Number(result.lastInsertRowid), name, priority, status };
    }
    case 'bulk_create_skills': {
      const created = [];
      const insert = db.transaction((items) => {
        for (const s of items) {
          const r = execFunction('create_skill', s);
          created.push(r);
        }
      });
      insert(args.skills || []);
      return { created: created.length, skills: created };
    }
    case 'list_contacts': {
      const rows = db.prepare('SELECT id, name, title, company, outreach_status FROM contacts ORDER BY date_updated DESC LIMIT 50').all();
      return { count: rows.length, contacts: rows };
    }
    case 'create_contact': {
      const { name, title, company, email, linkedin_url, how_connected, notes, outreach_status = 'not_contacted', tags = [] } = args;
      const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
      const result = db.prepare(
        `INSERT INTO contacts (name, title, company, email, linkedin_url, how_connected, notes, outreach_status, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(name, title || null, company || null, email || null, linkedin_url || null, how_connected || null, notes || null, outreach_status, tagsJson);
      return { id: Number(result.lastInsertRowid), name, company, outreach_status };
    }
    case 'bulk_create_contacts': {
      const created = [];
      const insert = db.transaction((items) => {
        for (const c of items) {
          const r = execFunction('create_contact', c);
          created.push(r);
        }
      });
      insert(args.contacts || []);
      return { created: created.length, contacts: created };
    }
    default:
      return { error: `Unknown function: ${name}` };
  }
}

router.post('/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured. Add it to server/.env' });
  }

  const { messages = [] } = req.body;
  if (!messages.length) {
    return res.status(400).json({ error: 'Messages required' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const ai = new GoogleGenAI({ apiKey });

    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    let loopCount = 0;
    const MAX_LOOPS = 8;

    while (loopCount < MAX_LOOPS) {
      loopCount++;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools,
        },
      });

      const candidate = response.candidates?.[0];
      if (!candidate) {
        send('error', { message: 'No response from model' });
        break;
      }

      const parts = candidate.content?.parts || [];
      let hasFunction = false;
      const functionResponseParts = [];

      for (const part of parts) {
        if (part.text) {
          send('text', { content: part.text });
        }

        if (part.functionCall) {
          hasFunction = true;
          const { name, args } = part.functionCall;
          send('function_call', { name, args });

          const result = execFunction(name, args || {});
          send('function_result', { name, result });

          functionResponseParts.push({
            functionResponse: { name, response: result },
          });
        }
      }

      contents.push({ role: 'model', parts });

      if (hasFunction) {
        contents.push({ role: 'user', parts: functionResponseParts });
      } else {
        break;
      }
    }

    send('done', {});
  } catch (err) {
    send('error', { message: err.message || 'Agent error' });
  }

  res.end();
});

export default router;
