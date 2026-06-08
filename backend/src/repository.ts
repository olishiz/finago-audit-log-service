import type { PoolClient } from "pg";
import { withClient, withTransaction } from "./db.js";
import {
  buildAuditHash,
  decodeCursor,
  encodeCursor,
  type AuditEventView,
  type IngestEvent,
  type QueryEvents
} from "./events.js";
import { localeCandidates, renderSummary } from "./localization.js";

interface AuditEventRow {
  event_id: string;
  tenant_id: string;
  event_type: string;
  event_version: number;
  occurred_at: Date;
  received_at: Date;
  actor_type: string;
  actor_id: string;
  actor_display_name: string | null;
  action: string;
  aggregate_type: string;
  aggregate_id: string;
  aggregate_display_name: string | null;
  source_service: string;
  source_region: string;
  correlation_id: string | null;
  causation_id: string | null;
  subject_refs: AuditEventView["subjectRefs"];
  payload: Record<string, unknown>;
  previous_hash: string | null;
  event_hash: string;
  retention_until: Date | string | null;
  redacted_at: Date | string | null;
  redaction_reason: string | null;
  summary_template?: string | null;
}

interface IngestResult {
  created: boolean;
  event: AuditEventView;
}

function dateToIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toView(row: AuditEventRow): AuditEventView {
  const event: AuditEventView = {
    eventId: row.event_id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    occurredAt: dateToIso(row.occurred_at),
    receivedAt: dateToIso(row.received_at),
    actor: {
      type: row.actor_type,
      id: row.actor_id,
      ...(row.actor_display_name
        ? { displayName: row.actor_display_name }
        : {})
    },
    action: row.action,
    aggregate: {
      type: row.aggregate_type,
      id: row.aggregate_id,
      ...(row.aggregate_display_name
        ? { displayName: row.aggregate_display_name }
        : {})
    },
    source: {
      service: row.source_service,
      region: row.source_region
    },
    ...(row.correlation_id ? { correlationId: row.correlation_id } : {}),
    ...(row.causation_id ? { causationId: row.causation_id } : {}),
    subjectRefs: row.subject_refs,
    payload: row.payload,
    ...(row.retention_until ? { retentionUntil: dateOnly(row.retention_until) } : {}),
    ...(row.redacted_at ? { redactedAt: dateToIso(row.redacted_at) } : {}),
    ...(row.redaction_reason ? { redactionReason: row.redaction_reason } : {}),
    summary: "",
    integrity: {
      ...(row.previous_hash ? { previousHash: row.previous_hash } : {}),
      eventHash: row.event_hash
    }
  };

  return {
    ...event,
    summary: renderSummary(event, row.summary_template)
  };
}

export class AuditEventRepository {
  private async findByTenantAndEvent(
    client: PoolClient,
    tenantId: string,
    eventId: string,
    locale = "en"
  ): Promise<AuditEventRow | undefined> {
    const candidates = localeCandidates(locale);
    const result = await client.query<AuditEventRow>(
      `SELECT e.*,
              COALESCE(primary_template.template, fallback_template.template) AS summary_template
         FROM audit_events e
    LEFT JOIN audit_event_templates primary_template
           ON primary_template.event_type = e.event_type
          AND primary_template.event_version = e.event_version
          AND primary_template.locale = $3
    LEFT JOIN audit_event_templates fallback_template
           ON fallback_template.event_type = e.event_type
          AND fallback_template.event_version = e.event_version
          AND fallback_template.locale = $4
        WHERE e.tenant_id = $1
          AND e.event_id = $2`,
      [tenantId, eventId, candidates[0], candidates[1] ?? "en"]
    );

    return result.rows[0];
  }

