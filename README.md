# Finago Audit Log Service

Tech Lead case implementation for a shared audit log service.

## Stack

Node.js 22, TypeScript, Fastify, PostgreSQL, SQL migrations, Docker Compose, and the Node test runner.

## Project Layout

- `backend/` contains the Fastify API, SQL migrations, seed data, and backend tests.
- `frontend/` contains the React/Vite audit console.
- `ADRs/` contains the decision records for design review.
- `writeup.md` covers scale, adoption, and production follow-up work.
- `postman/` contains the importable Postman collection.
- `deployment/` contains VM bootstrap support for the Azure-hosted demo.
- `docker-compose.prod.yml` runs the hosted demo stack with Postgres, API, and Nginx-served frontend.

## Run Locally

```bash
npm install
docker compose up -d
npm run migrate
npm run seed
npm run dev
```

API runs on `http://localhost:3000`.

Run the React test UI in another terminal:

```bash
npm run frontend:dev
```

UI runs on `http://localhost:5173`.

If the database is already running and seeded, use only:

```bash
npm run dev
npm run frontend:dev
```

## Hosted Demo

The production compose file is intended for a small Linux VM demo:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

It starts:

- `postgres` for the audit store.
- `backend` for migrations, seed data, and the Fastify API.
- `frontend` for the React UI and `/api/*` reverse proxy.

The public entry point is port `80`; the database is kept private inside the Docker network.

## API

Ingest an event:

```bash
curl -X POST http://localhost:3000/events \
  -H 'content-type: application/json' \
  -d '{"eventId":"evt-demo","tenantId":"firm-helsinki","eventType":"order.updated","eventVersion":1,"occurredAt":"2026-05-25T09:12:00.000+03:00","actor":{"type":"user","id":"bookkeeper-17","displayName":"Aino Korhonen"},"action":"updated","aggregate":{"type":"order","id":"order-1001","displayName":"Order 1001"},"source":{"service":"orders","region":"fi-hel-1"},"subjectRefs":[{"type":"customer","id":"customer-44"}],"payload":{"fieldsChanged":["amount","status"]}}'
```

Query localized events:

```bash
curl 'http://localhost:3000/events?tenantId=firm-nordic&locale=sv-SE&correlationId=corr-employee-204-deactivation'
```

## What Is Implemented

- Append-only audit schema with tenant/time indexes and JSONB payloads.
- `POST /events` idempotent ingestion using producer `eventId`.
- `GET /events` query with tenant, time, actor, aggregate, event type, subject, correlation, locale, limit, and cursor filters.
- English, Finnish, Swedish, and Norwegian Bokmål summary templates.
- Correlation and causation IDs for related technical side effects.
- Data-subject references, retention fields, and redaction metadata.
- Per-tenant tamper-evident hash chain.

See `docs/implementation-plan.md`, `writeup.md`, and `ADRs/`.
