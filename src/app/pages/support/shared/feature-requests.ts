import { MatDialog } from '@angular/material/dialog';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportDesk, supportBase } from './support-desk';

/** Public lifecycle of a feature request (API `FrqStatus`), in pipeline order. */
export const FEATURE_REQUEST_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'received', label: 'Received' },
  { value: 'triage', label: 'In triage' },
  { value: 'investigation', label: 'Under investigation' },
  { value: 'refinement', label: 'In refinement' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'in_development', label: 'In development' },
  { value: 'homologation', label: 'In homologation' },
  { value: 'testing', label: 'In testing' },
  { value: 'dev', label: 'Available in DEV' },
  { value: 'released', label: 'Available in production' },
  { value: 'declined', label: 'Declined' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'already_done', label: 'Already available' },
];

/** Status filter: the two lifecycle groups first, then every status. */
export const FEATURE_REQUEST_FILTER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'active', label: 'Open ideas' },
  { value: 'closed', label: 'Closed ideas' },
  ...FEATURE_REQUEST_STATUS_OPTIONS,
];

export const CLOSED_FEATURE_REQUEST_STATUSES = ['declined', 'duplicate', 'already_done'];

export const FEATURE_REQUEST_AUDIENCE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'unknown', label: 'Not assessed' },
  { value: 'platform', label: 'Whole platform' },
  { value: 'segment', label: 'One market segment' },
  { value: 'single_tenant', label: 'One company' },
];

export const FEATURE_REQUEST_SORT_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Most voted' },
  { value: 'recent', label: 'Most recent' },
  { value: 'updated', label: 'Recently updated' },
];

export const REFINEMENT_STAGE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'received', label: 'Received' },
  { value: 'triage', label: 'In triage' },
  { value: 'investigation', label: 'Under investigation' },
  { value: 'refinement', label: 'In refinement' },
  { value: 'done', label: 'Refinement done' },
];

export const REFINEMENT_RESOLUTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'already_fixed', label: 'Already fixed' },
  { value: 'not_reproducible', label: 'Not reproducible' },
  { value: 'wont_do', label: 'Will not be done' },
];

export const REPRODUCED_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: '', label: 'Not applicable' },
  { value: 1, label: 'Reproduced' },
  { value: 0, label: 'Not reproduced' },
];

export function featureRequestStatusChip(value: unknown): string {
  if (value === 'released' || value === 'already_done') return 'chip-success';
  if (value === 'declined' || value === 'duplicate') return 'chip-skipped';
  if (value === 'received' || value === 'triage') return 'chip-running';
  return 'chip-warning';
}

export function featureRequestStatusLabel(
  value: unknown,
  translate: (key: string) => string,
): string {
  const option = FEATURE_REQUEST_STATUS_OPTIONS.find((item) => item.value === value);
  return option ? translate(option.label) : String(value ?? '');
}

const optionLabel = (options: readonly ConfigurableCrudOption[], value: unknown) =>
  options.find((item) => item.value === value)?.label ?? String(value ?? '');

/** Read-only view of one request with its status timeline (shared data viewer). */
export async function openFeatureRequestViewer(
  dialog: MatDialog,
  request: ConfigurableCrudRecord,
  platform = false,
): Promise<void> {
  const { openDataViewerDialog } =
    await import('../../../shared/data-viewer-dialog/data-viewer-dialog');
  const status = String(request['Status'] ?? '');
  const events = Array.isArray(request['Events'])
    ? (request['Events'] as ConfigurableCrudRecord[])
    : [];
  openDataViewerDialog(dialog, {
    title: 'Idea',
    description: String(request['Title'] ?? ''),
    status: {
      value: optionLabel(FEATURE_REQUEST_STATUS_OPTIONS, status),
      tone: ['released', 'already_done'].includes(status)
        ? 'success'
        : CLOSED_FEATURE_REQUEST_STATUSES.includes(status)
          ? 'neutral'
          : 'info',
    },
    details: [
      { label: 'Code', value: request['FeatureRequestCode'], monospace: true },
      { label: 'Votes', value: request['VoteCount'] },
      { label: 'Tenants', value: request['TenantCount'] },
      {
        label: 'Audience',
        value: optionLabel(FEATURE_REQUEST_AUDIENCE_OPTIONS, request['AudienceScope']),
        translate: true,
      },
      { label: 'Duplicate of', value: request['DuplicateOfCode'], monospace: true },
      { label: 'Proposed at', value: request['DateCreated'], kind: 'datetime' },
      { label: 'Available in production at', value: request['ReleasedAt'], kind: 'datetime' },
      ...(platform
        ? [
            { label: 'Ticket', value: request['SupportTicketID'], monospace: true },
            { label: 'Tenant', value: request['RequesterTenantCode'], monospace: true },
            { label: 'Requester', value: request['RequesterName'] },
            { label: 'Proposed by', value: request['CreatedByName'] },
          ]
        : []),
    ],
    sections: [
      { title: 'Description', code: { value: request['Description'], format: 'text' } },
      ...(request['PublicNote']
        ? [{ title: 'Team note', code: { value: request['PublicNote'], format: 'text' as const } }]
        : []),
      {
        title: 'Timeline',
        table: {
          columns: [
            { key: 'DateCreated', label: 'Date', kind: 'datetime' },
            { key: 'StatusLabel', label: 'Status', translate: true },
            { key: 'Message', label: 'Note' },
          ],
          rows: events.map((event) => ({
            ...event,
            StatusLabel: event['StatusTo']
              ? optionLabel(FEATURE_REQUEST_STATUS_OPTIONS, event['StatusTo'])
              : event['Type'] === 'published'
                ? 'Published'
                : event['Type'] === 'unpublished'
                  ? 'Unpublished'
                  : '',
          })),
          emptyLabel: 'No status changes yet.',
        },
      },
    ],
  });
}

