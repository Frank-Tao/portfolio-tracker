# Implementation Plan

## Phase 1 — Foundation (Core Data Layer)
**Goal**: Database, basic API, fund CRUD, transaction recording

### Tasks
1. Initialise pnpm monorepo with shared/server/client packages
2. Set up TypeScript config, ESLint, Prettier
3. Create SQLite schema + migration runner (server)
4. Implement `funds` CRUD routes + seed data (8 Vanguard ETFs)
5. Implement `buckets` CRUD + seed default buckets
6. Implement `transactions` routes (buy/sell)
7. Implement `distributions` routes
8. Implement `cash_movements` routes
9. Basic integration tests with sample data

**Deliverable**: API server with working CRUD on localhost:3001

---

## Phase 2 — Excel Import
**Goal**: Parse existing workbook and populate database

### Tasks
1. Build Excel parser service (SheetJS)
2. Map Vertex42 sheet structure → transactions + distributions
3. Parse Summary sheet → cash movements
4. Handle deduplication logic (date + ticker + qty match)
5. POST `/api/import/excel` endpoint with multipart upload
6. Test with actual workbook file
7. Verify imported data matches Excel totals

**Deliverable**: Full historical data imported from xlsx

---

## Phase 3 — Price Feed & Portfolio Calculations
**Goal**: Live prices, portfolio valuation, XIRR

### Tasks
1. Integrate `yahoo-finance2` for ASX ETF quotes
2. Price caching layer (SQLite + hourly TTL)
3. Portfolio calculator service:
   - Per-fund: holdings qty, avg cost, current value, gain/loss
   - Per-bucket: aggregate value, actual weight %
   - Portfolio: total value, total gain, cash balance
4. XIRR calculator using transaction cash flows
5. Snapshot service (save daily snapshot when prices refresh)
6. `/api/portfolio/summary` and `/api/portfolio/performance` endpoints

**Deliverable**: Accurate portfolio valuation matching Excel calculations

---

## Phase 4 — Frontend Shell & Dashboard
**Goal**: React app with navigation and dashboard page

### Tasks
1. Scaffold Vite + React + TypeScript + TailwindCSS + shadcn/ui
2. App layout: sidebar nav, header, main content area
3. API client layer (fetch wrapper with types)
4. Dashboard page:
   - Summary cards (total value, gain, cash, return %)
   - Allocation pie chart (Recharts)
   - Portfolio value line chart (historical)
   - Holdings table with current values
5. Auto-refresh prices on page load

**Deliverable**: Working dashboard showing live portfolio state

---

## Phase 5 — Holdings & Transactions UI
**Goal**: Full CRUD for funds, transactions, distributions

### Tasks
1. Holdings page: fund list with drill-down
2. Fund detail view: transaction history, distribution history, performance chart
3. Add Transaction form (buy/sell)
4. Add Distribution form
5. Cash movements page (deposits/withdrawals)
6. Data tables with sort, filter, pagination

**Deliverable**: Complete data management UI

---

## Phase 6 — Allocation & Profiles
**Goal**: Bucket visualisation, target profiles, rebalance suggestions

### Tasks
1. Allocation page:
   - Current allocation bar/pie chart
   - Actual vs target comparison (stacked bar)
   - Drift indicators (green/amber/red)
2. Profile management:
   - List profiles (Growth, Balanced, Conservative, Custom)
   - Create/edit profile with per-bucket target %
   - Activate a profile as current target
3. Rebalance advisor:
   - Calculate drift per bucket
   - Suggest buy/sell actions with $ amounts
   - "What-if" mode: simulate adding $X, show how to distribute

**Deliverable**: Full allocation tracking with actionable rebalance advice

---

## Phase 7 — Import UI & Settings
**Goal**: Drag-and-drop Excel import, app configuration

### Tasks
1. Import page: file picker + drag-and-drop zone
2. Import preview: show parsed data before committing
3. Import history log
4. Settings page:
   - Price refresh interval
   - Drift threshold for alerts
   - Data export (JSON/CSV backup)
   - Database reset

**Deliverable**: Self-service import and configuration

---

## Phase 8 — Polish & Enhancements
**Goal**: UX refinements, performance, edge cases

### Tasks
1. Loading states, error handling, toast notifications
2. Responsive layout (tablet-friendly)
3. Keyboard shortcuts for common actions
4. Dark/light theme toggle
5. Performance optimisation (lazy loading, memoisation)
6. Data validation and error recovery for imports
7. README with setup instructions

**Deliverable**: Production-quality local app

---

## Default Seed Data

### Buckets
| Bucket | Funds | Color |
|--------|-------|-------|
| Australian Fixed Income | VAF | #3B82F6 |
| Australian Property | VAP | #8B5CF6 |
| Australian Equities (High Yield) | VHY | #EF4444 |
| Australian Equities | VAS | #F59E0B |
| International Equities (ESG) | VESG | #10B981 |
| Global Bonds | VBND | #6366F1 |
| International Equities | VGS | #06B6D4 |
| International Small Cap | VISM | #EC4899 |

### Default Profiles
| Profile | AU Equity | Intl Equity | Bonds | Property | Small Cap |
|---------|-----------|-------------|-------|----------|-----------|
| Growth | 15% | 55% | 10% | 5% | 15% |
| Balanced | 20% | 40% | 25% | 10% | 5% |
| Conservative | 15% | 20% | 50% | 10% | 5% |

(VHY + VAS → AU Equity; VGS + VESG → Intl Equity; VAF + VBND → Bonds; VAP → Property; VISM → Small Cap)

---

## Estimated Timeline
| Phase | Effort |
|-------|--------|
| Phase 1 | 1 session |
| Phase 2 | 1 session |
| Phase 3 | 1 session |
| Phase 4 | 1 session |
| Phase 5 | 1 session |
| Phase 6 | 1 session |
| Phase 7 | 0.5 session |
| Phase 8 | 0.5 session |

Total: ~7 working sessions
