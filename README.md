# RENOVA Redevelopment Platform

RENOVA is a redevelopment operating platform for Mumbai housing societies. It guides committees through property assessment, readiness checks, regulatory pathways, professional matching, and project planning.

## Start in GitHub Codespaces

From the repository root, run:

```bash
git pull origin main
pnpm install --frozen-lockfile
pnpm run dev
```

Codespaces will offer to open the forwarded frontend port. Open port `5173` to use RENOVA. The API runs on port `5000`, and the Vite development server proxies `/api` requests automatically.

## Useful commands

- `pnpm run dev` — start the RENOVA frontend and API together
- `pnpm run typecheck` — type-check the workspace
- `pnpm --filter @workspace/renova run build` — build the frontend
- `pnpm --filter @workspace/api-server run bundle` — build the standalone API bundle

## Project structure

- `artifacts/renova` — React and Vite frontend
- `artifacts/api-server` — Express API
- `lib/api-spec` — OpenAPI specification
- `lib/api-client-react` — generated React API client
- `lib/api-zod` — generated Zod validation schemas
- `lib/db` — Drizzle/PostgreSQL schema for accounts, organizations, societies, opportunities, interests and sessions

## Backend foundation

The first persistent RENOVA workflow is now implemented behind the existing UI:

`REGISTER → LOGIN → SOCIETY CREATES OPPORTUNITY → DEVELOPER/PMC DISCOVERS → EXPRESS INTEREST → SOCIETY REVIEWS INTEREST`

Set `DATABASE_URL` before starting the API. The API intentionally remains bootable without it for frontend-only previews, but database-backed routes return a clear `503` configuration response until a PostgreSQL database is provisioned.

```bash
export DATABASE_URL='postgresql://user:password@host:5432/renova'
export CORS_ORIGINS='http://localhost:5173,https://renova-lovat-mu.vercel.app'
pnpm --filter @workspace/db migrate
pnpm run dev
```

The versioned migration is stored in `lib/db/drizzle`. Run `pnpm --filter @workspace/db generate` when the schema changes, review the generated SQL, and run `migrate` against the selected database. `/api/healthz` checks that the process is alive; `/api/readyz` checks the PostgreSQL connection and returns `503` until it is usable.

Authentication uses server-side sessions in an HTTP-only cookie, scrypt password hashing, and role authorization for `SOCIETY`, `DEVELOPER`, `PMC`, `PROFESSIONAL` and `ADMIN`. Public opportunity responses expose only published opportunity fields; society and organization data is never returned merely because an opportunity exists.

The current legacy dashboard endpoints remain available while the frontend is connected incrementally to the persistent API.

### Live account workspace

The first real frontend flow is available at `/platform/live`: registration/sign in, society opportunity posting, published discovery for developers and PMCs, interest submission, and a society interest inbox. It uses same-origin `/api` requests and HTTP-only session cookies. The demo dashboard remains labeled as a preview.

The frontend Vercel configuration routes `/api/*` to the `api-server` production domain before the SPA fallback. Check that `https://renova-lovat-mu.vercel.app/api/healthz` returns JSON and `/api/readyz` reports database readiness after deployment; do not infer API health from a successful frontend build alone. API responses are marked `Cache-Control: no-store` because they include account and opportunity data.

Registration is also closed at the API unless `RENOVA_REGISTRATION_OPEN=true` is set on `api-server`. Merely connecting `DATABASE_URL` must not start accepting public accounts. For a private acceptance run, set a high-entropy `RENOVA_REGISTRATION_TEST_TOKEN` only on the API server and supply it as the `x-renova-registration-test` header when creating test accounts. Keep `RENOVA_REGISTRATION_OPEN` unset. With `RENOVA_BASE_URL=https://renova-lovat-mu.vercel.app` and that test token in the **local test process** environment, run `node scripts/verify-live-workspace.mjs` after the migration. This creates labeled test accounts, one opportunity, and two interests; remove those records after acceptance. Set `RENOVA_REGISTRATION_OPEN=true` in production and `VITE_RENOVA_LIVE_WORKSPACE=true` on the frontend **only after** the database, migration, routing, and role-based flow pass. Until then, leave both flags off. The direct workspace route reports when the API is unavailable.
