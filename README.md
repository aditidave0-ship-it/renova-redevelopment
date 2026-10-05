# RENOVA Redevelopment Platform

RENOVA is a redevelopment ecosystem platform connecting societies, developers, PMCs and other redevelopment professionals. It provides shared, permission-controlled workflows for discovering opportunities, forming the right connections, comparing structured information and managing redevelopment projects.

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

The coordinated web and mobile delivery sequence is documented in [`docs/WEB_MOBILE_ROADMAP.md`](docs/WEB_MOBILE_ROADMAP.md).

## Backend foundation

The first persistent platform workflow is implemented behind the existing UI:

`REGISTER → VERIFY EMAIL → LOGIN → SOCIETY CREATES OPPORTUNITY → DEVELOPER/PMC DISCOVERS → EXPRESS INTEREST → SOCIETY REVIEWS INTEREST`

Set `DATABASE_URL` before starting the API. The API intentionally remains bootable without it for frontend-only previews, but database-backed routes return a clear `503` configuration response until a PostgreSQL database is provisioned.

```bash
export DATABASE_URL='postgresql://user:password@host:5432/renova'
export CORS_ORIGINS='http://localhost:5173,https://renova-lovat-mu.vercel.app'
pnpm --filter @workspace/db migrate
pnpm run dev
```

PowerShell:

```powershell
$env:DATABASE_URL='postgresql://user:password@host:5432/renova'
$env:CORS_ORIGINS='http://localhost:5173,https://renova-lovat-mu.vercel.app'
pnpm --filter @workspace/db migrate
pnpm run dev
```

The versioned migration is stored in `lib/db/drizzle`. Run `pnpm --filter @workspace/db generate` when the schema changes, review the generated SQL, and run `migrate` against the selected database. `/api/healthz` checks that the process is alive; `/api/readyz` checks the PostgreSQL connection and returns `503` until it is usable.

Authentication uses server-side sessions in an HTTP-only cookie, scrypt password hashing, and role authorization for `SOCIETY`, `DEVELOPER`, `PMC`, `PROFESSIONAL` and `ADMIN`. Public opportunity responses expose only published opportunity fields; society and organization data is never returned merely because an opportunity exists.

Email-verification and password-reset tokens are stored only as SHA-256 hashes, expire after 24 hours and 1 hour respectively, and are single-use. Password reset deletes every existing session for the account. Email delivery is provider-abstracted and brand-neutral: configure `RENOVA_PRODUCT_NAME`, `RENOVA_APP_URL`, `RENOVA_EMAIL_FROM`, `RENOVA_EMAIL_PROVIDER=resend`, and `RESEND_API_KEY` only when an approved sender is available. Until then, external delivery intentionally returns `503` and remains **BLOCKED — WAITING FOR FINAL DOMAIN**; never log or commit the provider key.

Public contact and organization enquiries use `POST /api/enquiries`, server-side validation and rate protection, PostgreSQL storage, and an `ADMIN`-only `GET /api/admin/enquiries` view. They are no longer stored in browser `localStorage`.

The current legacy dashboard endpoints remain available while the frontend is connected incrementally to the persistent API.

### Live account workspace

The first real frontend flow is available at `/platform/live`: registration/sign in, society opportunity posting, published discovery for developers and PMCs, interest submission, and a society interest inbox. It uses same-origin `/api` requests and HTTP-only session cookies. The demo dashboard remains labeled as a preview.

The frontend Vercel configuration routes `/api/*` to the `api-server` production domain before the SPA fallback. Check that `https://renova-lovat-mu.vercel.app/api/healthz` returns JSON and `/api/readyz` reports database readiness after deployment; do not infer API health from a successful frontend build alone. API responses are marked `Cache-Control: no-store` because they include account and opportunity data.

Registration is closed at the API unless both `RENOVA_REGISTRATION_OPEN=true` and `RENOVA_BETA_RELEASE_APPROVED=true` are set on `api-server`. The second flag is the fail-closed release gate: do not set it until registration, production email verification, password reset, enquiry handling, role workflows, persistence, authorization, and desktop/mobile QA have passed. Merely connecting `DATABASE_URL` must not start accepting public accounts. A high-entropy `RENOVA_REGISTRATION_TEST_TOKEN` may bypass only the closed-registration gate for a controlled run; it does **not** bypass email delivery, verification, or account activation. Keep `RENOVA_BETA_RELEASE_APPROVED` unset while the sender domain is undecided. Run `pnpm --filter @workspace/api-server test` for the local authentication primitives, then perform the production browser journey with a real inbox after sender configuration is approved.
