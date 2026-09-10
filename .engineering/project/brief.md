# Project brief

Status: accepted for build after the integration contract spike
Owner: Huzaifa Abdul Rehman
Decision date: 2026-09-10

## Project profile

Type: web app
Delivery surface: a personal Next.js dashboard on Vercel, backed by Postgres and fed by a separately hosted HookRelay service
Stack and versions: TypeScript, Next.js, React, PostgreSQL, Vercel; HookRelay already uses Node 24, Fastify, PostgreSQL, Redis, and BullMQ
Risk class: normal
Triggered overlays: personal-data, high-trust, contract-change, user-interface, operated-service, distributed-behavior, external-dependency, ai-assisted, public-source-licensing, legal-release

## Problem

A developer who relies on GitHub webhooks can lose an event when their receiving endpoint is briefly unavailable. GitHub ends a delivery without a response after ten seconds and does not automatically redeliver failed deliveries. GitHub's notifications and Events API are alternatives, but neither is a real-time, independently durable event ledger for the developer's own repositories.

## User and outcome

Huzaifa, a developer with one or two personal repositories, can see a durable timeline of selected GitHub events and confirm that his receiver processed each one. The dashboard is deliberately not a replacement for GitHub Notifications.

## Evidence

GitHub's webhook failure and troubleshooting documentation establish the delivery gap and recommend asynchronous processing. GitHub's existing notification inbox is the strongest reason not to build a general notification replacement. Current Vercel documentation supports a short API route backed by external durable state. Sources and the full decision record are in `evidence.json`.

## Scope

The first useful slice is one Vercel-hosted dashboard, a Postgres table, and a signed `POST /api/webhooks/github` route. It accepts only a HookRelay-delivered GitHub `push` event, writes it exactly once using HookRelay's event ID, and displays it in a timeline. A user can send one signed event through the real HookRelay worker and see one item appear.

## Non-goals

- GitHub OAuth, sign-in, teams, or multi-tenancy.
- Replacing GitHub Notifications or backfilling/polling GitHub history.
- Event types other than `push` in the first slice.
- Notifications, analytics, deployment automation, and a duplicate HookRelay operations dashboard.
- Accepting a payload above Vercel's 4.5 MB function body limit.

## Constraints

Hard constraints: Devonoma is a separate repository; the frontend and short receiver route deploy to Vercel; HookRelay remains separately hosted because it needs a long-running worker plus Redis and Postgres. Secrets stay in deployment environment variables and are never committed. A public Vercel production URL, not a preview URL, is the webhook destination. No deadline or cloud budget has been set.

## Risks and assumptions

The riskiest assumption is the event contract: HookRelay currently does not forward GitHub's `X-GitHub-Event` header, so Devonoma cannot reliably classify events beyond a single supported shape. The cheapest test is to add a narrow allowlisted outbound event-type header to HookRelay, then prove one `push` event reaches Devonoma, verifies, stores exactly once, and renders. A second risk is size mismatch: HookRelay permits up to 5 MB by default while Vercel functions cap request bodies at 4.5 MB. The first release sets HookRelay's limit at or below 4.5 MB for this endpoint.

## Success and stop conditions

Baseline: GitHub can send directly to an endpoint, but a temporary receiving failure leaves the developer without an independently durable event record. Target: by the first live test, a GitHub push reaches the dashboard through HookRelay, and a temporary 503 at Devonoma is later delivered once with no duplicate row. Measure on the day of the deployed end-to-end test. Stop or narrow the project if this cannot be demonstrated with one real GitHub repository; do not add dashboards or OAuth to compensate.

## First slice

Acceptance: given a valid HookRelay signature, a supported `push` payload, and a fresh `x-hookrelay-event-id`, Devonoma returns 204 and creates one timeline row. The same request repeated returns 204 and creates no second row. An invalid signature returns 401 with no row. Observation: send the request through HookRelay's real worker and see one item in the local dashboard. Overlays: personal data, high trust, contract change, user interface, operated service, distributed behavior, external dependency, AI-assisted implementation, public source licensing, and legal release.

## Delivery path

1. Contract spike: add and test an allowlisted GitHub event-type header in HookRelay. Exit: a delivery carries only the expected header value.
2. Vertical slice: create Devonoma's signed receiver, Postgres event record, and a one-event timeline. Exit: an idempotent push appears locally through HookRelay.
3. Failure proof: force the receiver to return 503, then restore it. Exit: HookRelay retries and Devonoma still has one row.
4. Deploy proof: deploy Devonoma to Vercel, point a real GitHub webhook at HookRelay, and receive a push. Exit: the deployed timeline and HookRelay's delivery log correlate by event ID.

## Lifecycle gates

- During the contract spike before Devonoma code, the evidence is a HookRelay test for the safe event-type header and a recorded decision. Owner: Huzaifa. Status: planned.
- Before the first deployed test, the release evidence is passing tests, a clean install, no secrets in Git, and the recorded failure-retry proof. Owner: Huzaifa. Status: planned.
- One week after the first live GitHub event, the outcome evidence will show whether the dashboard was used, whether an event recovered after a failure, and whether the project should continue. Owner: Huzaifa. Status: planned.
