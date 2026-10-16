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
import { MatDialog } from '@angular/material/dialog';
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

/** AI triage classification of platform tickets (support assistant). */
export const TRIAGE_CLASSIFICATION_OPTIONS = [
  { value: 'bug', label: 'Platform bug' },
  { value: 'knowledge', label: 'Usage question' },
  { value: 'unclear', label: 'Needs a person' },
];

const TRIAGE_ACTION_OPTIONS = [
  { value: 'bug_ack', label: 'Requester told the problem was identified' },
  { value: 'knowledge_reply', label: 'Answer sent to the requester' },
  { value: 'note_only', label: 'Internal note for the team' },
];

const TRIAGE_STATUS_OPTIONS = [
  { value: 'pending', label: 'Waiting for analysis' },
  { value: 'running', label: 'Analysing' },
  { value: 'done', label: 'Analysed' },
  { value: 'failed', label: 'Analysis failed' },
  { value: 'skipped', label: 'Not analysed' },
  { value: 'handed_off', label: 'Handled by the team' },
];

function triageChip(value: unknown): string {
  if (value === 'bug') return 'chip-failed';
  if (value === 'knowledge') return 'chip-success';
  return value ? 'chip-running' : 'chip-skipped';
}

const FIXED_MESSAGE =
  'Corrigimos o problema que você relatou. Se ele voltar a acontecer, responda este chamado.';

/** Public reply that closes a bug found by the AI analysis once the team fixed it. */
function markFixedForm(desk: SupportDesk, row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${supportBase(desk)}/tickets/${String(row['SupportTicketUUID'] ?? '')}/events`,
    uuidField: 'SupportTicketEventUUID',
    pageTitle: 'Mark as fixed',
    pageDescription: `#${String(row['SupportTicketID'] ?? '')} · ${String(row['Subject'] ?? '')}`,
    createTitle: 'Mark as fixed',
    dialogDescription:
      'Sends this reply to the requester by the App and e-mail and moves the ticket to resolved.',
    savedMessage: 'Ticket marked as fixed.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    initialValues: { message: FIXED_MESSAGE },
    fields: [
      {
        key: 'message',
        label: 'Reply to the requester',
        type: 'textarea',
        rows: 5,
        span: 4,
        required: true,
      },
    ],
    payload: (values) => ({ message: values['message'], isInternal: 0, status: 'resolved' }),
    columns: [{ id: 'message', field: 'Message', label: 'Message', kind: 'identity' }],
  });
}

function priorityChip(row: ConfigurableCrudRecord): string {
  const rank = Number(row['PriorityRank'] ?? 100);
  return rank <= 10 ? 'chip-failed' : rank <= 20 ? 'chip-running' : 'chip-skipped';
}

