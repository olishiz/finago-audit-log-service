import React from "react";
import { createRoot } from "react-dom/client";
import {
  Joyride,
  STATUS,
  type CallBackProps,
  type Step
} from "react-joyride";
import {
  Activity,
  BookOpen,
  Database,
  Filter,
  HelpCircle,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import "./styles.css";

type AuditEvent = {
  eventId: string;
  tenantId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  receivedAt: string;
  actor: { type: string; id: string; displayName?: string };
  action: string;
  aggregate: { type: string; id: string; displayName?: string };
  source: { service: string; region: string };
  correlationId?: string;
  causationId?: string;
  subjectRefs: Array<{ type: string; id: string; displayName?: string }>;
  payload: Record<string, unknown>;
  summary: string;
  retentionUntil?: string;
  integrity?: {
    previousHash?: string;
    eventHash: string;
  };
};

type ApiResult = {
  label: string;
  status: number;
  body: unknown;
};

type ServiceHealth = {
  status: "idle" | "checking" | "online" | "offline";
  checkedAt?: string;
  httpStatus?: number;
  body?: unknown;
  error?: string;
};

type IngestResult = {
  created: boolean;
  event: AuditEvent;
};

type CustomAuditForm = {
  actorName: string;
  orderId: string;
  customerId: string;
  sourceService: string;
  region: string;
  fromStatus: string;
  toStatus: string;
};

type AuditFilters = {
  tenantId: string;
  locale: string;
  eventType: string;
  searchMode: string;
  searchText: string;
  from: string;
  to: string;
  limit: string;
};

type IngestPayload = {
  eventId: string;
  tenantId: string;
  eventType: string;
  eventVersion: number;
  occurredAt: string;
  actor: {
    type: string;
    id: string;
    displayName: string;
  };
  action: string;
  aggregate: {
    type: string;
    id: string;
    displayName: string;
  };
  source: {
    service: string;
    region: string;
  };
  correlationId: string;
  subjectRefs: Array<{ type: string; id: string }>;
  payload: {
    fieldsChanged: string[];
    before: { status: string };
    after: { status: string };
  };
  retentionUntil: string;
};

type View = "demo" | "status" | "guide";

const defaultAuditForm: CustomAuditForm = {
  actorName: "Support Agent",
  orderId: "order-45821",
  customerId: "customer-10017",
  sourceService: "order-support",
  region: "my-kul-1",
  fromStatus: "missing",
  toStatus: "restored"
};

const tenantOptions = ["firm-helsinki", "firm-nordic"];

const defaultFilters: AuditFilters = {
  tenantId: "all",
  locale: "en",
  eventType: "",
  searchMode: "all",
  searchText: "",
  from: "",
  to: "",
  limit: "100"
};

const tourSteps: Step[] = [
  {
    target: ".tour-guide-tab",
    title: "Presenter guide",
    content:
      "Open this page when preparing for the interview. It explains how the system was made, what tradeoffs to defend, and a speech you can deliver.",
    placement: "bottom"
  },
  {
    target: ".tour-service-tab",
    title: "Service status",
    content:
      "Open Service Status when you want to check the API and database connection without changing the audit records view.",
    placement: "bottom"
  },
  {
    target: ".tour-actions",
    title: "Log an order activity",
    content:
      "The main actions are here. New audit log opens a focused modal instead of taking permanent space on the page.",
    placement: "bottom"
  },
  {
    target: ".tour-ingest",
    title: "Create the audit log",
    content:
      "This opens the logging modal. Submitting the modal posts to the audit API, refreshes the table, and shows a SweetAlert result.",
    placement: "bottom"
  },
  {
    target: ".tour-replay",
    title: "Test idempotency",
    content:
      "After ingesting an event, replay the same payload. The backend should return the existing event instead of creating a duplicate.",
    placement: "bottom"
  },
  {
    target: ".tour-audit-table",
    title: "Database-backed audit table",
    content:
      "This table is the demo surface. Every stored audit row shows the business fields, source, subject reference, correlation, retention, hash, and payload.",
    placement: "top"
  },
  {
    target: ".tour-filters",
    title: "Search audit records",
    content:
      "Use these plain filters to find stored audit records by tenant, language, log type, actor, order, subject, request group, and time range.",
    placement: "top"
  },
  {
    target: ".tour-result",
    title: "Read the response",
    content:
      "The status pill shows the HTTP result. The JSON panel keeps the raw API response available for interview discussion.",
    placement: "left"
  },
  {
    target: ".tour-json",
    title: "Inspect the raw record",
    content:
      "Use the JSON panel to inspect the full audit envelope: actor, aggregate, source region, correlation IDs, retention date, and integrity hash.",
    placement: "top"
  }
];

const demoScript = [
  "Start with Health to show the service is alive and connected to Postgres.",
  "Use Log order activity to create a new audit record with actor, order, source region, subject refs, retention, and payload.",
  "Use the filters to show that the new record is queryable by tenant, log type, actor, order, subject, and request group.",
  "Use Retry last event to prove producer retries do not create duplicate audit rows."
];

const architecturePoints = [
  {
    title: "HTTP API",
    text: "Fastify exposes POST /events for ingestion and GET /events for tenant-scoped audit queries."
  },
  {
    title: "Audit envelope",
    text: "Every event carries tenant, actor, action, aggregate, source service, source region, occurredAt, correlation IDs, subject refs, and payload."
  },
  {
    title: "PostgreSQL store",
    text: "Stable fields are columns for indexing; event-specific details live in JSONB so teams can add event types without schema churn."
  },
  {
    title: "Localization",
    text: "Templates are stored by event type, version, and locale. Query-time rendering supports Finnish, Swedish, Norwegian Bokmål, and English fallback."
  },
  {
    title: "Integrity",
    text: "Events are append-only and linked with a per-tenant SHA-256 hash chain to make accidental mutation detectable."
  },
  {
    title: "Subject lookup and retention",
    text: "Subject references, retention dates, and redaction metadata are first-class fields instead of being buried in payload text."
  }
];

const decisionPoints = [
  "I chose PostgreSQL because this slice needs strong queryability, local development, JSONB flexibility, and familiar operational behavior.",
  "I rejected pre-rendered audit text because translation fixes and locale-specific wording would become impossible later.",
  "I used producer-owned event IDs for idempotency because regional producers will retry requests.",
  "I used correlationId and causationId so related technical side effects can be connected without hiding them inside one large event.",
  "I deferred auth, queue-based ingestion, full redaction workflow, and partitioning because the case asked for a clean defended slice rather than a sprawling system."
];

const speechParagraphs = [
  "I scoped this as a shared audit log service any Finago Office team could plug into. The goal was not just storing events, but making them understandable months later by accountants, auditors, support engineers, and eventually data subjects.",
  "The working slice has two core endpoints: ingestion and query. Ingestion validates a standard event envelope, stores the record in Postgres, keeps event-specific payloads in JSONB, and makes retries safe through tenant-scoped event IDs. Query supports tenant, locale, actor, aggregate, subject, correlation, date range, and cursor filters.",
  "For the domain concerns, I focused on localization, related technical side effects, data-subject lookup, and audit integrity. Localized summaries are rendered from templates, related events are grouped by correlation ID, subject references support data-subject lookup, and a per-tenant hash chain gives tamper-evidence.",
  "If this moved toward production, I would add authentication and tenant authorization first, then queue-backed ingestion for burst tolerance, monthly or tenant-hash partitioning for scale, template governance, SDKs for Node and .NET, and CI checks so other teams can adopt the event envelope consistently."
];

const serviceScalePoints = [
  {
    title: "One event contract",
    text: "Teams send the same audit envelope: tenant, actor, aggregate, source, subject refs, payload, and retention."
  },
  {
    title: "Flexible event payloads",
    text: "Stable fields are indexed columns; domain-specific fields stay in JSONB so new event types can be added without schema churn."
  },
  {
    title: "Safe retries",
    text: "Producer event IDs make ingestion idempotent, so retries do not create duplicate audit records."
  },
  {
    title: "Operational queries",
    text: "Tenant and time indexes support common support, audit, and customer lookup paths."
  },
  {
    title: "Localization by template",
    text: "Text is rendered from templates, so wording and languages can improve without rewriting stored events."
  },
  {
    title: "Tamper evidence",
    text: "A per-tenant hash chain makes accidental mutation detectable and gives auditors a stronger integrity story."
  }
];

function PresenterGuide() {
  return (
    <section className="guidePage">
      <div className="guideHero">
        <div>
          <p className="eyebrow">Interview Talk Track</p>
          <h2>How to Explain the Audit Log Service</h2>
        </div>
        <p>
          Use this page as your whiteboard structure: problem, implementation,
          decisions, demo, and next steps.
        </p>
      </div>

      <section className="guideBand">
        <div className="sectionTitle">
          <BookOpen size={20} aria-hidden="true" />
          <h3>Case Answer</h3>
        </div>
        <p>
          The case asks for a shared audit log service, not only an event table.
          This implementation builds a defended slice: database schema,
          ingestion API, query API, seed data, ADRs, scale/adoption writeup, and
          an optional UI for demonstration.
        </p>
      </section>

      <section className="guideGrid">
        <article className="guideCard">
          <div className="sectionTitle">
            <Layers size={20} aria-hidden="true" />
            <h3>How It Is Made</h3>
          </div>
          <div className="pointList">
            {architecturePoints.map((point) => (
              <div className="point" key={point.title}>
                <strong>{point.title}</strong>
                <span>{point.text}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="guideCard">
          <div className="sectionTitle">
            <ShieldCheck size={20} aria-hidden="true" />
            <h3>Decisions To Defend</h3>
          </div>
          <ol className="numberList">
            {decisionPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="guideGrid">
        <article className="guideCard">
          <div className="sectionTitle">
            <Activity size={20} aria-hidden="true" />
            <h3>Demo Flow</h3>
          </div>
          <ol className="numberList">
            {demoScript.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article className="guideCard">
          <div className="sectionTitle">
            <Users size={20} aria-hidden="true" />
            <h3>Questions To Ask Them</h3>
          </div>
          <ol className="numberList">
            <li>Is this a legal audit record only, or also customer-facing activity history?</li>
            <li>Which tenant identifier is canonical across Finago Office products?</li>
            <li>Do teams already have an event envelope standard we should align with?</li>
            <li>Which locales need regulatory-quality language first?</li>
            <li>Should personal data in payloads be rejected, tokenized, or retention-controlled?</li>
          </ol>
        </article>
      </section>

      <section className="guideBand">
        <div className="sectionTitle">
          <BookOpen size={20} aria-hidden="true" />
          <h3>Three-Minute Speech</h3>
        </div>
        <div className="speech">
          {speechParagraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
    </section>
  );
}

function ServiceStatusPage({
  health,
  onCheck
}: {
  health: ServiceHealth;
  onCheck: () => void;
}) {
  const isOnline = health.status === "online";
  const isOffline = health.status === "offline";
  const statusLabel =
    health.status === "idle"
      ? "Not checked"
      : health.status === "checking"
        ? "Checking"
        : isOnline
          ? "Online"
          : "Offline";

  return (
    <section className="servicePage">
      <section className="serviceHero">
        <div>
          <p className="eyebrow">Service Status</p>
          <h2>Audit API health check</h2>
          <p>
            Validate that the Fastify API is reachable and can talk to
            PostgreSQL before starting the interview demo.
          </p>
        </div>
        <button
          className="primaryButton tour-health"
          disabled={health.status === "checking"}
          onClick={onCheck}
        >
          <Activity size={18} aria-hidden="true" />
          {health.status === "checking" ? "Checking service" : "Check service"}
        </button>
      </section>

      <section className="statusGrid">
        <article className={`statusCard ${isOnline ? "online" : ""} ${isOffline ? "offline" : ""}`}>
          <div className="sectionTitle">
            <Database size={20} aria-hidden="true" />
            <h3>API and database</h3>
          </div>
          <strong>{statusLabel}</strong>
          <span>
            {isOnline
              ? "The /health endpoint returned ok."
              : isOffline
                ? "The health check failed. Confirm the API and Docker Postgres are running."
                : "Run the health check before the demo."}
          </span>
        </article>

        <article className="statusCard">
          <div className="sectionTitle">
            <Activity size={20} aria-hidden="true" />
            <h3>Endpoint</h3>
          </div>
          <strong>GET /health</strong>
          <span>Proxied from the UI through Vite to http://localhost:3000.</span>
        </article>

        <article className="statusCard">
          <div className="sectionTitle">
            <RefreshCw size={20} aria-hidden="true" />
            <h3>Last checked</h3>
          </div>
          <strong>
            {health.checkedAt ? localDateTime(health.checkedAt) : "Never"}
          </strong>
          <span>
            {health.httpStatus ? `HTTP ${health.httpStatus}` : "No status yet"}
          </span>
        </article>
      </section>

      <pre className="json serviceJson">
        {JSON.stringify(
          health.body ?? (health.error ? { error: health.error } : {}),
          null,
          2
        )}
      </pre>
    </section>
  );
}

function createEventSuffix(stamp: Date): string {
  const timePart = stamp.toISOString().replace(/[-:.TZ]/g, "");
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${timePart}-${randomPart}`;
}

function createDemoPayload(form: CustomAuditForm): IngestPayload {
  const stamp = new Date();
  const id = createEventSuffix(stamp);
  const orderId = form.orderId.trim() || `order-ui-${id}`;
  const customerId = form.customerId.trim() || `customer-ui-${id}`;
  const actorName = form.actorName.trim() || "KL Support";
  const sourceService = form.sourceService.trim() || "audit-console";
  const region = form.region.trim() || "my-kul-1";
  const fromStatus = form.fromStatus.trim() || "missing";
  const toStatus = form.toStatus.trim() || "restored";

  return {
    eventId: `evt-ui-${id}`,
    tenantId: "firm-helsinki",
    eventType: "order.updated",
    eventVersion: 1,
    occurredAt: stamp.toISOString(),
    actor: {
      type: "support",
      id: "support-kl-ui",
      displayName: actorName
    },
    action: "updated",
    aggregate: {
      type: "order",
      id: orderId,
      displayName: orderId
    },
    source: {
      service: sourceService,
      region
    },
    correlationId: `corr-ui-${id}`,
    subjectRefs: [{ type: "customer", id: customerId }],
    payload: {
      fieldsChanged: ["status"],
      before: { status: fromStatus },
      after: { status: toStatus }
    },
    retentionUntil: "2033-06-02"
  };
}

function isEventList(body: unknown): body is { data: AuditEvent[] } {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    Array.isArray((body as { data?: unknown }).data)
  );
}

function isIngestResult(body: unknown): body is IngestResult {
  return (
    typeof body === "object" &&
    body !== null &&
    "event" in body &&
    typeof (body as { event?: unknown }).event === "object"
  );
}

function objectValue(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function statusChange(event: AuditEvent): string {
  const before = objectValue(event.payload, "before");
  const after = objectValue(event.payload, "after");
  const beforeStatus = objectValue(before, "status");
  const afterStatus = objectValue(after, "status");

  if (typeof beforeStatus === "string" && typeof afterStatus === "string") {
    return `${beforeStatus} -> ${afterStatus}`;
  }

  return "Not supplied";
}

function subjectRefsText(event: AuditEvent): string {
  if (event.subjectRefs.length === 0) {
    return "None";
  }

  return event.subjectRefs
    .map((ref) => `${ref.type}:${ref.displayName ?? ref.id}`)
    .join(", ");
}

function aggregateText(event: AuditEvent): string {
  const name = event.aggregate.displayName ?? event.aggregate.id;
  return `${event.aggregate.type}:${name}`;
}

function actorText(event: AuditEvent): string {
  return `${event.actor.type}:${event.actor.displayName ?? event.actor.id}`;
}

function shortHash(event: AuditEvent): string {
  const hash = event.integrity?.eventHash;
  return hash ? `${hash.slice(0, 12)}...` : "Not supplied";
}

function payloadText(event: AuditEvent): string {
  return JSON.stringify(event.payload);
}

function eventSearchText(event: AuditEvent): string {
  return [
    event.eventId,
    event.tenantId,
    event.eventType,
    event.action,
    event.summary,
    actorText(event),
    aggregateText(event),
    subjectRefsText(event),
    statusChange(event),
    event.source.service,
    event.source.region,
    event.correlationId,
    event.causationId,
    event.retentionUntil,
    event.integrity?.eventHash,
    payloadText(event)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function eventMatchesTextSearch(event: AuditEvent, filters: AuditFilters): boolean {
  const searchText = filters.searchText.trim().toLowerCase();

  if (!searchText || filters.searchMode !== "all") {
    return true;
  }

  return eventSearchText(event).includes(searchText);
}

function localDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function dateTimeParam(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function buildEventsQuery(
  filters: AuditFilters,
  tenantId = filters.tenantId
): string {
  const params = new URLSearchParams();
  params.set("tenantId", tenantId);
  params.set("locale", filters.locale);
  params.set("limit", filters.limit);
  const searchText = filters.searchText.trim();

  const optionalParams: Array<[string, string | undefined]> = [
    ["eventType", filters.eventType],
    ["from", dateTimeParam(filters.from)],
    ["to", dateTimeParam(filters.to)]
  ];

  for (const [key, value] of optionalParams) {
    const trimmed = value?.trim();
    if (trimmed) {
      params.set(key, trimmed);
    }
  }

  if (searchText && filters.searchMode !== "all") {
    if (filters.searchMode === "actorId") {
      params.set("actorId", searchText);
    }

    if (filters.searchMode === "aggregateId") {
      params.set("aggregateId", searchText);
    }

    if (filters.searchMode === "customerId") {
      params.set("subjectType", "customer");
      params.set("subjectId", searchText);
    }

    if (filters.searchMode === "employeeId") {
      params.set("subjectType", "employee");
      params.set("subjectId", searchText);
    }

    if (filters.searchMode === "correlationId") {
      params.set("correlationId", searchText);
    }
  }

  return `/api/events?${params.toString()}`;
}

function sortEvents(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((left, right) => {
    const occurredDiff =
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();

    if (occurredDiff !== 0) {
      return occurredDiff;
    }

    return right.eventId.localeCompare(left.eventId);
  });
}

function tableTitle(filters: AuditFilters): string {
  return filters.tenantId === "all"
    ? "All tenant activity logs"
    : `${filters.tenantId} activity logs`;
}

function App() {
  const [activeView, setActiveView] = React.useState<View>("demo");
  const [result, setResult] = React.useState<ApiResult | null>(null);
  const [busyAction, setBusyAction] = React.useState<string | null>(null);
  const [lastPayload, setLastPayload] = React.useState<IngestPayload | null>(null);
  const [customAudit, setCustomAudit] =
    React.useState<CustomAuditForm>(defaultAuditForm);
  const [auditFilters, setAuditFilters] =
    React.useState<AuditFilters>(defaultFilters);
  const [serviceHealth, setServiceHealth] = React.useState<ServiceHealth>({
    status: "idle"
  });
  const [isLogModalOpen, setIsLogModalOpen] = React.useState(false);
  const [auditRows, setAuditRows] = React.useState<AuditEvent[]>([]);
  const [tableStatus, setTableStatus] = React.useState("Not loaded");
  const [highlightedEventId, setHighlightedEventId] = React.useState<string | null>(
    null
  );
  const [runTour, setRunTour] = React.useState(false);
  const [tourKey, setTourKey] = React.useState(0);

  React.useEffect(() => {
    void loadAuditTable().catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (!isLogModalOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape" && busyAction === null) {
        setIsLogModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busyAction, isLogModalOpen]);

  function startTour() {
    setActiveView("demo");
    setTourKey((current) => current + 1);
    setRunTour(true);
  }

  function handleTourCallback(data: CallBackProps) {
    if (data.status === STATUS.FINISHED || data.status === STATUS.SKIPPED) {
      setRunTour(false);
    }
  }

  function updateCustomAudit(field: keyof CustomAuditForm, value: string) {
    setCustomAudit((current) => ({
      ...current,
      [field]: value
    }));
  }

  function updateAuditFilter(field: keyof AuditFilters, value: string) {
    setAuditFilters((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function run(
    label: string,
    request: () => Promise<Response>
  ): Promise<ApiResult | null> {
    setBusyAction(label);

    try {
      const response = await request();
      const body = await response.json();
      const nextResult = { label, status: response.status, body };
      setResult(nextResult);
      return nextResult;
    } catch (error) {
      const nextResult = {
        label,
        status: 0,
        body: { error: error instanceof Error ? error.message : "Request failed" }
      };
      setResult(nextResult);
      return nextResult;
    } finally {
      setBusyAction(null);
    }
  }

  async function loadAuditTable(
    highlightEventId?: string,
    filters: AuditFilters = auditFilters
  ): Promise<{ data: AuditEvent[]; nextCursor?: string }> {
    setTableStatus("Loading records");

    try {
      const tenants =
        filters.tenantId === "all" ? tenantOptions : [filters.tenantId];
      const responses = await Promise.all(
        tenants.map(async (tenantId) => {
          const response = await fetch(buildEventsQuery(filters, tenantId));
          const body = await response.json();

          if (!response.ok || !isEventList(body)) {
            throw new Error(`Unexpected response for ${tenantId}`);
          }

          return body;
        })
      );

      const limit = Number(filters.limit);
      const rows = sortEvents(
        responses.flatMap((body) => body.data).filter((event) =>
          eventMatchesTextSearch(event, filters)
        )
      ).slice(0, Number.isFinite(limit) ? limit : 100);
      const body = { data: rows };

      setAuditRows(rows);
      setHighlightedEventId(highlightEventId ?? null);
      setTableStatus(`${rows.length} records`);
      return body;

    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load records";
      setAuditRows([]);
      setHighlightedEventId(null);
      setTableStatus(message);
      throw error;
    }
  }

  async function healthCheck() {
    setServiceHealth((current) => ({
      ...current,
      status: "checking"
    }));

    try {
      const response = await fetch("/api/health");
      const body = await response.json();
      const healthy = response.ok && body.status === "ok";
      setServiceHealth({
        status: healthy ? "online" : "offline",
        checkedAt: new Date().toISOString(),
        httpStatus: response.status,
        body
      });
    } catch (error) {
      setServiceHealth({
        status: "offline",
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Health check failed"
      });
    }
  }

  async function applyFilters(
    filters: AuditFilters = auditFilters,
    label = "Audit Search Result"
  ) {
    setHighlightedEventId(null);

    try {
      const body = await loadAuditTable(undefined, filters);
      setResult({
        label,
        status: 200,
        body
      });
    } catch (error) {
      setResult({
        label,
        status: 0,
        body: {
          error: error instanceof Error ? error.message : "Search failed"
        }
      });
    }
  }

  async function resetFilters() {
    setAuditFilters(defaultFilters);

    try {
      const body = await loadAuditTable(undefined, defaultFilters);
      setResult(null);
      setTableStatus(`${body.data.length} records`);
    } catch (error) {
      setResult({
        label: "Clear Filters Failed",
        status: 0,
        body: {
          error: error instanceof Error ? error.message : "Could not clear filters"
        }
      });
    }
  }

  async function ingestDemo() {
    const payload = createDemoPayload(customAudit);
    setLastPayload(payload);
    const apiResult = await run("Order Activity Logged", () =>
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
    );

    const eventId = isIngestResult(apiResult?.body)
      ? apiResult.body.event.eventId
      : payload.eventId;
    const filters = {
      ...defaultFilters,
      locale: auditFilters.locale
    };
    setAuditFilters(filters);
    await loadAuditTable(eventId, filters);

    const ingestBody = apiResult?.body;
    if (isIngestResult(ingestBody)) {
      setIsLogModalOpen(false);
      await Swal.fire({
        icon: ingestBody.created ? "success" : "info",
        title: ingestBody.created
          ? "Audit log created"
          : "Duplicate retry ignored",
        text: `${ingestBody.event.eventId} is now visible in the audit records table.`,
        confirmButtonColor: "#b21f2d"
      });
      return;
    }

    await Swal.fire({
      icon: "error",
      title: "Could not create audit log",
      text: "Check the API response panel for validation or connection details.",
      confirmButtonColor: "#b21f2d"
    });
  }

  async function replayLast() {
    if (!lastPayload) {
      return;
    }

    const apiResult = await run("Retry Same Log", () =>
      fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lastPayload)
      })
    );

    const eventId = isIngestResult(apiResult?.body)
      ? apiResult.body.event.eventId
      : lastPayload.eventId;
    await loadAuditTable(eventId);

    const retryBody = apiResult?.body;
    if (isIngestResult(retryBody)) {
      await Swal.fire({
        icon: "info",
        title: "Retry returned the existing record",
        text: `${retryBody.event.eventId} was not duplicated.`,
        confirmButtonColor: "#b21f2d"
      });
    }
  }

  function submitLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ingestDemo();
  }

  return (
    <main className="shell">
      <Joyride
        key={tourKey}
        callback={handleTourCallback}
        continuous
        disableOverlayClose
        run={runTour}
        scrollOffset={90}
        showProgress
        showSkipButton
        steps={tourSteps}
        styles={{
          options: {
            arrowColor: "#ffffff",
            backgroundColor: "#ffffff",
            overlayColor: "rgba(21, 23, 26, 0.58)",
            primaryColor: "#b21f2d",
            textColor: "#15171a",
            zIndex: 1000
          },
          tooltip: {
            borderRadius: 4,
            boxShadow: "0 18px 44px rgba(21, 23, 26, 0.18)"
          },
          tooltipContent: {
            fontSize: 14,
            lineHeight: 1.5,
            padding: "8px 0"
          },
          buttonNext: {
            borderRadius: 4,
            fontWeight: 700
          },
          buttonBack: {
            color: "#69717a",
            marginRight: 8
          }
        }}
      />

      <header className="topbar">
        <div>
          <p className="eyebrow">Finago Office</p>
          <h1>
            {activeView === "demo"
              ? "Order Activity Audit"
              : activeView === "status"
                ? "Service Status"
                : "Presenter Guide"}
          </h1>
        </div>
        <div className="headerActions">
          <nav className="viewTabs" aria-label="Application view">
            <button
              className={activeView === "demo" ? "active" : ""}
              onClick={() => setActiveView("demo")}
            >
              Console
            </button>
            <button
              className={`tour-service-tab ${activeView === "status" ? "active" : ""}`}
              onClick={() => setActiveView("status")}
            >
              Service Status
            </button>
            <button
              className={`tour-guide-tab ${activeView === "guide" ? "active" : ""}`}
              onClick={() => setActiveView("guide")}
            >
              Presenter Guide
            </button>
          </nav>
          <button className="tourButton" onClick={startTour}>
            <HelpCircle size={17} aria-hidden="true" />
            Tour
          </button>
          <div className="status tour-status">
            <Database size={16} aria-hidden="true" />
            PostgreSQL backed API
          </div>
        </div>
      </header>

      {activeView === "guide" ? (
        <PresenterGuide />
      ) : activeView === "status" ? (
        <ServiceStatusPage health={serviceHealth} onCheck={() => void healthCheck()} />
      ) : (
        <>
          {isLogModalOpen && (
            <div
              className="modalOverlay"
              onMouseDown={() => {
                if (busyAction === null) {
                  setIsLogModalOpen(false);
                }
              }}
            >
              <section
                aria-labelledby="log-modal-title"
                aria-modal="true"
                className="logModal"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
              >
                <div className="modalHeader">
                  <div>
                    <p className="eyebrow">Order Activity</p>
                    <h2 id="log-modal-title">Create audit log</h2>
                  </div>
                  <button
                    aria-label="Close log modal"
                    className="modalClose"
                    disabled={busyAction !== null}
                    onClick={() => setIsLogModalOpen(false)}
                    type="button"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>

                <form className="modalForm tour-trigger-form" onSubmit={submitLog}>
                  <div className="fieldPair">
                    <label>
                      Support user
                      <input
                        autoFocus
                        value={customAudit.actorName}
                        onChange={(event) =>
                          updateCustomAudit("actorName", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Order ID
                      <input
                        value={customAudit.orderId}
                        onChange={(event) =>
                          updateCustomAudit("orderId", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <label>
                    Customer ID
                    <input
                      value={customAudit.customerId}
                      onChange={(event) =>
                        updateCustomAudit("customerId", event.target.value)
                      }
                    />
                  </label>

                  <div className="fieldPair">
                    <label>
                      Old status
                      <input
                        value={customAudit.fromStatus}
                        onChange={(event) =>
                          updateCustomAudit("fromStatus", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      New status
                      <input
                        value={customAudit.toStatus}
                        onChange={(event) =>
                          updateCustomAudit("toStatus", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className="fieldPair">
                    <label>
                      Source service
                      <input
                        value={customAudit.sourceService}
                        onChange={(event) =>
                          updateCustomAudit("sourceService", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Source region
                      <input
                        value={customAudit.region}
                        onChange={(event) =>
                          updateCustomAudit("region", event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className="modalActions">
                    <button
                      disabled={busyAction !== null}
                      onClick={() => setIsLogModalOpen(false)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="primaryButton"
                      disabled={busyAction !== null}
                      type="submit"
                    >
                      <Send size={17} aria-hidden="true" />
                      {busyAction === "Order Activity Logged"
                        ? "Logging"
                        : "Log activity"}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          <section className="workspace">
          <section className="results">
            <section className="actionBar tour-actions">
              <div>
                <p className="eyebrow">Audit Console</p>
                <h2>Stored audit records</h2>
                <p>
                  Create a support activity, search tenant-scoped logs, and
                  show the complete audit envelope in one table.
                </p>
              </div>
              <div className="actionButtons">
                <button
                  className="primaryButton tour-ingest"
                  onClick={() => setIsLogModalOpen(true)}
                  disabled={busyAction !== null}
                >
                  <Plus size={18} aria-hidden="true" />
                  New audit log
                </button>
                <button
                  className="tour-replay"
                  onClick={replayLast}
                  disabled={busyAction !== null || !lastPayload}
                >
                  <RefreshCw size={18} aria-hidden="true" />
                  Retry last event
                </button>
              </div>
            </section>

            <div className="resultHeader tour-result">
              <div>
                <p className="eyebrow">Latest API Response</p>
                <h2>{result?.label ?? "Ready to log"}</h2>
                <p>
                  {auditRows.length} rows loaded from the audit query endpoint.
                </p>
              </div>
              <span className={`code ${result?.status === 0 ? "error" : ""}`}>
                {busyAction ? "Loading" : result ? result.status : "Idle"}
              </span>
            </div>

            <form
              className="filterPanel tour-filters"
              onSubmit={(event) => {
                event.preventDefault();
                void applyFilters();
              }}
            >
              <div className="filterHeader">
                <div>
                  <p className="eyebrow">Search</p>
                  <div className="sectionTitle compactTitle">
                    <Filter size={19} aria-hidden="true" />
                    <h2>Find audit records</h2>
                  </div>
                </div>
              </div>

              <div className="filterGrid">
                <label>
                  Tenant
                  <select
                    value={auditFilters.tenantId}
                    onChange={(event) =>
                      updateAuditFilter("tenantId", event.target.value)
                    }
                  >
                    <option value="all">All tenants</option>
                    <option value="firm-helsinki">firm-helsinki</option>
                    <option value="firm-nordic">firm-nordic</option>
                  </select>
                </label>

                <label>
                  Locale
                  <select
                    value={auditFilters.locale}
                    onChange={(event) =>
                      updateAuditFilter("locale", event.target.value)
                    }
                  >
                    <option value="en">English</option>
                    <option value="fi-FI">Finnish</option>
                    <option value="sv-SE">Swedish</option>
                    <option value="nb-NO">Norwegian</option>
                  </select>
                </label>

                <label>
                  Event type
                  <select
                    value={auditFilters.eventType}
                    onChange={(event) =>
                      updateAuditFilter("eventType", event.target.value)
                    }
                  >
                    <option value="">Any event</option>
                    <option value="order.updated">order.updated</option>
                    <option value="employee.deactivated">
                      employee.deactivated
                    </option>
                    <option value="session.revoked">session.revoked</option>
                    <option value="payroll.cancelled">payroll.cancelled</option>
                  </select>
                </label>

                <label>
                  Search by
                  <select
                    value={auditFilters.searchMode}
                    onChange={(event) =>
                      updateAuditFilter("searchMode", event.target.value)
                    }
                  >
                    <option value="all">All fields</option>
                    <option value="actorId">Support user ID</option>
                    <option value="aggregateId">Order or employee ID</option>
                    <option value="customerId">Customer ID</option>
                    <option value="employeeId">Employee ID</option>
                    <option value="correlationId">Request group ID</option>
                  </select>
                </label>

                <label>
                  ID value
                  <input
                    placeholder="Search actor, order, customer, payload..."
                    value={auditFilters.searchText}
                    onChange={(event) =>
                      updateAuditFilter("searchText", event.target.value)
                    }
                  />
                </label>

                <label>
                  From
                  <input
                    type="datetime-local"
                    value={auditFilters.from}
                    onChange={(event) => updateAuditFilter("from", event.target.value)}
                  />
                </label>

                <label>
                  To
                  <input
                    type="datetime-local"
                    value={auditFilters.to}
                    onChange={(event) => updateAuditFilter("to", event.target.value)}
                  />
                </label>

                <label>
                  Limit
                  <select
                    value={auditFilters.limit}
                    onChange={(event) => updateAuditFilter("limit", event.target.value)}
                  >
                    <option value="10">10</option>
                    <option value="12">12</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </label>
              </div>

              <div className="filterActions">
                <button type="submit">
                  <Search size={16} aria-hidden="true" />
                  Search logs
                </button>
                <button type="button" onClick={() => void resetFilters()}>
                  <RefreshCw size={16} aria-hidden="true" />
                  Clear filters
                </button>
              </div>
            </form>

            <section className="auditTablePanel tour-audit-table">
              <div className="tableHeader">
                <div>
                  <p className="eyebrow">Stored Audit Records</p>
                  <h2>{tableTitle(auditFilters)}</h2>
                </div>
                <div className="tableActions">
                  <span className="code">{tableStatus}</span>
                  <button
                    className="refreshTable"
                    onClick={() =>
                      void loadAuditTable().catch(() => undefined)
                    }
                    disabled={busyAction !== null}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Refresh table
                  </button>
                </div>
              </div>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Occurred</th>
                      <th>Received</th>
                      <th>Summary</th>
                      <th>Tenant</th>
                      <th>Event type</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Business record</th>
                      <th>Subject refs</th>
                      <th>Status change</th>
                      <th>Source</th>
                      <th>Correlation</th>
                      <th>Causation</th>
                      <th>Event ID</th>
                      <th>Keep until</th>
                      <th>Hash</th>
                      <th>Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditRows.length === 0 ? (
                      <tr>
                        <td className="emptyTable" colSpan={17}>
                          No audit records match the current filters.
                        </td>
                      </tr>
                    ) : auditRows.map((event) => (
                      <tr
                        className={
                          highlightedEventId === event.eventId ? "highlightRow" : ""
                        }
                        key={event.eventId}
                      >
                        <td>{localDateTime(event.occurredAt)}</td>
                        <td>{localDateTime(event.receivedAt)}</td>
                        <td>{event.summary}</td>
                        <td>{event.tenantId}</td>
                        <td>
                          {event.eventType}
                          <span className="mutedCell">v{event.eventVersion}</span>
                        </td>
                        <td>{actorText(event)}</td>
                        <td>{event.action}</td>
                        <td>{aggregateText(event)}</td>
                        <td>{subjectRefsText(event)}</td>
                        <td>{statusChange(event)}</td>
                        <td>
                          {event.source.service}
                          <span className="mutedCell">{event.source.region}</span>
                        </td>
                        <td>
                          <code className="wrapCode">
                            {event.correlationId ?? "None"}
                          </code>
                        </td>
                        <td>
                          <code className="wrapCode">{event.causationId ?? "None"}</code>
                        </td>
                        <td>
                          <code className="wrapCode">{event.eventId}</code>
                        </td>
                        <td>{event.retentionUntil ?? "Not set"}</td>
                        <td title={event.integrity?.eventHash}>
                          <code className="wrapCode">{shortHash(event)}</code>
                        </td>
                        <td>
                          <code className="payloadCode">{payloadText(event)}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <pre className="json tour-json">
              {JSON.stringify(result?.body ?? {}, null, 2)}
            </pre>
          </section>
        </section>
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
