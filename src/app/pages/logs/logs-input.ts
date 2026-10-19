import type { ConfigurableCrudRecord } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

export const LOGS_BOOLEAN_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;

/** Numeric fields go as numbers; the revision only on update (the API rejects unknown keys). */
export function logsPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const payload = { ...values };
  if (!editing) delete payload['revision'];
  for (const field of ['status', 'revision', 'published', 'syslogUdpPort', 'syslogTcpPort']) {
    if (field in payload && payload[field] != null && payload[field] !== '')
      payload[field] = Number(payload[field]);
  }
  if (payload['notes'] === '') payload['notes'] = null;
  return payload;
}
