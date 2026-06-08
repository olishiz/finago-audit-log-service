import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAuditHash,
  decodeCursor,
  encodeCursor,
  ingestEventSchema,
  queryEventsSchema
} from "../src/events.js";

const rawEvent = {
  eventId: "evt-1",
  tenantId: "tenant-1",
  eventType: "order.updated",
  eventVersion: 1,
  occurredAt: "2026-05-25T06:12:00.000Z",
  actor: { type: "user", id: "user-1", displayName: "Aino Korhonen" },
  action: "updated",
  aggregate: { type: "order", id: "order-1", displayName: "Order 1" },
  source: { service: "orders", region: "fi-hel-1" },
  subjectRefs: [{ type: "customer", id: "customer-1" }],
  payload: { fieldsChanged: ["amount", "status"] },
  retentionUntil: "2033-05-25"
};

test("validates an ingestion event contract", () => {
  const parsed = ingestEventSchema.parse(rawEvent);
  assert.equal(parsed.eventId, "evt-1");
  assert.equal(parsed.subjectRefs[0]?.type, "customer");
});

test("audit hash is stable regardless of payload key order", () => {
  const first = ingestEventSchema.parse({
    ...rawEvent,
    payload: { after: { b: 2, a: 1 }, fieldsChanged: ["amount"] }
  });
  const second = ingestEventSchema.parse({
    ...rawEvent,
    payload: { fieldsChanged: ["amount"], after: { a: 1, b: 2 } }
  });

  assert.equal(buildAuditHash(first, "previous"), buildAuditHash(second, "previous"));
});

test("audit hash normalizes timestamp offsets and subject reference order", () => {
  const first = ingestEventSchema.parse({
    ...rawEvent,
    occurredAt: "2026-05-25T09:12:00.000+03:00",
    subjectRefs: [
      { type: "customer", id: "customer-1" },
      { type: "employee", id: "employee-2" }
    ]
  });
  const second = ingestEventSchema.parse({
    ...rawEvent,
    occurredAt: "2026-05-25T06:12:00.000Z",
    subjectRefs: [
      { type: "employee", id: "employee-2" },
      { type: "customer", id: "customer-1" }
    ]
  });

  assert.equal(buildAuditHash(first, "previous"), buildAuditHash(second, "previous"));
});

test("cursor round trips", () => {
  const cursor = {
    occurredAt: "2026-05-25T06:12:00.000Z",
    eventId: "evt-1"
  };

  assert.deepEqual(decodeCursor(encodeCursor(cursor)), cursor);
});

test("query requires subject filters to be paired", () => {
  const result = queryEventsSchema.safeParse({
    tenantId: "tenant-1",
    subjectType: "employee"
  });

  assert.equal(result.success, false);
});

test("invalid cursors fail as client errors", () => {
  assert.throws(() => decodeCursor("not-a-cursor"), {
    name: "InvalidCursorError"
  });
});
