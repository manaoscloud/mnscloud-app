import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/**
 * One Support model, two desks: the tenant desk (/support, a tenant answers its ERP customers)
 * and the platform desk (/system/support, the MNSCloud team answers tenants). Pages read the
 * desk from the route (`data.scope === 'master'`), so quick-create keeps the caller's desk.
 */
export type SupportDesk = 'tenant' | 'platform';

export function supportDesk(route: ActivatedRoute): SupportDesk {
  return route.snapshot.data['scope'] === 'master' ? 'platform' : 'tenant';
}

export function supportBase(desk: SupportDesk): string {
  return desk === 'platform' ? 'system/support' : 'support';
}

export const TICKET_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'pending', label: 'Waiting for requester' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
  { value: 'canceled', label: 'Canceled' },
];

export const ACTIVE_TICKET_STATUSES = ['open', 'in_progress', 'pending'];

export function ticketStatusChip(value: unknown): string {
  if (value === 'resolved' || value === 'closed') return 'chip-success';
  if (value === 'canceled') return 'chip-skipped';
  if (value === 'pending') return 'chip-running';
  return 'chip-failed';
}

export const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

const AUTHOR_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'agent', label: 'Support team' },
  { value: 'requester', label: 'Requester' },
  { value: 'system', label: 'System' },
];

const EVENT_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'created', label: 'Ticket opened' },
  { value: 'reply', label: 'Reply' },
  { value: 'note', label: 'Internal note' },
  { value: 'status', label: 'Status changed' },
  { value: 'priority', label: 'Priority changed' },
  { value: 'assignment', label: 'Assignment changed' },
];

const ATTACHMENT_KIND_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'file', label: 'File' },
  { value: 'screenshot', label: 'Screen capture' },
  { value: 'diagnostics', label: 'Diagnostics' },
];

export const ATTACHMENT_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.pdf,.txt,.log,.csv,.json';

function statusLabel(value: unknown, translate: (key: string) => string): string {
  const option = TICKET_STATUS_OPTIONS.find((item) => item.value === value);
  return option ? translate(option.label) : '';
}

/** Opens a private file in a new tab: the tab opens synchronously so popup blockers allow it. */
export async function openPrivateFile(api: ApiService, endpoint: string): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const blob = await api.getBlob(endpoint);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    tab?.close();
  }
}

/** Agent timeline: public replies, internal notes and status moves in one place. */
export function agentTimelineCollection(
  desk: SupportDesk,
  ticket: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const uuid = String(ticket['SupportTicketUUID'] ?? '');
  return defineCrud({
    endpoint: `${supportBase(desk)}/tickets/${uuid}/events`,
    uuidField: 'SupportTicketEventUUID',
    pageTitle: 'Ticket conversation',
    pageDescription: `#${String(ticket['SupportTicketID'] ?? '')} · ${String(ticket['Subject'] ?? '')}`,
    createTitle: 'Reply or add a note',
    dialogDescription:
      'Public replies are emailed to the requester; internal notes stay with the team.',
    emptyLabel: 'No messages yet.',
    savedMessage: 'Message recorded.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialPageSize: 25,
    initialValues: { message: '', isInternal: 0, status: '' },
    fields: [
      { key: 'message', label: 'Message', type: 'textarea', rows: 5, span: 4, required: true },
      {
        key: 'isInternal',
        label: 'Internal note',
        type: 'search-select',
        options: YES_NO_OPTIONS,
        translateOptions: true,
        help: 'Internal notes are never shown to the requester.',
        span: 2,
      },
      {
        key: 'status',
        label: 'Move ticket to',
        type: 'search-select',
        options: [{ value: '', label: 'Keep current status' }, ...TICKET_STATUS_OPTIONS],
        translateOptions: true,
        help: 'Use “Waiting for requester” when you asked for information.',
        span: 2,
      },
    ],
    payload: (values) => ({
      message: values['message'],
      isInternal: Number(values['isInternal'] ?? 0),
      status: values['status'] || null,
    }),
    columns: [
      { id: 'date', field: 'DateCreated', label: 'Date', kind: 'datetime' },
      {
        id: 'author',
        field: 'AuthorKind',
        label: 'Author',
        kind: 'status',
        options: AUTHOR_OPTIONS,
        chipClass: (value) =>
          value === 'agent'
            ? 'chip-running'
            : value === 'requester'
              ? 'chip-success'
              : 'chip-skipped',
        detail: (row) => String(row['CreatedByName'] ?? ''),
      },
      {
        id: 'type',
        field: 'Type',
        label: 'Event',
        kind: 'status',
        options: EVENT_TYPE_OPTIONS,
        chipClass: () => 'chip-skipped',
      },
      {
        id: 'message',
        field: 'Message',
        label: 'Message',
        value: (row, translate) =>
          String(row['Message'] ?? '') || statusLabel(row['StatusTo'], translate),
      },
      { id: 'internal', field: 'IsInternal', label: 'Internal', kind: 'boolean' },
    ],
  });
}

