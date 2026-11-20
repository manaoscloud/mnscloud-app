import { Component, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../../../services/auth.service';
import { TenantService } from '../../../../services/tenant.service';
import { RouteScopeService } from '../../../../core/scope/route-scope';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilterAction,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import type {
  HostingVpsImage,
  HostingVpsImageAccessPreview,
  HostingVpsProvider,
} from '../vps.types';
import {
  IMAGES_ENDPOINT,
  IMAGE_OPERATION_STATE_OPTIONS,
  IMAGE_PUBLICATION_OPTIONS,
  IMAGE_REPLICA_STATE_OPTIONS,
  IMAGE_SYNC_OPTIONS,
  IMAGE_VISIBILITY_OPTIONS,
  VPS_IMAGE_ERROR_TEXTS,
  buildImageAccessPayload,
  canManageImageRow,
  canPublishImageRow,
  isTruthy,
  isImageUuid,
  imageUuidSegment,
  minimumSpecsSummary,
  normalizeUuidArray,
  publicationLabel,
  remainingSelectedGrantsCount,
  replicaAvailabilitySummary,
  visibilityLabel,
  vpsImageErrorKey,
} from './image-access-logic';

export {
  IMAGES_ENDPOINT,
  IMAGE_OPERATION_STATE_OPTIONS,
  IMAGE_PUBLICATION_OPTIONS,
  IMAGE_REPLICA_STATE_OPTIONS,
  IMAGE_SYNC_OPTIONS,
  IMAGE_VISIBILITY_OPTIONS,
  VPS_IMAGE_ERROR_TEXTS,
  buildImageAccessPayload,
  canManageImageRow,
  canPublishImageRow,
  isTruthy,
  isImageUuid,
  imageUuidSegment,
  minimumSpecsSummary,
  normalizeUuidArray,
  publicationLabel,
  remainingSelectedGrantsCount,
  replicaAvailabilitySummary,
  visibilityLabel,
  vpsImageErrorKey,
};

function visibilityChipClass(value: unknown): string {
  if (value === 'public') return 'chip-running';
  if (value === 'selected') return 'chip-warning';
  return 'chip-skipped';
}

function publicationChipClass(value: unknown): string {
  if (value === 'published') return 'chip-success';
  if (value === 'retired') return 'chip-failed';
  return 'chip-skipped';
}

function syncChipClass(value: unknown): string {
  if (value === 'ready') return 'chip-success';
  if (value === 'pending' || value === 'running' || value === 'queued') return 'chip-running';
  if (value === 'drift' || value === 'unmanaged') return 'chip-warning';
  if (value === 'failed' || value === 'blocked') return 'chip-failed';
  return 'chip-skipped';
}

function replicaChipClass(value: unknown): string {
  if (value === 'ready') return 'chip-success';
  if (value === 'copying' || value === 'pending') return 'chip-running';
  if (value === 'outdated' || value === 'drift' || value === 'offline') return 'chip-warning';
  if (value === 'failed') return 'chip-failed';
  return 'chip-skipped';
}

function operationChipClass(value: unknown): string {
  if (value === 'succeeded') return 'chip-success';
  if (value === 'running' || value === 'pending' || value === 'queued' || value === 'waiting_retry')
    return 'chip-running';
  if (value === 'failed' || value === 'blocked') return 'chip-failed';
  return 'chip-skipped';
}

const OBSERVE_PROVIDER_ACTION: ConfigurableCrudFilterAction = {
  key: 'observeProvider',
  label: 'Observe provider',
  icon: 'radar',
  tooltip: 'Import read-only image observations from the selected provider.',
};

/** Image builds (phase T3): new draft versions from the vendor's official cloud image. */
export const IMAGE_BUILDS_ENDPOINT = 'system/hosting/vps/image-builds';
/** Images with a build recipe in the API (the API refuses any other key). */
export const IMAGE_BUILD_KEYS: readonly string[] = [
  'debian-13',
  'debian-12',
  'ubuntu-24.04',
  'ubuntu-26.04',
];

export function canBuildImageRow(row: ConfigurableCrudRecord): boolean {
  return canManageImageRow(row) && IMAGE_BUILD_KEYS.includes(String(row['HimImageKey'] ?? ''));
}

const IMAGE_BUILD_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const GENERATE_VERSION_ACTION: ConfigurableCrudRowAction = {
  key: 'generateVersion',
  label: 'Generate new version',
  icon: 'build',
  tooltip:
    'Build a new draft version from the official cloud image of the vendor, with security updates applied. It is never published automatically.',
  visible: (row) => canBuildImageRow(row),
};

function imageBuildsConfig(providerUUID: string, imageKey: string): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${IMAGE_BUILDS_ENDPOINT}/providers/${imageUuidSegment(providerUUID)}/images/${encodeURIComponent(imageKey)}`,
    uuidField: 'buildUUID',
    pageTitle: 'Builds',
    pageDescription:
      'New versions built from the official cloud image of the vendor. A finished build appears as a draft version; publish it in Manage access.',
    readOnly: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    emptyLabel: 'No builds requested for this image.',
    columns: [
      { id: 'dateCreated', label: 'Requested at', kind: 'datetime', field: 'dateCreated' },
      {
        id: 'state',
        label: 'Status',
        kind: 'status',
        field: 'state',
        options: IMAGE_BUILD_STATE_OPTIONS,
        chipClass: (value) => operationChipClass(value),
      },
      { id: 'stage', label: 'Stage', field: 'stage' },
      { id: 'progress', label: 'Progress (%)', kind: 'number', field: 'progress' },
      {
        id: 'revision',
        label: 'Build revision',
        field: 'result',
        value: (row) =>
          String((row['result'] as Record<string, unknown> | null)?.['revision'] ?? '-'),
      },
      {
        id: 'draftVmid',
        label: 'Draft VMID',
        field: 'result',
        value: (row) =>
          String((row['result'] as Record<string, unknown> | null)?.['draftVmid'] ?? '-'),
      },
      {
        id: 'acceptance',
        label: 'Acceptance',
        field: 'result',
        value: (row, translate) => {
          const acceptance = (row['result'] as Record<string, any> | null)?.['acceptance'];
          if (!acceptance) return '-';
          return acceptance.passed ? translate('Passed') : translate('Failed');
        },
      },
      {
        id: 'errorCode',
        label: 'Last error',
        field: 'errorCode',
        value: (row, translate) => {
          const code = String(row['errorCode'] ?? '').trim();
          if (!code) return '-';
          const key = VPS_IMAGE_ERROR_TEXTS[code.toUpperCase()];
          return key ? translate(key) : code;
        },
      },
      { id: 'dateFinished', label: 'Finished at', kind: 'datetime', field: 'dateFinished' },
    ],
    rowActions: [],
    fields: [],
  });
}

const MANAGE_ACCESS_ACTION: ConfigurableCrudRowAction = {
  key: 'manageAccess',
  label: 'Manage access',
  icon: 'lock_open',
  tooltip: 'Manage who can use this image and review the impact before saving.',
  inline: true,
  visible: (row) => canManageImageRow(row),
};

function imageVersionsConfig(imageUUID: string): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${IMAGES_ENDPOINT}/${imageUuidSegment(imageUUID)}/versions`,
    uuidField: 'versionUUID',
    pageTitle: 'Overview',
    pageDescription: 'Build revisions and minimum hardware requirements observed for this image.',
    readOnly: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    emptyLabel: 'No image versions found.',
    columns: [
      {
        id: 'buildRevision',
        label: 'Build revision',
        kind: 'identity',
        field: 'buildRevision',
        uuidField: 'versionUUID',
      },
      {
        id: 'publication',
        label: 'Publication',
        kind: 'status',
        field: 'publication',
        options: IMAGE_PUBLICATION_OPTIONS,
        chipClass: (value) => publicationChipClass(value),
      },
      { id: 'cpu', label: 'Minimum vCPU', kind: 'number', field: 'cpu' },
      { id: 'memoryMb', label: 'Minimum memory (MB)', kind: 'number', field: 'memoryMb' },
      { id: 'diskGb', label: 'Minimum disk (GB)', kind: 'number', field: 'diskGb' },
    ],
    fields: [],
  });
}

