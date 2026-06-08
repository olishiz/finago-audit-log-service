import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool, withClient } from "./db.js";
import { ingestEventSchema, type IngestEvent } from "./events.js";
import { AuditEventRepository } from "./repository.js";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

const demoEvents: IngestEvent[] = [
  {
    eventId: "evt-order-1001-updated",
    tenantId: "firm-helsinki",
    eventType: "order.updated",
    eventVersion: 1,
    occurredAt: "2026-05-25T09:12:00.000+03:00",
    actor: {
      type: "user",
      id: "bookkeeper-17",
      displayName: "Aino Korhonen"
    },
    action: "updated",
    aggregate: {
      type: "order",
      id: "order-1001",
      displayName: "Order 1001"
    },
    source: {
      service: "orders",
      region: "fi-hel-1"
    },
    correlationId: "corr-order-1001",
    subjectRefs: [{ type: "customer", id: "customer-44" }],
    payload: {
      fieldsChanged: ["amount", "status"],
      before: { amount: 120, status: "draft" },
      after: { amount: 180, status: "approved" }
    },
    retentionUntil: "2033-05-25"
  },
  {
    eventId: "evt-employee-204-deactivated",
    tenantId: "firm-nordic",
    eventType: "employee.deactivated",
    eventVersion: 1,
    occurredAt: "2026-05-27T12:03:00.000+02:00",
    actor: {
      type: "admin",
      id: "admin-8",
      displayName: "Erik Lindberg"
    },
    action: "deactivated",
    aggregate: {
      type: "employee",
      id: "employee-204",
      displayName: "Maja Nord"
    },
    source: {
      service: "identity",
      region: "se-sto-1"
    },
    correlationId: "corr-employee-204-deactivation",
    subjectRefs: [{ type: "employee", id: "employee-204", displayName: "Maja Nord" }],
    payload: {
      reason: "Employment ended",
      deactivationReason: "Employment ended"
    },
    retentionUntil: "2033-05-27"
  },
  {
    eventId: "evt-employee-204-session-revoked",
    tenantId: "firm-nordic",
    eventType: "session.revoked",
    eventVersion: 1,
    occurredAt: "2026-05-27T12:03:04.000+02:00",
    actor: {
      type: "system",
      id: "identity-worker",
      displayName: "Identity worker"
    },
    action: "revoked",
    aggregate: {
      type: "employee",
      id: "employee-204",
      displayName: "Maja Nord"
    },
    source: {
      service: "identity",
      region: "se-sto-1"
    },
    correlationId: "corr-employee-204-deactivation",
    causationId: "evt-employee-204-deactivated",
    subjectRefs: [{ type: "employee", id: "employee-204", displayName: "Maja Nord" }],
    payload: {
      revokedSessions: 3
    },
    retentionUntil: "2033-05-27"
  },
  {
    eventId: "evt-employee-204-payroll-cancelled",
    tenantId: "firm-nordic",
    eventType: "payroll.cancelled",
    eventVersion: 1,
    occurredAt: "2026-05-27T12:03:09.000+02:00",
    actor: {
      type: "system",
      id: "payroll-worker",
      displayName: "Payroll worker"
    },
    action: "cancelled",
    aggregate: {
      type: "employee",
      id: "employee-204",
      displayName: "Maja Nord"
    },
    source: {
      service: "payroll",
      region: "no-osl-1"
    },
    correlationId: "corr-employee-204-deactivation",
    causationId: "evt-employee-204-deactivated",
    subjectRefs: [{ type: "employee", id: "employee-204", displayName: "Maja Nord" }],
    payload: {
      payrollRunId: "payroll-2026-05",
      amount: 2400
    },
    retentionUntil: "2033-05-27"
  }
];

async function seed(): Promise<void> {
  const templatesSql = await readFile(
    join(rootDir, "seeds", "001_templates.sql"),
    "utf8"
  );

  await withClient(async (client) => {
    await client.query(templatesSql);
  });

  const repository = new AuditEventRepository();
  for (const event of demoEvents) {
    await repository.ingest(ingestEventSchema.parse(event));
  }
}

seed()
  .then(async () => {
    console.log(`Seeded ${demoEvents.length} audit events`);
    await pool.end();
  })
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
