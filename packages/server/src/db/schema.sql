CREATE TABLE IF NOT EXISTS buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  expense_ratio REAL,
  bucket_id INTEGER REFERENCES buckets(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, ticker)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('buy','sell')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'deposit',
  amount REAL NOT NULL,
  notes TEXT,
  related_fund_id INTEGER REFERENCES funds(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  date TEXT NOT NULL,
  price REAL NOT NULL,
  source TEXT DEFAULT 'yahoo',
  UNIQUE(user_id, fund_id, date)
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS profile_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  bucket_id INTEGER NOT NULL REFERENCES buckets(id),
  target_pct REAL NOT NULL,
  UNIQUE(user_id, profile_id, bucket_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  date TEXT NOT NULL,
  total_value REAL NOT NULL,
  total_invested REAL NOT NULL,
  cash_balance REAL NOT NULL,
  snapshot_data TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  actor_email TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_fund_date ON transactions(user_id, fund_id, date);
CREATE INDEX IF NOT EXISTS idx_distributions_user_fund_date ON distributions(user_id, fund_id, date);
CREATE INDEX IF NOT EXISTS idx_price_history_user_fund_date ON price_history(user_id, fund_id, date);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON snapshots(user_id, date);
CREATE INDEX IF NOT EXISTS idx_funds_user_ticker ON funds(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_buckets_user_name ON buckets(user_id, name);
CREATE INDEX IF NOT EXISTS idx_profiles_user_name ON profiles(user_id, name);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_email ON auth_tokens(email, token);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_user_id, created_at DESC);
