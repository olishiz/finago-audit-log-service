import { createHash } from "node:crypto";
import { z } from "zod";

const subjectRefSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  displayName: z.string().min(1).optional()
});

export const ingestEventSchema = z.object({
  eventId: z.string().min(1).max(160),
  tenantId: z.string().min(1).max(120),
  eventType: z.string().min(1).max(160),
  eventVersion: z.number().int().positive().default(1),
  occurredAt: z.string().datetime({ offset: true }),
  actor: z.object({
    type: z.string().min(1).max(80),
    id: z.string().min(1).max(160),
    displayName: z.string().min(1).max(240).optional()
  }),
  action: z.string().min(1).max(120),
  aggregate: z.object({
    type: z.string().min(1).max(80),
    id: z.string().min(1).max(160),
    displayName: z.string().min(1).max(240).optional()
  }),
  source: z.object({
    service: z.string().min(1).max(120),
    region: z.string().min(1).max(80)
  }),
  correlationId: z.string().min(1).max(160).optional(),
  causationId: z.string().min(1).max(160).optional(),
  subjectRefs: z.array(subjectRefSchema).default([]),
  payload: z.record(z.unknown()).default({}),
  retentionUntil: z.string().date().optional()
});

export const queryEventsSchema = z
  .object({
    tenantId: z.string().min(1),
    locale: z.string().min(2).max(16).default("en"),
    from: z.string().datetime({ offset: true }).optional(),
    to: z.string().datetime({ offset: true }).optional(),
    actorId: z.string().min(1).optional(),
    aggregateType: z.string().min(1).optional(),
    aggregateId: z.string().min(1).optional(),
    eventType: z.string().min(1).optional(),
    correlationId: z.string().min(1).optional(),
    subjectType: z.string().min(1).optional(),
    subjectId: z.string().min(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(50),
    cursor: z.string().min(1).optional()
  })
  .refine(
    (query) => Boolean(query.subjectType) === Boolean(query.subjectId),
    {
      message: "subjectType and subjectId must be supplied together",
      path: ["subjectId"]
    }
  );

export type IngestEvent = z.infer<typeof ingestEventSchema>;
export type QueryEvents = z.infer<typeof queryEventsSchema>;

export interface AuditEventView {
  eventId: string;
  tenantId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  receivedAt: string;
  actor: {
    type: string;
    id: string;
    displayName?: string;
  };
  action: string;
  aggregate: {
    type: string;
    id: string;
    displayName?: string;
  };
  source: {
    service: string;
    region: string;
  };
  correlationId?: string;
  causationId?: string;
  subjectRefs: Array<z.infer<typeof subjectRefSchema>>;
  payload: Record<string, unknown>;
  retentionUntil?: string;
  redactedAt?: string;
  redactionReason?: string;
  summary: string;
  integrity: {
    previousHash?: string;
    eventHash: string;
  };
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function canonicalInstant(value: string): string {
  return new Date(value).toISOString();
}

function canonicalSubjectRefs(
  refs: IngestEvent["subjectRefs"]
): IngestEvent["subjectRefs"] {
  return [...refs].sort((left, right) => {
    const leftKey = `${left.type}\0${left.id}\0${left.displayName ?? ""}`;
    const rightKey = `${right.type}\0${right.id}\0${right.displayName ?? ""}`;
    return leftKey.localeCompare(rightKey);
  });
}

function canonicalize(value: unknown): JsonValue {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, canonicalize(nestedValue)])
    );
  }

  return String(value);
}

export function buildAuditHash(
  event: IngestEvent,
  previousHash: string | null
): string {
  const hashInput = {
    previousHash,
    event: canonicalize({
      eventId: event.eventId,
      tenantId: event.tenantId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      occurredAt: canonicalInstant(event.occurredAt),
      actor: event.actor,
      action: event.action,
      aggregate: event.aggregate,
      source: event.source,
      correlationId: event.correlationId,
      causationId: event.causationId,
      subjectRefs: canonicalSubjectRefs(event.subjectRefs),
      payload: event.payload,
      retentionUntil: event.retentionUntil
    })
  };

  return createHash("sha256").update(JSON.stringify(hashInput)).digest("hex");
}

export interface EventCursor {
  occurredAt: string;
  eventId: string;
}

export function encodeCursor(cursor: EventCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): EventCursor {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return z
      .object({
        occurredAt: z.string().datetime({ offset: true }),
        eventId: z.string().min(1)
      })
      .parse(decoded);
  } catch (error) {
    throw new InvalidCursorError("Invalid cursor", { cause: error });
  }
}

export class InvalidCursorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidCursorError";
  }
}
