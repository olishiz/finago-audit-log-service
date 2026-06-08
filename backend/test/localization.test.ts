import assert from "node:assert/strict";
import test from "node:test";
import type { AuditEventView } from "../src/events.js";
import { localeCandidates, normalizeLocale, renderSummary } from "../src/localization.js";

const event: AuditEventView = {
  eventId: "evt-1",
  tenantId: "tenant-1",
  eventType: "order.updated",
  eventVersion: 1,
  occurredAt: "2026-05-25T06:12:00.000Z",
  receivedAt: "2026-05-25T06:12:01.000Z",
  actor: { type: "user", id: "user-1", displayName: "Aino Korhonen" },
  action: "updated",
  aggregate: { type: "order", id: "order-1", displayName: "Order 1" },
  source: { service: "orders", region: "fi-hel-1" },
  subjectRefs: [],
  payload: { fieldsChanged: ["amount", "status"] },
  summary: "",
  integrity: { eventHash: "hash" }
};

test("normalizes supported Nordic locales to stored template locales", () => {
  assert.equal(normalizeLocale("fi-FI"), "fi");
  assert.equal(normalizeLocale("sv-SE"), "sv");
  assert.equal(normalizeLocale("nb-NO"), "nb");
  assert.equal(normalizeLocale("no"), "nb");
  assert.deepEqual(localeCandidates("sv-SE"), ["sv", "en"]);
});

test("renders localized summary templates with event fields", () => {
  const summary = renderSummary(event, "{actor} updated {aggregate}: {fields}");
  assert.equal(summary, "Aino Korhonen updated Order 1: amount, status");
});

test("falls back for event types that do not yet have templates", () => {
  const summary = renderSummary(event, null);
  assert.equal(summary, "Aino Korhonen recorded order.updated on Order 1");
});
