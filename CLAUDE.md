# Portfolio Tracker

Personal investment portfolio management app for tracking Vanguard ETFs on ASX.

## Quick Start

```bash
pnpm install
pnpm dev          # Starts both server (3001) and client (3000)
pnpm dev:server   # Server only
pnpm dev:client   # Client only
```

## Architecture

- `packages/server` — Express API + SQLite (better-sqlite3)
- `packages/client` — React + Vite + TailwindCSS
- `packages/shared` — TypeScript types shared between packages

## Key APIs

- `POST /api/import/excel/path` — Import from Excel file path
- `GET /api/prices/refresh` — Fetch live prices from Yahoo Finance
- `GET /api/portfolio/summary` — Full portfolio valuation
- `GET /api/portfolio/rebalance` — Rebalance suggestions

## Database

SQLite stored at `~/.portfolio-tracker/portfolio.db`. Delete to reset.

## Price Source

Yahoo Finance v8 chart API (no auth key needed). ASX tickers formatted as `{TICKER}.AX`.