function config(
  desk: SupportDesk,
  api: () => ApiService,
  dialog: () => MatDialog,
): ConfigurableCrudConfig {
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
        collection: (row) => attachmentsCollection(api, dialog, base, row, true),
      },
      { key: 'assign-me', label: 'Assign to me', icon: 'assignment_ind' },
      ...(platform
        ? [
            {
              key: 'ai-analysis',
              label: 'AI analysis',
              icon: 'smart_toy',
              tooltip: 'Classification, report for the team and the prompt to fix a bug.',
            },
            {
              key: 'ai-rerun',
              label: 'Analyse again with AI',
              icon: 'auto_mode',
              tooltip: 'Records a new internal note; the requester receives nothing.',
              visible: (row: ConfigurableCrudRecord) =>
                !['closed', 'canceled'].includes(String(row['Status'] ?? '')),
              request: {
                method: 'post' as const,
                endpoint: (row: ConfigurableCrudRecord) =>
                  `${base}/tickets/${String(row['SupportTicketUUID'])}/triage/run`,
                successMessage: 'AI analysis requested. The result appears in about a minute.',
                confirm: {
                  title: 'Analyse again with AI',
                  message:
                    'Send this ticket to the AI provider again? The result is an internal note for the team.',
                },
              },
            },
            {
              key: 'mark-fixed',
              label: 'Mark as fixed',
              icon: 'task_alt',
              tooltip: 'Tells the requester the bug was fixed and resolves the ticket.',
              visible: (row: ConfigurableCrudRecord) =>
                row['TriageClassification'] === 'bug' &&
                !['resolved', 'closed', 'canceled'].includes(String(row['Status'] ?? '')),
              form: (row: ConfigurableCrudRecord) => markFixedForm(desk, row),
            },
          ]
        : []),
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
      ...(platform
        ? [
            {
              id: 'ai',
              field: 'TriageClassification',
              label: 'AI',
              kind: 'status' as const,
              options: TRIAGE_CLASSIFICATION_OPTIONS,
              translateValue: true,
              width: 'sm' as const,
              chipClass: triageChip,
              rowAction: 'ai-analysis',
            },
          ]
        : []),
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
    const dialog = inject(MatDialog);
    super(
      config(
        desk,
        () => api,
        () => dialog,
      ),
    );
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
    if (action.key === 'ai-analysis') return await this.openTriage(row);
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

  /** Read-only AI analysis: report and fix prompt are for the team only (never sent to requesters). */
  private async openTriage(row: ConfigurableCrudRecord) {
    let triage: ConfigurableCrudRecord | undefined;
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `${supportBase(this.desk)}/tickets/${this.recordUUID(row)}/triage`,
      );
      triage = response?.data;
    } catch {
      return; // The API interceptor shows the error.
    }
    if (!triage) return;
    const label = (options: readonly { value: string; label: string }[], value: unknown) =>
      options.find((item) => item.value === value)?.label ?? String(value ?? '');
    const classification = triage['Classification'];
    const confidence = Number(triage['Confidence']);
    const citations = Array.isArray(triage['Citations'])
      ? (triage['Citations'] as ConfigurableCrudRecord[])
      : [];
    const { openDataViewerDialog } =
      await import('../../../shared/data-viewer-dialog/data-viewer-dialog');
    openDataViewerDialog(this.dialog, {
      title: 'AI analysis',
      description: `#${String(row['SupportTicketID'] ?? '')} · ${String(row['Subject'] ?? '')}`,
      status: {
        value: classification
          ? label(TRIAGE_CLASSIFICATION_OPTIONS, classification)
          : label(TRIAGE_STATUS_OPTIONS, triage['Status'] ?? 'skipped'),
        tone:
          classification === 'bug' ? 'danger' : classification === 'knowledge' ? 'success' : 'info',
      },
      details: [
        {
          label: 'Analysis',
          value: label(TRIAGE_STATUS_OPTIONS, triage['Status']),
          translate: true,
        },
        {
          label: 'Confidence',
          value:
            Number.isFinite(confidence) && triage['Confidence'] !== null
              ? `${Math.round(confidence * 100)}%`
              : '-',
        },
        { label: 'Action', value: label(TRIAGE_ACTION_OPTIONS, triage['Action']), translate: true },
        { label: 'Suspected area', value: triage['SuspectedArea'] },
        { label: 'Provider', value: triage['ProviderName'] },
        { label: 'Model', value: triage['Model'], monospace: true },
        {
          label: 'Tokens (input / output)',
          value:
            triage['InputTokens'] === null || triage['InputTokens'] === undefined
              ? '-'
              : `${String(triage['InputTokens'])} / ${String(triage['OutputTokens'] ?? 0)}`,
        },
        { label: 'Analysed at', value: triage['CompletedAt'], kind: 'datetime' },
        { label: 'Last error', value: triage['LastErrorCode'], monospace: true },
      ],
      sections: [
        ...(triage['Summary']
          ? [{ title: 'Summary', code: { value: triage['Summary'], format: 'text' as const } }]
          : []),
        ...(triage['AdminReport']
          ? [
              {
                title: 'Report for the team',
                code: { value: triage['AdminReport'], format: 'text' as const, copy: true },
              },
            ]
          : []),
        ...(triage['DeveloperPrompt']
          ? [
              {
                title: 'Prompt to fix the bug (paste into any LLM)',
                code: { value: triage['DeveloperPrompt'], format: 'text' as const, copy: true },
              },
            ]
          : []),
        ...(triage['RequesterReply']
          ? [
              {
                title: 'Answer sent to the requester',
                code: { value: triage['RequesterReply'], format: 'text' as const },
              },
            ]
          : []),
        ...(citations.length
          ? [
              {
                title: 'Knowledge used',
                table: {
                  columns: [
                    { key: 'title', label: 'Title' },
                    { key: 'menuPath', label: 'Menu path' },
                    { key: 'route', label: 'App route', monospace: true },
                  ],
                  rows: citations,
                },
              },
            ]
          : []),
      ],
    });
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
