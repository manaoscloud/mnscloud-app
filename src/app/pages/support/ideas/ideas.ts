import { Component, afterNextRender, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { readStoredEnvironmentUUID } from '../../../core/environment/environment-context';
import { SupportRequestDraft } from '../../../services/support-request-draft';
import {
  CLOSED_FEATURE_REQUEST_STATUSES,
  FEATURE_REQUEST_FILTER_OPTIONS,
  FEATURE_REQUEST_SORT_OPTIONS,
  featureRequestStatusChip,
  openFeatureRequestViewer,
} from '../shared/feature-requests';

/**
 * Idea board. Signed-in users (`/support/ideas`) propose, vote and follow; visitors of the public
 * route (`/ideas`, `data.publicBoard`) read published ideas only. Visibility, moderation and vote
 * counting are API/DB decisions; the page only chooses the endpoint for the session.
 */
function config(publicBoard: boolean): ConfigurableCrudConfig {
  const open = (row: ConfigurableCrudRecord) =>
    !CLOSED_FEATURE_REQUEST_STATUSES.includes(String(row['Status'] ?? ''));
  return defineCrud({
    endpoint: publicBoard ? 'public/feature-requests' : 'feature-requests',
    uuidField: 'FeatureRequestUUID',
    pageTitle: 'Ideas board',
    pageDescription:
      'Ideas to improve the platform: propose, vote for what you need and follow each one from triage to production.',
    createTitle: 'Propose an idea',
    dialogDescription:
      'Search first: if the idea already exists, choose it and your vote goes to it. New ideas appear on the board after the team triage.',
    searchPlaceholder: 'Title, description or code',
    emptyLabel: 'No ideas yet.',
    savedMessage: 'Idea sent. The team will triage it and publish it on the board.',
    statusMode: 'string',
    activeValue: 'received',
    inactiveValue: 'declined',
    statusOptions: FEATURE_REQUEST_FILTER_OPTIONS,
    canCreate: !publicBoard,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    serverSidePagination: true,
    initialPageSize: 20,
    filterActions: publicBoard ? [{ key: 'signin', label: 'Sign in to vote', icon: 'login' }] : [],
    listFilters: [
      {
        key: 'sort',
        label: 'Order',
        type: 'search-select',
        span: 1,
        options: FEATURE_REQUEST_SORT_OPTIONS,
        translateOptions: true,
      },
      {
        key: 'view',
        label: 'Ideas',
        type: 'search-select',
        span: 1,
        options: [
          { value: '', label: 'All' },
          { value: 'mine', label: 'Proposed or voted by me' },
        ],
        translateOptions: true,
        hiddenWhen: () => publicBoard,
      },
    ],
    rowActions: [
      { key: 'view', label: 'View details', icon: 'visibility' },
      {
        key: 'vote',
        label: 'Vote',
        icon: 'thumb_up',
        visible: (row) => !publicBoard && Number(row['HasVoted']) !== 1,
        disabledReason: (row) => (open(row) ? null : 'Closed ideas accept no votes.'),
        request: {
          method: 'post',
          endpoint: (row) => `feature-requests/${String(row['FeatureRequestUUID'])}/vote`,
          successMessage: 'Vote recorded.',
        },
      },
      {
        key: 'unvote',
        label: 'Remove my vote',
        icon: 'thumb_down_off_alt',
        visible: (row) => !publicBoard && Number(row['HasVoted']) === 1,
      },
    ],
    initialValues: { similar: '', title: '', description: '' },
    payload: (values) => ({ title: values['title'], description: values['description'] }),
    fields: [
      {
        key: 'similar',
        label: 'Similar ideas',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'feature-requests/similar',
          uuidField: 'FeatureRequestUUID',
          labelField: 'Title',
          descriptionField: 'FeatureRequestCode',
          searchParam: 'q',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Choosing an existing idea adds a vote to it; new ideas are proposed by this same form.',
        help: 'Type a few words of your idea. Choosing an existing one votes for it instead of creating a duplicate.',
      },
      {
        key: 'title',
        label: 'Title',
        requiredWhen: (context) => !context.values['similar'],
        hiddenWhen: (context) => Boolean(context.values['similar']),
        help: 'One short sentence with the improvement (8 to 160 characters).',
      },
      // business-description: the content of the idea.
      {
        key: 'description',
        label: 'Description',
        type: 'textarea',
        requiredWhen: (context) => !context.values['similar'],
        hiddenWhen: (context) => Boolean(context.values['similar']),
        help: 'What problem it solves and who it helps. Do not include passwords or customer data: published ideas are public.',
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
      { id: 'votes', field: 'VoteCount', label: 'Votes', kind: 'number', width: 'xs' },
      { id: 'tenants', field: 'TenantCount', label: 'Tenants', kind: 'number', width: 'xs' },
      {
        id: 'voted',
        field: 'HasVoted',
        label: 'My vote',
        kind: 'boolean',
        width: 'xs',
        hiddenWhen: () => publicBoard,
      },
      {
        id: 'changed',
        field: 'StatusChangedAt',
        label: 'Last update',
        kind: 'datetime',
        optional: true,
      },
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
}

@Component({
  selector: 'app-ideas',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FeatureRequestsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly publicBoard: boolean;
  private readonly router = inject(Router);
  private readonly submission = new SupportRequestDraft();

  constructor() {
    const route = inject(ActivatedRoute);
    const publicBoard = route.snapshot.data['publicBoard'] === true;
    super(config(publicBoard));
    this.publicBoard = publicBoard;
    // E-mail and shared links open one idea: /ideas/:code or /support/ideas?code=<code>.
    const code = route.snapshot.paramMap.get('code') ?? route.snapshot.queryParamMap.get('code');
    if (code) afterNextRender(() => void this.openIdea(code));
    // "Report problem" sends suggestions here: ?new=1 opens the proposal form.
    else if (!publicBoard && route.snapshot.queryParamMap.get('new') === '1')
      afterNextRender(() => this.startCreate());
  }

  private async openIdea(code: string) {
    try {
      const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
        `${this.publicBoard ? 'public/' : ''}feature-requests/${encodeURIComponent(code)}`,
      );
      if (response?.data) await openFeatureRequestViewer(this.dialog, response.data);
    } catch {
      // The API interceptor shows the error.
    }
  }

  override async handleRowAction(action: { key: string }, row: ConfigurableCrudRecord) {
    if (action.key === 'view') {
      await this.openIdea(String(row['FeatureRequestCode'] ?? ''));
      return;
    }
    if (action.key !== 'unvote') return;
    try {
      await this.api.delete(`feature-requests/${this.recordUUID(row)}/vote`);
      this.snack.success(this.t('Vote removed.'));
      this.refreshList();
    } catch {
      // The API interceptor shows the error.
    }
  }

  override async handleFilterAction(action: { key: string }) {
    if (action.key === 'signin') await this.router.navigate(['/signin']);
  }

  /** Choosing a similar idea votes for it instead of proposing a duplicate. */
  override async saveItem(saveAndNew = false): Promise<void> {
    const similar = String(this.formValues()['similar'] ?? '');
    if (!similar) {
      await super.saveItem(saveAndNew);
      return;
    }
    this.saving.set(true);
    try {
      await this.api.post(`feature-requests/${encodeURIComponent(similar)}/vote`, {});
      this.snack.success(this.t('Your vote was added to the existing idea.'));
      this.submission.clear();
      this.closeDialog();
      this.refreshList();
    } catch {
      // The API interceptor shows the error.
    } finally {
      this.saving.set(false);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    const values = super.augmentPayload(payload);
    return this.submission.prepare(readStoredEnvironmentUUID() ?? '', values);
  }

  protected override afterSave() {
    this.submission.clear();
  }
}
