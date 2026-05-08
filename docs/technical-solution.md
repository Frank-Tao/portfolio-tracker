# Technical Solution Design

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                   │
│  (Vite + TypeScript + TailwindCSS + Recharts)    │
│                                                   │
│  Pages: Dashboard | Holdings | Transactions |     │
│         Allocation | Profiles | Import | Settings │
└────────────────────────┬────────────────────────┘
                         │ HTTP (localhost:3001)
┌────────────────────────┴────────────────────────┐
│              Express API Server                   │
│                                                   │
│  Routes: /api/funds, /api/transactions,           │
│          /api/prices, /api/buckets,               │
│          /api/profiles, /api/import,              │
│          /api/portfolio                           │
└──────┬─────────────────────────┬────────────────┘
       │                         │
┌──────┴──────┐          ┌───────┴───────┐
│   SQLite    │          │ Yahoo Finance │
│  (on disk)  │          │   (external)  │
└─────────────┘          └───────────────┘
```

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 18 + Vite + TypeScript | Fast dev, type safety |
| Styling | TailwindCSS + shadcn/ui | Rapid UI, consistent design |
| Charts | Recharts | React-native charts, good for financial data |
| Backend | Express.js + TypeScript | Minimal, sufficient for local API |
| Database | better-sqlite3 | Synchronous, fast, single-file, no server needed |
| Price feed | yahoo-finance2 | Reliable ASX ETF data, no API key |
| Excel parse | xlsx (SheetJS) | Handles complex Excel workbooks |
| XIRR calc | xirr (npm) | Annualised return calculation |
| Build | pnpm monorepo | Single repo, shared types |

## Project Structure

```
portfolio-tracker/
├── docs/                    # Planning documents
├── packages/
│   ├── shared/              # Shared TypeScript types
│   │   └── src/types.ts
│   ├── server/              # Express API
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── db/
│   │   │   │   ├── schema.sql
│   │   │   │   ├── connection.ts
│   │   │   │   └── migrations/
│   │   │   ├── routes/
│   │   │   │   ├── funds.ts
│   │   │   │   ├── transactions.ts
│   │   │   │   ├── prices.ts
│   │   │   │   ├── buckets.ts
│   │   │   │   ├── profiles.ts
│   │   │   │   ├── portfolio.ts
│   │   │   │   └── import.ts
│   │   │   ├── services/
│   │   │   │   ├── price-fetcher.ts
│   │   │   │   ├── portfolio-calculator.ts
│   │   │   │   ├── xirr-calculator.ts
│   │   │   │   └── excel-importer.ts
│   │   │   └── middleware/
│   │   └── package.json
│   └── client/              # React frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Holdings.tsx
│       │   │   ├── Transactions.tsx
│       │   │   ├── Allocation.tsx
│       │   │   ├── Profiles.tsx
│       │   │   ├── Import.tsx
│       │   │   └── Settings.tsx
│       │   ├── components/
│       │   │   ├── charts/
│       │   │   ├── tables/
│       │   │   └── layout/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── types/
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
└── tsconfig.base.json
```

## Database Schema

```sql
-- Funds (ETF definitions)
CREATE TABLE funds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticker TEXT UNIQUE NOT NULL,         -- e.g. "VGS"
  name TEXT NOT NULL,                   -- e.g. "MSCI Index International Shares"
  expense_ratio REAL,                   -- e.g. 0.0018
  bucket_id INTEGER REFERENCES buckets(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Allocation Buckets
CREATE TABLE buckets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,           -- e.g. "International Equities"
  color TEXT                            -- hex color for charts
);

-- Transactions (buys, sells)
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER REFERENCES funds(id),
  date TEXT NOT NULL,                   -- ISO date
  type TEXT NOT NULL CHECK(type IN ('buy','sell')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  amount REAL NOT NULL,                 -- quantity * price (negative for sells)
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Distributions (dividends)
CREATE TABLE distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER REFERENCES funds(id),
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  label TEXT,                           -- 'dividend', 'reinvest', 'sell' etc
  created_at TEXT DEFAULT (datetime('now'))
);

-- Cash movements (deposits/withdrawals to brokerage account)
CREATE TABLE cash_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount REAL NOT NULL,                 -- positive = deposit, negative = withdrawal
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Price history (cached from Yahoo Finance)
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fund_id INTEGER REFERENCES funds(id),
  date TEXT NOT NULL,
  price REAL NOT NULL,
  source TEXT DEFAULT 'yahoo',
  UNIQUE(fund_id, date)
);

-- Allocation profiles
CREATE TABLE profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,           -- e.g. "Growth", "Balanced"
  description TEXT,
  is_active INTEGER DEFAULT 0,         -- which one is the current target
  created_at TEXT DEFAULT (datetime('now'))
);

-- Profile target allocations
CREATE TABLE profile_allocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id INTEGER REFERENCES profiles(id),
  bucket_id INTEGER REFERENCES buckets(id),
  target_pct REAL NOT NULL,            -- e.g. 0.40 for 40%
  UNIQUE(profile_id, bucket_id)
);

-- Portfolio snapshots (for historical charts)
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  total_value REAL NOT NULL,
  total_invested REAL NOT NULL,
  cash_balance REAL NOT NULL,
  snapshot_data TEXT,                   -- JSON blob with per-fund breakdown
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Key Services

### Price Fetcher
- Uses `yahoo-finance2` npm package
- ASX tickers formatted as `{TICKER}.AX` (e.g. `VGS.AX`)
- Caches prices in `price_history` table
- Respects rate limits (max 1 request per ticker per hour)
- Provides real-time quote + historical close prices

### Portfolio Calculator
- Computes per-fund: current holdings (sum of buy - sell qty), current value, cost basis, gain/loss
- Computes per-bucket: sum of fund values in bucket, actual weight %
- Computes portfolio: total value, total gain/loss, cash balance
- XIRR: uses transaction dates and amounts for annualised return

### Excel Importer
- Parses workbook using SheetJS
- Detects fund sheets by name matching (VAF, VAP, etc.)
- Extracts transaction rows (row 22+ in each sheet): date, price, qty, amount
- Extracts distribution data from right-side columns (R, S, T)
- Extracts cash movements from Summary sheet column I/J
- Deduplication: skip rows where (date, ticker, qty) already exists

### Rebalance Advisor
- Given: current portfolio values per bucket + selected profile targets
- Calculate: drift per bucket (actual% - target%)
- Suggest: buy/sell amounts to bring within threshold (configurable, default 2%)
- Output: ordered list of actions with dollar amounts

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/funds | List all funds with current holdings |
| POST | /api/funds | Add a new fund |
| GET | /api/transactions?fund_id=&from=&to= | List transactions |
| POST | /api/transactions | Record transaction |
| GET | /api/distributions?fund_id= | List distributions |
| POST | /api/distributions | Record distribution |
| GET | /api/prices/refresh | Trigger price update |
| GET | /api/prices/:ticker | Get latest price |
| GET | /api/buckets | List buckets with actual values |
| POST | /api/buckets | Create/update bucket |
| GET | /api/profiles | List all allocation profiles |
| POST | /api/profiles | Create profile with allocations |
| PUT | /api/profiles/:id/activate | Set as active target |
| GET | /api/portfolio/summary | Dashboard data |
| GET | /api/portfolio/performance?period= | Historical performance |
| GET | /api/portfolio/rebalance?profile_id= | Rebalance suggestions |
| POST | /api/import/excel | Upload and parse Excel file |
| GET | /api/cash | Cash movements and balance |
| POST | /api/cash | Record deposit/withdrawal |
