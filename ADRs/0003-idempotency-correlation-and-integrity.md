# ADR 0003: Idempotency, Correlation, And Integrity

## Context

Producers run in different regions and may retry requests. One user action can create several technical events. Audit records must also be defensible against accidental mutation.

## Decision

Require a producer-owned `eventId` for idempotency. Use `correlationId` to group all effects of one user action and `causationId` to link derived events. Add a per-tenant SHA-256 hash chain over normalized event content.

## Rejected Alternatives

- Server-generated IDs only: avoids producer coordination, but makes retries create duplicate audit records.
- One large event for every user action: easy to read, but hides the individual side effects teams need to debug.
- No integrity metadata: operationally simpler, but weak in an audit discussion.

## Consequences

Ingestion has a small serialization point per tenant while assigning the next hash. That is acceptable for this slice; at larger scale, tenant-level partitioning or anchored segment chains would reduce contention.
