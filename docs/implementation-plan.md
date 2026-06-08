# Implementation Plan

## Tech Stack

- Node.js 22 + TypeScript for a Finago-aligned backend.
- Fastify for the HTTP API because it is small, typed, and easy to operate.
- PostgreSQL with SQL migrations for append-only audit storage, JSONB payloads, GIN indexes, and tenant/date query paths.
- Docker Compose for local Postgres.
- Node test runner for focused unit tests.

## Scope Chosen

The case says a clean slice is better than an unfinished broad system. This implementation focuses on:

- `POST /events` for idempotent ingestion.
- `GET /events` for tenant-scoped query with cursor pagination and common filters.
- Localized summaries in English, Finnish, Swedish, and Norwegian Bokmål.
- Related technical effects through `correlationId` and `causationId`.
- Data-subject references and retention metadata.
- Tamper-evident per-tenant hash chaining.
- A small React demo console for support-style order activity and an interview presenter guide.

## Deferred

- Full redaction workflow: schema has redaction fields, but policy automation and legal approval flows need product decisions.
- Multi-region streaming ingestion: the API contract and schema support it, but Kafka/EventBridge adapters are not needed for this slice.
- Fine-grained auth: endpoints are tenant-scoped but not yet protected by OAuth/JWT in this take-home slice.
- Production partitioning and chain-head anchoring: the design notes describe them, but the local slice keeps migration and demo complexity low.

## Questions For Planning

1. Should Finago treat audit events as legal records only, or also as customer-facing activity history? That changes retention, wording, and filtering.
2. Which identifier is canonical across products: tenant, firm, company, or organization? I used `tenantId`.
3. Do teams already have an event envelope standard? If yes, this API should become a thin compatibility layer rather than a new contract.
4. Which locales need regulatory-quality phrasing first: `fi`, `sv`, `nb`, `da`, or `en`?
5. Should personal data in payloads be rejected at ingestion, automatically tokenized, or allowed behind stricter retention policy?
