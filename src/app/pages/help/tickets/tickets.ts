import { Component, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { BugReportService } from '../../../services/bug-report.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  ACTIVE_TICKET_STATUSES,
  TICKET_STATUS_OPTIONS,
  attachmentsCollection,
  helpConversationCollection,
  ticketStatusChip,
} from '../../support/shared/support-desk';

const READ_ALL = 'tenant.help.tickets.read_all';

function config(api: () => ApiService, readAll: () => boolean): ConfigurableCrudConfig {
  const open = (row: ConfigurableCrudRecord) =>
    !['closed', 'canceled'].includes(String(row['Status'] ?? ''));
  return defineCrud({
    endpoint: 'help/tickets',
    uuidField: 'SupportTicketUUID',
    pageTitle: 'My tickets',
    pageDescription:
      'Tickets you opened to the MNSCloud support team, including problems reported from the App.',
    createTitle: 'New ticket',
    dialogDescription: 'Describe what you need; the support team answers here and by email.',
    searchPlaceholder: 'Protocol or subject',
    emptyLabel: 'No tickets yet.',
    savedMessage: 'Ticket opened. Our team was notified.',
    statusMode: 'string',
    activeValue: 'open',
    inactiveValue: 'closed',
    statusOptions: TICKET_STATUS_OPTIONS,
    activeStatusValues: ACTIVE_TICKET_STATUSES,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    serverSidePagination: true,
    initialPageSize: 10,
    filterActions: [{ key: 'report', label: 'Report problem', icon: 'bug_report' }],
    listFilters: [
      {
        key: 'scope',
        label: 'Tickets',
        type: 'search-select',
        span: 1,
        options: [
          { value: '', label: 'Mine' },
          { value: 'environment', label: 'Whole environment' },
        ],
        translateOptions: true,
        hiddenWhen: () => !readAll(),
      },
    ],
    rowActions: [
      { key: 'view', label: 'View details', icon: 'visibility' },
      {
        key: 'conversation',
        label: 'Conversation',
        icon: 'forum',
        collection: (row) => helpConversationCollection(row),
      },
      {
        key: 'attachments',
        label: 'Attachments',
        icon: 'attach_file',
        collection: (row) => attachmentsCollection(api, 'help', row, false),
      },
      {
        key: 'close',
        label: 'Problem solved — close ticket',
        icon: 'task_alt',
        visible: open,
        request: {
          method: 'post',
          endpoint: (row) => `help/tickets/${String(row['SupportTicketUUID'])}/close`,
          successMessage: 'Ticket closed.',
          confirm: {
            title: 'Close ticket',
            message: 'Close this ticket? You can open a new one if the problem comes back.',
          },
        },
      },
    ],
    initialValues: { typeUUID: '', priorityUUID: '', subject: '', description: '' },
    payload: (values) => ({ ...values, origin: 'help_center' }),
    fields: [
      {
        key: 'typeUUID',
        payloadKey: 'typeUUID',
        label: 'Type',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'help/ticket-types',
          uuidField: 'SupportTicketTypeUUID',
          labelField: 'Name',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Ticket types of the platform team are managed by the platform, not by tenants.',
        help: 'Leave empty to use the default.',
        span: 2,
      },
      {
        key: 'priorityUUID',
        payloadKey: 'priorityUUID',
        label: 'Priority',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'help/ticket-priorities',
          uuidField: 'SupportTicketPriorityUUID',
          labelField: 'Name',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Priorities and SLA of the platform team are managed by the platform, not by tenants.',
        help: 'Leave empty to use the default.',
        span: 2,
      },
      { key: 'subject', payloadKey: 'subject', label: 'Subject', required: true, span: 4 },
      {
        key: 'description',
        payloadKey: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 6,
        required: true,
        span: 4,
      },
    ],
    columns: [
      { id: 'protocol', field: 'SupportTicketID', label: 'Protocol', kind: 'identity' },
      {
        id: 'subject',
        field: 'Subject',
        label: 'Subject',
        detail: (row) => String(row['TypeName'] ?? ''),
      },
      { id: 'priority', field: 'PriorityName', label: 'Priority' },
      { id: 'origin', field: 'ChannelName', label: 'Origin' },
      { id: 'author', field: 'CreatedByName', label: 'Opened by', hiddenWhen: () => !readAll() },
      { id: 'activity', field: 'LastActivityAt', label: 'Last activity', kind: 'datetime' },
      {
        id: 'status',
        field: 'Status',
        label: 'Status',
        kind: 'status',
        options: TICKET_STATUS_OPTIONS,
        chipClass: ticketStatusChip,
        className: 'status-col',
      },
    ],
  });
}

@Component({
  selector: 'app-help-tickets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HelpTicketsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly reports = inject(BugReportService);

  constructor() {
    const api = inject(ApiService);
    const auth = inject(AuthService);
    const route = inject(ActivatedRoute);
    super(
      config(
        () => api,
        () => hasEffectivePermission(auth.user()?.permissions ?? [], READ_ALL),
      ),
    );
    // Email links and "My tickets" after a report open the ticket conversation: ?ticket=<uuid>.
    const requested = route.snapshot.queryParamMap.get('ticket');
    if (requested) afterNextRender(() => void this.openConversation(requested));
  }

  private async openConversation(uuid: string) {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `help/tickets/${encodeURIComponent(uuid)}`,
      );
      const ticket = response?.data;
      const action = this.rowActions(ticket ?? {}).find((item) => item.key === 'conversation');
      if (ticket && action) await this.runRowAction(action, ticket);
    } catch {
      // The API interceptor shows the error.
    }
  }

  override async handleFilterAction(action: { key: string }) {
    if (action.key === 'report') await this.reports.openReportDialog();
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key !== 'view') return;
    const { openDataViewerDialog } =
      await import('../../../shared/data-viewer-dialog/data-viewer-dialog');
    const status = TICKET_STATUS_OPTIONS.find((item) => item.value === row['Status']);
    openDataViewerDialog(this.dialog, {
      title: 'Ticket',
      description: String(row['Subject'] ?? ''),
      status: {
        value: status?.label ?? String(row['Status'] ?? ''),
        tone: ['resolved', 'closed'].includes(String(row['Status'])) ? 'success' : 'warning',
      },
      details: [
        { label: 'Protocol', value: row['SupportTicketID'], monospace: true },
        { label: 'Type', value: row['TypeName'] },
        { label: 'Priority', value: row['PriorityName'] },
        { label: 'Origin', value: row['ChannelName'] },
        { label: 'Opened by', value: row['CreatedByName'] },
        { label: 'Opened at', value: row['OpenedAt'], kind: 'datetime' },
        { label: 'First response', value: row['FirstResponseAt'], kind: 'datetime' },
        { label: 'Resolved at', value: row['ResolvedAt'], kind: 'datetime' },
      ],
      sections: [{ title: 'Description', code: { value: row['Description'], format: 'text' } }],
    });
  }
}
