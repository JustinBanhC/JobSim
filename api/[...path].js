import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

// Fail fast with a clear JSON error when Supabase env vars are missing —
// otherwise createClient() throws inside an async handler and the function
// crashes with an opaque FUNCTION_INVOCATION_FAILED.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required' });
  }
  next();
});

function getSupabase(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } }
  );
  return supabase;
}

function getServiceSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

async function getUserId(req) {
  try {
    const sb = getSupabase(req);
    const { data: { user } } = await sb.auth.getUser();
    return user?.id;
  } catch {
    return null;
  }
}

// ── Applications ──
app.get('/api/applications', async (req, res) => {
  const sb = getSupabase(req);
  let query = sb.from('applications').select('*');
  if (req.query.status) query = query.eq('status', req.query.status);
  if (req.query.source) query = query.eq('source', req.query.source);
  if (req.query.from) query = query.gte('date_applied', req.query.from);
  if (req.query.to) query = query.lte('date_applied', req.query.to);
  const { data, error } = await query.order('position').order('date_created', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/applications/:id', async (req, res) => {
  const sb = getSupabase(req);
  const { data: app, error } = await sb.from('applications').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  const { data: activity } = await sb.from('application_activity').select('*').eq('application_id', req.params.id).order('date_created', { ascending: false });
  res.json({ ...app, activity: activity || [] });
});

app.post('/api/applications', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { company, role, status = 'researching', source, url, salary_range, location, notes, date_applied } = req.body;
  if (!company || !role) return res.status(400).json({ error: 'Company and role are required' });
  const { count } = await sb.from('applications').select('*', { count: 'exact', head: true }).eq('status', status);
  const { data: app, error } = await sb.from('applications').insert({ company, role, status, source, url, salary_range, location, notes, date_applied, user_id: userId, position: count || 0 }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  await sb.from('application_activity').insert({ application_id: app.id, type: 'created', note: `Added ${company} - ${role}` });
  res.status(201).json(app);
});

app.put('/api/applications/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { company, role, status, source, url, salary_range, location, notes, date_applied } = req.body;
  const payload = {};
  if (company !== undefined) payload.company = company;
  if (role !== undefined) payload.role = role;
  if (status !== undefined) payload.status = status;
  if (source !== undefined) payload.source = source;
  if (url !== undefined) payload.url = url;
  if (salary_range !== undefined) payload.salary_range = salary_range;
  if (location !== undefined) payload.location = location;
  if (notes !== undefined) payload.notes = notes;
  if (date_applied !== undefined) payload.date_applied = date_applied;
  payload.date_updated = new Date().toISOString();
  const { data: app, error } = await sb.from('applications').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(app);
});

app.put('/api/applications/:id/move', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { status, position } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  const { data: existing, error: fetchErr } = await sb.from('applications').select('*').eq('id', req.params.id).single();
  if (fetchErr) return res.status(404).json({ error: 'Not found' });

  const updates = { status, position: position ?? 0, date_updated: new Date().toISOString() };
  const { data: app, error } = await sb.from('applications').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });

  if (existing.status !== status) {
    await sb.from('application_activity').insert({
      application_id: req.params.id,
      type: 'status_change',
      note: `Moved from ${existing.status} to ${status}`,
    });
  }
  res.json(app);
});

