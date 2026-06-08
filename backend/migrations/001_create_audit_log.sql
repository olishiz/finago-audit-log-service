CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  tenant_id text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL,
  actor_id text NOT NULL,
  actor_display_name text,
  action text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  aggregate_display_name text,
  source_service text NOT NULL,
  source_region text NOT NULL,
  correlation_id text,
  causation_id text,
  subject_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  event_hash text NOT NULL,
  retention_until date,
  redacted_at timestamptz,
  redaction_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS audit_events_event_id_idx
  ON audit_events (event_id);

CREATE INDEX IF NOT EXISTS audit_events_tenant_occurred_idx
  ON audit_events (tenant_id, occurred_at DESC, event_id DESC);

CREATE INDEX IF NOT EXISTS audit_events_tenant_actor_idx
  ON audit_events (tenant_id, actor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_tenant_aggregate_idx
  ON audit_events (tenant_id, aggregate_type, aggregate_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_tenant_correlation_idx
  ON audit_events (tenant_id, correlation_id, occurred_at DESC)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS audit_events_subject_refs_gin_idx
  ON audit_events USING gin (subject_refs jsonb_path_ops);

CREATE INDEX IF NOT EXISTS audit_events_payload_gin_idx
  ON audit_events USING gin (payload jsonb_path_ops);

CREATE TABLE IF NOT EXISTS audit_event_templates (
  event_type text NOT NULL,
  event_version integer NOT NULL DEFAULT 1 CHECK (event_version > 0),
  locale text NOT NULL,
  template text NOT NULL,
  PRIMARY KEY (event_type, event_version, locale)
);
