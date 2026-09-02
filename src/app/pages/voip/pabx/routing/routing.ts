import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxAccountQuickCreateHostComponent } from '../account/account';

type RoutingResource = 'group' | 'queue' | 'ivr';

const endpoints: Record<RoutingResource, string> = {
  group: 'voip/pabx/groups',
  queue: 'voip/pabx/queues',
  ivr: 'voip/pabx/ivrs',
};

const uuidFields: Record<RoutingResource, string> = {
  group: 'VpgUUID',
  queue: 'VpqUUID',
  ivr: 'VpiUUID',
};

const nameFields: Record<RoutingResource, string> = {
  group: 'VpgName',
  queue: 'VpqName',
  ivr: 'VpiName',
};

const statusFields: Record<RoutingResource, string> = {
  group: 'VpgEnabled',
  queue: 'VpqEnabled',
  ivr: 'VpiEnabled',
};

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const groupStrategies: ConfigurableCrudOption[] = [
  { value: 'simultaneous', label: 'Simultaneous' },
  { value: 'sequence', label: 'Sequence' },
];

const queueStrategies: ConfigurableCrudOption[] = [
  { value: 'ring_all', label: 'Ring all' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'least_recent', label: 'Least recent' },
  { value: 'fewest_calls', label: 'Fewest calls' },
  { value: 'random', label: 'Random' },
];

function config(resource: RoutingResource): ConfigurableCrudConfig {
  const title = resourceTitle(resource);
  return {
    endpoint: endpoints[resource],
    uuidField: uuidFields[resource],
    pageTitle: title,
    pageDescription: `Manage PABX ${title.toLowerCase()} routing records.`,
    createTitle: `New ${singular(resource)}`,
    editTitle: `Edit ${singular(resource)}`,
    dialogDescription: 'Maintain routing identity, behavior and status.',
    searchPlaceholder: 'Search',
    emptyLabel: `No ${title.toLowerCase()} found.`,
    deleteTitle: `Delete ${singular(resource)}`,
    deleteMessage: `Delete this ${singular(resource)}?`,
    deleteSelectedTitle: `Delete selected ${title.toLowerCase()}`,
    deleteSelectedMessage: `Delete {count} selected ${title.toLowerCase()}?`,
    savedMessage: `${singular(resource)} saved successfully.`,
    deletedMessage: `${singular(resource)} deleted successfully.`,
    deleteFailedMessage: `Failed to delete ${singular(resource)}.`,
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      routing: 'Routing',
      limits: 'Limits',
      notes: 'Notes',
    },
    initialValues: initialValues(resource),
    columns: columns(resource),
    fields: fields(resource),
    relatedCollections: relatedCollections(resource),
  };
}

function initialValues(resource: RoutingResource): ConfigurableCrudRecord {
  return {
    enabled: 1,
    pabxUUID: '',
    name: '',
    number: '',
    callerId: '',
    dialPrefix: '',
    ringStrategy: 'simultaneous',
    strategy: 'ring_all',
    timeoutSeconds: resource === 'ivr' ? 10 : 30,
    retrySeconds: 5,
    maxWaitSeconds: 300,
    invalidRetries: 3,
    mediaFileUUID: '',
    greetingText: '',
  };
}

function columns(resource: RoutingResource): ConfigurableCrudConfig['columns'] {
  const statusField = statusFields[resource];
  const base: NonNullable<ConfigurableCrudConfig['columns']>[number][] = [
    { id: 'name', label: 'Name', kind: 'identity', field: nameFields[resource], uuidField: uuidFields[resource] },
    { id: 'pabx', label: 'PABX', kind: 'related', uuidField: 'VoipPabxAccountVpaUUID', lookupKey: 'pabxUUID' },
  ];
  if (resource === 'group') {
    base.push({ id: 'strategy', label: 'Ring strategy', kind: 'text', field: 'VpgRingStrategy', translateValue: true });
  }
  if (resource === 'queue') {
    base.push({ id: 'strategy', label: 'Strategy', kind: 'text', field: 'VpqStrategy', translateValue: true });
  }
  if (resource === 'ivr') {
    base.push({ id: 'retries', label: 'Invalid retries', kind: 'number', field: 'VpiInvalidRetries' });
  }
  base.push({ id: 'timeout', label: 'Timeout', kind: 'number', field: timeoutField(resource) });
  base.push({ id: 'status', label: 'Status', kind: 'status', field: statusField });
  return base;
}

