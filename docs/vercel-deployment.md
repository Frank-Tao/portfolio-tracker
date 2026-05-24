# Vercel Deployment (Client + Server)

This repo now has separate Vercel deploy workflows for frontend and backend.

## GitHub Actions workflows

- Frontend production: `.github/workflows/deploy-frontend-vercel.yml`
- Frontend preview: `.github/workflows/deploy-frontend-vercel-preview.yml`
- Backend production: `.github/workflows/deploy-backend-vercel.yml`
- Backend preview: `.github/workflows/deploy-backend-vercel-preview.yml`

## Required GitHub secrets

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID` (frontend project)
- `VERCEL_BACKEND_PROJECT_ID` (backend project)

## Required GitHub variables

- `PORTFOLIO_API_ORIGIN` (frontend proxy target for production, e.g. `https://portfolio-tracker-server.vercel.app`)
- `PORTFOLIO_API_ORIGIN_PREVIEW` (optional preview backend URL)

## Manual Vercel project setup

### Frontend project

- Root Directory: `packages/client`
- Framework: Vite

### Backend project

- Root Directory: `packages/server`
- Framework: Other / Express auto-detected

The backend app exports Express from `packages/server/src/index.ts`, which Vercel uses as a single function.

## Important persistence note

The current backend uses local SQLite file storage at `~/.portfolio-tracker/portfolio.db`.

On Vercel serverless, local filesystem persistence is not guaranteed across invocations/instances.
For production-grade persistence on Vercel, migrate DB storage to a remote database (for example Turso/Postgres).
