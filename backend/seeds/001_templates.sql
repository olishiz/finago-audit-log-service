INSERT INTO audit_event_templates (event_type, event_version, locale, template)
VALUES
  ('order.updated', 1, 'en', '{actor} updated {aggregate}: {fields}'),
  ('order.updated', 1, 'fi', '{actor} päivitti kohteen {aggregate}: {fields}'),
  ('order.updated', 1, 'sv', '{actor} uppdaterade {aggregate}: {fields}'),
  ('order.updated', 1, 'nb', '{actor} oppdaterte {aggregate}: {fields}'),
  ('employee.deactivated', 1, 'en', '{actor} deactivated {aggregate}. Reason: {reason}'),
  ('employee.deactivated', 1, 'fi', '{actor} poisti käytöstä kohteen {aggregate}. Syy: {reason}'),
  ('employee.deactivated', 1, 'sv', '{actor} inaktiverade {aggregate}. Orsak: {reason}'),
  ('employee.deactivated', 1, 'nb', '{actor} deaktiverte {aggregate}. Årsak: {reason}'),
  ('session.revoked', 1, 'en', '{actor} revoked active sessions for {aggregate}'),
  ('session.revoked', 1, 'fi', '{actor} mitätöi kohteen {aggregate} aktiiviset istunnot'),
  ('session.revoked', 1, 'sv', '{actor} återkallade aktiva sessioner för {aggregate}'),
  ('session.revoked', 1, 'nb', '{actor} tilbakekalte aktive økter for {aggregate}'),
  ('payroll.cancelled', 1, 'en', '{actor} cancelled pending payroll for {aggregate}'),
  ('payroll.cancelled', 1, 'fi', '{actor} peruutti kohteen {aggregate} odottavan palkanlaskennan'),
  ('payroll.cancelled', 1, 'sv', '{actor} avbröt väntande lönekörning för {aggregate}'),
  ('payroll.cancelled', 1, 'nb', '{actor} kansellerte ventende lønnskjøring for {aggregate}')
ON CONFLICT (event_type, event_version, locale)
DO UPDATE SET template = EXCLUDED.template;
