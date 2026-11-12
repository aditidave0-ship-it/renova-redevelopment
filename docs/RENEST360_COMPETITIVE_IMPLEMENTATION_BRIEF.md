# RENOVA competitor-informed implementation brief: ReNest360

Date: 2 November 2026

## Objective

Use the publicly observable positioning and service model of ReNest360 (https://renest360.com/redevelopment-process) as competitive research to improve RENOVA. Build a differentiated, society-first redevelopment journey inside the existing RENOVA product. Do not clone ReNest360's branding, copy, layout, assets, or claim unverified features.

RENOVA positioning: **a connected redevelopment ecosystem** for housing societies, developers, PMCs, advocates, architects, and other redevelopment professionals. RENOVA is a platform, not a developer and not a substitute for qualified professional advice.

## Research findings and confidence

### Publicly observed
- ReNest360 markets free redevelopment consultation to housing societies in Mumbai and Thane.
- Its public positioning says it works for societies, not developers.
- Its public page includes a direct WhatsApp contact route.
- A publicly available ReNest360 Operations Team job description describes work including feasibility analysis, development-potential assessment, developer selection, negotiations, stakeholder coordination, milestone monitoring, documentation/reporting, and operational planning.

### Not verified; do not present as facts
- ReNest360's frontend framework, CMS, backend, database, hosting, CRM, admin panel, authentication, APIs, private dashboards, automated calculators, or actual internal SOP.
- Its fee structure, revenue share, subscriptions, developer charges, or society charges.
- Whether every service mentioned in a job description is delivered through software or manually.

Treat the job listing as supporting evidence of a service-led operating model, not proof of software functionality.

## Current repository context

Repository: `aditidave0-ship-it/renova-redevelopment`
Default branch: `main`
Stack documented in README: React + Vite frontend, Express API, PostgreSQL + Drizzle, generated OpenAPI/Zod/client packages, pnpm workspace.

Existing role model: `SOCIETY`, `DEVELOPER`, `PMC`, `PROFESSIONAL`, `ADMIN`.

Existing platform capabilities documented in README and milestone docs:
- Account and organization onboarding with server-side sessions and role authorization.
- Society, Developer and PMC profiles with explicit visibility controls.
- Society opportunity draft/publish lifecycle.
- Developer/PMC opportunity discovery and interest submission.
- Society interest review states: RECEIVED, REVIEWING, SHORTLISTED, DECLINED.
- Enquiry API and Admin enquiry management.
- Email verification/password reset foundations and release flags.

Existing relevant routes include `/platform/live` and role dashboards. Read the current code before changing anything; documentation may lag active pull requests.

## Critical release and safety constraints

1. Public registration must remain closed. Do not change `RENOVA_REGISTRATION_OPEN` or `RENOVA_BETA_RELEASE_APPROVED`.
2. Do not merge, deploy, promote, or run production migrations.
3. Production `/api/readyz` was reported as HTTP 503 ("Database is not ready"). PR #31 is the read-only production DB recovery preflight. Resolve and verify the database incident through the approved recovery process before any schema-dependent release.
4. PR #35 (email OTP) remains a draft with unresolved remote frontend check and real email/staging acceptance requirements. Do not bypass these gates.
5. Do not edit secrets, production environment variables, sender domains, DNS, live database contents, or real customer records.
6. Do not introduce a parallel backend, new auth system, duplicate organization model, or competing UI route.
7. Preserve existing password authentication plus email verification/OTP design; email OTP only. No phone OTP.
8. Do not replace, re-encode, rename, or redesign the approved RENOVA intro video or other locked media.
9. Keep changes additive, narrowly scoped, testable, and in a dedicated branch/PR. Never commit directly to main.
10. If another active Codex branch/PR already implements the requested behavior, do not duplicate it. Report the overlap and propose the smallest safe continuation.

## Product goal

Create a clear end-to-end society entry journey inspired by the *service logic* of redevelopment consultancies, but differentiated by RENOVA's multi-stakeholder platform.

Recommended journey:

1. Visitor chooses **Get Your Society Feasibility** or **Consult RENOVA**.
2. Society provides basic property details: society/building name, locality, municipal jurisdiction, number of buildings/flats, plot area and unit, building age, existing carpet area, floors, current occupancy, redevelopment status, and contact role.
3. The UI explains why each requested detail is needed and allows "not sure" for unknown values; do not fabricate defaults.
4. Society can save a draft and return later when authenticated. Public enquiry must not expose private society data.
5. Submit a structured feasibility/consultation request. Show a clear acknowledgement and reference ID only if the backend actually creates one.
6. Admin/operations can triage, assign, request missing information, update status, and keep an auditable activity history.
7. When appropriate, society can move into the existing opportunity workflow and choose whether to publish selected, allowlisted information for Developer/PMC discovery.
8. Society receives clear next-step guidance and can view request status.
9. Qualified professionals can participate only through existing role and permission boundaries; no automatic endorsement, ranking, or promise of legal/technical feasibility.

## UX requirements

- Keep RENOVA visual identity and current design system. Do not copy ReNest360's interface.
- Explain the process in plain, professional Indian English.
- Make the primary actions obvious and reduce unnecessary navigation.
- Use a stepper or progressive disclosure for a genuinely multi-stage form.
- Responsive at 375px, 390px, tablet and desktop.
- Accessible labels, keyboard operation, validation summaries, clear error states, loading states, and confirmation state.
- Support Indian units explicitly (sq. ft. / sq. m. / sq. yd. where appropriate); persist a normalized value and original unit if calculations are introduced.
- Do not make regulatory or FSI calculations unless inputs, jurisdiction, applicable regulation/version, assumptions and professional review are explicit.
- Add privacy explanation before collecting personal or property documents.
- No invented testimonials, client counts, success rates, developer ratings, or legal guarantees.

## Implementation sequence for Codex

### Phase 0 — inspect and report before coding
- Pull latest `main` and inspect open PRs/branches, especially #31 and #35 and existing society-feasibility work.
- Inspect frontend routes/components, API routes, DB schema/migrations, OpenAPI definitions, generated clients, tests and current feature flags.
- Map which parts of the recommended journey already exist.
- Identify whether there is already a society feasibility form/request entity or an overlapping active PR.
- Produce a short gap analysis and implementation plan. Do not duplicate existing functionality.

### Phase 1 — frontend-only, no production dependencies
- Improve the society-facing entry point and explain the redevelopment process using RENOVA's own design system.
- If an existing form/API already supports feasibility or enquiries, connect to it rather than adding a duplicate.
- If backend support is missing, implement only a clearly labelled frontend prototype or prepare an API/schema proposal; do not pretend a submission is persisted.
- Preserve existing routes and demo/live distinctions.

### Phase 2 — backend only after approval and DB recovery
If a new persistent feasibility-request workflow is genuinely missing:
- Design a minimal normalized schema and migration with ownership, status, timestamps and audit events.
- Define statuses such as DRAFT, SUBMITTED, UNDER_REVIEW, NEEDS_INFORMATION, CONSULTATION_SCHEDULED, ASSESSMENT_IN_PROGRESS, COMPLETED, CLOSED.
- Enforce organization ownership and ADMIN/assigned-operator access in the API.
- Keep society contact details and uploaded documents private by default.
- Add validation, rate limits, idempotency where appropriate, audit trail, tests, OpenAPI and generated clients.
- Never expose society private details to Developers/PMCs through marketplace discovery.
- Do not execute the migration in production.

### Phase 3 — operations and quality
- Add admin triage/assignment/history only if not already present.
- Add tests for ownership, role boundaries, cross-organization isolation, status transitions, duplicate submission, validation, privacy, and error handling.
- Run typecheck, API tests, frontend tests/build, migration-history checks and responsive QA.
- Document any test that could not be run and why.

## Acceptance criteria

- Existing RENOVA role-based flows remain intact.
- Society can understand the steps before starting.
- No duplicate society/profile/opportunity/enquiry model is introduced.
- Unknown property facts can remain unknown; no guessed FSI or feasibility outcome.
- Private society data is never visible to unrelated organizations.
- All mutations are server-authorized and audited.
- Public registration and production release gates remain unchanged.
- No production migration/deployment/merge.
- The PR description states exact files changed, tests run, tests not run, known limitations, and next approval required.

## Required Codex output

Before implementation, provide:
1. Existing feature inventory and code paths.
2. Overlap check against open PRs.
3. Proposed user journey and data flow.
4. Smallest implementation slice.
5. Risks and tests.

After implementation, provide:
1. Branch and PR link.
2. Files changed and behavior delivered.
3. Test commands/results.
4. Screenshots or responsive QA evidence where available.
5. Explicit confirmation that registration remains closed and no production migration/deployment/merge occurred.

## Non-goals

- Do not recreate ReNest360 pixel-for-pixel.
- Do not build a second website or separate platform.
- Do not build a developer marketplace that bypasses society consent.
- Do not invent ReNest360 technology details.
- Do not promise that RENOVA can determine legal, structural, title, or statutory feasibility without qualified professionals.
