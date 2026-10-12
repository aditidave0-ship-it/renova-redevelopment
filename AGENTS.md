# RENOVA project instructions

These standing instructions reflect the owner's decisions. Follow them for all work in this repository until the owner explicitly changes them.

## Continuity and integration
- Continue the existing backend implementation and draft PR #24; the requested recovery baseline is commit 866469d. Inspect current branches and PRs before editing. Preserve completed work and coordinate through GitHub.
- Review overlap with PRs #25, #26 and subsequent backend PRs. Reuse existing authentication, profiles, feasibility, opportunities and enquiries rather than introducing parallel implementations.
- Focus on backend reliability and controlled testing. Do not start another homepage redesign.

## Approved experience
- Preserve the approved homepage and local intro video deployed through PR #25.
- The intro uses artifacts/renova/public/renova-intro.mp4. Do not replace, regenerate, shorten, recolor, crop, blur, cover, erase watermarks from, or otherwise alter its content.
- Preserve full-screen playback, muted autoplay, playsInline, Skip Intro, playback-end navigation and the existing 820 ms exit transition.
- Founder information is Aziz Parihar — Founder. Do not name Aditi Dave as Founder/Co-Founder or invent biographies or credentials.

## Production and release boundaries
- Keep public registration CLOSED and retain the reviewed release-control mechanism.
- Never bypass email verification or weaken authorization, organization isolation or session invalidation to demonstrate a feature.
- Audit the actual production schema and migration ledger read-only, compare historical migration hashes and rehearse upgrades in an isolated non-production database.
- Do not edit/delete production migration history, reset/drop/recreate production data, or execute production migrations without explicit owner approval for the concrete reviewed plan.
- Builds and deployments must not implicitly execute production migrations.
- Do not purchase/configure a domain, change DNS, accept a paid plan, make billing commitments or change production authentication settings without explicit approval.
- Previously authorized Vercel access may be used within the existing RENOVA setup scope. Credentials remain exclusively in secure server/environment configuration; never expose them in chat, screenshots, logs, source, commits or PR descriptions.

## Backend work and testing
- Complete email OTP through the existing verification infrastructure: secure generation and hashed storage, expiry, single use, attempt limits, resend limits, concurrency protection and delivery.
- Configure and test email in staging where authorized. Keep brand, sender and application origin configurable. Identify missing sender credentials/approvals precisely.
- Enquiries must follow frontend → API → PostgreSQL → authorized Admin, with validation, abuse protection, notification and acknowledgement delivery status. Never substitute localStorage or fake success for backend persistence.
- Society feasibility/opportunities and Developer/PMC interests must use real authenticated APIs and enforced ownership/role permissions.
- Feasibility is a structured request and professional/Admin assessment workflow. Do not fabricate FSI, TDR, development permissions, heights, costs, returns or regulatory conclusions.
- Checkout, orders, payment webhooks and receipts are authorized in SANDBOX mode only. Do not invent prices, activate live payments or trust a client callback as proof of payment.
- Do not add chat, proposals, unrelated modules or decorative substitute functionality during this stabilization task.
- Use clearly labelled controlled test accounts/data. Test authentication, password recovery, session persistence/invalidation, role boundaries, organization isolation, feasibility, draft/edit/publish and interests.
- Test approved intro behavior on desktop/mobile, production and the latest preview. Run relevant frozen-install, builds, typechecks, security and deployment checks.

## Reporting and evidence
- Keep draft work unmerged until critical issues are resolved.
- Separate CODE VERIFIED, BROWSER VERIFIED and PRODUCTION VERIFIED.
- Real email readiness requires actual inbox delivery and successful verification/reset/OTP exercise. Provider acceptance, simulated delivery and frontend builds alone do not prove production readiness.
- Report each backend module as WORKING, BLOCKED or NOT STARTED, with PR/commit, actual test evidence, deployment status, precise remaining blockers and any required owner approval.
- Continue independent authorized work while external credentials or production approvals are pending.
