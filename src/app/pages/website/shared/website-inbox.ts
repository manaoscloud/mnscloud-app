import { MatDialog } from '@angular/material/dialog';
import {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../shared/data-viewer-dialog/data-viewer-dialog';

/** Converts to text only primitives that have a meaningful string form; anything else is empty. */
export function plainText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Trimmed text of a value (see `plainText`). */
export function text(value: unknown): string {
  return plainText(value).trim();
}

/** Moderation body: the API accepts only the revision, the status and the notes. */
export function websiteInboxPayload(values: Record<string, unknown>): Record<string, unknown> {
  return {
    revision: Number(values['revision']),
    status: text(values['status']),
    notes: text(values['notes']),
  };
}

export const WEBSITE_INBOX_INITIAL_VALUES = { status: 'new', notes: '', revision: null };

export const WEBSITE_INBOX_ROW_ACTIONS: readonly ConfigurableCrudRowAction[] = [
  { key: 'view', label: 'View details', icon: 'visibility' },
];

/** Label of the option matching the value, or the value as text. */
export function inboxOptionLabel(
  options: readonly ConfigurableCrudOption[],
  value: unknown,
): string {
  return options.find((o) => o.value === value)?.label ?? text(value);
}

export function websiteInboxStatusColumn(
  options: readonly ConfigurableCrudOption[],
): ConfigurableCrudColumn {
  return {
    id: 'status',
    field: 'Status',
    label: 'Status',
    kind: 'status',
    options,
    className: 'status-col',
  };
}

export function websiteInboxFields(
  options: readonly ConfigurableCrudOption[],
): ConfigurableCrudField[] {
  return [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'select',
      options,
      required: true,
      span: 1,
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
    { key: 'revision', source: 'Revision', label: 'Revision', hidden: true },
  ];
}

type ViewerOptions = Parameters<typeof openDataViewerDialog>[1];

/** Opens the read-only details dialog of an inbox row. */
export function openInboxViewer(dialog: MatDialog, options: ViewerOptions): void {
  openDataViewerDialog(dialog, options);
}

/** Settings shared by the website inboxes: moderation only, server paging, status new..closed. */
export function websiteInboxCrudDefaults() {
  return {
    canCreate: false,
    bulkDelete: true,
    serverSidePagination: true,
    initialPageSize: 25,
    statusMode: 'string' as const,
    activeValue: 'new',
    inactiveValue: 'closed',
    rowActions: WEBSITE_INBOX_ROW_ACTIONS,
    initialValues: WEBSITE_INBOX_INITIAL_VALUES,
    payload: (values: Record<string, unknown>) => websiteInboxPayload(values),
  };
}

/** One select filter of an inbox list. */
export function websiteInboxSelectFilter(
  key: string,
  label: string,
  options: readonly ConfigurableCrudOption[],
) {
  return [{ key, label, paramKey: key, type: 'select' as const, span: 1 as const, options }];
}
