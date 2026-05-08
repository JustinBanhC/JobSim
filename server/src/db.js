import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'jobsim.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'researching',
    source TEXT,
    url TEXT,
    salary_range TEXT,
    location TEXT,
    notes TEXT,
    date_applied TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now')),
    date_updated TEXT NOT NULL DEFAULT (datetime('now')),
    position INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS application_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    note TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    title TEXT,
    company TEXT,
    email TEXT,
    linkedin_url TEXT,
    how_connected TEXT,
    notes TEXT,
    outreach_status TEXT NOT NULL DEFAULT 'not_contacted',
    tags TEXT DEFAULT '[]',
    date_created TEXT NOT NULL DEFAULT (datetime('now')),
    date_updated TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    template_type TEXT NOT NULL,
    draft TEXT NOT NULL,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    current_level TEXT,
    target_level TEXT,
    status TEXT NOT NULL DEFAULT 'not_started',
    resources TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS learning_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id INTEGER REFERENCES skills(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    time_spent INTEGER,
    notes TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS project_ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    skill_ids TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'idea',
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export default db;
