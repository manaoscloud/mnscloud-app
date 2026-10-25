import { MatDialog } from '@angular/material/dialog';
import { ApiService } from '../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { ATTACHMENT_ACCEPT, openPrivateFile } from '../../support/shared/support-desk';

const ATTACHMENT_KINDS = [
  { value: 'PHOTO', label: 'Photo' },
  { value: 'DOCUMENT', label: 'Document' },
];

const HISTORY_ACTIONS = [
  { value: 'CREATE', label: 'Created' },
  { value: 'UPDATE', label: 'Changed' },
  { value: 'DELETE', label: 'Deleted' },
  { value: 'ATTACH', label: 'File attached' },
  { value: 'DETACH', label: 'File removed' },
];

/** Labels of the fields recorded in `changes`, in the order they are shown. */
const CHANGE_FIELDS: readonly [string, string][] = [
  ['name', 'Name'],
  ['externalId', 'External ID'],
  ['project', 'Project'],
  ['layer', 'Layer'],
  ['type', 'Asset Type'],
  ['status', 'Asset Status'],
  ['active', 'Status'],
  ['properties', 'Properties'],
  ['geometry', 'Geometry'],
  ['fileName', 'File'],
];

const label = (options: readonly { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label ?? String(value ?? '');

const plain = (value: unknown): string =>
  value === null || value === undefined || value === ''
    ? '—'
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

/** One line per changed field: "Name: POSTE 1 → POSTE 1B"; properties and geometry only by name. */
export function historySummary(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  const changes = (row['changes'] ?? {}) as Record<string, unknown>;
  return CHANGE_FIELDS.filter(([key]) => key in changes)
    .map(([key, name]) => {
      const change = changes[key] as { from?: unknown; to?: unknown } | string;
      if (typeof change !== 'object' || change === null || key === 'properties') return t(name);
      if (key === 'geometry') {
        const to = (change.to ?? {}) as Record<string, unknown>;
        return `${t(name)}: ${plain(to['latitude'])}, ${plain(to['longitude'])}`;
      }
      if (!('from' in change)) return `${t(name)}: ${plain(change)}`;
      return `${t(name)}: ${plain(change.from)} → ${plain(change.to)}`;
    })
    .join('; ');
}

/** Photos and documents of an asset (field captures carry GPS and the capture time). */
export function assetAttachmentsCollection(
  api: ApiService,
  dialog: MatDialog,
  asset: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const uuid = String(asset['IgaUUID'] ?? '');
  return defineCrud({
    endpoint: `infragis/assets/${uuid}/attachments`,
    deleteEndpoint: (row) => `infragis/attachments/${String(row['IgfUUID'])}`,
    uuidField: 'IgfUUID',
    pageTitle: 'Photos and documents',
    pageDescription: String(asset['IgaName'] ?? ''),
    createTitle: 'Attach a file',
    dialogDescription: 'Images, PDF or text files (txt, log, csv, json) up to 10 MB.',
    emptyLabel: 'No photos or documents.',
    savedMessage: 'File attached.',
    canEdit: false,
    bulkDelete: false,
    statusFilter: false,
    createUpload: { fileField: 'file', formField: 'file', includeFields: true },
    initialValues: { file: null, kind: 'PHOTO' },
    fields: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        accept: ATTACHMENT_ACCEPT,
        required: true,
        span: 4,
      },
      {
        key: 'kind',
        label: 'Kind',
        type: 'select',
        options: ATTACHMENT_KINDS,
        translateOptions: true,
        span: 2,
      },
      { key: 'caption', label: 'Caption', span: 2 },
    ],
    rowActions: [
      {
        key: 'open',
        label: 'Open file',
        icon: 'open_in_new',
        run: (row) =>
          openPrivateFile(api, `infragis/attachments/${String(row['IgfUUID'])}/content`, {
            dialog,
            contentType: String(row['IgfContentType'] ?? ''),
            fileName: String(row['IgfFileName'] ?? 'attachment'),
          }),
      },
    ],
    columns: [
      { id: 'name', field: 'IgfFileName', label: 'File', kind: 'identity' },
      {
        id: 'kind',
        field: 'IgfKind',
        label: 'Kind',
        value: (row, t) => t(label(ATTACHMENT_KINDS, row['IgfKind'])),
      },
      { id: 'caption', field: 'IgfCaption', label: 'Caption' },
      {
        id: 'position',
        field: 'IgfLatitude',
        label: 'Position',
        value: (row) =>
          row['IgfLatitude'] == null ? '' : `${row['IgfLatitude']}, ${row['IgfLongitude']}`,
      },
      { id: 'captured', field: 'IgfCapturedAt', label: 'Captured at', kind: 'datetime' },
      { id: 'author', field: 'CreatedByName', label: 'Sent by' },
    ],
  });
}

/** Who created, changed or deleted the asset and attached files, newest first (read-only). */
export function assetHistoryCollection(asset: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const uuid = String(asset['IgaUUID'] ?? '');
  return defineCrud({
    endpoint: `infragis/assets/${uuid}/history`,
    uuidField: 'IghUUID',
    pageTitle: 'Asset history',
    pageDescription: String(asset['IgaName'] ?? ''),
    emptyLabel: 'No changes recorded.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: {},
    fields: [],
    columns: [
      { id: 'date', field: 'IghDateCreated', label: 'Date', kind: 'datetime' },
      {
        id: 'action',
        field: 'IghAction',
        label: 'Action',
        value: (row, t) => t(label(HISTORY_ACTIONS, row['IghAction'])),
      },
      { id: 'actor', field: 'ActorName', label: 'By' },
      {
        id: 'changes',
        field: 'changes',
        label: 'Changes',
        width: 'lg',
        value: (row, t) => historySummary(row, t),
      },
    ],
  });
}
