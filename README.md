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

The current product data is seeded in memory for the first working product slice.