/**
 * One-shot refinement form of a ticket (human triage): opened with the current refinement, saved
 * with POST (revisioned upsert) to `<desk>/tickets/:uuid/refinement`.
 */
export function refinementForm(
  desk: SupportDesk,
  ticket: ConfigurableCrudRecord,
  current: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const base = supportBase(desk);
  const ticketUUID = String(ticket['SupportTicketUUID'] ?? '');
  const linked = current['FeatureRequestCode']
    ? `${String(current['FeatureRequestCode'])} · ${current['FeatureRequestVoteCount'] ?? 0}`
    : '';
  return defineCrud({
    endpoint: `${base}/tickets/${ticketUUID}/refinement`,
    uuidField: 'RefinementUUID',
    pageTitle: 'Refinement',
    pageDescription:
      'Triage of the ticket: duplicates, problems already fixed, reproduction, impact, specification and acceptance criteria.',
    createTitle: 'Refinement',
    dialogDescription: String(ticket['SupportTicketID'] ?? ''),
    savedMessage: 'Refinement saved.',
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    columns: [],
    initialValues: {
      stage: current['Stage'] ?? 'received',
      resolution: current['Resolution'] ?? 'pending',
      duplicateOfTicketUUID: current['DuplicateOfTicketUUID'] ?? '',
      reproduced:
        current['Reproduced'] === null || current['Reproduced'] === undefined
          ? ''
          : Number(current['Reproduced']),
      reproductionSteps: current['ReproductionSteps'] ?? '',
      impactScope: current['ImpactScope'] ?? 'unknown',
      impactAnalysis: current['ImpactAnalysis'] ?? '',
      specification: current['Specification'] ?? '',
      acceptanceCriteria: current['AcceptanceCriteria'] ?? '',
      featureRequest: linked,
    },
    payload: (values) => ({
      stage: values['stage'],
      resolution: values['resolution'],
      duplicateOfTicketUUID:
        values['resolution'] === 'duplicate' ? values['duplicateOfTicketUUID'] || null : null,
      reproduced: values['reproduced'] === '' ? null : Number(values['reproduced']),
      reproductionSteps: values['reproductionSteps'] || null,
      impactScope: values['impactScope'],
      impactAnalysis: values['impactAnalysis'] || null,
      specification: values['specification'] || null,
      acceptanceCriteria: values['acceptanceCriteria'] || null,
      revision: Number(current['Revision'] ?? 0),
    }),
    fields: [
      {
        key: 'stage',
        label: 'Stage',
        type: 'search-select',
        options: REFINEMENT_STAGE_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
      },
      {
        key: 'resolution',
        label: 'Resolution',
        type: 'search-select',
        options: REFINEMENT_RESOLUTION_OPTIONS,
        translateOptions: true,
        required: true,
        span: 1,
        help: 'Duplicate needs the original ticket; already fixed or not reproducible close the investigation.',
      },
      {
        key: 'impactScope',
        label: 'Who benefits',
        type: 'search-select',
        options: FEATURE_REQUEST_AUDIENCE_OPTIONS,
        translateOptions: true,
        span: 1,
      },
      {
        key: 'reproduced',
        label: 'Reproduction',
        type: 'search-select',
        options: REPRODUCED_OPTIONS,
        translateOptions: true,
        span: 1,
      },
      {
        key: 'duplicateOfTicketUUID',
        label: 'Original ticket',
        type: 'search-select',
        remoteLookup: {
          endpoint: `${base}/tickets`,
          uuidField: 'SupportTicketUUID',
          labelField: 'Subject',
          descriptionField: 'SupportTicketID',
          selectedLabelField: 'DuplicateOfSubject',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'The original of a duplicate is an existing ticket of the same desk; creating one here would defeat the triage.',
        hiddenWhen: (context) => context.values['resolution'] !== 'duplicate',
        requiredWhen: (context) => context.values['resolution'] === 'duplicate',
        span: 4,
      },
      {
        key: 'featureRequest',
        label: 'Idea (code · votes)',
        hiddenWhen: (context) => !context.values['featureRequest'],
        disabledWhen: () => true,
        help: 'Moderate the public idea in Support › Platform › Ideas.',
        span: 4,
      },
      {
        key: 'reproductionSteps',
        label: 'Steps to reproduce',
        type: 'textarea',
        rows: 4,
        span: 4,
      },
      { key: 'impactAnalysis', label: 'Impact analysis', type: 'textarea', rows: 3, span: 4 },
      { key: 'specification', label: 'Specification', type: 'textarea', rows: 5, span: 4 },
      {
        key: 'acceptanceCriteria',
        label: 'Acceptance criteria',
        type: 'textarea',
        rows: 5,
        span: 4,
      },
    ],
  });
}
