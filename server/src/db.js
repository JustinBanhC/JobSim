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

  CREATE TABLE IF NOT EXISTS job_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    board_type TEXT NOT NULL,
    config TEXT NOT NULL DEFAULT '{}',
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run TEXT,
    last_result TEXT,
    date_created TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS discovered_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    source_id INTEGER REFERENCES job_sources(id) ON DELETE SET NULL,
    external_id TEXT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    location TEXT,
    description TEXT,
    posted_date TEXT,
    score INTEGER,
    score_reasons TEXT,
    hard_filter_result TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    date_discovered TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_discovered_jobs_source_external
    ON discovered_jobs(source, external_id) WHERE external_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}',
    date_updated TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS search_prefs (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL DEFAULT '{}',
    date_updated TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    host TEXT,
    event_type TEXT DEFAULT 'other',
    url TEXT UNIQUE,
    source TEXT DEFAULT 'other',
    location TEXT,
    is_virtual INTEGER,
    event_date TEXT,
    description TEXT,
    score INTEGER,
    score_reasons TEXT,
    status TEXT DEFAULT 'new',
    notes TEXT,
    date_discovered TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS application_answers (
    job_id INTEGER PRIMARY KEY REFERENCES discovered_jobs(id) ON DELETE CASCADE,
    data TEXT NOT NULL DEFAULT '[]',
    date_updated TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function addColumnIfMissing(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

addColumnIfMissing('contacts', 'discovered_job_id', 'discovered_job_id INTEGER REFERENCES discovered_jobs(id) ON DELETE SET NULL');

export default db;
