# Profiles and interest workflow milestone

## Scope

This milestone adds PostgreSQL-backed Society, Developer, and PMC profiles to the verified-account workspace. It does not add proposals, chat, payments, document uploads, or a permanent sender-domain dependency.

## User journeys

- Society: verified login → complete/edit/preview profile → create or publish an opportunity → review incoming interests → open permitted Developer/PMC profiles → update review status.
- Developer: verified login → complete/edit/preview company profile → search/filter/open published opportunities → express interest → track interest status.
- PMC: verified login → complete/edit/preview PMC-specific services profile → search/filter/open published opportunities → express interest → track connections.

## Visibility boundaries

| Data | Owner | Marketplace participant |
| --- | --- | --- |
| Society contact name, email, phone, address | Visible | Never returned |
| Published opportunity fields | Visible | Developer/PMC only |
| Society marketplace summary | Visible | Developer/PMC only when enabled |
| Developer/PMC account email | Visible through account session | Never returned by profile API |
| Public profile email/phone | Editable | Society only when marketplace visibility is enabled |
| Credentials marked public | Editable | Society only |
| Credentials not marked public | Editable | Never returned |
| Developer/PMC profile | Editable only by owning organization | Society can read explicit allowlisted fields |

All owner edits use the organization ID from the authenticated server session. Client-provided organization IDs are not accepted by profile update routes.

## Interest states

`RECEIVED → REVIEWING → SHORTLISTED` or `DECLINED`

These states organize society review only. They do not select a proposal, award work, rank an organization, or represent platform verification.

## Release gate

Public registration remains closed. External end-to-end testing remains blocked until an approved sender domain can deliver real verification and reset emails. No domain, DNS, or permanent sender change is included in this milestone.

## Verification

Run:

```bash
pnpm --filter @workspace/api-server test
pnpm run typecheck
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/renova build
```

Production deployment must not be promoted until the migration succeeds and `/api/readyz` confirms the Society profile columns, Developer/PMC tables, and interest review column exist.
