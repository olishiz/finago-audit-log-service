import type { AuditEventView } from "./events.js";

export function normalizeLocale(locale: string | undefined): string {
  const normalized = (locale ?? "en").trim().toLowerCase().replace("_", "-");

  if (normalized.startsWith("fi")) {
    return "fi";
  }

  if (normalized.startsWith("sv")) {
    return "sv";
  }

  if (normalized === "no" || normalized.startsWith("nb")) {
    return "nb";
  }

  return "en";
}

export function localeCandidates(locale: string | undefined): string[] {
  const normalized = normalizeLocale(locale);
  return normalized === "en" ? ["en"] : [normalized, "en"];
}

function stringList(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.map((item) => String(item)).join(", ");
}

function templateValues(event: AuditEventView): Record<string, string> {
  return {
    actor: event.actor.displayName ?? event.actor.id,
    aggregate:
      event.aggregate.displayName ??
      `${event.aggregate.type} ${event.aggregate.id}`,
    eventType: event.eventType,
    fields: stringList(event.payload.fieldsChanged),
    reason: String(
      event.payload.reason ?? event.payload.deactivationReason ?? "not supplied"
    )
  };
}

export function renderSummary(
  event: AuditEventView,
  template: string | null | undefined
): string {
  if (!template) {
    const values = templateValues(event);
    return `${values.actor} recorded ${event.eventType} on ${values.aggregate}`;
  }

  const values = templateValues(event);
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => {
    return values[key] ?? "";
  });
}
