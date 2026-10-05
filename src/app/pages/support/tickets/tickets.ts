import { Component, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import {
  ACTIVE_TICKET_STATUSES,
  SupportDesk,
  TICKET_STATUS_OPTIONS,
  agentTimelineCollection,
  attachmentsCollection,
  supportBase,
  supportDesk,
  ticketStatusChip,
} from '../shared/support-desk';

const SUPPORT_QUEUE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'team', label: 'My teams' },
  { value: 'waiting', label: 'Waiting for requester' },
  { value: 'due', label: 'Due within one hour' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'resolved', label: 'Resolved or closed' },
];

function priorityChip(row: ConfigurableCrudRecord): string {
  const rank = Number(row['PriorityRank'] ?? 100);
  return rank <= 10 ? 'chip-failed' : rank <= 20 ? 'chip-running' : 'chip-skipped';
}

function config(desk: SupportDesk, api: () => ApiService): ConfigurableCrudConfig {
  const base = supportBase(desk);
  const platform = desk === 'platform';
  const catalogField = (
    key: string,
    source: string,
    label: string,
    endpoint: string,
    uuidField: string,
    registry:
      | 'SupportTicketChannelStcUUID'
      | 'SupportTicketTypeSttUUID'
      | 'SupportTicketPriorityStpUUID'
      | 'SupportTeamStmUUID',
    required: boolean,
  ): ConfigurableCrudField => ({
    key,
    source,
    payloadKey: key,
    label,
    type: 'search-select',
    remoteLookup: { endpoint: `${base}/${endpoint}?status=1`, uuidField, labelField: 'Name' },
    quickCreate: quickCreateFor(registry, {
      routeData: { scope: platform ? 'master' : 'tenant', supportDesk: desk },
    }),
    required,
    span: 1,
  });
  return defineCrud({
    endpoint: `${base}/tickets`,
    uuidField: 'SupportTicketUUID',
    pageTitle: platform ? 'Platform tickets' : 'Support tickets',
    pageDescription: platform
      ? 'Tickets tenants opened to the platform team, including "Report problem" from the App.'
      : 'Tickets of your customers and their service lifecycle.',
    createTitle: 'New support ticket',
    editTitle: 'Ticket triage',
    dialogDescription: platform
      ? 'Classify, prioritize and move the ticket; reply to the requester in the conversation.'
      : 'Customer, classification, SLA and contact of the ticket.',
    searchPlaceholder: 'Protocol, subject, customer or email',
    emptyLabel: 'No support tickets found.',
    deleteTitle: 'Delete support ticket',
    deleteMessage: 'Delete this support ticket?',
    savedMessage: 'Support ticket saved successfully.',
    deletedMessage: 'Support ticket deleted successfully.',
    deleteFailedMessage: 'Failed to delete support ticket.',
    statusMode: 'string',
    activeValue: 'open',
    inactiveValue: 'closed',
    statusOptions: TICKET_STATUS_OPTIONS,
    activeStatusValues: ACTIVE_TICKET_STATUSES,
    bulkDelete: false,
    canCreate: !platform,
    serverSidePagination: true,
    initialPageSize: 10,
    tabLabels: { notes: 'Notes', authentication: 'Contact' },
    listFilters: [
      {
        key: 'queue',
        label: 'Queue',
        type: 'search-select',
        span: 1,
        options: SUPPORT_QUEUE_OPTIONS,
        translateOptions: true,
      },
    ],
    rowActions: [
      {
        key: 'conversation',
        label: 'Conversation',
        icon: 'forum',
        collection: (row) => agentTimelineCollection(desk, row),
      },
      {
        key: 'attachments',
        label: 'Attachments',
        icon: 'attach_file',
        collection: (row) => attachmentsCollection(api, base, row, true),
      },
      { key: 'assign-me', label: 'Assign to me', icon: 'assignment_ind' },
    ],
    initialValues: {
      customerUUID: '',
      channelUUID: '',
      typeUUID: '',
      priorityUUID: '',
      status: 'open',
      subject: '',
      description: '',
      tags: '',
      internalNotes: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
    },
    columns: [
      { id: 'protocol', field: 'SupportTicketID', label: 'Protocol', kind: 'identity' },
      {
        id: 'subject',
        field: 'Subject',
        label: 'Subject',
        detail: (row) => String(row['TypeName'] ?? ''),
      },
      {
        id: 'requester',
        field: 'CustomerName',
        label: platform ? 'Tenant' : 'Customer',
        detail: (row) => String(row['CreatedByName'] ?? row['ContactName'] ?? ''),
      },
      {
        id: 'priority',
        field: 'PriorityName',
        label: 'Priority',
        kind: 'status',
        chipClass: (_value, row) => priorityChip(row),
      },
      {
        id: 'sla',
        field: 'SlaBreached',
        label: 'SLA',
        kind: 'status',
        options: [
          { value: 0, label: 'On time' },
          { value: 1, label: 'Breached' },
        ],
        translateValue: true,
        chipClass: (value) => (Number(value) === 1 ? 'chip-failed' : 'chip-success'),
      },
      { id: 'team', field: 'TeamName', label: 'Team' },
      { id: 'assigned', field: 'AssignedToName', label: 'Assigned to' },
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
    fields: [
      {
        key: 'assignedToUserUUID',
        source: 'AssignedToUserUUID',
        payloadKey: 'assignedToUserUUID',
        label: 'Assigned to',
        type: 'search-select',
        span: 1,
        remoteLookup: { endpoint: `${base}/agents`, uuidField: 'UserUUID', labelField: 'Name' },
        quickCreate: false,
        quickCreateExemptReason:
          'Assignment selects an existing authorized agent. Account creation and permission grants belong to identity administration.',
      },
      catalogField(
        'teamUUID',
        'TeamUUID',
        'Team',
        'teams',
        'SupportTeamUUID',
        'SupportTeamStmUUID',
        false,
      ),
      ...(platform
        ? []
        : [
            {
              key: 'customerUUID',
              source: 'CustomerUUID',
              payloadKey: 'customerUUID',
              label: 'Customer',
              type: 'search-select' as const,
              remoteLookup: {
                endpoint: 'erp/customers',
                uuidField: 'CustomerUUID',
                labelField: 'Name',
              },
              quickCreate: quickCreateFor('CustomerCusUUID'),
              required: true,
              span: 1 as const,
            },
          ]),
      catalogField(
        'channelUUID',
        'ChannelUUID',
        'Origin',
        'ticket-channels',
        'SupportTicketChannelUUID',
        'SupportTicketChannelStcUUID',
        true,
      ),
      catalogField(
        'typeUUID',
        'TypeUUID',
        'Type',
        'ticket-types',
        'SupportTicketTypeUUID',
        'SupportTicketTypeSttUUID',
        false,
      ),
      catalogField(
        'priorityUUID',
        'PriorityUUID',
        'Priority',
        'ticket-priorities',
        'SupportTicketPriorityUUID',
        'SupportTicketPriorityStpUUID',
        false,
      ),
      {
        key: 'status',
        source: 'Status',
        payloadKey: 'status',
        label: 'Status',
        type: 'search-select',
        options: TICKET_STATUS_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
      },
      {
        key: 'subject',
        source: 'Subject',
        payloadKey: 'subject',
        label: 'Subject',
        required: true,
        span: 4,
        breakBefore: true,
      },
      {
        key: 'description',
        source: 'Description',
        payloadKey: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 5,
        required: true,
        span: 4,
      },
      { key: 'tags', source: 'Tags', payloadKey: 'tags', label: 'Tags', tab: 'notes', span: 4 },
      {
        key: 'internalNotes',
        source: 'InternalNotes',
        payloadKey: 'internalNotes',
        label: 'Internal notes',
        type: 'textarea',
        rows: 4,
        tab: 'notes',
        help: 'Never shown to the requester.',
        span: 4,
      },
      {
        key: 'contactName',
        source: 'ContactName',
        payloadKey: 'contactName',
        label: 'Contact name',
        tab: 'authentication',
        span: 1,
      },
      {
        key: 'contactEmail',
        source: 'ContactEmail',
        payloadKey: 'contactEmail',
        label: 'Contact email',
        type: 'email',
        tab: 'authentication',
        span: 1,
      },
      {
        key: 'contactPhone',
        source: 'ContactPhone',
        payloadKey: 'contactPhone',
        label: 'Contact phone',
        type: 'phone',
        tab: 'authentication',
        span: 1,
      },
    ],
  });
}

@Component({
  selector: 'app-support-tickets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportTicketsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly desk: SupportDesk;
  private readonly auth = inject(AuthService);

  constructor() {
    const route = inject(ActivatedRoute);
    const desk = supportDesk(route);
    const api = inject(ApiService);
    super(config(desk, () => api));
    this.desk = desk;
    // Email links open one ticket directly: ?ticket=<uuid>.
    const requested = route.snapshot.queryParamMap.get('ticket');
    if (requested) afterNextRender(() => void this.openTicket(requested));
  }

  private async openTicket(uuid: string) {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `${supportBase(this.desk)}/tickets/${encodeURIComponent(uuid)}`,
      );
      if (response?.data) this.startEdit(response.data);
    } catch {
      // The API interceptor shows the error.
    }
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key !== 'assign-me') return;
    const me = this.auth.user()?.uuid;
    if (!me) return;
    try {
      await this.api.put(`${supportBase(this.desk)}/tickets/${this.recordUUID(row)}`, {
        customerUUID: row['CustomerUUID'] || null,
        channelUUID: row['ChannelUUID'],
        typeUUID: row['TypeUUID'],
        priorityUUID: row['PriorityUUID'],
        teamUUID: row['TeamUUID'] || null,
        status: row['Status'] === 'open' ? 'in_progress' : row['Status'],
        subject: row['Subject'],
        description: row['Description'],
        tags: row['Tags'],
        internalNotes: row['InternalNotes'],
        contactName: row['ContactName'],
        contactEmail: row['ContactEmail'],
        contactPhone: row['ContactPhone'],
        assignedToUserUUID: me,
        expectedRevision: row['Revision'],
      });
      this.snack.success('Ticket assigned to you.');
      this.refreshList();
    } catch {
      // The API interceptor shows the error.
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
      assignedToUserUUID: payload['assignedToUserUUID'] || null,
      teamUUID: payload['teamUUID'] || null,
    };
  }
}