function fields(resource: RoutingResource): ConfigurableCrudConfig['fields'] {
  const result: NonNullable<ConfigurableCrudConfig['fields']>[number][] = [
    { key: 'enabled', source: statusFields[resource], payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
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
    { key: 'name', source: nameFields[resource], payloadKey: 'name', label: 'Name', required: true, span: 1 },
  ];


  if (resource === 'group') {
    result.push(
      { key: 'ringStrategy', source: 'VpgRingStrategy', payloadKey: 'ringStrategy', label: 'Ring strategy', type: 'select', options: groupStrategies, translateOptions: true, tab: 'routing', span: 1 },
      { key: 'timeoutSeconds', source: 'VpgRingTimeoutSeconds', payloadKey: 'ringTimeoutSeconds', label: 'Ring timeout seconds', type: 'number', tab: 'limits', span: 1 },
    );
  }

  if (resource === 'queue') {
    result.push(
      { key: 'strategy', source: 'VpqStrategy', payloadKey: 'strategy', label: 'Strategy', type: 'select', options: queueStrategies, translateOptions: true, tab: 'routing', span: 1 },
      { key: 'mediaFileUUID', source: 'VoipPabxMediaFileVmfUUID', payloadKey: 'mediaFileUUID', label: 'Media file', type: 'search-select', tab: 'routing', span: 1 },
      { key: 'timeoutSeconds', source: 'VpqTimeoutSeconds', payloadKey: 'timeoutSeconds', label: 'Timeout seconds', type: 'number', tab: 'limits', span: 1 },
      { key: 'retrySeconds', source: 'VpqRetrySeconds', payloadKey: 'retrySeconds', label: 'Retry seconds', type: 'number', tab: 'limits', span: 1 },
      { key: 'maxWaitSeconds', source: 'VpqMaxWaitSeconds', payloadKey: 'maxWaitSeconds', label: 'Max wait seconds', type: 'number', tab: 'limits', span: 1 },
    );
  }

  if (resource === 'ivr') {
    result.push(
      { key: 'mediaFileUUID', source: 'VoipPabxMediaFileVmfUUID', payloadKey: 'mediaFileUUID', label: 'Media file', type: 'search-select', tab: 'routing', span: 1 },
      { key: 'timeoutSeconds', source: 'VpiTimeoutSeconds', payloadKey: 'timeoutSeconds', label: 'Timeout seconds', type: 'number', tab: 'routing', span: 1 },
      { key: 'invalidRetries', source: 'VpiInvalidRetries', payloadKey: 'invalidRetries', label: 'Invalid retries', type: 'number', tab: 'routing', span: 1 },
      { key: 'greetingText', source: 'VpiGreetingText', payloadKey: 'greetingText', label: 'Greeting text', type: 'textarea', tab: 'notes', span: 4, rows: 4 },
    );
  }

  return result;
}

function relatedCollections(resource: RoutingResource): readonly ConfigurableCrudRelatedCollection[] {
  if (resource !== 'group') return [];
  return [
    {
      key: 'groupMembers',
      label: 'Members',
      emptyLabel: 'No members linked',
      addLabel: 'Add',
      endpoint: (groupUUID) => `voip/pabx/groups/${groupUUID}/members`,
      deleteEndpoint: (groupUUID, row) =>
        `voip/pabx/groups/${groupUUID}/members/${row['VgmUUID']}`,
      uuidField: 'VgmUUID',
      initialValues: {
        enabled: 1,
        extensionUUID: '',
        priority: 0,
        delaySeconds: 0,
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
          key: 'delaySeconds',
          payloadKey: 'delaySeconds',
          label: 'Delay seconds',
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
        { id: 'priority', label: 'Priority', field: 'VgmPriority', kind: 'number' },
        { id: 'delay', label: 'Delay seconds', field: 'VgmDelaySeconds', kind: 'number' },
        { id: 'status', label: 'Status', field: 'VgmEnabled', kind: 'status' },
      ],
      payload: (values) => ({
        extensionUUID: values['extensionUUID'],
        priority: numberOrNull(values['priority']),
        delaySeconds: numberOrNull(values['delaySeconds']),
        enabled: Number(values['enabled']) === 1,
      }),
    },
  ];
}

@Component({
  selector: 'app-voip-pabx-routing',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxRoutingPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly resource = routeResource();
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly mediaFileOptions = signal<ConfigurableCrudOption[]>([]);
  readonly extensionOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config(routeResource()));
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
    const next: ConfigurableCrudRecord = {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      mediaFileUUID: payload['mediaFileUUID'] || null,
    };
    if (this.resource === 'ivr') next['greetingText'] = text(payload['greetingText']);
    return next;
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const endpointsToFetch = [
        this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
      ];
      if (this.resource === 'group') {
        endpointsToFetch.push(
          this.fetchPaged('voip/pabx/extensions?status=1', (row) =>
            option(row.VpeUUID, row.VpeUsername, [row.PabxName, row.CustomerName]),
          ),
        );
      }
      if (this.resource === 'queue' || this.resource === 'ivr') {
        endpointsToFetch.push(
          this.fetchPaged('voip/pabx/media-files?status=1', (row) =>
            option(row.uuid ?? row.VmfUUID, row.name ?? row.VmfName, [row.PabxName]),
          ),
        );
      }
      const [pabxs, second = [], third = []] = await Promise.all(endpointsToFetch);
      this.pabxOptions.set(pabxs);
      if (this.resource === 'group') {
        this.extensionOptions.set(second);
      } else {
        this.mediaFileOptions.set(second);
        this.extensionOptions.set(third);
      }
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

function routeResource(): RoutingResource {
  const value = inject(ActivatedRoute).snapshot.data?.['resource'];
  return ['group', 'queue', 'ivr'].includes(String(value))
    ? (value as RoutingResource)
    : 'group';
}

function resourceTitle(resource: RoutingResource): string {
  if (resource === 'group') return 'Groups';
  if (resource === 'queue') return 'Queues';
  return 'IVRs';
}

function singular(resource: RoutingResource): string {
  if (resource === 'group') return 'group';
  if (resource === 'queue') return 'queue';
  return 'IVR';
}

function timeoutField(resource: RoutingResource): string {
  if (resource === 'group') return 'VpgRingTimeoutSeconds';
  if (resource === 'queue') return 'VpqTimeoutSeconds';
  return 'VpiTimeoutSeconds';
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
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

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}

function numberOrNull(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}