function imageGrantsConfig(
  imageUUID: string,
  isMarkedForRevocation: (envUUID: string) => boolean,
  canRevokeGrant: () => boolean,
  onStageRevoke: (row: ConfigurableCrudRecord) => void,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${IMAGES_ENDPOINT}/${imageUuidSegment(imageUUID)}/grants`,
    uuidField: 'EnvironmentUUID',
    pageTitle: 'Access',
    pageDescription: 'Consumer environments currently authorized to use this image.',
    readOnly: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    emptyLabel: 'No authorized environments for this image.',
    columns: [
      {
        id: 'environment',
        label: 'Authorized environment',
        kind: 'identity',
        field: 'EnvironmentName',
        uuidField: 'EnvironmentUUID',
        detail: (row, translate) =>
          isMarkedForRevocation(String(row['EnvironmentUUID'] ?? ''))
            ? translate('Pending revocation on save')
            : '',
      },
      {
        id: 'status',
        label: 'Status',
        kind: 'status',
        field: 'status',
        value: (row, translate) =>
          isMarkedForRevocation(String(row['EnvironmentUUID'] ?? ''))
            ? translate('Pending revocation on save')
            : isTruthy(row['status']) || row['status'] === 'active'
              ? translate('Active')
              : translate('Inactive'),
        chipClass: (value, row) =>
          isMarkedForRevocation(String(row['EnvironmentUUID'] ?? ''))
            ? 'chip-warning'
            : isTruthy(value) || value === 'active'
              ? 'chip-success'
              : 'chip-skipped',
      },
    ],
    rowActions: [
      {
        key: 'stageRevoke',
        label: 'Mark for revocation',
        icon: 'person_remove',
        tooltip: 'Stage this environment grant to be revoked when saving access policy.',
        visible: (row) =>
          canRevokeGrant() && !isMarkedForRevocation(String(row['EnvironmentUUID'] ?? '')),
        run: (row) => onStageRevoke(row),
      },
    ],
    fields: [],
  });
}

function imageReplicasConfig(imageUUID: string, providerUUID?: string): ConfigurableCrudConfig {
  const copyBase = providerUUID
    ? `system/hosting/vps/providers/${imageUuidSegment(providerUUID)}/images`
    : null;
  return defineCrud({
    endpoint: `${IMAGES_ENDPOINT}/${imageUuidSegment(imageUUID)}/replicas`,
    uuidField: 'key',
    pageTitle: 'Availability',
    pageDescription:
      'Observed image replicas per cluster node, policy synchronization and sanitized errors.',
    readOnly: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    emptyLabel: 'No replicas observed for this image.',
    columns: [
      { id: 'node', label: 'Node', kind: 'identity', field: 'node', uuidField: 'key' },
      { id: 'vmid', label: 'Template VMID', field: 'vmid' },
      { id: 'buildRevision', label: 'Build revision', field: 'buildRevision' },
      {
        id: 'state',
        label: 'Status',
        kind: 'status',
        field: 'state',
        options: IMAGE_REPLICA_STATE_OPTIONS,
        chipClass: (value) => replicaChipClass(value),
      },
      {
        id: 'observedVisibility',
        label: 'Observed audience',
        field: 'observedVisibility',
        options: IMAGE_VISIBILITY_OPTIONS,
      },
      {
        id: 'policyRevision',
        label: 'Observed revision',
        field: 'policyRevision',
        optional: true,
      },
      {
        id: 'desiredRevision',
        label: 'Desired revision',
        field: 'desiredRevision',
        optional: true,
      },
      { id: 'observedAt', label: 'Observed at', kind: 'datetime', field: 'observedAt' },
      {
        id: 'errorCode',
        label: 'Last error',
        field: 'errorCode',
        value: (row, translate) => {
          const code = String(row['errorCode'] ?? '').trim();
          if (!code) return '-';
          const key = VPS_IMAGE_ERROR_TEXTS[code.toUpperCase()];
          return key ? translate(key) : code;
        },
      },
    ],
    rowActions: copyBase
      ? [
          {
            key: 'copyImage',
            label: 'Copy to this node',
            icon: 'content_copy',
            visible: (row) =>
              Boolean(row['sourceVmid']) &&
              (row['state'] === 'missing' || row['state'] === 'outdated'),
            request: {
              method: 'post',
              endpoint: (row) =>
                `${copyBase}/${encodeURIComponent(String(row['sourceVmid'] ?? ''))}/replicas`,
              body: (row) => ({ node: row['node'] }),
              successMessage: 'Image copy started. Refresh to follow it.',
              confirm: {
                title: 'Copy image',
                message:
                  'Copy this image to the node? The disk crosses the network and may take several minutes.',
                confirmLabel: 'Copy',
              },
            },
          },
        ]
      : [],
    fields: [],
  });
}

function imageHistoryConfig(
  imageUUID: string,
  currentRevision: () => string,
  canManage: () => boolean,
  onRetry: (row: ConfigurableCrudRecord) => Promise<void>,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${IMAGES_ENDPOINT}/${imageUuidSegment(imageUUID)}/history`,
    uuidField: 'operationUUID',
    pageTitle: 'History',
    pageDescription:
      'Access policy changes, justifications and durable reconciliation operations for this image.',
    readOnly: true,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    serverSidePagination: true,
    emptyLabel: 'No access operations recorded for this image.',
    columns: [
      {
        id: 'createdAt',
        label: 'Date',
        kind: 'datetime',
        field: 'createdAt',
      },
      { id: 'actorName', label: 'Changed by', field: 'actorName' },
      {
        id: 'previousVisibility',
        label: 'Previous audience',
        field: 'previousVisibility',
        options: IMAGE_VISIBILITY_OPTIONS,
      },
      {
        id: 'visibility',
        label: 'New audience',
        field: 'visibility',
        options: IMAGE_VISIBILITY_OPTIONS,
      },
      { id: 'revision', label: 'Policy revision', field: 'revision' },
      { id: 'reason', label: 'Justification', field: 'reason' },
      {
        id: 'state',
        label: 'Operation status',
        kind: 'status',
        field: 'state',
        options: IMAGE_OPERATION_STATE_OPTIONS,
        chipClass: (value) => operationChipClass(value),
      },
      {
        id: 'errorCode',
        label: 'Last error',
        field: 'errorCode',
        value: (row, translate) => {
          const code = String(row['errorCode'] ?? '').trim();
          if (!code) return '-';
          const key = VPS_IMAGE_ERROR_TEXTS[code.toUpperCase()];
          return key ? translate(key) : code;
        },
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        kind: 'datetime',
        field: 'updatedAt',
        optional: true,
      },
    ],
    rowActions: [
      {
        key: 'retryOperation',
        label: 'Retry pending replicas',
        icon: 'refresh',
        tooltip: 'Retry failed or blocked replicas for the current policy revision.',
        visible: (row) => {
          if (!canManage()) return false;
          const state = String(row['state'] ?? '');
          if (state !== 'failed' && state !== 'blocked') return false;
          const rev = currentRevision();
          return !rev || String(row['revision'] ?? '') === rev;
        },
        run: (row) => onRetry(row),
      },
    ],
    fields: [],
  });
}

