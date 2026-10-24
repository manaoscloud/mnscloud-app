import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * Shared shape of the Registry "named record" pages (departments, positions): name, description,
 * status and notes. Each page keeps its own endpoint, identity field, title and description.
 * The builders return literals directly so the App catalog reads their labels statically.
 */
export function namedRecordColumns(uuidField: string): ConfigurableCrudColumn[] {
  return [
    { id: 'name', label: 'Name', field: 'Name', uuidField, kind: 'identity' },
    { id: 'description', label: 'Description', field: 'Description' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ];
}

export function namedRecordFields(): ConfigurableCrudField[] {
  return [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    { key: 'description', source: 'Description', label: 'Description', span: 2 },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ];
}

export const NAMED_RECORD_INITIAL_VALUES = { status: 1, name: '', description: '', notes: '' };

/** Status is sent as a number by every named record page. */
export function namedRecordPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
  return { ...payload, status: Number(payload['status']) };
}
