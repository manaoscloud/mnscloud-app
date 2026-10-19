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
  for (const field of [
    'status',
    'revision',
    'published',
    'syslogUdpPort',
    'syslogTcpPort',
    'syslogUdp',
    'syslogTcp',
  ]) {
    if (field in payload && payload[field] != null && payload[field] !== '')
      payload[field] = Number(payload[field]);
  }
  if (payload['notes'] === '') payload['notes'] = null;
  return payload;
}

export const LOGS_TIER_OPTIONS = [
  { value: '7d', label: 'logs.tiers.7d' },
  { value: '30d', label: 'logs.tiers.30d' },
  { value: '90d', label: 'logs.tiers.90d' },
  { value: '365d', label: 'logs.tiers.365d' },
] as const;
