import { ConfigurableCrudColumn } from '../crud/configurable-crud/configurable-crud-page-base';

const HEALTH_LABELS: Record<string, string> = {
  online: 'ONLINE',
  offline: 'OFFLINE',
  inactive: 'INACTIVE',
  unknown: 'UNKNOWN',
};

/** Runtime server health chip (online / unknown / offline) shared by the dashboard tables. */
export function serverHealthColumn(field = 'health'): ConfigurableCrudColumn {
  return {
    id: 'health',
    label: 'Status',
    field,
    kind: 'status',
    value: (row) => {
      const health = String(row[field] ?? '');
      return HEALTH_LABELS[health] ?? health.toUpperCase();
    },
    chipClass: (value) =>
      value === 'online'
        ? 'chip-success is-active'
        : value === 'unknown'
          ? 'chip-running is-inactive'
          : 'chip-skipped is-inactive',
  };
}

/** Active/Inactive chip for a numeric (1/0) status field. */
export function activeStatusColumn(field = 'status'): ConfigurableCrudColumn {
  return { id: 'status', label: 'Status', field, kind: 'status' };
}

/** Last time a node reported, formatted with the configured date/time format. */
export function lastSeenColumn(field = 'lastSeenAt', label = 'Last Seen'): ConfigurableCrudColumn {
  return { id: field, label, field, kind: 'datetime' };
}
