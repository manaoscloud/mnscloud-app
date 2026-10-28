import { Component, computed, inject } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudListParams,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  DataViewerTone,
  openDataViewerDialog,
} from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import { AuthService } from '../../../../services/auth.service';

const STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'sending', label: 'Sending' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'rejected', label: 'Rejected' },
];

const EVENT_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'signup_email_verification', label: 'Signup Verification' },
  { value: 'reset_password', label: 'Password Reset' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'login_success', label: 'Login Success' },
  { value: 'invalid_password', label: 'Invalid Password Warning' },
  { value: 'user_access_invite', label: 'User Invite' },
  { value: 'customer_portal_welcome', label: 'Customer Portal Welcome' },
  { value: 'platform_support', label: 'Platform Support' },
  { value: 'general', label: 'General / Notification' },
];

const VIEW_DETAILS_ACTION: ConfigurableCrudRowAction = {
  key: 'view-details',
  label: 'View details',
  icon: 'visibility',
  tooltip: 'View details',
};

function messageChipClass(status: unknown): string {
  const normalized = String(status ?? '').toLowerCase();
  if (['sent', 'delivered'].includes(normalized)) return 'status-chip status-active';
  if (['failed', 'bounced', 'rejected', 'complained'].includes(normalized)) {
    return 'status-chip status-inactive';
  }
  if (['queued', 'sending'].includes(normalized)) return 'status-chip status-pending';
  return 'status-chip';
}

function viewerTone(status: unknown): DataViewerTone {
  const normalized = String(status ?? '').toLowerCase();
  if (['sent', 'delivered'].includes(normalized)) return 'success';
  if (['failed', 'bounced', 'rejected', 'complained'].includes(normalized)) return 'danger';
  if (['queued', 'sending'].includes(normalized)) return 'warning';
  return 'neutral';
}

const MESSAGES_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/smtp/messages',
  uuidField: 'messageUUID',
  pageTitle: 'SMTP Messages',
  pageDescription: 'Transactional email message delivery logs, status and monitoring.',
  createTitle: '',
  editTitle: 'SMTP Message',
  dialogDescription: 'Review email delivery details and lifecycle events.',
  searchPlaceholder: 'Search by subject or idempotency key',
  emptyLabel: 'No SMTP messages found.',
  deleteTitle: '',
  deleteMessage: '',
  deleteSelectedTitle: '',
  deleteSelectedMessage: '',
  savedMessage: '',
  deletedMessage: '',
  deleteFailedMessage: '',
  fields: [],
  columns: [
    { id: 'queuedAt', label: 'Date/Time', field: 'queuedAt', kind: 'datetime' },
    {
      id: 'status',
      label: 'Status',
      field: 'status',
      kind: 'status',
      options: STATUS_OPTIONS,
      chipClass: (value) => messageChipClass(value),
    },
    { id: 'eventType', label: 'Event', field: 'eventType' },
    { id: 'subject', label: 'Subject', field: 'subject' },
    { id: 'recipients', label: 'Recipients', field: 'recipientsSummary' },
    { id: 'provider', label: 'Provider', field: 'provider' },
    { id: 'lastError', label: 'Error', field: 'lastError' },
  ],
  initialValues: {},
  statusMode: 'string',
  activeValue: 'sent',
  inactiveValue: 'failed',
  statusOptions: STATUS_OPTIONS,
  statusFilter: true,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  rowActions: [VIEW_DETAILS_ACTION],
  listFilters: [
    {
      key: 'eventType',
      label: 'Event Type',
      type: 'select',
      options: [{ value: '', label: 'All' }, ...EVENT_TYPE_OPTIONS],
      translateOptions: false,
    },
  ],
  serverSidePagination: true,
  pageSizeOptions: [10, 25, 50, 100],
};

