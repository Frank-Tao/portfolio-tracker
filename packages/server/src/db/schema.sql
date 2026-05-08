CREATE TABLE IF NOT EXISTS buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  color TEXT
);

CREATE TABLE IF NOT EXISTS funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  expense_ratio REAL,
  bucket_id INTEGER REFERENCES buckets(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  label TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'deposit',
  amount REAL NOT NULL,
  notes TEXT,
  related_fund_id INTEGER REFERENCES funds(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  date TEXT NOT NULL,
  price REAL NOT NULL,
  source TEXT DEFAULT 'yahoo',
  UNIQUE(fund_id, date)
);

CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS profile_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER NOT NULL REFERENCES profiles(id),
  bucket_id INTEGER NOT NULL REFERENCES buckets(id),
  target_pct REAL NOT NULL,
  UNIQUE(profile_id, bucket_id)
);

CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  total_value REAL NOT NULL,
  total_invested REAL NOT NULL,
  cash_balance REAL NOT NULL,
  snapshot_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_fund_date ON transactions(fund_id, date);
CREATE INDEX IF NOT EXISTS idx_distributions_fund_date ON distributions(fund_id, date);
CREATE INDEX IF NOT EXISTS idx_price_history_fund_date ON price_history(fund_id, date);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(date);
