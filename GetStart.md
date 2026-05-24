# Portfolio Tracker - Get Started

Portfolio Tracker is a full-stack monorepo app for tracking holdings, transactions, distributions, cash, and portfolio performance.
It supports multi-tenant data isolation: each account has its own portfolio dataset.

## Tech Stack

- Frontend: React + Vite (`packages/client`)
- Backend: Express + TypeScript (`packages/server`)
- Shared types: TypeScript package (`packages/shared`)
- Database: SQLite (`better-sqlite3`)

## Prerequisites

- Node.js
- pnpm

## Install

From the repo root:

```bash
pnpm install
```

## Run Locally

Run both frontend and backend together:

```bash
pnpm dev
```

Default local URLs:

- Frontend: `http://localhost:8000`
- Backend API: `http://localhost:8001`
- Health check: `http://localhost:8001/api/health`

After startup, open the frontend and sign in from the login screen.
If SMTP is not configured, the backend returns a `dev_token` that you can use as the login code.

## Optional: Run In Demo Mode (Skip Auth)

If you want to bypass login during local development:

```bash
PORTFOLIO_DISABLE_AUTH=true pnpm dev

## Admin Account (Optional)

To grant admin access (Admin page + system account/activity APIs), set admin emails before startup:

```bash
PORTFOLIO_ADMIN_EMAILS=you@example.com pnpm dev
```
```

## Run Separately

Backend only:

```bash
pnpm dev:server
```

Frontend only:

```bash
pnpm dev:client
```

## Build And Test

```bash
pnpm -r build
pnpm -r test
```
