import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipDidOperatorItem } from './operator.service';

function isSystemScope() {
  return globalThis.location?.pathname.startsWith('/system/') ?? false;
}

function operatorConfig(system: boolean): ConfigurableCrudConfig {
  return {
    endpoint: system ? 'system/voip/did/operators' : 'voip/did/operators',
    uuidField: 'VdoUUID',
    pageTitle: 'DID operators',
    pageDescription: 'Manage DID carrier operators available to DID inventory and portability.',
    createTitle: 'New DID operator',
    editTitle: 'Edit DID operator',
    dialogDescription: 'Maintain DID operator identity and supplier linkage.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No DID operators found.',
    deleteTitle: 'Delete DID operator',
    deleteMessage: 'Are you sure you want to delete this DID operator?',
    deleteSelectedTitle: 'Delete selected DID operators',
    deleteSelectedMessage: 'Delete {count} selected DID operators?',
    savedMessage: 'DID operator saved successfully.',
    deletedMessage: 'DID operator deleted successfully.',
    deleteFailedMessage: 'Failed to delete DID operator.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    canCreate: system,
    canEdit: system,
    canDelete: system,
    bulkDelete: system,
    initialValues: {
      status: 1,
      name: '',
      nick: '',
      supplierUUID: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VdoName', uuidField: 'VdoUUID' },
      { id: 'nick', label: 'Nick', field: 'VdoNick' },
      { id: 'supplier', label: 'Supplier', field: 'SupplierName' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VdoStatus', className: 'status-col' },
    ],
    fields: [
      {
        key: 'status',
        source: 'VdoStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'name',
        source: 'VdoName',
        payloadKey: 'name',
        label: 'Name',
        required: true,
        span: 1,
      },
      {
        key: 'nick',
        source: 'VdoNick',
        payloadKey: 'nick',
        label: 'Nick',
        required: true,
        span: 1,
      },
      {
        key: 'supplierUUID',
        source: 'ErpSupplierSupUUID',
        payloadKey: 'supplierUUID',
        label: 'Supplier',
        type: 'search-select',
        span: 1,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-did-operator',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDidOperatorPage extends ConfigurableCrudPageBase<VoipDidOperatorItem> {
  private readonly rawApi = inject(ApiService);
  readonly supplierOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(operatorConfig(isSystemScope()));
    void this.loadSuppliers();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'supplierUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'supplierUUID') return this.supplierOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }

  private async loadSuppliers(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.supplierOptions.set(
        await fetchPaged(this.rawApi, 'erp/suppliers?status=1', (row) =>
          option(row.SupUUID ?? row.uuid, row.SupName ?? row.Name ?? row.name, [
            row.SupDocument ?? row.document,
            row.SupEmail ?? row.email,
          ]),
        ),
      );
    } catch {
      this.supplierOptions.set([]);
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

async function fetchPaged(
  api: ApiService,
  endpoint: string,
  mapItem: (row: any) => ConfigurableCrudOption | null,
): Promise<ConfigurableCrudOption[]> {
  const options: ConfigurableCrudOption[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const rows = extractItems(response);
    options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
    if (rows.length < 500) break;
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
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