@Component({
  selector: 'app-hosting-smtp-messages',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingSmtpMessagesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly auth = inject(AuthService);

  private readonly isMaster = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access') ||
    (this.auth.user()?.permissions ?? []).includes('platform.hosting.smtp.manage'),
  );

  constructor() {
    super(MESSAGES_CONFIG);
  }

  protected override listEndpoint(): string {
    return this.isMaster() ? 'system/hosting/smtp/messages' : 'hosting/smtp/messages';
  }

  override rowActions(_row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return [VIEW_DETAILS_ACTION];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'view-details') return;
    await this.openDetails(row);
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<ConfigurableCrudRecord[]> {
    const params = new URLSearchParams();
    params.set('limit', String((filters as ConfigurableCrudListParams).limit ?? 25));
    params.set('offset', String((filters as ConfigurableCrudListParams).offset ?? 0));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', String(filters.status));
    for (const [key, value] of Object.entries(filters.extra ?? {})) {
      if (value === null || value === undefined || value === '') continue;
      params.set(key, String(value));
    }

    const response = await this.api.get<{
      data?: { items?: ConfigurableCrudRecord[]; total?: number };
    }>(`${this.listEndpoint()}?${params.toString()}`);
    const data = response.data ?? {};
    const items = (data.items ?? []).map((item) => this.decorateRow(item));
    this.serverTotal.set(Number(data.total ?? items.length));
    return items;
  }

  private decorateRow(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const recipientsList = Array.isArray(row['recipients'])
      ? (row['recipients'] as Record<string, unknown>[])
      : [];
    const recipientsSummary = recipientsList
      .map((r) => r['email'] || r['name'])
      .filter(Boolean)
      .join(', ') || '-';
    return {
      ...row,
      recipientsSummary,
      provider: row['provider'] || 'smtp',
    };
  }

  private async openDetails(row: ConfigurableCrudRecord) {
    const uuid = String(row['messageUUID'] || row['uuid'] || '');
    let item = row;
    if (uuid) {
      try {
        const res = await this.api.get<{ data?: { item?: ConfigurableCrudRecord } }>(
          `${this.listEndpoint()}/${uuid}`,
        );
        if (res.data?.item) item = res.data.item;
      } catch {
        // Use row from list on failure
      }
    }

    const recipients = Array.isArray(item['recipients']) ? (item['recipients'] as unknown[]) : [];
    const events = Array.isArray(item['events']) ? (item['events'] as unknown[]) : [];

    openDataViewerDialog(this.dialog, {
      title: String(item['subject'] || 'SMTP Message'),
      description: `Event: ${item['eventType'] || 'general'} | Provider: ${item['provider'] || 'smtp'}`,
      status: {
        label: 'Status',
        value: String(item['status'] || '-'),
        tone: viewerTone(item['status']),
      },
      details: [
        { label: 'Subject', value: item['subject'], wide: true },
        { label: 'Event Type', value: item['eventType'] },
        { label: 'Status', value: item['status'] },
        { label: 'Message UUID', value: item['messageUUID'], monospace: true, wide: true },
        { label: 'Idempotency Key', value: item['idempotencyKey'], monospace: true, wide: true },
        { label: 'Provider', value: item['provider'] },
        {
          label: 'Provider Message ID',
          value: item['providerMessageId'] || '-',
          monospace: true,
          wide: true,
        },
        { label: 'Retry Count', value: item['retryCount'] ?? 0 },
        { label: 'Queued At', value: item['queuedAt'], kind: 'datetime' },
        { label: 'Sending At', value: item['sendingAt'], kind: 'datetime' },
        { label: 'Sent At', value: item['sentAt'], kind: 'datetime' },
        { label: 'Delivered At', value: item['deliveredAt'], kind: 'datetime' },
        { label: 'Failed At', value: item['failedAt'], kind: 'datetime' },
        { label: 'Last Error', value: item['lastError'] || 'None', wide: true },
      ],
      sections: [
        {
          title: 'Recipients',
          code: {
            title: 'Recipients',
            value: recipients.length ? recipients : 'No recipient details recorded.',
            format: 'json',
            copy: true,
          },
        },
        {
          title: 'Lifecycle Events',
          code: {
            title: 'Events',
            value: events.length ? events : 'No lifecycle events recorded yet.',
            format: 'json',
            copy: true,
          },
        },
        ...(item['html']
          ? [{
            title: 'Email HTML Content',
            code: {
              title: 'HTML',
              value: String(item['html']),
              format: 'text' as const,
              copy: true,
            },
          }]
          : []),
        ...(item['text']
          ? [{
            title: 'Email Plain Text Content',
            code: {
              title: 'Text',
              value: String(item['text']),
              format: 'text' as const,
              copy: true,
            },
          }]
          : []),
      ],
    });
  }
}
