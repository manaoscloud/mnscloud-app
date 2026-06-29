import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipDidItem, VoipDidService } from './did.service';

function isSystemScope() {
  return globalThis.location?.pathname.startsWith('/system/') ?? false;
}

function didConfig(system: boolean): ConfigurableCrudConfig {
  return {
    endpoint: system ? 'system/voip/did/numbers' : 'voip/did/numbers',
    uuidField: 'VddUUID',
    pageTitle: 'DID numbers',
    pageDescription: system
      ? 'Manage global DID stock and operator assignment.'
      : 'Manage DID numbers contracted by this tenant.',
    createTitle: 'New DID number',
    editTitle: 'Edit DID number',
    dialogDescription: 'Maintain DID number identity and operator assignment.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No DID numbers found.',
    deleteTitle: 'Delete DID number',
    deleteMessage: 'Are you sure you want to delete this DID number?',
    deleteSelectedTitle: 'Delete selected DID numbers',
    deleteSelectedMessage: 'Delete {count} selected DID numbers?',
    savedMessage: 'DID number saved successfully.',
    deletedMessage: 'DID number deleted successfully.',
    deleteFailedMessage: 'Failed to delete DID number.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    canCreate: system,
    canEdit: system,
    canDelete: system,
    bulkDelete: system,
    rowActions: system ? [] : [{ key: 'release', label: 'Release DID', icon: 'link_off' }],
    initialValues: {
      status: 1,
      number: '',
      operatorUUID: '',
    },
    columns: [
      { id: 'number', label: 'Number', kind: 'identity', field: 'VddNumber', uuidField: 'VddUUID' },
      {
        id: 'operator',
        label: 'Operator',
        kind: 'related',
        uuidField: 'VoipDidOperatorVdoUUID',
        lookupKey: 'operatorUUID',
      },
      { id: 'customer', label: 'Customer', field: 'CustomerName' },
      { id: 'available', label: 'Available', field: 'IsAvailable' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VddStatus', className: 'status-col' },
    ],
    fields: [
      {
        key: 'status',
        source: 'VddStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'operatorUUID',
        source: 'VoipDidOperatorVdoUUID',
        payloadKey: 'operatorUUID',
        label: 'Operator',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'number',
        source: 'VddNumber',
        payloadKey: 'number',
        label: 'Number',
        required: true,
        span: 1,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-did',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDidPage extends ConfigurableCrudPageBase<VoipDidItem> {
  private readonly rawApi = inject(ApiService);
  private readonly didApi = inject(VoipDidService);
  private readonly system = isSystemScope();

  readonly operatorOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(didConfig(isSystemScope()));
    void this.loadOperators();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'operatorUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'operatorUUID') return this.operatorOptions();
    return [];
  }

  override rowActions(row: VoipDidItem): readonly ConfigurableCrudRowAction[] {
    if (this.system) return [];
    return row.VoipDidAssignmentVdaUUID || row.CustomerCusUUID || row.UserUsrUUID
      ? [{ key: 'release', label: 'Release DID', icon: 'link_off' }]
      : [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipDidItem) {
    if (action.key !== 'release') return;
    const confirmed = await this.confirmAction(
      'Release DID',
      `Release "${row.VddNumber}" from this tenant? Billing for this DID will be cancelled when the release succeeds.`,
      'Release',
    );
    if (!confirmed) return;
    await this.didApi.release(row.VddUUID);
    this.snack.success('DID released successfully.');
    this.refreshList();
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      status: Number(payload['status']),
      number: String(payload['number'] ?? '').replace(/\D+/g, ''),
    };
  }

  override columnText(row: VoipDidItem, column: ConfigurableCrudColumn): string {
    if ((column.field ?? column.id) === 'IsAvailable') {
      return Number(row.IsAvailable ?? 0) === 1 ? 'Yes' : 'No';
    }
    return super.columnText(row, column);
  }

  private async loadOperators(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.operatorOptions.set(
        await fetchPaged(this.rawApi, 'voip/did/operators?status=1', (row) =>
          option(row.VdoUUID, row.VdoName, [row.VdoNick, row.SupplierName]),
        ),
      );
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
