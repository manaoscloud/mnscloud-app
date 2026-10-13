import type { ConfigurableCrudRecord } from '../../shared/crud/configurable-crud/configurable-crud-page-base';
export const AUTHENTICATION_BOOLEAN_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;
export function authenticationPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const payload = { ...values };
  if (!editing) delete payload['revision'];
  if (editing)
    for (const field of ['secret', 'password'])
      if (payload[field] == null || payload[field] === '') delete payload[field];
  for (const field of [
    'status',
    'revision',
    'published',
    'authPort',
    'acctPort',
    'interimInterval',
    'idleTimeout',
    'sessionTimeout',
  ]) {
    if (field in payload && payload[field] != null && payload[field] !== '')
      payload[field] = Number(payload[field]);
  }
  return payload;
}
