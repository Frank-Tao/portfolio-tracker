import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_DIR = join(homedir(), '.portfolio-tracker');
const DB_PATH = join(DB_DIR, 'portfolio.db');

if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  const seed = readFileSync(join(__dirname, 'seed.sql'), 'utf-8');
  db.exec(seed);

  migrate(db);
}

function migrate(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(cash_movements)").all() as any[];
  const colNames = columns.map((c: any) => c.name);

  if (!colNames.includes('type')) {
    db.exec("ALTER TABLE cash_movements ADD COLUMN type TEXT NOT NULL DEFAULT 'deposit'");
  }
  if (!colNames.includes('related_fund_id')) {
    db.exec("ALTER TABLE cash_movements ADD COLUMN related_fund_id INTEGER REFERENCES funds(id)");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      session_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens(email, token);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
  `);
}

export default db;