/** Requester conversation in the help center: public messages only. */
export function helpConversationCollection(ticket: ConfigurableCrudRecord): ConfigurableCrudConfig {
  const uuid = String(ticket['SupportTicketUUID'] ?? '');
  const open = !['closed', 'canceled'].includes(String(ticket['Status'] ?? ''));
  return defineCrud({
    endpoint: `help/tickets/${uuid}/messages`,
    uuidField: 'SupportTicketEventUUID',
    pageTitle: 'Ticket conversation',
    pageDescription: `#${String(ticket['SupportTicketID'] ?? '')} · ${String(ticket['Subject'] ?? '')}`,
    createTitle: 'Reply to the support team',
    dialogDescription: 'Your answer goes back to the support team queue.',
    emptyLabel: 'No messages yet.',
    savedMessage: 'Message sent.',
    canCreate: open,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialPageSize: 25,
    initialValues: { message: '' },
    fields: [
      { key: 'message', label: 'Message', type: 'textarea', rows: 5, span: 4, required: true },
    ],
    columns: [
      { id: 'date', field: 'DateCreated', label: 'Date', kind: 'datetime' },
      {
        id: 'author',
        field: 'AuthorKind',
        label: 'Author',
        kind: 'status',
        options: AUTHOR_OPTIONS,
        chipClass: (value) =>
          value === 'agent'
            ? 'chip-running'
            : value === 'requester'
              ? 'chip-success'
              : 'chip-skipped',
        detail: (row) => String(row['CreatedByName'] ?? ''),
      },
      {
        id: 'message',
        field: 'Message',
        label: 'Message',
        value: (row, translate) =>
          String(row['Message'] ?? '') || statusLabel(row['StatusTo'], translate),
      },
    ],
  });
}

/** Attachments of a ticket; `base` is support, system/support or help. */
export function attachmentsCollection(
  api: () => ApiService,
  base: string,
  ticket: ConfigurableCrudRecord,
  agent: boolean,
): ConfigurableCrudConfig {
  const uuid = String(ticket['SupportTicketUUID'] ?? '');
  const endpoint = `${base}/tickets/${uuid}/attachments`;
  return defineCrud({
    endpoint,
    uuidField: 'SupportTicketAttachmentUUID',
    pageTitle: 'Ticket attachments',
    pageDescription: `#${String(ticket['SupportTicketID'] ?? '')} · ${String(ticket['Subject'] ?? '')}`,
    createTitle: 'Attach a file',
    dialogDescription: 'Images, PDF or text files (txt, log, csv, json) up to 10 MB.',
    emptyLabel: 'No attachments.',
    savedMessage: 'File attached.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    createUpload: { fileField: 'file', formField: 'file' },
    initialValues: { file: null },
    fields: [
      {
        key: 'file',
        label: 'File',
        type: 'file',
        accept: ATTACHMENT_ACCEPT,
        required: true,
        span: 4,
      },
    ],
    rowActions: [
      {
        key: 'download',
        label: 'Open file',
        icon: 'open_in_new',
        run: (row) =>
          openPrivateFile(
            api(),
            `${endpoint}/${String(row['SupportTicketAttachmentUUID'])}/content`,
          ),
      },
    ],
    columns: [
      { id: 'name', field: 'FileName', label: 'File', kind: 'identity' },
      {
        id: 'kind',
        field: 'Kind',
        label: 'Kind',
        kind: 'status',
        options: ATTACHMENT_KIND_OPTIONS,
        chipClass: () => 'chip-skipped',
      },
      {
        id: 'size',
        field: 'SizeBytes',
        label: 'Size',
        value: (row) => `${Math.max(1, Math.round(Number(row['SizeBytes'] ?? 0) / 1024))} KB`,
      },
      ...(agent
        ? [{ id: 'internal', field: 'IsInternal', label: 'Internal', kind: 'boolean' as const }]
        : []),
      { id: 'author', field: 'CreatedByName', label: 'Sent by' },
      { id: 'date', field: 'DateCreated', label: 'Date', kind: 'datetime' },
    ],
  });
}
