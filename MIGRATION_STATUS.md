# OmniScale AI — Next.js UI migration status

## What changed in this archive

A new `frontend-next/` application has been added alongside the existing `frontend/` Vite app. The original Vite frontend, Express backend, Supabase migration, legal pages, and existing backups have been retained. Existing Vercel routing/build configuration was not changed.

### Implemented in `frontend-next/`

- Dark, responsive Next.js App Router shell with desktop sidebar and mobile drawer.
- Public landing page, email/password registration and login, Discord OAuth, password reset, optional E.164 phone capture/sync, and Terms/Privacy consent.
- Dashboard showing live Supabase identity and API-verified subscription status.
- AI Workspace chat connected to existing conversation list/load/delete/chat endpoints, including history filtering.
- Platform Builder connected to `/api/builder/build-platform`.
- AI generation studio connected to `/api/ai/generate` for all six existing service engines.
- PayPal checkout creation and return verification using existing subscription endpoints.
- Account/profile, email verification resend, password update, subscription cancellation, and account deletion connected to existing APIs.
- Preferences stored locally in the current browser.
- Admin page checks a new server-side `GET /api/admin/status` endpoint before exposing the existing blocked-email operation. Authorization still comes from the server-side `OMNISCALE_BLOCKLIST_ADMIN_EMAILS` allowlist.

### Explicitly not implemented as live features

The supplied backend does not currently provide usage counters, revenue analytics, API latency/system-load metrics, an admin user directory/role editor, system-health data, global workflow overrides, persistent multi-step workflow scheduling, asset library CRUD, notebooks, memory import/export, public export links, device inventory, Personal Intelligence profiles, AI avatars, or Gems. Those UI areas are labeled as unavailable/pending and do not display invented metrics or sample user records.

## Validation performed in this environment

- Next.js source syntax transpilation: 30 TS/TSX files, 0 syntax diagnostics.
- Backend and API JavaScript syntax: passed `node --check` before the additive admin-status endpoint; the changed admin route and test files were also checked with `node --check`.
- Backend tests not requiring Express: 13 passed.
- Full backend test command could not complete because `express` is not installed in this extracted environment; the route-test file failed to load with `Cannot find module 'express'`.
- Next.js dependency installation could not complete because npm registry DNS lookup failed (`EAI_AGAIN registry.npmjs.org`). Therefore a full `next build` has **not** been verified here.

## Deployment status

Not deployed. The existing root `vercel.json` still builds the Vite frontend in `frontend/`. Do not switch production routing to Next.js until dependencies install successfully, `cd frontend-next && npm run build` passes, environment variables are configured, and the Express API origin/CORS configuration is verified for the intended deployment topology.

## Local validation steps

```bash
cd frontend-next
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
# If the API is on a separate origin, set NEXT_PUBLIC_API_URL to its full base URL including /api.
npm install
npm run dev
npm run build
```

Keep the original `frontend/` intact as the rollback path until the Next.js app has been tested end-to-end against Supabase and PayPal sandbox credentials.
