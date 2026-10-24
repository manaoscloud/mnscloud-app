import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { DID_NUMBER_INPUT_ERRORS, parseDidNumberInput } from '../did-number-input';
import { VoipDidOperatorService } from '../operator/operator.service';
import { VoipDidExternalItem, VoipDidExternalService } from './external.service';

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
        labelWhen: ({ editing }) => (editing ? 'Number' : 'Number or range'),
        help: 'One DID number, or a range of up to 100 numbers as start-end (same number of digits). Example: 559230423000-559230423049.',
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
  private readonly externalApi = inject(VoipDidExternalService);
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

  /** While creating, the label shows the size of a detected range as the user types. */
  override translatedFieldLabel(field: ConfigurableCrudField): string {
    if (field.key === 'number' && !this.editingRecord()) {
      const input = parseDidNumberInput(this.formValues()['number']);
      if (input.kind === 'range')
        return this.t('Number range ({total} DIDs)', { total: input.total });
    }
    return super.translatedFieldLabel(field);
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (this.saving()) return;
    const input = parseDidNumberInput(this.formValues()['number']);
    if (input.kind === 'invalid') {
      this.clearFieldErrors(null);
      this.rejectField('number', DID_NUMBER_INPUT_ERRORS[input.reason]);
      return;
    }
    if (input.kind === 'range' && this.editingRecord()) {
      this.clearFieldErrors(null);
      this.rejectField('number', 'A DID range can only be used when creating DIDs.');
      return;
    }
    if (input.kind !== 'range') {
      await super.saveItem(saveAndNew);
      return;
    }
    await this.saveRange(input.start, input.end, saveAndNew);
  }

  /** Preview (conflicts and prepaid cost), confirmation, then one all-or-nothing create. */
  private async saveRange(start: string, end: string, saveAndNew: boolean): Promise<void> {
    const values = this.formValues();
    const operatorUUID = String(values['operatorUUID'] ?? '').trim();
    this.clearFieldErrors(null);
    if (!operatorUUID) {
      this.rejectField('operatorUUID', 'Provider is required.');
      return;
    }
    const request = {
      rangeStart: start,
      rangeEnd: end,
      operatorUUID,
      status: Number(values['status'] ?? 1) === 1 ? 1 : 0,
      notes: String(values['notes'] ?? '').trim() || null,
    };

    this.saving.set(true);
    try {
      const preview = (await this.externalApi.createRange({ ...request, dryRun: true }))?.data
        ?.preview;
      if (!preview) throw new Error('Failed to preview the DID range.');
      if (preview.conflicts.length) {
        const shown = preview.conflicts.slice(0, 5).join(', ');
        const more = preview.conflicts.length > 5 ? ` (+${preview.conflicts.length - 5})` : '';
        this.rejectField('number', 'These DID numbers already exist: {numbers}', {
          numbers: `${shown}${more}`,
        });
        return;
      }
      const money = (amount: number) => formatMoney(amount, preview.currency);
      if (!preview.creditSufficient) {
        this.snack.error(
          this.t(
            'Insufficient prepaid credit for {total} DIDs: {required} needed, {available} available.',
            {
              total: preview.total,
              required: money(preview.requiredAmount),
              available: money(preview.availableBalance),
            },
          ),
        );
        return;
      }
      this.saving.set(false);
      const provider = this.lookupLabel('operatorUUID', operatorUUID);
      const confirmed = await this.confirmAction(
        'Create DID range',
        this.t(
          'Create {total} DIDs from {start} to {end} with provider {provider}? Prepaid charge now: {required} ({unit} per DID).',
          {
            total: preview.total,
            start,
            end,
            provider,
            required: money(preview.requiredAmount),
            unit: money(preview.unitAmount),
          },
        ),
        'Create',
      );
      if (!confirmed) return;
      this.saving.set(true);
      const created = (await this.externalApi.createRange({ ...request, dryRun: false }))?.data
        ?.items;
      this.snack.success(
        this.t('{total} external DIDs created successfully.', {
          total: created?.length ?? preview.total,
        }),
      );
      this.refreshList();
      if (saveAndNew) {
        this.formValues.set({ ...this.config.initialValues, operatorUUID });
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
