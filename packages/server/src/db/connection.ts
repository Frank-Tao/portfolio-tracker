import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isVercelRuntime = Boolean(process.env.VERCEL);
const useInMemoryDb = isVercelRuntime || process.env.PORTFOLIO_DB_MODE === 'memory';
const shouldBootstrapFromJson =
  process.env.PORTFOLIO_BOOTSTRAP_JSON === 'true' ||
  (isVercelRuntime && process.env.PORTFOLIO_BOOTSTRAP_JSON !== 'false');

const DB_DIR = join(homedir(), '.portfolio-tracker');
const DB_PATH = useInMemoryDb ? ':memory:' : join(DB_DIR, 'portfolio.db');

if (!useInMemoryDb && !existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

const db: Database.Database = new Database(DB_PATH);

if (!useInMemoryDb) {
  db.pragma('journal_mode = WAL');
}
db.pragma('foreign_keys = ON');

const TENANT_TABLES = [
  'buckets',
  'funds',
  'transactions',
  'distributions',
  'cash_movements',
  'price_history',
  'profiles',
  'profile_allocations',
  'snapshots',
] as const;

const DEFAULT_BUCKETS = [
  ['Australian Fixed Income', '#3B82F6'],
  ['Australian Property', '#8B5CF6'],
  ['Australian Equities', '#F59E0B'],
  ['International Equities', '#10B981'],
  ['Global Bonds', '#6366F1'],
  ['International Small Cap', '#EC4899'],
  ['Diversified', '#F97316'],
  ['Asia Pacific', '#14B8A6'],
  ['Cash', '#6B7280'],
] as const;

const DEFAULT_FUNDS = [
  ['VAF', 'Australian Fixed Interest Index ETF', 0.0010, 'Australian Fixed Income'],
  ['VAP', 'Australian Property Securities Index ETF', 0.0023, 'Australian Property'],
  ['VHY', 'Australian Shares High Yield ETF', 0.0025, 'Australian Equities'],
  ['VAS', 'Australian Shares Index ETF', 0.0007, 'Australian Equities'],
  ['VESG', 'Ethically Conscious International Shares ETF', 0.0018, 'International Equities'],
  ['VBND', 'Global Aggregate Bond Index ETF', 0.0020, 'Global Bonds'],
  ['VGS', 'MSCI Index International Shares ETF', 0.0018, 'International Equities'],
  ['VISM', 'MSCI International Small Companies ETF', 0.0032, 'International Small Cap'],
  ['VDHG', 'Diversified High Growth Index ETF', 0.0027, 'Diversified'],
  ['VAE', 'FTSE Asia ex Japan Shares Index ETF', 0.0040, 'Asia Pacific'],
  ['V500', 'S&P 500 ETF', 0.0003, 'International Equities'],
  ['CASHFUND', 'Vanguard Cash Plus Fund', 0.0020, 'Cash'],
] as const;

type ProfileSeed = {
  name: string;
  description: string;
  isActive: number;
  allocations: Array<{ bucket: string; target: number }>;
};

const DEFAULT_PROFILES: ProfileSeed[] = [
  {
    name: 'Growth',
    description: 'Higher equity allocation for long-term capital growth',
    isActive: 1,
    allocations: [
      { bucket: 'Australian Equities', target: 0.15 },
      { bucket: 'International Equities', target: 0.55 },
      { bucket: 'Australian Fixed Income', target: 0.03 },
      { bucket: 'Global Bonds', target: 0.07 },
      { bucket: 'Australian Property', target: 0.05 },
      { bucket: 'International Small Cap', target: 0.15 },
    ],
  },
  {
    name: 'Balanced',
    description: 'Mix of growth and defensive assets',
    isActive: 0,
    allocations: [
      { bucket: 'Australian Equities', target: 0.20 },
      { bucket: 'International Equities', target: 0.40 },
      { bucket: 'Australian Fixed Income', target: 0.10 },
      { bucket: 'Global Bonds', target: 0.15 },
      { bucket: 'Australian Property', target: 0.10 },
      { bucket: 'International Small Cap', target: 0.05 },
    ],
  },
  {
    name: 'Conservative',
    description: 'Capital preservation with moderate growth',
    isActive: 0,
    allocations: [
      { bucket: 'Australian Equities', target: 0.15 },
      { bucket: 'International Equities', target: 0.20 },
      { bucket: 'Australian Fixed Income', target: 0.25 },
      { bucket: 'Global Bonds', target: 0.25 },
      { bucket: 'Australian Property', target: 0.10 },
      { bucket: 'International Small Cap', target: 0.05 },
    ],
  },
];

export function initializeDatabase(): void {
  preflightLegacyTables();
  const schema = readAssetFile('schema.sql');
  db.exec(schema);

  migrate(db);

  const ownerUserId = ensureDefaultOwnerUser();
  if (shouldBootstrapFromJson && hasBootstrapJson()) {
    hydrateFromBootstrapJson(ownerUserId);
  }
}

function preflightLegacyTables(): void {
  const maybeAdd = (table: string, columnDefinition: string) => {
    if (!tableExists(table)) return;
    const [columnName] = columnDefinition.split(/\s+/);
    if (!tableColumns(table).includes(columnName)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
    }
  };

  maybeAdd('users', 'is_admin INTEGER NOT NULL DEFAULT 0');
  maybeAdd('cash_movements', "type TEXT NOT NULL DEFAULT 'deposit'");
  maybeAdd('cash_movements', 'related_fund_id INTEGER REFERENCES funds(id)');

  maybeAdd('buckets', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('funds', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('transactions', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('distributions', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('cash_movements', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('price_history', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('profiles', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('profile_allocations', 'user_id INTEGER REFERENCES users(id)');
  maybeAdd('snapshots', 'user_id INTEGER REFERENCES users(id)');
}

export function ensureTenantBaseData(userId: number): void {
  const existing = db.prepare('SELECT COUNT(*) as count FROM buckets WHERE user_id = ?').get(userId) as { count: number };
  if (existing.count > 0) return;

  const insertBucket = db.prepare('INSERT INTO buckets (user_id, name, color) VALUES (?, ?, ?)');
  const insertFund = db.prepare('INSERT INTO funds (user_id, ticker, name, expense_ratio, bucket_id) VALUES (?, ?, ?, ?, ?)');
  const insertProfile = db.prepare('INSERT INTO profiles (user_id, name, description, is_active) VALUES (?, ?, ?, ?)');
  const insertProfileAlloc = db.prepare(`
    INSERT INTO profile_allocations (user_id, profile_id, bucket_id, target_pct)
    VALUES (?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const [name, color] of DEFAULT_BUCKETS) {
      insertBucket.run(userId, name, color);
    }

    const bucketIdByName = new Map<string, number>();
    const bucketRows = db.prepare('SELECT id, name FROM buckets WHERE user_id = ?').all(userId) as Array<{ id: number; name: string }>;
    for (const row of bucketRows) {
      bucketIdByName.set(row.name, row.id);
    }

    for (const [ticker, name, expenseRatio, bucketName] of DEFAULT_FUNDS) {
      insertFund.run(userId, ticker, name, expenseRatio, bucketIdByName.get(bucketName) ?? null);
    }

    for (const profile of DEFAULT_PROFILES) {
      const profileResult = insertProfile.run(userId, profile.name, profile.description, profile.isActive);
      const profileId = Number(profileResult.lastInsertRowid);
      for (const alloc of profile.allocations) {
        const bucketId = bucketIdByName.get(alloc.bucket);
        if (!bucketId) continue;
        insertProfileAlloc.run(userId, profileId, bucketId, alloc.target);
      }
    }
  });

  tx();
}

function migrate(db: Database.Database): void {
  const cashColumns = tableColumns('cash_movements');
  if (!cashColumns.includes('type')) {
    db.exec("ALTER TABLE cash_movements ADD COLUMN type TEXT NOT NULL DEFAULT 'deposit'");
  }
  if (!cashColumns.includes('related_fund_id')) {
    db.exec("ALTER TABLE cash_movements ADD COLUMN related_fund_id INTEGER REFERENCES funds(id)");
  }

  addColumnIfMissing('users', 'is_admin INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('buckets', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('funds', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('transactions', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('distributions', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('cash_movements', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('price_history', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('profiles', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('profile_allocations', 'user_id INTEGER REFERENCES users(id)');
  addColumnIfMissing('snapshots', 'user_id INTEGER REFERENCES users(id)');

  db.exec(`
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
    )
  `);

  const ownerUserId = ensureDefaultOwnerUser();
  backfillTenantOwnership(ownerUserId);
  rebuildLegacyUniqueConstraints();
  ensureTenantIndexes();
}

function addColumnIfMissing(table: string, columnDefinition: string): void {
  const [columnName] = columnDefinition.split(/\s+/);
  const columns = tableColumns(table);
  if (!columns.includes(columnName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDefinition}`);
  }
}

function tableColumns(table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function ensureDefaultOwnerUser(): number {
  const first = db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get() as { id: number } | undefined;
  if (first) return first.id;

  const defaultEmail = (process.env.PORTFOLIO_DEFAULT_OWNER_EMAIL || 'demo@portfolio.local').trim().toLowerCase();
  const isAdmin = isConfiguredAdmin(defaultEmail) ? 1 : 0;
  const result = db.prepare('INSERT INTO users (email, name, is_admin) VALUES (?, ?, ?)').run(defaultEmail, 'Default User', isAdmin);
  return Number(result.lastInsertRowid);
}

function isConfiguredAdmin(email: string): boolean {
  const raw = process.env.PORTFOLIO_ADMIN_EMAILS || '';
  const allowed = raw.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function backfillTenantOwnership(ownerUserId: number): void {
  const tx = db.transaction(() => {
    for (const table of TENANT_TABLES) {
      db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id IS NULL`).run(ownerUserId);
    }
  });
  tx();
}

function rebuildLegacyUniqueConstraints(): void {
  const fundsSql = tableSql('funds');
  const bucketsSql = tableSql('buckets');
  const profilesSql = tableSql('profiles');
  const priceHistorySql = tableSql('price_history');
  const profileAllocSql = tableSql('profile_allocations');
  const snapshotsSql = tableSql('snapshots');
  const transactionsSql = tableSql('transactions');
  const distributionsSql = tableSql('distributions');
  const cashMovementsSql = tableSql('cash_movements');

  const needsRebuild =
    /ticker\s+TEXT\s+UNIQUE/i.test(fundsSql) ||
    /name\s+TEXT\s+UNIQUE/i.test(bucketsSql) ||
    /name\s+TEXT\s+UNIQUE/i.test(profilesSql) ||
    /UNIQUE\s*\(\s*fund_id\s*,\s*date\s*\)/i.test(priceHistorySql) ||
    /UNIQUE\s*\(\s*profile_id\s*,\s*bucket_id\s*\)/i.test(profileAllocSql) ||
    !/UNIQUE\s*\(\s*user_id\s*,\s*date\s*\)/i.test(snapshotsSql) ||
    /funds_legacy/i.test(transactionsSql) ||
    /funds_legacy/i.test(distributionsSql) ||
    /funds_legacy/i.test(cashMovementsSql);

  if (!needsRebuild) return;

  db.pragma('foreign_keys = OFF');
  try {
    db.exec(`
      ALTER TABLE buckets RENAME TO buckets_legacy;
      CREATE TABLE buckets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        color TEXT,
        UNIQUE(user_id, name)
      );
      INSERT INTO buckets (id, user_id, name, color)
      SELECT id, user_id, name, color FROM buckets_legacy;
      DROP TABLE buckets_legacy;

      ALTER TABLE funds RENAME TO funds_legacy;
      CREATE TABLE funds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        ticker TEXT NOT NULL,
        name TEXT NOT NULL,
        expense_ratio REAL,
        bucket_id INTEGER REFERENCES buckets(id),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, ticker)
      );
      INSERT INTO funds (id, user_id, ticker, name, expense_ratio, bucket_id, created_at)
      SELECT id, user_id, ticker, name, expense_ratio, bucket_id, created_at FROM funds_legacy;
      DROP TABLE funds_legacy;

      ALTER TABLE transactions RENAME TO transactions_legacy;
      CREATE TABLE transactions (
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
      INSERT INTO transactions (id, user_id, fund_id, date, type, quantity, price, amount, notes, created_at)
      SELECT id, user_id, fund_id, date, type, quantity, price, amount, notes, created_at FROM transactions_legacy;
      DROP TABLE transactions_legacy;

      ALTER TABLE distributions RENAME TO distributions_legacy;
      CREATE TABLE distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        fund_id INTEGER NOT NULL REFERENCES funds(id),
        date TEXT NOT NULL,
        amount REAL NOT NULL,
        label TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO distributions (id, user_id, fund_id, date, amount, label, created_at)
      SELECT id, user_id, fund_id, date, amount, label, created_at FROM distributions_legacy;
      DROP TABLE distributions_legacy;

      ALTER TABLE cash_movements RENAME TO cash_movements_legacy;
      CREATE TABLE cash_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        date TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'deposit',
        amount REAL NOT NULL,
        notes TEXT,
        related_fund_id INTEGER REFERENCES funds(id),
        created_at TEXT DEFAULT (datetime('now'))
      );
      INSERT INTO cash_movements (id, user_id, date, type, amount, notes, related_fund_id, created_at)
      SELECT id, user_id, date, type, amount, notes, related_fund_id, created_at FROM cash_movements_legacy;
      DROP TABLE cash_movements_legacy;

      ALTER TABLE profiles RENAME TO profiles_legacy;
      CREATE TABLE profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, name)
      );
      INSERT INTO profiles (id, user_id, name, description, is_active, created_at)
      SELECT id, user_id, name, description, is_active, created_at FROM profiles_legacy;
      DROP TABLE profiles_legacy;

      ALTER TABLE profile_allocations RENAME TO profile_allocations_legacy;
      CREATE TABLE profile_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        profile_id INTEGER NOT NULL REFERENCES profiles(id),
        bucket_id INTEGER NOT NULL REFERENCES buckets(id),
        target_pct REAL NOT NULL,
        UNIQUE(user_id, profile_id, bucket_id)
      );
      INSERT INTO profile_allocations (id, user_id, profile_id, bucket_id, target_pct)
      SELECT id, user_id, profile_id, bucket_id, target_pct FROM profile_allocations_legacy;
      DROP TABLE profile_allocations_legacy;

      ALTER TABLE price_history RENAME TO price_history_legacy;
      CREATE TABLE price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        fund_id INTEGER NOT NULL REFERENCES funds(id),
        date TEXT NOT NULL,
        price REAL NOT NULL,
        source TEXT DEFAULT 'yahoo',
        UNIQUE(user_id, fund_id, date)
      );
      INSERT INTO price_history (id, user_id, fund_id, date, price, source)
      SELECT id, user_id, fund_id, date, price, source FROM price_history_legacy;
      DROP TABLE price_history_legacy;

      ALTER TABLE snapshots RENAME TO snapshots_legacy;
      CREATE TABLE snapshots (
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
      INSERT INTO snapshots (id, user_id, date, total_value, total_invested, cash_balance, snapshot_data, created_at)
      SELECT id, user_id, date, total_value, total_invested, cash_balance, snapshot_data, created_at FROM snapshots_legacy;
      DROP TABLE snapshots_legacy;
    `);
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function tableSql(table: string): string {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql?: string } | undefined;
  return row?.sql || '';
}

function tableExists(table: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function ensureTenantIndexes(): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created ON activity_logs(actor_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_fund_date ON transactions(user_id, fund_id, date);
    CREATE INDEX IF NOT EXISTS idx_distributions_user_fund_date ON distributions(user_id, fund_id, date);
    CREATE INDEX IF NOT EXISTS idx_price_history_user_fund_date ON price_history(user_id, fund_id, date);
    CREATE INDEX IF NOT EXISTS idx_snapshots_user_date ON snapshots(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_funds_user_ticker ON funds(user_id, ticker);
    CREATE INDEX IF NOT EXISTS idx_buckets_user_name ON buckets(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_profiles_user_name ON profiles(user_id, name);
  `);
}

function readAssetFile(filename: string): string {
  const candidates = [
    join(__dirname, filename),
    join(process.cwd(), 'src', 'db', filename),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf-8');
    }
  }
  throw new Error(`DB asset file not found: ${filename}`);
}

function readAssetJson<T>(filename: string): T {
  return JSON.parse(readAssetFile(filename)) as T;
}

function hasBootstrapJson(): boolean {
  const candidates = [
    join(__dirname, 'bootstrap-data.json'),
    join(process.cwd(), 'src', 'db', 'bootstrap-data.json'),
  ];
  return candidates.some((filePath) => existsSync(filePath));
}

type Row = Record<string, unknown>;
type BootstrapData = Record<string, Row[]>;

function tableCount(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
  return row.count;
}

function withTenantRow(table: string, row: Row, ownerUserId: number): Row {
  if (!TENANT_TABLES.includes(table as (typeof TENANT_TABLES)[number])) {
    return row;
  }
  return row.user_id == null ? { ...row, user_id: ownerUserId } : row;
}

function hydrateFromBootstrapJson(ownerUserId: number): void {
  const hasData = tableCount('funds') > 0 || tableCount('transactions') > 0;
  const overwrite = process.env.PORTFOLIO_BOOTSTRAP_OVERWRITE === 'true';
  if (hasData && !overwrite) {
    return;
  }

  const bootstrap = readAssetJson<BootstrapData>('bootstrap-data.json');

  const deleteOrder = [
    'activity_logs',
    'sessions',
    'auth_tokens',
    'snapshots',
    'profile_allocations',
    'profiles',
    'price_history',
    'cash_movements',
    'distributions',
    'transactions',
    'funds',
    'buckets',
    'users',
  ];

  const insertOrder = [
    'users',
    'buckets',
    'funds',
    'transactions',
    'distributions',
    'cash_movements',
    'price_history',
    'profiles',
    'profile_allocations',
    'snapshots',
    'auth_tokens',
    'sessions',
  ];

  const insertRows = (table: string, rows: Row[]) => {
    if (!rows.length) return;
    const patchedRows = rows.map((row) => withTenantRow(table, row, ownerUserId));
    const columns = Object.keys(patchedRows[0]);
    const placeholders = columns.map(() => '?').join(', ');
    const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
    for (const row of patchedRows) {
      const values = columns.map((col) => row[col]);
      stmt.run(...values);
    }
  };

  const tx = db.transaction(() => {
    db.pragma('foreign_keys = OFF');
    for (const table of deleteOrder) {
      db.prepare(`DELETE FROM ${table}`).run();
    }
    db.prepare('DELETE FROM sqlite_sequence').run();
    for (const table of insertOrder) {
      insertRows(table, bootstrap[table] || []);
    }
    db.pragma('foreign_keys = ON');
  });

  tx();
}

export default db;