app.post('/api/applications/:id/activity', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { type, note } = req.body;
  if (!type || !note) return res.status(400).json({ error: 'Type and note are required' });

  const { error: appErr } = await sb.from('applications').select('id').eq('id', req.params.id).single();
  if (appErr) return res.status(404).json({ error: 'Not found' });

  await sb.from('applications').update({ date_updated: new Date().toISOString() }).eq('id', req.params.id);
  const { data: activity, error } = await sb.from('application_activity').insert({
    application_id: req.params.id, type, note,
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(activity);
});

app.delete('/api/applications/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { error } = await sb.from('applications').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// ── Skills ──
app.get('/api/skills', async (req, res) => {
  const sb = getSupabase(req);
  const { data, error } = await sb.from('skills').select('*').order('date_created', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/skills/:id', async (req, res) => {
  const sb = getSupabase(req);
  const { data: skill, error } = await sb.from('skills').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  const { data: logs } = await sb.from('learning_logs').select('*').eq('skill_id', req.params.id).order('date_created', { ascending: false });
  res.json({ ...skill, learning_logs: logs || [] });
});

app.post('/api/skills', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, priority = 'medium', current_level, target_level, status = 'not_started', resources } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { data: skill, error } = await sb.from('skills').insert({ name, priority, current_level, target_level, status, resources, user_id: userId }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(skill);
});

app.put('/api/skills/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { name, priority, current_level, target_level, status, resources } = req.body;
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (priority !== undefined) payload.priority = priority;
  if (current_level !== undefined) payload.current_level = current_level;
  if (target_level !== undefined) payload.target_level = target_level;
  if (status !== undefined) payload.status = status;
  if (resources !== undefined) payload.resources = resources;
  const { data: skill, error } = await sb.from('skills').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(skill);
});

app.post('/api/skills/:id/learning-logs', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { topic, time_spent, notes } = req.body;
  if (!topic) return res.status(400).json({ error: 'Topic is required' });
  const { data: log, error } = await sb.from('learning_logs').insert({
    skill_id: req.params.id, topic, time_spent: time_spent ?? null, notes: notes ?? null,
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(log);
});

app.delete('/api/skills/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { error } = await sb.from('skills').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// ── Contacts ──
app.get('/api/contacts', async (req, res) => {
  const sb = getSupabase(req);
  const { data, error } = await sb.from('contacts').select('*').order('date_updated', { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/contacts/:id', async (req, res) => {
  const sb = getSupabase(req);
  const { data: contact, error } = await sb.from('contacts').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  const { data: interactions } = await sb.from('interactions').select('*').eq('contact_id', req.params.id).order('date_created', { ascending: false });
  res.json({ ...contact, interactions: interactions || [] });
});

app.post('/api/contacts', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { name, title, company, email, linkedin_url, how_connected, notes, outreach_status = 'not_contacted', tags = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  const { data: contact, error } = await sb.from('contacts').insert({ name, title, company, email, linkedin_url, how_connected, notes, outreach_status, tags, user_id: userId }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(contact);
});

app.put('/api/contacts/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { name, title, company, email, linkedin_url, how_connected, notes, outreach_status, tags } = req.body;
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (title !== undefined) payload.title = title;
  if (company !== undefined) payload.company = company;
  if (email !== undefined) payload.email = email;
  if (linkedin_url !== undefined) payload.linkedin_url = linkedin_url;
  if (how_connected !== undefined) payload.how_connected = how_connected;
  if (notes !== undefined) payload.notes = notes;
  if (outreach_status !== undefined) payload.outreach_status = outreach_status;
  if (tags !== undefined) payload.tags = tags;
  payload.date_updated = new Date().toISOString();
  const { data: contact, error } = await sb.from('contacts').update(payload).eq('id', req.params.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(contact);
});

app.post('/api/contacts/:id/interactions', async (req, res) => {
  const sb = getSupabase(req);
  const userId = await getUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  const { note } = req.body;
  if (!note) return res.status(400).json({ error: 'Note is required' });

  await sb.from('contacts').update({ date_updated: new Date().toISOString() }).eq('id', req.params.id);
  const { data: interaction, error } = await sb.from('interactions').insert({
    contact_id: req.params.id, note,
  }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(interaction);
});

app.delete('/api/contacts/:id', async (req, res) => {
  const sb = getSupabase(req);
  if (!(await getUserId(req))) return res.status(401).json({ error: 'Unauthorized' });
  const { error } = await sb.from('contacts').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

// ── Agent (Gemini) ──
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

const agentTools = [{
  functionDeclarations: [
    { name: 'list_applications', description: 'List all current job applications', parameters: { type: 'object', properties: {} } },
    { name: 'create_application', description: 'Create a single job application', parameters: { type: 'object', properties: { company:{type:'string'}, role:{type:'string'}, status:{type:'string'}, source:{type:'string'}, url:{type:'string'}, salary_range:{type:'string'}, location:{type:'string'}, notes:{type:'string'}, date_applied:{type:'string'} }, required: ['company','role'] } },
    { name: 'bulk_create_applications', description: 'Create multiple job applications at once', parameters: { type: 'object', properties: { applications: { type: 'array', items: { type: 'object', properties: { company:{type:'string'}, role:{type:'string'}, status:{type:'string'}, source:{type:'string'}, url:{type:'string'}, salary_range:{type:'string'}, location:{type:'string'}, notes:{type:'string'}, date_applied:{type:'string'} }, required: ['company','role'] } } }, required: ['applications'] } },
    { name: 'list_skills', description: 'List all current skills', parameters: { type: 'object', properties: {} } },
    { name: 'create_skill', description: 'Create a single skill', parameters: { type: 'object', properties: { name:{type:'string'}, priority:{type:'string'}, current_level:{type:'string'}, target_level:{type:'string'}, status:{type:'string'}, resources:{type:'string'} }, required: ['name'] } },
    { name: 'bulk_create_skills', description: 'Create multiple skills at once', parameters: { type: 'object', properties: { skills: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, priority:{type:'string'}, current_level:{type:'string'}, target_level:{type:'string'}, status:{type:'string'}, resources:{type:'string'} }, required: ['name'] } } }, required: ['skills'] } },
    { name: 'list_contacts', description: 'List all current contacts', parameters: { type: 'object', properties: {} } },
    { name: 'create_contact', description: 'Create a single contact', parameters: { type: 'object', properties: { name:{type:'string'}, title:{type:'string'}, company:{type:'string'}, email:{type:'string'}, linkedin_url:{type:'string'}, how_connected:{type:'string'}, notes:{type:'string'}, outreach_status:{type:'string'}, tags:{type:'array',items:{type:'string'}} }, required: ['name'] } },
    { name: 'bulk_create_contacts', description: 'Create multiple contacts at once', parameters: { type: 'object', properties: { contacts: { type: 'array', items: { type: 'object', properties: { name:{type:'string'}, title:{type:'string'}, company:{type:'string'}, email:{type:'string'}, linkedin_url:{type:'string'}, how_connected:{type:'string'}, notes:{type:'string'}, outreach_status:{type:'string'}, tags:{type:'array',items:{type:'string'}} }, required: ['name'] } } }, required: ['contacts'] } },
  ]
}];

async function execFn(name, args, userId) {
  const sb = getServiceSupabase();
  switch (name) {
    case 'list_applications': {
      const { data } = await sb.from('applications').select('id,company,role,status,source,location').eq('user_id', userId).order('date_created', { ascending: false }).limit(50);
      return { count: data?.length || 0, applications: data || [] };
    }
    case 'create_application': {
      const { company, role, status = 'researching', source, url, salary_range, location, notes, date_applied } = args;
      const { data } = await sb.from('applications').insert({ company, role, status, source, url, salary_range, location, notes, date_applied, user_id: userId, position: 0 }).select('id,company,role,status').single();
      return data || { company, role, status };
    }
    case 'bulk_create_applications': {
      const created = [];
      for (const a of (args.applications || [])) { const r = await execFn('create_application', a, userId); created.push(r); }
      return { created: created.length, applications: created };
    }
    case 'list_skills': {
      const { data } = await sb.from('skills').select('id,name,priority,status,current_level,target_level').eq('user_id', userId).order('date_created', { ascending: false }).limit(50);
      return { count: data?.length || 0, skills: data || [] };
    }
    case 'create_skill': {
      const { name, priority = 'medium', current_level, target_level, status = 'not_started', resources } = args;
      const { data } = await sb.from('skills').insert({ name, priority, current_level, target_level, status, resources, user_id: userId }).select('id,name,priority,status').single();
      return data || { name, priority, status };
    }
    case 'bulk_create_skills': {
      const created = [];
      for (const s of (args.skills || [])) { const r = await execFn('create_skill', s, userId); created.push(r); }
      return { created: created.length, skills: created };
    }
    case 'list_contacts': {
      const { data } = await sb.from('contacts').select('id,name,title,company,outreach_status').eq('user_id', userId).order('date_updated', { ascending: false }).limit(50);
      return { count: data?.length || 0, contacts: data || [] };
    }
    case 'create_contact': {
      const { name, title, company, email, linkedin_url, how_connected, notes, outreach_status = 'not_contacted', tags = [] } = args;
      const { data } = await sb.from('contacts').insert({ name, title, company, email, linkedin_url, how_connected, notes, outreach_status, tags, user_id: userId }).select('id,name,company,outreach_status').single();
      return data || { name, company, outreach_status };
    }
    case 'bulk_create_contacts': {
      const created = [];
      for (const c of (args.contacts || [])) { const r = await execFn('create_contact', c, userId); created.push(r); }
      return { created: created.length, contacts: created };
    }
    default: return { error: `Unknown function: ${name}` };
  }
}

app.post('/api/agent/chat', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { messages = [] } = req.body;
  if (!messages.length) return res.status(400).json({ error: 'Messages required' });

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  const send = (event, data) => { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };

  try {
    const ai = new GoogleGenAI({ apiKey });
    const contents = messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    let loops = 0;
    while (loops++ < 8) {
      const response = await ai.models.generateContent({ model: process.env.GEMINI_MODEL || 'gemini-3.5-flash', contents, config: { systemInstruction: SYSTEM_INSTRUCTION, tools: agentTools } });
      const parts = response.candidates?.[0]?.content?.parts || [];
      let hasFunc = false;
      const fnParts = [];
      for (const part of parts) {
        if (part.text) send('text', { content: part.text });
        if (part.functionCall) {
          hasFunc = true;
          send('function_call', { name: part.functionCall.name, args: part.functionCall.args });
          const result = await execFn(part.functionCall.name, part.functionCall.args || {}, user.id);
          send('function_result', { name: part.functionCall.name, result });
          fnParts.push({ functionResponse: { name: part.functionCall.name, response: result } });
        }
      }
      contents.push({ role: 'model', parts });
      if (hasFunc) contents.push({ role: 'user', parts: fnParts });
      else break;
    }
    send('done', {});
  } catch (err) { send('error', { message: err.message || 'Agent error' }); }
  res.end();
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

export default app;
