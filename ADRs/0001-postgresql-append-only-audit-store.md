# ADR 0001: PostgreSQL Append-Only Audit Store

## Context

The service needs tenant-scoped audit queries, regulatory retention, flexible event payloads, and a schema that other teams can adopt without coordination for every new event type.

## Decision

Use PostgreSQL with SQL migrations. Store the stable audit envelope in columns and event-specific details in JSONB. Treat `audit_events` as append-only at the application layer.

## Rejected Alternatives

- Cassandra/DynamoDB: strong write-scale options, but they make ad hoc auditor queries and local development heavier for this case.
- Pure event-stream storage: good for ingestion fan-out, but not enough by itself for six-month-later support and audit queries.
- Fully normalized payload tables per event type: too much coordination for teams adding new events later.

## Consequences

PostgreSQL gives a pragmatic balance of queryability and flexible payloads. If volume grows, the table will need partitioning and archival. JSONB payloads need governance so teams do not dump personal data into unbounded blobs.