const PROVIDER_FILTER: ConfigurableCrudListFilter = {
  key: 'providerUUID',
  paramKey: 'providerUUID',
  label: 'Provider',
  type: 'search-select',
  span: 1,
};

const VISIBILITY_FILTER: ConfigurableCrudListFilter = {
  key: 'visibility',
  paramKey: 'visibility',
  label: 'Who can use',
  type: 'select',
  options: IMAGE_VISIBILITY_OPTIONS,
  translateOptions: true,
  span: 1,
};

const BASE_CONFIG: ConfigurableCrudConfig = defineCrud({
  endpoint: IMAGES_ENDPOINT,
  updateEndpoint: (row) => `${IMAGES_ENDPOINT}/${imageUuidSegment(row['HimUUID'])}/access`,
  uuidField: 'HimUUID',
  pageTitle: 'VPS images',
  pageDescription:
    'Manage platform VPS logical images, audience authorization, published versions and node availability.',
  createTitle: 'Manage access',
  editTitle: 'Manage access',
  dialogDescription:
    'Define who can use this logical image, review the impact across replicas and track background application in the Activity Center.',
  searchPlaceholder: 'Image name or key',
  emptyLabel: 'No VPS images found.',
  savedMessage: 'Image access policy saved.',
  canCreate: false,
  canEdit: true,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  pageSizeOptions: [10, 25, 50, 100],
  initialPageSize: 10,
  listFilters: [PROVIDER_FILTER, VISIBILITY_FILTER],
  filterActions: [OBSERVE_PROVIDER_ACTION],
  initialValues: {
    revision: '',
    visibility: 'platform',
    addEnvironmentUUIDs: [],
    removeEnvironmentUUIDs: [],
    publication: 'draft',
    versionUUID: '',
    reason: '',
  },
  columns: [
    {
      id: 'name',
      label: 'Image',
      kind: 'identity',
      field: 'HimName',
      uuidField: 'HimUUID',
      detail: (row, translate) => {
        const key = String(row['HimImageKey'] ?? '').trim();
        const internal = isTruthy(row['HimInternalOnly']) ? translate('Internal only') : '';
        return [key, internal].filter(Boolean).join(' · ');
      },
    },
    {
      id: 'provider',
      label: 'Provider',
      field: 'providerName',
    },
    {
      id: 'buildRevision',
      label: 'Published build',
      field: 'buildRevision',
      value: (row) => {
        const rev = String(row['buildRevision'] ?? '').trim();
        const specs = minimumSpecsSummary(row);
        if (!rev) return specs;
        return specs !== '-' ? `${rev} (${specs})` : rev;
      },
    },
    {
      id: 'visibility',
      label: 'Who can use',
      kind: 'status',
      field: 'HimVisibility',
      options: IMAGE_VISIBILITY_OPTIONS,
      chipClass: (value) => visibilityChipClass(value),
    },
    {
      id: 'publication',
      label: 'Publication',
      kind: 'status',
      field: 'HimPublication',
      options: IMAGE_PUBLICATION_OPTIONS,
      chipClass: (value) => publicationChipClass(value),
    },
    {
      id: 'availability',
      label: 'Availability',
      field: 'readyReplicas',
      value: (row) => replicaAvailabilitySummary(row),
    },
    {
      id: 'syncState',
      label: 'Policy sync',
      kind: 'status',
      field: 'syncState',
      options: IMAGE_SYNC_OPTIONS,
      chipClass: (value) => syncChipClass(value),
    },
    {
      id: 'revision',
      label: 'Policy revision',
      field: 'HimRevision',
      optional: true,
    },
    {
      id: 'updatedAt',
      label: 'Last updated',
      kind: 'datetime',
      field: 'HimDateUpdated',
    },
  ],
  fields: [
    {
      key: 'revision',
      source: 'HimRevision',
      payloadKey: 'revision',
      label: 'Policy revision',
      hidden: true,
    },
    {
      key: 'visibility',
      source: 'HimVisibility',
      payloadKey: 'visibility',
      label: 'Who can use?',
      type: 'select',
      required: true,
      span: 1,
      optionsWhen: ({ values }) =>
        isTruthy(values['internalOnly'])
          ? IMAGE_VISIBILITY_OPTIONS.filter((option) => option.value === 'platform')
          : IMAGE_VISIBILITY_OPTIONS,
      disabledWhen: ({ values }) => isTruthy(values['internalOnly']),
      help: 'Platform only restricts the image to internal platform operations. All customers authorizes every eligible customer environment. Selected environments authorizes only the granted consumer environments.',
    },
    {
      key: 'publication',
      source: 'HimPublication',
      payloadKey: 'publication',
      label: 'Publication state',
      type: 'select',
      options: IMAGE_PUBLICATION_OPTIONS,
      required: true,
      span: 1,
      disabledWhen: ({ values }) => !isTruthy(values['canPublish']),
      help: 'Only published images can be used for new VPS creations and reinstallations. Retiring an image does not stop existing VMs.',
    },
    {
      key: 'versionUUID',
      source: 'currentVersionUUID',
      payloadKey: 'versionUUID',
      label: 'Published build version',
      type: 'search-select',
      span: 1,
      disabledWhen: ({ values }) => !isTruthy(values['canPublish']),
      quickCreate: false,
      quickCreateExemptReason:
        'Image versions are imported from provider template observations and cannot be created manually.',
      remoteLookup: {
        endpoint: IMAGES_ENDPOINT,
        uuidField: 'versionUUID',
        labelField: 'buildRevision',
        selectedLabelField: 'buildRevision',
        parameters: { imageUUID: 'imageUUID' },
      },
      help: 'Build revision associated with the logical image policy.',
    },
    {
      key: 'addEnvironmentUUIDs',
      payloadKey: 'addEnvironmentUUIDs',
      label: 'Add authorized environments',
      type: 'search-select',
      multiple: true,
      span: 1,
      breakBefore: true,
      hiddenWhen: ({ values }) => values['visibility'] !== 'selected',
      remoteLookup: {
        endpoint: `${IMAGES_ENDPOINT}/environments`,
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
        descriptionField: 'status',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Consumer environments are platform tenant records and are not created from image access.',
      help: 'Search and select consumer environments to grant access. Additions are applied as a bounded delta without replacing existing grants on other pages.',
    },
    {
      key: 'removeEnvironmentUUIDs',
      payloadKey: 'removeEnvironmentUUIDs',
      label: 'Revoke authorized environments',
      type: 'search-select',
      multiple: true,
      span: 1,
      hiddenWhen: ({ values }) => values['visibility'] !== 'selected',
      quickCreate: false,
      quickCreateExemptReason: 'Revocation selects from already active grants of this image.',
      help: 'Select active environment grants to revoke in this change. Revoking access blocks new creations and reinstallations without stopping existing instances.',
    },
    {
      key: 'reason',
      payloadKey: 'reason',
      label: 'Justification',
      type: 'textarea',
      required: true,
      span: 4,
      placeholder: 'Record the operational reason for this access or publication change',
      help: 'Required for audit. Do not include credentials, tokens or private customer data.',
    },
  ],
});

@Component({
  selector: 'app-hosting-vps-images',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsImagesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly activeGrants = signal<ConfigurableCrudOption[]>([]);
  private readonly activeGrantTotal = signal(0);
  private idempotencyKey = crypto.randomUUID();
  private confirmedIntent: string | null = null;
  private openingGeneration = 0;
  private previewPending = false;
  private readonly imageAuth = inject(AuthService);
  private readonly imageTenants = inject(TenantService);
  private readonly imageScope = inject(RouteScopeService);

  protected override captureSaveContext(): () => boolean {
    const generation = this.openingGeneration;
    const isPageCurrent = this.capturePageContext();
    return () => isPageCurrent() && generation === this.openingGeneration;
  }

  private capturePageContext(): () => boolean {
    const session = this.imageAuth.sessionGeneration();
    const tenant = this.imageTenants.selectedTenant();
    const scope = this.imageScope.current();
    const system = this.imageScope.isSystemTree();
    return () =>
      !this.destroyRef.destroyed &&
      session === this.imageAuth.sessionGeneration() &&
      tenant === this.imageTenants.selectedTenant() &&
      scope === this.imageScope.current() &&
      system === this.imageScope.isSystemTree();
  }

  override closeDialog(): void {
    this.openingGeneration++;
    this.confirmedIntent = null;
    super.closeDialog();
  }

  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HvrUUID,
      label: provider.HvrName,
      description: provider.HvrProvider,
      searchText: `${provider.HvrName} ${provider.HvrProvider}`,
    })),
  );

  constructor() {
    const collections = (page: HostingVpsImagesPage): ConfigurableCrudRelatedCollection[] => [
      {
        key: 'overview',
        label: 'Overview',
        emptyLabel: 'No image versions found.',
        uuidField: 'versionUUID',
        endpoint: (uuid) => `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/versions`,
        deleteEndpoint: (uuid, row) =>
          `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/versions/${imageUuidSegment(row['versionUUID'])}`,
        initialValues: {},
        fields: [],
        columns: [],
        config: (uuid) => imageVersionsConfig(uuid),
      },
      {
        key: 'grants',
        label: 'Access',
        emptyLabel: 'No authorized environments for this image.',
        uuidField: 'EnvironmentUUID',
        endpoint: (uuid) => `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/grants`,
        deleteEndpoint: (uuid, row) =>
          `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/grants/${imageUuidSegment(row['EnvironmentUUID'])}`,
        initialValues: {},
        fields: [],
        columns: [],
        config: (uuid) =>
          imageGrantsConfig(
            uuid,
            (envUUID) => page.isEnvironmentMarkedForRevocation(envUUID),
            () => page.formValues()['visibility'] === 'selected',
            (row) => page.stageGrantForRevocation(row),
          ),
      },
      {
        key: 'replicas',
        label: 'Availability',
        emptyLabel: 'No replicas observed for this image.',
        uuidField: 'key',
        endpoint: (uuid) => `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/replicas`,
        deleteEndpoint: (uuid, row) =>
          `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/replicas/${encodeURIComponent(String(row['key']))}`,
        initialValues: {},
        fields: [],
        columns: [],
        config: (uuid) =>
          imageReplicasConfig(
            uuid,
            String(page.editingRecord()?.['HostingVpsProviderHvrUUID'] ?? ''),
          ),
      },
      {
        key: 'builds',
        label: 'Builds',
        emptyLabel: 'No builds requested for this image.',
        uuidField: 'buildUUID',
        endpoint: () =>
          `${IMAGE_BUILDS_ENDPOINT}/providers/${imageUuidSegment(String(page.editingRecord()?.['HostingVpsProviderHvrUUID'] ?? ''))}/images/${encodeURIComponent(String(page.editingRecord()?.['HimImageKey'] ?? ''))}`,
        deleteEndpoint: (_uuid, row) =>
          `${IMAGE_BUILDS_ENDPOINT}/${imageUuidSegment(row['buildUUID'])}`,
        initialValues: {},
        fields: [],
        columns: [],
        config: () =>
          imageBuildsConfig(
            String(page.editingRecord()?.['HostingVpsProviderHvrUUID'] ?? ''),
            String(page.editingRecord()?.['HimImageKey'] ?? ''),
          ),
      },
      {
        key: 'history',
        label: 'History',
        emptyLabel: 'No access operations recorded for this image.',
        uuidField: 'operationUUID',
        endpoint: (uuid) => `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/history`,
        deleteEndpoint: (uuid, row) =>
          `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/history/${imageUuidSegment(row['operationUUID'])}`,
        initialValues: {},
        fields: [],
        columns: [],
        config: (uuid) =>
          imageHistoryConfig(
            uuid,
            () => String(page.editingRecord()?.['HimRevision'] ?? ''),
            () => canManageImageRow(page.editingRecord() ?? {}),
            (row) => page.retryAccessOperation(uuid, row),
          ),
      },
    ];

    super({
      ...BASE_CONFIG,
      fields: BASE_CONFIG.fields.map((field) => ({
        ...field,
        remoteLookup: field.remoteLookup ? { ...field.remoteLookup } : undefined,
      })),
      canEditRow: (row) => canManageImageRow(row),
      rowActions: [MANAGE_ACCESS_ACTION, GENERATE_VERSION_ACTION],
      relatedCollections: collections(
        // Passed through closure evaluated only when editingRecord() is set.
        null as unknown as HostingVpsImagesPage,
      ),
    });

    // Rebind relatedCollections closure to `this` instance.
    (
      this.config as { relatedCollections: readonly ConfigurableCrudRelatedCollection[] }
    ).relatedCollections = collections(this);

    const providerUUID = (this.route?.snapshot.queryParamMap.get('providerUUID') ?? '').trim();
    if (isImageUuid(providerUUID)) {
      this.listFilterValues.set({ providerUUID });
      this.appliedFilters.update((current) => ({
        ...current,
        extra: { ...current.extra, providerUUID },
      }));
    }
    let previousSession = this.imageAuth.sessionGeneration();
    let previousTenant = this.imageTenants.selectedTenant();
    effect(() => {
      const session = this.imageAuth.sessionGeneration();
      const tenant = this.imageTenants.selectedTenant();
      if (session !== previousSession || tenant !== previousTenant) this.closeDialog();
      previousSession = session;
      previousTenant = tenant;
    });
    void this.fetchProviders();
  }

  override backLink(): string | null {
    const providerUUID = String(this.appliedFilters().extra['providerUUID'] ?? '').trim();
    return providerUUID ? '/system/vps/provider' : null;
  }

  override isFilterActionDisabled(action: ConfigurableCrudFilterAction): boolean {
    if (action.key === 'observeProvider') {
      return !this.selectedProviderUUID();
    }
    return false;
  }

  override filterActionDisabledReason(action: ConfigurableCrudFilterAction): string | null {
    if (action.key === 'observeProvider' && !this.selectedProviderUUID()) {
      return 'Select a provider in the filter to import its image observations.';
    }
    return null;
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'observeProvider') return;
    const providerUUID = this.selectedProviderUUID();
    if (!providerUUID) return;
    const isCurrent = this.captureSaveContext();
    this.mutating.set(true);
    try {
      const response = await this.api.post(
        `${IMAGES_ENDPOINT}/providers/${imageUuidSegment(providerUUID)}/observe`,
        {},
      );
      if (!isCurrent()) return;
      if (!this.trackOperation(response)) {
        this.snack.success(this.t('Provider image observation started.'));
      }
      this.refreshList();
    } catch (error) {
      if (isCurrent()) this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.mutating.set(false);
    }
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'manageAccess') {
      this.startEdit(row);
    } else if (action.key === 'generateVersion') {
      await this.requestImageBuild(row);
    }
  }

  /** Queues a draft build of the image (never published automatically). */
  private async requestImageBuild(row: ConfigurableCrudRecord): Promise<void> {
    if (!canBuildImageRow(row)) return;
    const providerUUID = String(row['HostingVpsProviderHvrUUID'] ?? '');
    const imageKey = String(row['HimImageKey'] ?? '');
    if (!isImageUuid(providerUUID)) return;
    const isCurrent = this.capturePageContext();
    const confirmed = await this.confirmAction(
      'Generate new version',
      this.t(
        'Build a new draft version of {{image}} from the official cloud image of the vendor? It takes about 15 minutes, installs the security updates, passes an acceptance boot and stays as a draft until you publish it in Manage access.',
        { image: String(row['HimName'] ?? imageKey) },
      ),
      'Generate',
    );
    if (!confirmed || !isCurrent()) return;
    this.mutating.set(true);
    try {
      await this.api.post(IMAGE_BUILDS_ENDPOINT, {
        providerUUID,
        imageKey,
        reason: 'New version requested in the App from the official cloud image of the vendor',
      });
      if (!isCurrent()) return;
      this.snack.success(this.t('Image build queued. Follow it in the Builds tab of the image.'));
    } catch (error) {
      if (isCurrent()) this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.mutating.set(false);
    }
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    void this.openManageAccess(row);
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    this.idempotencyKey = crypto.randomUUID();
    this.confirmedIntent = null;
    if (key === 'visibility' && this.formValues()['visibility'] !== 'selected') {
      this.patchFormValues({
        addEnvironmentUUIDs: [],
        removeEnvironmentUUIDs: [],
      });
    }
  }

  protected override saveRequestOptions(): { idempotencyKey?: string } {
    return { idempotencyKey: this.idempotencyKey };
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'removeEnvironmentUUIDs') return this.activeGrants();
    return [];
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...super.formValuesFromRecord(row),
      imageUUID: String(row['HimUUID'] ?? ''),
      revision: String(row['HimRevision'] ?? ''),
      visibility: String(row['HimVisibility'] ?? 'platform'),
      publication: String(row['HimPublication'] ?? 'draft'),
      versionUUID: String(row['currentVersionUUID'] ?? ''),
      internalOnly: isTruthy(row['HimInternalOnly']) ? 1 : 0,
      canPublish: canPublishImageRow(row) ? 1 : 0,
      addEnvironmentUUIDs: [],
      removeEnvironmentUUIDs: [],
      reason: '',
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return buildImageAccessPayload(payload, this.editingRecord());
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const current = this.editingRecord();
    for (const key of ['addEnvironmentUUIDs', 'removeEnvironmentUUIDs']) {
      const values = payload[key];
      if (Array.isArray(values) && values.some((value) => !isImageUuid(value))) {
        return this.rejectField(key, 'Invalid identifier.');
      }
    }
    if (payload['versionUUID'] && !isImageUuid(payload['versionUUID'])) {
      return this.rejectField('versionUUID', 'Invalid identifier.');
    }
    if (isTruthy(current?.['HimInternalOnly']) && payload['visibility'] !== 'platform') {
      return this.rejectField(
        'visibility',
        'Internal platform images cannot be shared with customer environments.',
      );
    }
    const reason = String(payload['reason'] ?? '').trim();
    if (reason.length < 5) {
      return this.rejectField('reason', 'Enter a clear justification with at least 5 characters.');
    }
    if (payload['visibility'] === 'selected') {
      const remaining = remainingSelectedGrantsCount(payload, current, this.activeGrantTotal());
      if (remaining < 1) {
        return this.rejectField(
          'addEnvironmentUUIDs',
          'Selected environments access requires at least one authorized environment.',
        );
      }
    }
    return true;
  }

  protected override async confirmBeforeSave(payload: ConfigurableCrudRecord): Promise<boolean> {
    const current = this.editingRecord();
    if (!current || this.previewPending) return false;
    const uuid = this.recordUUID(current);
    if (!isImageUuid(uuid)) return false;
    const body = buildImageAccessPayload(payload, current);
    const fingerprint = JSON.stringify([uuid, body]);
    const isCurrent = this.captureSaveContext();
    const key = this.idempotencyKey;
    const unchanged = () =>
      isCurrent() &&
      key === this.idempotencyKey &&
      fingerprint ===
        JSON.stringify([
          this.recordUUID(this.editingRecord() ?? {}),
          buildImageAccessPayload(this.formValues(), this.editingRecord()),
        ]);
    // A lost accepted PUT response must replay the same key without a stale-revision preview.
    if (this.confirmedIntent === fingerprint && unchanged()) return true;
    this.previewPending = true;
    try {
      const response = await this.api.post<{ data?: HostingVpsImageAccessPreview }>(
        `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/access/preview`,
        body,
      );
      const preview = response?.data;
      if (!preview || !unchanged()) return false;

      const previousLabel = this.t(visibilityLabel(preview.previousVisibility));
      const nextLabel = this.t(visibilityLabel(preview.visibility));
      const publicationText = this.t(publicationLabel(preview.publication));
      const summary = this.t(
        'Audience: {{previous}} -> {{next}} ({{publication}}). Environments: +{{added}} / -{{removed}}. Individual environment permissions after change: {{targets}} (unavailable replicas: {{unavailable}}). Revoking access blocks future creations and reinstallations without stopping existing VMs.',
        {
          previous: previousLabel,
          next: nextLabel,
          publication: publicationText,
          added: Number(preview.addedCount ?? 0),
          removed: Number(preview.removedCount ?? 0),
          targets: Number(preview.targetCount ?? 0),
          unavailable: Number(preview.unavailableCount ?? 0),
        },
      );

      const confirmed =
        preview.willPublishPublicly || preview.visibility === 'public'
          ? await this.confirmAction(
              'Make available to all customers',
              `${summary} ${this.t('Confirm making this image available to all eligible customer environments?')}`,
              'Make available to all customers',
            )
          : await this.confirmAction('Apply image access policy', summary, 'Apply policy');
      if (!confirmed || !unchanged()) return false;
      this.confirmedIntent = fingerprint;
      return true;
    } catch (error) {
      if (isCurrent()) this.snack.error(this.t(this.errorMessage(error)));
      return false;
    } finally {
      this.previewPending = false;
    }
  }

  protected override errorMessage(error: unknown): string {
    return vpsImageErrorKey(error) ?? super.errorMessage(error);
  }

  isEnvironmentMarkedForRevocation(environmentUUID: string): boolean {
    if (!environmentUUID) return false;
    return normalizeUuidArray(this.formValues()['removeEnvironmentUUIDs']).includes(
      environmentUUID,
    );
  }

  stageGrantForRevocation(row: ConfigurableCrudRecord): void {
    const uuid = String(row['EnvironmentUUID'] ?? '').trim();
    if (!isImageUuid(uuid)) return;
    const label = String(row['EnvironmentName'] ?? uuid).trim() || uuid;
    this.activeGrants.update((current) =>
      current.some((opt) => String(opt.value) === uuid)
        ? current
        : [{ value: uuid, label }, ...current],
    );
    const currentRemoved = normalizeUuidArray(this.formValues()['removeEnvironmentUUIDs']);
    if (!currentRemoved.includes(uuid)) {
      this.idempotencyKey = crypto.randomUUID();
      this.confirmedIntent = null;
      this.patchFormValues({ removeEnvironmentUUIDs: [...currentRemoved, uuid] });
    }
  }

  private selectedProviderUUID(): string {
    const uuid = String(
      this.listFilterValues()['providerUUID'] ?? this.appliedFilters().extra['providerUUID'] ?? '',
    ).trim();
    return isImageUuid(uuid) ? uuid : '';
  }

  private async openManageAccess(row: ConfigurableCrudRecord): Promise<void> {
    const uuid = this.recordUUID(row);
    if (!isImageUuid(uuid) || !canManageImageRow(row) || this.saving()) return;
    this.openingGeneration++;
    const isCurrent = this.captureSaveContext();
    this.idempotencyKey = crypto.randomUUID();
    this.confirmedIntent = null;
    this.activeGrants.set([]);
    this.activeGrantTotal.set(0);
    this.isFormDialogOpen.set(false);
    let detail: ConfigurableCrudRecord;
    try {
      const [accessRes, grantsRes] = await Promise.all([
        this.api.get<{
          data?: {
            item?: HostingVpsImage;
            activeGrantCount?: number;
            grantCount?: number;
          };
        }>(`${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/access`),
        this.api
          .get<{
            data?: {
              items?: Array<{
                EnvironmentUUID: string;
                EnvironmentName: string;
                status?: string | number | null;
              }>;
              total?: number;
            };
          }>(`${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/grants?limit=200&offset=0`)
          .catch(() => null),
      ]);
      if (!isCurrent() || !accessRes?.data?.item || !canManageImageRow(accessRes.data.item)) return;
      {
        detail = {
          ...row,
          ...accessRes.data.item,
          activeGrantCount:
            accessRes.data.item.activeGrantCount ??
            accessRes.data.activeGrantCount ??
            accessRes.data.item.grantCount ??
            accessRes.data.grantCount ??
            grantsRes?.data?.total,
        };
      }
      const versionField = this.config.fields.find((field) => field.key === 'versionUUID');
      if (versionField?.remoteLookup) {
        versionField.remoteLookup.endpoint = `${IMAGES_ENDPOINT}/${imageUuidSegment(uuid)}/versions`;
      }
      const grantItems = grantsRes?.data?.items ?? [];
      this.activeGrantTotal.set(Number(grantsRes?.data?.total ?? grantItems.length));
      this.activeGrants.set(
        grantItems.map((grant) => ({
          value: String(grant.EnvironmentUUID),
          label: String(grant.EnvironmentName || grant.EnvironmentUUID),
        })),
      );
    } catch (error) {
      if (isCurrent()) this.snack.error(this.t(this.errorMessage(error)));
      return;
    }
    if (isCurrent()) super.startEdit(detail);
  }

  async retryAccessOperation(imageUUID: string, row: ConfigurableCrudRecord): Promise<void> {
    const operationUUID = String(row['operationUUID'] ?? '').trim();
    if (!isImageUuid(imageUUID) || !isImageUuid(operationUUID)) return;
    const isCurrent = this.captureSaveContext();
    const confirmed = await this.confirmAction(
      'Retry pending replicas',
      'Retry applying the current image access policy on pending or failed replicas?',
      'Retry',
    );
    if (!confirmed || !isCurrent()) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(
        `${IMAGES_ENDPOINT}/${imageUuidSegment(imageUUID)}/access-operations/${imageUuidSegment(operationUUID)}/retry`,
        {},
      );
      if (!isCurrent()) return;
      if (!this.trackOperation(response)) {
        this.snack.success(this.t('Image access retry queued.'));
      }
      this.refreshList();
      for (const collection of this.relatedCollections()) {
        this.reloadRelatedCollection(collection);
      }
    } catch (error) {
      if (isCurrent()) this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchProviders(): Promise<void> {
    const isCurrent = this.capturePageContext();
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        'system/hosting/vps/providers?limit=500&offset=0',
      );
      if (!isCurrent()) return;
      this.providers.set(Array.isArray(result?.data?.items) ? result.data.items : []);
    } catch {
      if (isCurrent()) this.providers.set([]);
    }
  }
}
