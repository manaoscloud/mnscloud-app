import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxAccountQuickCreateHostComponent } from '../account/account';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const queueStrategies: ConfigurableCrudOption[] = [
  { value: 'ring_all', label: 'Ring all' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_recent', label: 'Least recent' },
  { value: 'fewest_calls', label: 'Fewest calls' },
  { value: 'random', label: 'Random' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/queues',
    uuidField: 'VpqUUID',
    pageTitle: 'Queues',
    pageDescription: 'Manage PABX queues and their answer behavior.',
    createTitle: 'New queue',
    editTitle: 'Edit queue',
    dialogDescription: 'Maintain queue identity, strategy, media and limits.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No queues found.',
    deleteTitle: 'Delete queue',
    deleteMessage: 'Delete this queue? This also removes its members.',
    deleteSelectedTitle: 'Delete selected queues',
    deleteSelectedMessage: 'Delete {count} selected queues?',
    savedMessage: 'Queue saved successfully.',
    deletedMessage: 'Queue deleted successfully.',
    deleteFailedMessage: 'Failed to delete queue.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      routing: 'Routing',
      limits: 'Limits',
    },
    initialValues: {
      enabled: 1,
      pabxUUID: '',
      name: '',
      strategy: 'ring_all',
      timeoutSeconds: 30,
      retrySeconds: 5,
      maxWaitSeconds: 300,
      mediaFileUUID: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VpqName', uuidField: 'VpqUUID' },
      {
        id: 'pabx',
        label: 'PABX',
        kind: 'related',
        uuidField: 'VoipPabxAccountVpaUUID',
        lookupKey: 'pabxUUID',
      },
      { id: 'strategy', label: 'Strategy', kind: 'text', field: 'VpqStrategy', translateValue: true },
      { id: 'timeout', label: 'Timeout', kind: 'number', field: 'VpqTimeoutSeconds' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VpqEnabled' },
    ],
    fields: [
      { key: 'enabled', source: 'VpqEnabled', payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'pabxUUID',
        source: 'VoipPabxAccountVpaUUID',
        payloadKey: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        required: true,
        span: 1,
        quickCreate: { label: 'Create PABX', component: VoipPabxAccountQuickCreateHostComponent },
      },
      { key: 'name', source: 'VpqName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'strategy',
        source: 'VpqStrategy',
        payloadKey: 'strategy',
        label: 'Strategy',
        type: 'select',
        options: queueStrategies,
        translateOptions: true,
        tab: 'routing',
        span: 1,
      },
      {
        key: 'mediaFileUUID',
        source: 'VoipPabxMediaFileVmfUUID',
        payloadKey: 'mediaFileUUID',
        label: 'Media file',
        type: 'search-select',
        tab: 'routing',
        span: 1,
      },
      {
        key: 'timeoutSeconds',
        source: 'VpqTimeoutSeconds',
        payloadKey: 'timeoutSeconds',
        label: 'Timeout seconds',
        type: 'number',
        tab: 'limits',
        span: 1,
      },
      {
        key: 'retrySeconds',
        source: 'VpqRetrySeconds',
        payloadKey: 'retrySeconds',
        label: 'Retry seconds',
        type: 'number',
        tab: 'limits',
        span: 1,
      },
      {
        key: 'maxWaitSeconds',
        source: 'VpqMaxWaitSeconds',
        payloadKey: 'maxWaitSeconds',
        label: 'Max wait seconds',
        type: 'number',
        tab: 'limits',
        span: 1,
      },
    ],
    relatedCollections: [
      {
        key: 'queueMembers',
        label: 'Members',
        emptyLabel: 'No members linked',
        addLabel: 'Add',
        endpoint: (queueUUID) => `voip/pabx/queues/${queueUUID}/members`,
        deleteEndpoint: (queueUUID, row) =>
          `voip/pabx/queues/${queueUUID}/members/${row['VqmUUID']}`,
        uuidField: 'VqmUUID',
        initialValues: {
          enabled: 1,
          extensionUUID: '',
          priority: 0,
          penalty: 0,
        },
        fields: [
          { key: 'enabled', payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
          {
            key: 'extensionUUID',
            payloadKey: 'extensionUUID',
            label: 'Extension',
            type: 'search-select',
            required: true,
            span: 1,
          },
          {
            key: 'priority',
            payloadKey: 'priority',
            label: 'Priority',
            type: 'number',
            span: 1,
          },
          {
            key: 'penalty',
            payloadKey: 'penalty',
            label: 'Penalty',
            type: 'number',
            span: 1,
          },
        ],
        columns: [
          {
            id: 'extension',
            label: 'Extension',
            field: 'VoipPabxExtensionVpeUUID',
            kind: 'related',
            lookupKey: 'extensionUUID',
          },
          { id: 'priority', label: 'Priority', field: 'VqmPriority', kind: 'number' },
          { id: 'penalty', label: 'Penalty', field: 'VqmPenalty', kind: 'number' },
          { id: 'status', label: 'Status', field: 'VqmEnabled', kind: 'status' },
        ],
        payload: (values) => ({
          extensionUUID: values['extensionUUID'],
          priority: numberOrNull(values['priority']),
          penalty: numberOrNull(values['penalty']),
          enabled: Number(values['enabled']) === 1,
        }),
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-queue',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxQueuePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly mediaFileOptions = signal<ConfigurableCrudOption[]>([]);
  readonly extensionOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'mediaFileUUID', 'extensionUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'mediaFileUUID') return [{ value: '', label: 'None' }, ...this.mediaFileOptions()];
    if (key === 'extensionUUID') return this.extensionOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      mediaFileUUID: payload['mediaFileUUID'] || null,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [pabxs, mediaFiles, extensions] = await Promise.all([
        this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('voip/pabx/media-files?status=1', (row) =>
          option(row.uuid ?? row.VmfUUID, row.name ?? row.VmfName, [row.PabxName]),
        ),
        this.fetchPaged('voip/pabx/extensions?status=1', (row) =>
          option(row.VpeUUID, row.VpeUsername, [row.PabxName, row.CustomerName]),
        ),
      ]);
      this.pabxOptions.set(pabxs);
      this.mediaFileOptions.set(mediaFiles);
      this.extensionOptions.set(extensions);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return { value: normalizedValue, label: normalizedLabel, description, searchText: `${normalizedLabel} ${description} ${normalizedValue}` };
}

function numberOrNull(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}
