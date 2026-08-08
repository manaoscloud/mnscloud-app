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
  const isRangeCreate = (values: ConfigurableCrudRecord) => values['createMode'] === 'range';
  const isSingleCreate = (values: ConfigurableCrudRecord) => values['createMode'] !== 'range';

  return {
    endpoint: system ? 'system/voip/did/numbers' : 'voip/did/numbers',
    uuidField: 'VddUUID',
    pageTitle: 'DID numbers',
    pageDescription: system
      ? 'Manage global DID stock and DID operator assignment.'
      : 'Manage DID numbers contracted by this tenant.',
    createTitle: 'New DID number',
    editTitle: 'Edit DID number',
    dialogDescription: 'Maintain DID number identity and DID operator assignment.',
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
    rowActions: system
      ? []
      : [
          { key: 'claim', label: 'Contract DID', icon: 'add_shopping_cart' },
          { key: 'release', label: 'Release DID', icon: 'link_off' },
        ],
    listFilters: system
      ? []
      : [
          {
            key: 'didView',
            label: 'View',
            type: 'select',
            span: 1,
            options: [
              { value: 'contracted', label: 'Contracted DIDs' },
              { value: 'available', label: 'Available DIDs' },
            ],
          },
        ],
    initialValues: {
      status: 1,
      createMode: 'single',
      number: '',
      didRange: '',
      operatorUUID: '',
    },
    columns: [
      { id: 'number', label: 'Number', kind: 'identity', field: 'VddNumber', uuidField: 'VddUUID' },
      {
        id: 'operator',
        label: 'DID operator',
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
        key: 'createMode',
        payloadKey: 'createMode',
        label: 'Create mode',
        type: 'select',
        options: [
          { value: 'single', label: 'Unit' },
          { value: 'range', label: 'Range' },
        ],
        hiddenWhen: ({ editing }) => editing || !system,
        requiredWhen: ({ editing }) => !editing && system,
        span: 1,
      },
      {
        key: 'operatorUUID',
        source: 'VoipDidOperatorVdoUUID',
        payloadKey: 'operatorUUID',
        label: 'DID operator',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'number',
        source: 'VddNumber',
        payloadKey: 'number',
        label: 'Number',
        hiddenWhen: ({ editing, values }) => !editing && system && isRangeCreate(values),
        requiredWhen: ({ editing, values }) => editing || !system || isSingleCreate(values),
        placeholder: '5511999999999',
        span: 1,
      },
      {
        key: 'didRange',
        payloadKey: 'didRange',
        label: 'Number range',
        hiddenWhen: ({ editing, values }) => editing || !system || isSingleCreate(values),
        requiredWhen: ({ editing, values }) => !editing && system && isRangeCreate(values),
        placeholder: '551140000000-551140000099',
        span: 2,
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
    if (!this.system) {
      this.listFilterValues.set({ didView: 'contracted' });
      this.appliedFilters.set({
        search: '',
        status: '',
        extra: { didView: 'contracted' },
      });
    }
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
    if (Number(row.IsAvailable ?? 0) === 1) {
      return [{ key: 'claim', label: 'Contract DID', icon: 'add_shopping_cart' }];
    }
    return row.VoipDidAssignmentVdaUUID || row.CustomerCusUUID || row.UserUsrUUID
      ? [{ key: 'release', label: 'Release DID', icon: 'link_off' }]
      : [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: VoipDidItem) {
    if (action.key === 'claim') {
      await this.claimDid(row);
      return;
    }
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

  protected override async fetchItems(filters: {
    search: string;
    status: '' | string | number;
    extra: Record<string, string | number | boolean | null>;
  }): Promise<VoipDidItem[]> {
    if (this.system || filters.extra['didView'] !== 'available') {
      return super.fetchItems(filters);
    }

    const response = await this.didApi.available({
      search: filters.search,
      status: filters.status === '' ? undefined : Number(filters.status),
      limit: this.listLimit,
      offset: 0,
    });
    return extractItems(response) as VoipDidItem[];
  }

  private async claimDid(row: VoipDidItem): Promise<void> {
    const confirmed = await this.confirmAction(
      'Contract DID',
      this.t('Contract DID confirmation', { number: row.VddNumber }),
      'Contract',
    );
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.didApi.claim(row.VddUUID);
      this.snack.success('DID contracted successfully.');
      this.listFilterValues.set({ ...this.listFilterValues(), didView: 'contracted' });
      this.appliedFilters.set({
        search: this.search().trim(),
        status: this.status(),
        extra: { ...this.listFilterValues(), didView: 'contracted' },
      });
      this.refreshList();
    } catch (error) {
      this.snack.error(this.didErrorMessage(error));
    } finally {
      this.mutating.set(false);
    }
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (!this.system || this.editingRecord() || this.formValues()['createMode'] !== 'range') {
      await super.saveItem(saveAndNew);
      return;
    }

    const values = this.formValues();
    const operatorUUID = String(values['operatorUUID'] ?? '').trim();
    const status = Number(values['status'] ?? 1);
    const parsedRange = this.parseRange(String(values['didRange'] ?? ''));

    if (!operatorUUID || !parsedRange) {
      this.snack.warning('Required fields are missing.');
      return;
    }

    if (parsedRange.total > 100) {
      this.snack.warning('Number range exceeds max size of 100 DIDs per operation.');
      return;
    }

    this.saving.set(true);
    try {
      const response = await this.didApi.bulkCreate(
        {
          rangeStart: parsedRange.start,
          rangeEnd: parsedRange.end,
          operatorUUID,
          status,
        },
        true,
      );
      const skipped = response?.data?.skippedExisting ?? [];
      const failed = response?.data?.failed ?? [];
      this.refreshList();

      if (skipped.length || failed.length) {
        this.snack.warning(
          response?.message ??
            `Number range completed with ${skipped.length} skipped and ${failed.length} failed.`,
        );
        return;
      }

      this.snack.success('DID number range created successfully.');
      if (saveAndNew) {
        this.formValues.set({
          ...this.config.initialValues,
          createMode: 'range',
          operatorUUID,
          status,
        });
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.didErrorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      status: Number(payload['status']),
      number: String(payload['number'] ?? '').replace(/\D+/g, ''),
    };
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'createMode' || this.editingRecord()) return;
    if (value === 'range') {
      this.patchFormValues({ number: '' });
    } else {
      this.patchFormValues({ didRange: '' });
    }
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

  private parseRange(value: string): { start: string; end: string; total: number } | null {
    const match = value.match(/^\s*(\d{8,15})\s*-\s*(\d{8,15})\s*$/);
    if (!match) return null;

    const start = match[1];
    const end = match[2];
    if (start.length !== end.length) return null;

    const startNumber = BigInt(start);
    const endNumber = BigInt(end);
    if (endNumber < startNumber) return null;

    const total = Number(endNumber - startNumber + 1n);
    if (!Number.isSafeInteger(total)) return null;
    return { start, end, total };
  }

  private didErrorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybe = error as { error?: { error?: string; message?: string }; message?: string };
      return maybe.error?.error ?? maybe.error?.message ?? maybe.message ?? 'Failed to save DID.';
    }
    return 'Failed to save DID.';
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
