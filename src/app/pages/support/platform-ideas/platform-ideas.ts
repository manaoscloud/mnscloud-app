import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  FEATURE_REQUEST_AUDIENCE_OPTIONS,
  FEATURE_REQUEST_FILTER_OPTIONS,
  FEATURE_REQUEST_SORT_OPTIONS,
  FEATURE_REQUEST_STATUS_OPTIONS,
  featureRequestStatusChip,
  openFeatureRequestViewer,
} from '../shared/feature-requests';
import { YES_NO_OPTIONS } from '../shared/support-desk';

/**
 * Platform desk moderation of the idea board: publication, wording, audience, duplicates and the
 * public lifecycle. Each status change moves the internal ticket and e-mails the author (API).
 */
const config = defineCrud({
  endpoint: 'system/support/feature-requests',
  uuidField: 'FeatureRequestUUID',
  pageTitle: 'Platform ideas',
  pageDescription:
    'Moderate the ideas tenants proposed: publish them on the public board, mark duplicates and move each one through the lifecycle.',
  editTitle: 'Moderate idea',
  dialogDescription:
    'Published ideas show title, description, status and team note to everyone; never the tenant or the author.',
  searchPlaceholder: 'Title, description or code',
  emptyLabel: 'No ideas yet.',
  deleteTitle: 'Delete idea',
  deleteMessage: 'Delete this idea from the board? Use it only for spam or abuse.',
  savedMessage: 'Idea saved. The author was notified of a status change.',
  deletedMessage: 'Idea deleted.',
  deleteFailedMessage: 'Failed to delete idea.',
  statusMode: 'string',
  activeValue: 'received',
  inactiveValue: 'declined',
  statusOptions: FEATURE_REQUEST_FILTER_OPTIONS,
  canCreate: false,
  bulkDelete: false,
  serverSidePagination: true,
  initialPageSize: 20,
  listFilters: [
    {
      key: 'sort',
      label: 'Order',
      type: 'search-select',
      span: 1,
      options: FEATURE_REQUEST_SORT_OPTIONS,
      translateOptions: true,
    },
  ],
  rowActions: [
    { key: 'view', label: 'View details', icon: 'visibility' },
    { key: 'ticket', label: 'Open ticket', icon: 'confirmation_number' },
  ],
  initialValues: {
    title: '',
    description: '',
    status: 'received',
    isPublic: 0,
    audienceScope: 'unknown',
    publicNote: '',
    duplicateOfUUID: '',
    revision: 0,
  },
  payload: (values) => ({
    title: values['title'],
    description: values['description'],
    status: values['status'],
    isPublic: Number(values['isPublic']),
    audienceScope: values['audienceScope'],
    publicNote: values['publicNote'] || null,
    duplicateOfUUID: values['status'] === 'duplicate' ? values['duplicateOfUUID'] || null : null,
    revision: Number(values['revision']),
  }),
  fields: [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'search-select',
      options: FEATURE_REQUEST_STATUS_OPTIONS,
      translateOptions: true,
      required: true,
      span: 1,
    },
    {
      key: 'isPublic',
      source: 'IsPublic',
      label: 'Published on the board',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      translateOptions: true,
      required: true,
      span: 1,
    },
    {
      key: 'audienceScope',
      source: 'AudienceScope',
      label: 'Who benefits',
      type: 'search-select',
      options: FEATURE_REQUEST_AUDIENCE_OPTIONS,
      translateOptions: true,
      span: 1,
    },
    { key: 'revision', source: 'Revision', label: 'Revision', hidden: true, span: 1 },
    {
      key: 'duplicateOfUUID',
      source: 'DuplicateOfUUID',
      label: 'Original idea',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/support/feature-requests',
        uuidField: 'FeatureRequestUUID',
        labelField: 'Title',
        descriptionField: 'FeatureRequestCode',
        selectedLabelField: 'DuplicateOfTitle',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'The original of a duplicate is an existing idea; ideas are proposed by tenants, not created by the platform desk.',
      hiddenWhen: (context) => context.values['status'] !== 'duplicate',
      requiredWhen: (context) => context.values['status'] === 'duplicate',
      help: 'Supporters of this idea are added to the original once.',
    },
    { key: 'title', source: 'Title', label: 'Title', required: true, span: 1 },
    // business-description: the content of the idea.
    {
      key: 'description',
      source: 'Description',
      label: 'Description',
      type: 'textarea',
      required: true,
      help: 'Remove customer data or secrets before publishing.',
      span: 4,
    },
    {
      key: 'publicNote',
      source: 'PublicNote',
      label: 'Team note',
      type: 'textarea',
      help: 'Shown on the board and in the status e-mail, for example the planned release.',
      span: 4,
    },
  ],
  columns: [
    {
      id: 'title',
      field: 'Title',
      label: 'Idea',
      kind: 'identity',
      rowAction: 'view',
      detail: (row) => String(row['FeatureRequestCode'] ?? ''),
      width: 'xl',
    },
    {
      id: 'requester',
      field: 'RequesterName',
      label: 'Requester',
      detail: (row) => String(row['RequesterTenantCode'] ?? ''),
    },
    { id: 'votes', field: 'VoteCount', label: 'Votes', kind: 'number', width: 'xs' },
    { id: 'tenants', field: 'TenantCount', label: 'Tenants', kind: 'number', width: 'xs' },
    {
      id: 'audience',
      field: 'AudienceScope',
      label: 'Who benefits',
      kind: 'status',
      options: FEATURE_REQUEST_AUDIENCE_OPTIONS,
      optional: true,
    },
    { id: 'public', field: 'IsPublic', label: 'Published', kind: 'boolean', width: 'xs' },
    { id: 'ticket', field: 'SupportTicketID', label: 'Ticket', optional: true },
    {
      id: 'status',
      field: 'Status',
      label: 'Status',
      kind: 'status',
      options: FEATURE_REQUEST_FILTER_OPTIONS,
      chipClass: featureRequestStatusChip,
      className: 'status-col',
    },
  ],
});

@Component({
  selector: 'app-platform-ideas',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PlatformFeatureRequestsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly router = inject(Router);

  constructor() {
    super(config);
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key === 'ticket') {
      await this.router.navigate(['/support/platform/tickets'], {
        queryParams: { ticket: row['SupportTicketUUID'] },
      });
      return;
    }
    if (action.key !== 'view') return;
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `system/support/feature-requests/${this.recordUUID(row)}`,
      );
      if (response?.data) await openFeatureRequestViewer(this.dialog, response.data, true);
    } catch {
      // The API interceptor shows the error.
    }
  }
}
