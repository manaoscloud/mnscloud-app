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

type RouteTargetType = 'extension' | 'group' | 'queue' | 'ivr';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const routeTypes: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'group', label: 'Group' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/inbound-routes',
    uuidField: 'uuid',
    pageTitle: 'PABX DID Routes',
    pageDescription: 'Publish contracted or validated external DIDs to PABX routing targets.',
    createTitle: 'New inbound route',
    editTitle: 'Edit inbound route',
    dialogDescription: 'Maintain DID publication and inbound routing target for this PABX.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No inbound routes found.',
    deleteTitle: 'Delete inbound route',
    deleteMessage: 'Delete this inbound route?',
    deleteSelectedTitle: 'Delete selected inbound routes',
    deleteSelectedMessage: 'Delete {count} selected inbound routes?',
    savedMessage: 'Inbound route saved successfully.',
    deletedMessage: 'Inbound route deleted successfully.',
    deleteFailedMessage: 'Failed to delete inbound route.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      routing: 'Routing',
    },
    initialValues: {
      enabled: 1,
      pabxUUID: '',
      didUUID: '',
      name: '',
      pattern: '',
      routeType: 'extension',
      routeTargetUUID: '',
      priority: 100,
      context: 'default',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      {
        id: 'pabx',
        label: 'PABX',
        kind: 'related',
        uuidField: 'pabxUUID',
        lookupKey: 'pabxUUID',
      },
      { id: 'did', label: 'DID', kind: 'text', field: 'didNumber' },
      { id: 'routeType', label: 'Route type', kind: 'text', field: 'routeType', translateValue: true },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'pabxUUID',
        source: 'pabxUUID',
        payloadKey: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        required: true,
        span: 1,
        quickCreate: { label: 'Create PABX', component: VoipPabxAccountQuickCreateHostComponent },
      },
      {
        key: 'didUUID',
        source: 'didUUID',
        payloadKey: 'didUUID',
        label: 'DID',
        type: 'search-select',
        required: true,
        span: 1,
      },
      { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'pattern',
        source: 'pattern',
        payloadKey: 'pattern',
        label: 'Pattern',
        tab: 'routing',
        hidden: true,
        span: 1,
      },
      {
        key: 'routeType',
        source: 'routeType',
        payloadKey: 'routeType',
        label: 'Route type',
        type: 'select',
        options: routeTypes,
        translateOptions: true,
        required: true,
        tab: 'routing',
        span: 1,
      },
      {
        key: 'routeTargetUUID',
        source: 'routeTargetUUID',
        payloadKey: 'routeTargetUUID',
        label: 'Destination',
        type: 'search-select',
        required: true,
        tab: 'routing',
        span: 1,
      },
      {
        key: 'priority',
        source: 'priority',
        payloadKey: 'priority',
        label: 'Priority',
        type: 'number',
        tab: 'routing',
        span: 1,
      },
      {
        key: 'context',
        source: 'context',
        payloadKey: 'context',
        label: 'Context',
        hidden: true,
        span: 1,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-trunk-route',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxTrunkRoutePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly didOptions = signal<ConfigurableCrudOption[]>([]);
  readonly routeTargetOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadPabxOptions();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'didUUID', 'routeTargetUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'didUUID') return this.didOptions();
    if (key === 'routeTargetUUID') return this.routeTargetOptions();
    return [];
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'pabxUUID') {
      this.patchFormValues({ didUUID: '', routeTargetUUID: '' });
      void this.loadDependentLookups();
    }
    if (key === 'routeType') {
      this.patchFormValues({ routeTargetUUID: '' });
      void this.loadRouteTargets();
    }
    if (key === 'didUUID') this.applyDidDefaults(value);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const did = this.didOptions().find((item) => String(item.value) === String(payload['didUUID'] ?? ''));
    const didNumber = String(did?.label ?? '').trim();
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      trunkUUID: null,
      pattern: didNumber ? `^${didNumber}$` : null,
      routeTargetValue: null,
      context: 'default',
    };
  }

  protected override async afterQuickCreate(
    field: ConfigurableCrudField,
    option: ConfigurableCrudOption,
  ): Promise<void> {
    if (field.key === 'pabxUUID') {
      this.pabxOptions.update((items) => mergeOption(items, option));
      await this.loadDependentLookups();
    }
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    void this.loadDependentLookups(String(row['didUUID'] ?? ''));
  }

  private async loadPabxOptions(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      this.pabxOptions.set(
        await this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
      );
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async loadDependentLookups(includeDidUUID = ''): Promise<void> {
    await Promise.all([this.loadDids(includeDidUUID), this.loadRouteTargets()]);
  }

  private async loadDids(includeDidUUID = ''): Promise<void> {
    const pabxUUID = String(this.formValues()['pabxUUID'] ?? '');
    if (!pabxUUID) {
      this.didOptions.set([]);
      return;
    }
    const params = new URLSearchParams({ pabxUUID, limit: '5000' });
    if (includeDidUUID) params.set('includeDidUUID', includeDidUUID);
    const response = await this.rawApi.get<any>(
      `voip/pabx/inbound-routes/available-dids?${params.toString()}`,
    );
    this.didOptions.set(
      extractItems(response).map((row) =>
        option(row.VddUUID, row.VddNumber, [row.CustomerName]),
      ).filter(Boolean) as ConfigurableCrudOption[],
    );
  }

  private async loadRouteTargets(): Promise<void> {
    const pabxUUID = String(this.formValues()['pabxUUID'] ?? '');
    const routeType = String(this.formValues()['routeType'] ?? 'extension') as RouteTargetType;
    if (!pabxUUID) {
      this.routeTargetOptions.set([]);
      return;
    }
    const endpoint = targetEndpoint(routeType);
    const response = await this.rawApi.get<any>(
      `voip/pabx/${endpoint}?limit=5000&pabxUUID=${encodeURIComponent(pabxUUID)}`,
    );
    this.routeTargetOptions.set(
      extractItems(response).map((row) => targetOption(routeType, row)).filter(Boolean) as ConfigurableCrudOption[],
    );
  }

  private applyDidDefaults(value: unknown): void {
    const did = this.didOptions().find((item) => String(item.value) === String(value ?? ''));
    if (!did) return;
    const currentName = String(this.formValues()['name'] ?? '').trim();
    const didNumber = did.label;
    this.patchFormValues({
      name: currentName || `DID ${didNumber}`,
      pattern: String(did.description ?? '').split(' - ').pop() || `^${didNumber}$`,
    });
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

function targetEndpoint(routeType: RouteTargetType): string {
  if (routeType === 'group') return 'groups';
  if (routeType === 'queue') return 'queues';
  if (routeType === 'ivr') return 'ivrs';
  return 'extensions';
}

function targetOption(routeType: RouteTargetType, row: any): ConfigurableCrudOption | null {
  if (routeType === 'group') return option(row.VpgUUID ?? row.uuid, row.VpgName ?? row.name, [row.PabxName]);
  if (routeType === 'queue') return option(row.VpqUUID ?? row.uuid, row.VpqName ?? row.name, [row.PabxName]);
  if (routeType === 'ivr') return option(row.VpiUUID ?? row.uuid, row.VpiName ?? row.name, [row.PabxName]);
  return option(row.VpeUUID ?? row.uuid, row.VpeUsername ?? row.username, [row.PabxName, row.DomainName]);
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

function mergeOption(
  items: readonly ConfigurableCrudOption[],
  option: ConfigurableCrudOption,
): ConfigurableCrudOption[] {
  if (items.some((item) => item.value === option.value)) return [...items];
  return [...items, option].sort((left, right) => left.label.localeCompare(right.label));
}
