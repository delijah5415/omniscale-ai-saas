# OmniScale AI — Next.js App Router frontend

This is a parallel frontend migration scaffold. The existing Vite app remains in `frontend/` and the Express API remains in `backend/`. This folder does not replace either.

## Included and connected
- Next.js App Router, TypeScript, Tailwind CSS, Lucide React.
- Responsive dark workspace shell, collapsible mobile navigation, overview dashboard.
- Supabase email/password sign-up and sign-in, Discord OAuth, password recovery, optional phone sync, and legal consent using browser-safe public credentials.
- Existing backend subscription-status check, PayPal subscription creation/return verification, account lookup, subscription cancellation, account deletion, platform generation, AI generation engines, AI workspace chat/history/delete, and protected blocked-email operation.
- Working one-shot AI generation tools plus explicitly marked pending persistent workflow automation, library, notebooks, scheduled tasks, usage metering, and unsupported privacy/device features.

## Configuration
Copy `.env.example` to `.env.local` and set only the public Supabase URL and anon/publishable key. `NEXT_PUBLIC_API_URL` must point at the existing Express API base including `/api` (for example `https://omniscale-ai-saas.vercel.app/api`). For a separate Vercel preview project, set this explicitly to the deployed Express API origin and configure that API to allow the preview origin through CORS. Leave it blank only when the Next.js app is actually served behind a same-origin `/api` reverse proxy. Never put Supabase service-role keys, OpenAI keys, or PayPal secrets in `NEXT_PUBLIC_*` variables.

## Local development
```bash
npm install
npm run dev
```

## Production build
```bash
npm run build
npm start
```

## Important integration notes
- Existing Express endpoints remain the authority for subscription entitlement, blocked-email enforcement, and account deletion/cancellation.
- Admin UI is not a substitute for server authorization. The only currently implemented admin operation is `POST /api/admin/blocked-emails`, which checks `OMNISCALE_BLOCKLIST_ADMIN_EMAILS` on the server.
- The supplied backend has no metrics, user-directory, workflow scheduler, asset-library, notebook, token-usage, or public-export endpoints. Those screens are intentionally transparent placeholders, not mock data.
- This migration scaffold does not alter Supabase schema, RLS, OAuth providers, PayPal plan IDs/prices, legal text, or production deployment settings.
