import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import requireAuth from './middleware/auth.js';
import applicationsRouter from './routes/applications.js';
import contactsRouter from './routes/contacts.js';
import skillsRouter from './routes/skills.js';
import agentRouter from './routes/agent.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/applications', requireAuth, applicationsRouter);
app.use('/api/contacts', requireAuth, contactsRouter);
app.use('/api/skills', requireAuth, skillsRouter);
app.use('/api/agent', requireAuth, agentRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