  async ingest(input: IngestEvent): Promise<IngestResult> {
    return withClient(async (client) => {
      return withTransaction(client, async () => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
          input.tenantId
        ]);

        const existing = await this.findByTenantAndEvent(
          client,
          input.tenantId,
          input.eventId
        );

        if (existing) {
          return {
            created: false,
            event: toView(existing)
          };
        }

        const previous = await client.query<{ event_hash: string }>(
          `SELECT event_hash
             FROM audit_events
            WHERE tenant_id = $1
            ORDER BY created_at DESC, event_id DESC
            LIMIT 1`,
          [input.tenantId]
        );
        const previousHash = previous.rows[0]?.event_hash ?? null;
        const eventHash = buildAuditHash(input, previousHash);

        await client.query(
          `INSERT INTO audit_events (
             event_id,
             tenant_id,
             event_type,
             event_version,
             occurred_at,
             actor_type,
             actor_id,
             actor_display_name,
             action,
             aggregate_type,
             aggregate_id,
             aggregate_display_name,
             source_service,
             source_region,
             correlation_id,
             causation_id,
             subject_refs,
             payload,
             previous_hash,
             event_hash,
             retention_until
           )
           VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17::jsonb, $18::jsonb, $19, $20, $21
           )`,
          [
            input.eventId,
            input.tenantId,
            input.eventType,
            input.eventVersion,
            input.occurredAt,
            input.actor.type,
            input.actor.id,
            input.actor.displayName ?? null,
            input.action,
            input.aggregate.type,
            input.aggregate.id,
            input.aggregate.displayName ?? null,
            input.source.service,
            input.source.region,
            input.correlationId ?? null,
            input.causationId ?? null,
            JSON.stringify(input.subjectRefs),
            JSON.stringify(input.payload),
            previousHash,
            eventHash,
            input.retentionUntil ?? null
          ]
        );
        const inserted = await this.findByTenantAndEvent(
          client,
          input.tenantId,
          input.eventId
        );

        if (!inserted) {
          throw new Error("Inserted audit event could not be reloaded");
        }

        return {
          created: true,
          event: toView(inserted)
        };
      });
    });
  }

  async list(
    query: QueryEvents
  ): Promise<{ data: AuditEventView[]; nextCursor?: string }> {
    const candidates = localeCandidates(query.locale);
    const values: unknown[] = [query.tenantId, candidates[0], candidates[1] ?? "en"];
    const where = ["e.tenant_id = $1"];

    function addFilter(sql: string, value: unknown): void {
      values.push(value);
      where.push(sql.replace("?", `$${values.length}`));
    }

    if (query.from) {
      addFilter("e.occurred_at >= ?::timestamptz", query.from);
    }

    if (query.to) {
      addFilter("e.occurred_at <= ?::timestamptz", query.to);
    }

    if (query.actorId) {
      addFilter("e.actor_id = ?", query.actorId);
    }

    if (query.aggregateType) {
      addFilter("e.aggregate_type = ?", query.aggregateType);
    }

    if (query.aggregateId) {
      addFilter("e.aggregate_id = ?", query.aggregateId);
    }

    if (query.eventType) {
      addFilter("e.event_type = ?", query.eventType);
    }

    if (query.correlationId) {
      addFilter("e.correlation_id = ?", query.correlationId);
    }

    if (query.subjectType && query.subjectId) {
      addFilter("e.subject_refs @> ?::jsonb", [
        { type: query.subjectType, id: query.subjectId }
      ]);
      values[values.length - 1] = JSON.stringify(values[values.length - 1]);
    }

    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      values.push(cursor.occurredAt, cursor.eventId);
      where.push(
        `(e.occurred_at, e.event_id) < ($${values.length - 1}::timestamptz, $${values.length})`
      );
    }

    values.push(query.limit + 1);
    const limitPlaceholder = `$${values.length}`;

    const rows = await withClient(async (client: PoolClient) => {
      const result = await client.query<AuditEventRow>(
        `SELECT e.*,
                COALESCE(primary_template.template, fallback_template.template) AS summary_template
           FROM audit_events e
      LEFT JOIN audit_event_templates primary_template
             ON primary_template.event_type = e.event_type
            AND primary_template.event_version = e.event_version
            AND primary_template.locale = $2
      LEFT JOIN audit_event_templates fallback_template
             ON fallback_template.event_type = e.event_type
            AND fallback_template.event_version = e.event_version
            AND fallback_template.locale = $3
          WHERE ${where.join(" AND ")}
       ORDER BY e.occurred_at DESC, e.event_id DESC
          LIMIT ${limitPlaceholder}`,
        values
      );

      return result.rows;
    });

    const pageRows = rows.slice(0, query.limit);
    const last = pageRows.at(-1);

    return {
      data: pageRows.map(toView),
      ...(rows.length > query.limit && last
        ? {
            nextCursor: encodeCursor({
              occurredAt: dateToIso(last.occurred_at),
              eventId: last.event_id
            })
          }
        : {})
    };
  }
}
