import { Component, inject, signal } from '@angular/core';

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

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const groupStrategies: ConfigurableCrudOption[] = [
  { value: 'simultaneous', label: 'Simultaneous' },
  { value: 'sequence', label: 'Sequence' },
];

const config: ConfigurableCrudConfig = {
  endpoint: 'voip/pabx/groups',
  uuidField: 'VpgUUID',
  pageTitle: 'Groups',
  pageDescription: 'Manage PABX groups routing records.',
  createTitle: 'New group',
  editTitle: 'Edit group',
  dialogDescription: 'Maintain routing identity, behavior and status.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No groups found.',
  deleteTitle: 'Delete group',
  deleteMessage: 'Delete this group?',
  deleteSelectedTitle: 'Delete selected groups',
  deleteSelectedMessage: 'Delete {count} selected groups?',
  savedMessage: 'Group saved successfully.',
  deletedMessage: 'Group deleted successfully.',
  deleteFailedMessage: 'Failed to delete group.',
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
  initialValues: {
    enabled: 1,
    pabxUUID: '',
    name: '',
    ringStrategy: 'simultaneous',
    timeoutSeconds: 30,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VpgName', uuidField: 'VpgUUID' },
    {
      id: 'pabx',
      label: 'PABX',
      kind: 'related',
      uuidField: 'VoipPabxAccountVpaUUID',
      lookupKey: 'pabxUUID',
    },
    {
      id: 'strategy',
      label: 'Ring strategy',
      kind: 'text',
      field: 'VpgRingStrategy',
      translateValue: true,
    },
    { id: 'timeout', label: 'Timeout', kind: 'number', field: 'VpgRingTimeoutSeconds' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VpgEnabled' },
  ],
  fields: [
    {
      key: 'enabled',
      source: 'VpgEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
    },
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
    { key: 'name', source: 'VpgName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'ringStrategy',
      source: 'VpgRingStrategy',
      payloadKey: 'ringStrategy',
      label: 'Ring strategy',
      type: 'select',
      options: groupStrategies,
      translateOptions: true,
      tab: 'routing',
      span: 1,
    },
    {
      key: 'timeoutSeconds',
      source: 'VpgRingTimeoutSeconds',
      payloadKey: 'ringTimeoutSeconds',
      label: 'Ring timeout seconds',
      type: 'number',
      tab: 'limits',
      span: 1,
    },
  ],
  relatedCollections: [
    {
      key: 'groupMembers',
      label: 'Members',
      emptyLabel: 'No members linked',
      addLabel: 'Add',
      endpoint: (groupUUID) => `voip/pabx/groups/${groupUUID}/members`,
      deleteEndpoint: (groupUUID, row) => `voip/pabx/groups/${groupUUID}/members/${row['VgmUUID']}`,
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
  ] satisfies readonly ConfigurableCrudRelatedCollection[],
};

@Component({
  selector: 'app-voip-pabx-routing',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxRoutingPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly extensionOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config);
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'extensionUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'extensionUUID') return this.extensionOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, enabled: Number(payload['enabled']) === 1 };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [pabxs, extensions] = await Promise.all([
        this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('voip/pabx/extensions?status=1', (row) =>
          option(row.VpeUUID, row.VpeUsername, [row.PabxName, row.CustomerName]),
        ),
      ]);
      this.pabxOptions.set(pabxs);
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
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}

function numberOrNull(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}
