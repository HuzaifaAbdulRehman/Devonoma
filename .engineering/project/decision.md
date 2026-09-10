# Preserve the GitHub event type at the relay boundary

Status: accepted
Date: 2026-09-10
Owner: Huzaifa Abdul Rehman

## Context

GitHub labels each delivery with `X-GitHub-Event`. HookRelay stores that header but currently sends only the payload, a fresh signature, and its own delivery identifiers to a destination. Devonoma would receive valid JSON without a dependable way to decide whether it is a push, pull request, or release.

## Decision drivers

- Devonoma must reject or route unsupported event types before writing them.
- Inferring an event type from payload fields is brittle because GitHub payloads overlap and evolve.
- Forwarding every original header would expose more provider-controlled input than Devonoma needs.
- A single allowlisted string preserves the useful contract without turning HookRelay into a transparent proxy.

## Considered options

1. Change nothing and infer the type from JSON. Rejected because the inference would become an undocumented protocol.
2. Treat every first-slice payload as a push. Rejected because a configuration mistake could store another event incorrectly.
3. Forward all original GitHub headers. Rejected because most are unnecessary and broaden the downstream trust boundary.
4. Forward only a validated `X-GitHub-Event` value. Accepted.

## Outcome

HookRelay will pass an allowlisted event-type header to its destination and tests will pin that behavior. Devonoma will accept only `push` in the first slice. Pull request and release support remain later work.

## Consequences

The HookRelay-to-destination contract gains one field, so HookRelay needs a focused code change and test before Devonoma's receiver is written. Devonoma can then classify events explicitly and fail safely. Supporting providers with different event headers later will need another deliberate mapping rather than automatic header forwarding.

## Verification and revisit trigger

The decision is verified when a HookRelay delivery test shows the expected event type at the destination and confirms that an arbitrary inbound header is absent. Revisit it if HookRelay supports a second provider whose event-type contract cannot use this header.
