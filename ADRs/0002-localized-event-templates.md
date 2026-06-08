# ADR 0002: Localized Event Templates

## Context

The same audit event must be understandable to accountants, auditors, and support engineers in Finnish, Swedish, Norwegian, and English. New event types will arrive without advance notice.

## Decision

Persist event facts separately from human-readable text. Store localization templates by `event_type`, `event_version`, and `locale`; render summaries at query time.

## Rejected Alternatives

- Store only pre-rendered text: simpler, but it freezes language and makes later translation fixes impossible.
- Let every producer send localized strings: shifts quality and consistency problems to every team.
- Hard-code all templates in the API: easy for the slice, but poor for platform adoption.

## Consequences

Events remain stable records while wording can improve. Missing templates fall back to English and then to a generic summary, so unknown event types remain queryable.
