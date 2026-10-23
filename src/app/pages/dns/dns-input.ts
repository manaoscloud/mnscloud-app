import type { ConfigurableCrudRecord } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

export const DNS_BOOLEAN_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;

const ROLE_FIELDS = ['roleRecursive', 'roleAuthoritative', 'roleEdge'];

/**
 * Numeric fields go as numbers; the revision only on update and the roles only on create (the API
 * rejects unknown keys and ignores immutable ones).
 */
export function dnsPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const payload = { ...values };
  if (!editing) delete payload['revision'];
  if (editing) for (const field of ROLE_FIELDS) delete payload[field];
  for (const field of ['status', 'revision', ...ROLE_FIELDS]) {
    if (field in payload && payload[field] != null && payload[field] !== '')
      payload[field] = Number(payload[field]);
  }
  if (payload['notes'] === '') payload['notes'] = null;
  return payload;
}

/** Role names of a server row, in node order, for the list. */
export function dnsRoles(row: ConfigurableCrudRecord, translate: (key: string) => string): string {
  return [
    ['DsvRoleRecursive', 'dns.roles.recursive'],
    ['DsvRoleAuthoritative', 'dns.roles.authoritative'],
    ['DsvRoleEdge', 'dns.roles.edge'],
  ]
    .filter(([field]) => Number(row[field]) === 1)
    .map(([, label]) => translate(label))
    .join(' + ');
}
