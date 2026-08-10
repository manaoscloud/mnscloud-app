import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/trunk-group-members',
  uuidField: 'uuid',
  pageTitle: 'Softswitch trunk group members',
  pageDescription: 'Attach trunks to routing groups with priority and weight.',
  createTitle: 'New trunk group member',
  editTitle: 'Edit trunk group member',
  dialogDescription: 'Maintain trunk group membership used by route failover.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No trunk group members found.',
  deleteTitle: 'Delete trunk group member',
  deleteMessage: 'Are you sure you want to delete this member?',
  deleteSelectedTitle: 'Delete selected trunk group members',
  deleteSelectedMessage: 'Delete {count} selected members?',
  savedMessage: 'Trunk group member saved successfully.',
  deletedMessage: 'Trunk group member deleted successfully.',
  deleteFailedMessage: 'Failed to delete trunk group member.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  tabLabels: {
    record: 'Record',
    routing: 'Routing',
    limits: 'Limits',
  },
  columns: [
    { id: 'name', label: 'Member', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'priority', label: 'Priority', field: 'priority' },
    { id: 'weight', label: 'Weight', field: 'weight' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    trunkGroupUUID: '',
    trunkUUID: '',
    priority: 100,
    weight: 100,
    maxConcurrentCalls: 0,
    status: 1,
  },
  fields: [
    {
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
      tab: 'record',
    },
    {
      key: 'trunkGroupUUID',
      source: 'trunkGroupUUID',
      payloadKey: 'trunkGroupUUID',
      label: 'Trunk group',
      type: 'search-select',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'trunkUUID',
      source: 'trunkUUID',
      payloadKey: 'trunkUUID',
      label: 'Trunk',
      type: 'search-select',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'priority',
      source: 'priority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'weight',
      source: 'weight',
      payloadKey: 'weight',
      label: 'Weight',
      type: 'number',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'maxConcurrentCalls',
      source: 'maxConcurrentCalls',
      payloadKey: 'maxConcurrentCalls',
      label: 'Maximum concurrent calls',
      type: 'number',
      span: 1,
      tab: 'limits',
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-trunk-group-member',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchTrunkGroupMemberPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly trunkGroupOptions = signal<ConfigurableCrudOption[]>([]);
  readonly trunkOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['trunkGroupUUID', 'trunkUUID'].includes(field.key) ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'trunkGroupUUID') return this.trunkGroupOptions();
    if (key === 'trunkUUID') return this.trunkOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) === 1 };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [groups, trunks] = await Promise.all([
        this.rawApi.get<any>('voip/softswitch/trunk-groups?status=1&limit=5000&offset=0'),
        this.rawApi.get<any>('voip/softswitch/trunks?status=1&limit=5000&offset=0'),
      ]);
      this.trunkGroupOptions.set(toOptions(groups, (row) => option(row.uuid, row.name, [row.accountName, row.strategy])));
      this.trunkOptions.set(toOptions(trunks, (row) => option(row.uuid, row.name, [row.accountName, row.host])));
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

function toOptions(response: any, mapItem: (row: any) => ConfigurableCrudOption | null): ConfigurableCrudOption[] {
  return extractItems(response).map(mapItem).filter(isOption).sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function option(value: unknown, label: unknown, descriptionParts: unknown[] = []): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts.map((item) => String(item ?? '').trim()).filter(Boolean).join(' - ');
  return { value: normalizedValue, label: normalizedLabel, description, searchText: `${normalizedLabel} ${description} ${normalizedValue}` };
}

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
