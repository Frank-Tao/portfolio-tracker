# Portfolio Performance Tracker - Requirements Specification

## Overview
A local React application for managing and analysing a personal investment portfolio of Vanguard ETFs (ASX-listed). Replaces the current Excel-based tracker with a richer, automated experience.

## Users
Single user (owner), running locally on macOS.

## Functional Requirements

### F1 - Fund & Holdings Management
- CRUD operations for funds (ticker, name, expense ratio, asset class/bucket)
- Pre-seeded with current holdings: VAF, VAP, VHY, VAS, VESG, VBND, VGS, VISM
- Each fund belongs to an **allocation bucket** (see F3)

### F2 - Transaction Management
- Record buy/sell transactions: date, ticker, quantity, price, total amount
- Record distribution/dividend events: date, ticker, amount, label (reinvest/cash)
- Record cash deposits/withdrawals into the portfolio account
- Import from existing Excel file (`.xlsx`) as initial seed and ongoing bi-weekly refresh

### F3 - Allocation Buckets & Budget
- Define buckets: e.g. "Australian Equities", "International Equities", "Bonds/Fixed Income", "Property", "Small Cap International"
- Map each fund to a bucket
- Set **target allocation %** per bucket (must sum to 100%)
- Display actual vs target allocation with drift indicators
- Support multiple target profiles (e.g. "Growth", "Balanced", "Conservative") so user can compare

### F4 - Live Price Updates
- Auto-fetch current market prices for ASX-listed ETFs (Yahoo Finance API — free, no key)
- Frequency: on-demand refresh + optional periodic (e.g. daily when app is open)
- Fallback: manual price entry

### F5 - Portfolio Valuation & Performance
- **Portfolio-level**: total invested, total current value, total gain/loss ($, %), cash balance
- **Per-fund**: current value, gain/loss ($, %), annualised return (XIRR), period returns
- **Per-bucket**: bucket value, bucket weight, bucket gain/loss
- Historical snapshots for trend charts

### F6 - Investment Profile Comparison (Advice-lite)
- Pre-defined allocation profiles:
  - **Growth** (e.g. 70% intl equities, 15% AU equities, 10% small cap, 5% bonds)
  - **Balanced** (e.g. 40% intl equities, 20% AU equities, 10% small cap, 20% bonds, 10% property)
  - **Conservative** (e.g. 20% equities, 50% bonds, 20% AU equities, 10% property)
  - **Custom** (user-defined)
- Show current portfolio overlaid against each profile
- Highlight rebalance actions needed to reach a selected profile
- Provide rebalance suggestions: "Buy $X of VBND" / "Sell $Y of VGS"
- Note: this is informational, not financial advice

### F7 - Excel Import
- Parse the Vertex42-style workbook (per-fund sheets + Summary)
- Map columns: Date, Market Price, Invested QTY, Amount Invested, distributions
- Handle incremental import (merge new rows, skip duplicates by date+ticker)
- Support drag-and-drop or file picker

### F8 - Dashboard
- Summary cards: total value, total gain, cash, overall return %
- Allocation pie chart (actual vs target)
- Performance line chart (portfolio value over time)
- Per-fund table with sparklines
- Alerts: "bucket drift > 5%" or "new dividends received"

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Stack | React (Vite), TypeScript, TailwindCSS, SQLite (via better-sqlite3 or sql.js) |
| Backend | Lightweight Node/Express API or Tauri for native feel; start with Express |
| Storage | SQLite file on disk (~/.portfolio-tracker/portfolio.db) |
| Price API | Yahoo Finance (no auth), with caching to avoid rate limits |
| Charts | Recharts or Chart.js |
| Deployment | Local dev server (`npm run dev`) for now |
| Performance | Sub-second page loads, price fetch < 3s |
| Data safety | SQLite WAL mode, periodic JSON export as backup |

## Out of Scope (v1)
- Multi-user / authentication
- Cloud deployment
- Tax reporting / CGT calculations
- Broker integration (auto-import from CommSec etc.)
- Mobile app
