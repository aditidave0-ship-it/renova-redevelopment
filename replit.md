# RENOVA Redevelopment Platform

RENOVA guides Mumbai housing societies from redevelopment assessment through professional matching and developer selection.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/renova/src/App.tsx` — routed society workspace, assessment flow, project readiness file, professional directory, and regulation centre
- `artifacts/renova/src/index.css` — RENOVA visual language and responsive styles
- `artifacts/api-server/src/routes/renova.ts` — dashboard, project, professional, and regulation API data
- `lib/api-spec/openapi.yaml` — source of truth for generated API hooks and validation

## Architecture decisions

- The first product surface is the society workflow, not a public developer listing marketplace.
- Regulatory outputs are framed as potential pathways and must be confirmed by qualified professionals.
- The first build uses a guided assessment to create a project readiness file with actionable red flags.

## Product

- Committee members can review an active redevelopment project at a glance.
- Societies can start an assessment, create a project workspace, and see the next best step.
- Users can browse matched PMC, architect, legal, and technical professionals.
- Users can search a plain-language regulation centre for potential DCPR pathways.

## User preferences

_No project-specific preferences recorded._

## Gotchas

- API data is currently seeded in memory for the first working product slice.
- The Vite build requires `PORT` and `BASE_PATH`; the managed workflow supplies both.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
