# RENOVA web + mobile delivery roadmap

## Product direction

RENOVA should ship as one platform with two clients:

- the responsive web application for discovery, onboarding, administration, and detailed project work;
- an Expo/React Native mobile application for daily project activity, approvals, messages, documents, and alerts.

Both clients must use the same API contracts, organization membership rules, project permissions, and audit trail. The mobile app should not duplicate business rules from the API or treat the current demo data as production data.

## Current baseline

- Public marketing site and responsive role previews are live.
- Society, developer, and PMC preview dashboards share a single demonstration project.
- PostgreSQL/Drizzle persistence, session authentication, registration controls, opportunity discovery, and interest submission exist.
- `/api/healthz` and `/api/readyz` are healthy in production.
- `/platform/live` is the first real account-backed workflow and remains guarded by release flags.
- The generated API client already supports a remote base URL and bearer-token getter for a future Expo client.

## Delivery sequence

### 1. Production web foundation

- Complete the private acceptance run for registration, login/logout, all roles, draft privacy, discovery, interest submission, and cross-organization isolation.
- Add browser end-to-end coverage for the society-to-developer/PMC connection journey.
- Replace remaining preview-only actions with explicit disabled/demo states or real API-backed behavior.
- Add production monitoring, error reporting, analytics consent, and a release checklist.

### 2. Society workflow

- Account and organization onboarding.
- Society/property profile and document checklist.
- Opportunity draft, review, publish, and invite flow.
- Interest inbox, shortlist, and permission-controlled connection.
- Committee activity log and milestone tracking.

### 3. Developer and PMC workflows

- Verified organization profiles and service areas.
- Opportunity search, filters, saved views, and interest status.
- Proposal creation, evidence attachments, clarification threads, and version history.
- PMC review tasks, normalized comparison fields, and society-facing recommendations that remain clearly attributed.

### 4. Mobile application foundation

- Add an `artifacts/mobile` Expo workspace only after the mobile authentication contract is approved.
- Reuse `@workspace/api-client-react` and generated OpenAPI types.
- Add a mobile token exchange/refresh flow; keep browser sessions in HTTP-only cookies.
- Store mobile credentials only in platform secure storage.
- Start with society activity, messages, tasks, document viewing, and notifications; keep complex opportunity/proposal authoring on web until the mobile flows are validated.
- Support deep links to projects, clarifications, documents, and tasks.
- Cache read-only project summaries and draft form state, with clear offline indicators and conflict handling.

## Shared engineering rules

- Authorization is enforced by the API, never only by hidden client navigation.
- Every sensitive project read/write is scoped to an active organization/project membership.
- Proposal terms remain factual and source-attributed; RENOVA does not silently rank commercial offers.
- Demo, public, pending, and verified states stay visually distinct.
- Web and mobile releases use the same acceptance fixtures and permission matrix.
- Accessibility, responsive behavior, and low-bandwidth loading are release criteria.

## Next implementation slice

1. Run the private production acceptance script with the configured registration test token.
2. Add end-to-end coverage for one society, one developer, and one PMC journey.
3. Promote `/platform/live` after the acceptance gates pass.
4. Define and implement the mobile bearer-token contract.
5. Scaffold the Expo client with sign-in, role-aware navigation, and a read-only project overview.
