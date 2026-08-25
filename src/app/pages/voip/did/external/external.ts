import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudColumn,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipDidOperatorService } from '../operator/operator.service';
import { VoipDidExternalItem } from './external.service';

function isSystemScope() {
  return globalThis.location?.pathname.startsWith('/system/') ?? false;
}

function externalConfig(system: boolean): ConfigurableCrudConfig {
  return {
    endpoint: system ? 'system/voip/did/external' : 'voip/did/external',
    uuidField: 'VddUUID',
    pageTitle: 'External DID numbers',
    pageDescription: system
      ? 'Review tenant-owned external DID inventory.'
      : 'Manage external DID numbers owned by this tenant.',
    createTitle: 'New external DID',
    editTitle: 'Edit external DID',
    dialogDescription: 'Maintain DID number, status, provider, and notes.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No external DIDs found.',
    deleteTitle: 'Delete external DID',
    deleteMessage: 'Are you sure you want to delete this external DID?',
    deleteSelectedTitle: 'Delete selected external DIDs',
    deleteSelectedMessage: 'Delete {count} selected external DIDs?',
    savedMessage: 'External DID saved successfully.',
    deletedMessage: 'External DID deleted successfully.',
    deleteFailedMessage: 'Failed to delete external DID.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    canCreate: !system,
    canEdit: !system,
    canDelete: true,
    bulkDelete: false,
    tabLabels: {
      record: 'Record',
      notes: 'Notes',
    },
    initialValues: {
      status: 1,
      number: '',
      operatorUUID: '',
      notes: '',
    },
    columns: [
      { id: 'number', label: 'Number', kind: 'identity', field: 'VddNumber', uuidField: 'VddUUID' },
      {
        id: 'provider',
        label: 'Provider',
        kind: 'related',
        field: 'OperatorName',
        uuidField: 'VoipDidOperatorVdoUUID',
        lookupKey: 'VoipDidOperatorVdoUUID',
      },
      { id: 'tenant', label: 'Tenant', field: 'TenantName' },
      { id: 'billing', label: 'Billing', field: 'VddBillingStatus', translateValue: true },
      {
        id: 'status',
        label: 'Status',
        kind: 'status',
        field: 'VddStatus',
        className: 'status-col',
      },
    ],
    fields: [
      {
        key: 'status',
        source: 'VddStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        tab: 'record',
        span: 1,
      },
      {
        key: 'operatorUUID',
        source: 'VoipDidOperatorVdoUUID',
        payloadKey: 'operatorUUID',
        label: 'Provider',
        type: 'select',
        required: true,
        tab: 'record',
        span: 1,
      },
      {
        key: 'number',
        source: 'VddNumber',
        payloadKey: 'number',
        label: 'Number',
        required: true,
        tab: 'record',
        span: 1,
      },
      {
        key: 'notes',
        source: 'VddNotes',
        payloadKey: 'notes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-did-external',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDidExternalPage extends ConfigurableCrudPageBase<VoipDidExternalItem> {
  private readonly operatorApi = inject(VoipDidOperatorService);
  readonly operatorOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(externalConfig(isSystemScope()));
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'operatorUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'operatorUUID' ? this.operatorOptions() : [];
  }

  override columnMain(row: VoipDidExternalItem, column: ConfigurableCrudColumn): string {
    if (column.id === 'provider') {
      const name =
        text(row.OperatorName) || this.lookupLabel('operatorUUID', row.VoipDidOperatorVdoUUID);
      return name || '-';
    }
    return super.columnMain(row, column);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const number = firstText(payload, ['number', 'VddNumber']).replace(/\D+/g, '');
    const operatorUUID = firstText(payload, [
      'operatorUUID',
      'VoipDidOperatorVdoUUID',
      'providerUUID',
      'provider',
    ]);
    const statusValue = payload['status'] ?? payload['VddStatus'];
    return {
      ...payload,
      number,
      status: Number(statusValue) === 1 ? 1 : 0,
      operatorUUID,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.operatorApi.list({ status: 1, limit: 5000 }, false);
      this.operatorOptions.set(
        extractItems(response)
          .map((row) => option(row.VdoUUID, row.VdoName, [row.VdoNick]))
          .filter(isOption)
          .sort((left, right) => left.label.localeCompare(right.label)),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
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
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
  return { value: normalizedValue, label: normalizedLabel, description };
}

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function firstText(payload: ConfigurableCrudRecord, keys: string[]): string {
  for (const key of keys) {
    const value = payload[key];
    const normalized = String(value ?? '').trim();
    if (normalized) return normalized;
  }
  return '';
}
