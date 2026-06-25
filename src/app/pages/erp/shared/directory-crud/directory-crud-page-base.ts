import {
  Directive,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';

import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

export const ERP_DIRECTORY_CRUD_IMPORTS = [
  RefreshButtonComponent,
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatDialogModule,
  MatFormFieldModule,
  MatIconModule,
  MatInputModule,
  MatMenuModule,
  MatPaginatorModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatSortModule,
  MatTableModule,
  MatTabsModule,
  MatTooltipModule,
  MnsSearchSelectFieldComponent,
  TranslocoPipe,
];

export type DirectoryRecord = Record<string, unknown>;

export type DirectoryOption = MnsSearchSelectFieldOption & {
  value: string | number | boolean | null;
  label: string;
};

export type DirectoryFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'phone'
  | 'select'
  | 'search-select'
  | 'status'
  | 'textarea';

export type DirectoryPostalCodeLookup = {
  streetKey?: string;
  districtKey?: string;
  complementKey?: string;
  cityKey?: string;
  stateKey?: string;
  countryKey?: string;
  numberKey?: string;
};

export type DirectoryField = {
  key: string;
  label: string;
  source?: string;
  payloadKey?: string;
  type?: DirectoryFieldType;
  tab?: 'record' | 'address' | 'notes';
  span?: 1 | 2 | 3 | 4;
  breakBefore?: boolean;
  postalLookup?: DirectoryPostalCodeLookup;
  rows?: number;
  required?: boolean;
  placeholder?: string;
  autocomplete?: string;
  options?: readonly DirectoryOption[];
  loading?: () => boolean;
};

export type DirectoryColumn = {
  id: string;
  label: string;
  field?: string;
  uuidField?: string;
  kind?: 'identity' | 'related' | 'status' | 'text';
  lookupKey?: string;
  className?: string;
};

export type DirectoryStatusMode = 'number' | 'string';

export type DirectoryConfig = {
  endpoint: string;
  uuidField: string;
  pageTitle: string;
  pageDescription: string;
  createTitle: string;
  editTitle: string;
  dialogDescription: string;
  searchPlaceholder: string;
  emptyLabel: string;
  deleteTitle: string;
  deleteMessage: string;
  deleteSelectedTitle: string;
  deleteSelectedMessage: string;
  savedMessage: string;
  deletedMessage: string;
  deleteFailedMessage: string;
  fields: readonly DirectoryField[];
  columns: readonly DirectoryColumn[];
  initialValues: DirectoryRecord;
  statusMode: DirectoryStatusMode;
  activeValue: string | number;
  inactiveValue: string | number;
};

type DirectoryFilters = {
  search: string;
  status: '' | string | number;
};

@Directive()
export abstract class DirectoryCrudPageBase<T extends DirectoryRecord> {
  protected readonly api = inject(ApiService);
  protected readonly snack = inject(SnackbarService);
  protected readonly dialog = inject(MatDialog);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly listLimit = 500;
  protected readonly config: DirectoryConfig;

  readonly formDialog = viewChild<TemplateRef<unknown>>('directoryFormDialog');
  protected dialogBinding: CrudDialogBinding | null = null;

  readonly search = signal('');
  readonly status = signal<'' | string | number>('');
  readonly appliedFilters = signal<DirectoryFilters>({ search: '', status: '' });
  readonly selectedUUIDs = signal(new Set<string>());
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly postalLookupLoadingKey = signal<string | null>(null);
  readonly editingRecord = signal<T | null>(null);
  readonly formValues = signal<DirectoryRecord>({});

  readonly itemsResource;

  readonly displayedColumns = computed(() => [
    'select',
    ...this.config.columns.map((column) => column.id),
    'actions',
  ]);
  readonly rows = computed(() => this.normalizeRows(this.itemsResource.value() as T[]));
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly selectedCount = computed(() => this.selectedUUIDs().size);
  readonly allVisibleSelected = computed(() => {
    const visible = this.visibleRows();
    if (!visible.length) return false;
    const selected = this.selectedUUIDs();
    return visible.every((row) => selected.has(this.recordUUID(row)));
  });
  readonly someVisibleSelected = computed(() => {
    const selected = this.selectedUUIDs();
    return this.visibleRows().some((row) => selected.has(this.recordUUID(row)));
  });
  readonly recordFields = computed(() =>
    this.config.fields.filter((field) => !field.tab || field.tab === 'record'),
  );
  readonly addressFields = computed(() =>
    this.config.fields.filter((field) => field.tab === 'address'),
  );
  readonly notesFields = computed(() => this.config.fields.filter((field) => field.tab === 'notes'));
  readonly dialogTitle = computed(() =>
    this.editingRecord() ? this.config.editTitle : this.config.createTitle,
  );

  protected constructor(config: DirectoryConfig) {
    this.config = config;
    this.formValues.set(this.emptyFormValues());
    this.itemsResource = resource({
      params: () => this.appliedFilters(),
      defaultValue: [] as T[],
      loader: ({ params }) => this.fetchItems(params),
    });

    effect(() => {
      const available = new Set(this.rows().map((row) => this.recordUUID(row)));
      const next = new Set([...this.selectedUUIDs()].filter((uuid) => available.has(uuid)));
      if (next.size !== this.selectedUUIDs().size) {
        this.selectedUUIDs.set(next);
      }
    });
  }

  applySearchFilters(): void {
    this.pageIndex.set(0);
    this.appliedFilters.set({
      search: this.search().trim(),
      status: this.status(),
    });
  }

  clearSearchFilters(): void {
    this.search.set('');
    this.status.set('');
    this.applySearchFilters();
  }

  refreshList(): void {
    this.itemsResource.reload();
  }

  setSort(sort: Sort): void {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  setPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  toggleVisibleRows(checked: boolean): void {
    const next = new Set(this.selectedUUIDs());
    for (const row of this.visibleRows()) {
      const uuid = this.recordUUID(row);
      if (checked) {
        next.add(uuid);
      } else {
        next.delete(uuid);
      }
    }
    this.selectedUUIDs.set(next);
  }

  toggleRow(row: T, checked: boolean): void {
    const next = new Set(this.selectedUUIDs());
    const uuid = this.recordUUID(row);
    if (checked) {
      next.add(uuid);
    } else {
      next.delete(uuid);
    }
    this.selectedUUIDs.set(next);
  }

  isSelected(row: T): boolean {
    return this.selectedUUIDs().has(this.recordUUID(row));
  }

  startCreate(): void {
    this.editingRecord.set(null);
    this.formValues.set(this.emptyFormValues());
    this.openDialog();
  }

  startEdit(row: T): void {
    this.editingRecord.set(row);
    this.formValues.set(this.formValuesFromRecord(row));
    this.openDialog();
  }

  async saveItem(saveAndNew = false): Promise<void> {
    const payload = this.augmentPayload(this.buildPayload());
    if (!this.validatePayload(payload)) return;

    this.saving.set(true);
    try {
      const current = this.editingRecord();
      if (current) {
        await this.api.put(`${this.config.endpoint}/${this.recordUUID(current)}`, payload);
      } else {
        await this.api.post(this.config.endpoint, payload);
      }
      this.snack.success(this.config.savedMessage);
      this.itemsResource.reload();
      if (saveAndNew) {
        this.editingRecord.set(null);
        this.formValues.set(this.emptyFormValues());
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteItem(row: T): Promise<void> {
    const confirmed = await this.confirm(this.config.deleteTitle, this.config.deleteMessage);
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.api.delete(`${this.config.endpoint}/${this.recordUUID(row)}`);
      this.snack.success(this.config.deletedMessage);
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.config.deleteFailedMessage);
    } finally {
      this.mutating.set(false);
    }
  }

  async deleteSelectedItems(): Promise<void> {
    const ids = [...this.selectedUUIDs()];
    if (!ids.length) return;

    const message = this.config.deleteSelectedMessage.replace('{count}', String(ids.length));
    const confirmed = await this.confirm(this.config.deleteSelectedTitle, message);
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.api.delete(`${this.config.endpoint}/bulk`, { ids });
      this.selectedUUIDs.set(new Set());
      this.snack.success(this.config.deletedMessage);
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.config.deleteFailedMessage);
    } finally {
      this.mutating.set(false);
    }
  }

  closeDialog(): void {
    this.dialogBinding?.ref.close();
  }

  fieldValue(key: string): string | number | boolean | null {
    const value = this.formValues()[key];
    if (value === undefined) return '';
    return value as string | number | boolean | null;
  }

  fieldValueString(key: string): string {
    const value = this.formValues()[key];
    return value === null || value === undefined ? '' : String(value);
  }

  setFieldValue(key: string, value: unknown): void {
    this.formValues.update((current) => ({ ...current, [key]: value }));
  }

  async searchPostalCode(field: DirectoryField, event?: Event): Promise<void> {
    event?.preventDefault();
    if (!field.postalLookup || this.postalLookupLoadingKey()) return;

    const normalizedZip = this.fieldValueString(field.key).replace(/\D/g, '');
    if (!normalizedZip) {
      this.snack.warning('Inform a postal code to search.');
      return;
    }
    if (normalizedZip.length !== 8) {
      this.snack.warning('Invalid postal code. Provide 8 digits.');
      return;
    }

    this.postalLookupLoadingKey.set(field.key);
    this.setFieldValue(field.key, normalizedZip);

    try {
      const response = await this.api.get<{ data?: { item?: DirectoryRecord } }>(
        `postal-codes/${normalizedZip}`,
      );
      const item = response?.data?.item ?? {};
      const lookup = field.postalLookup;
      const next: DirectoryRecord = { [field.key]: normalizedZip };

      this.assignPostalLookupValue(next, lookup.streetKey, item['street']);
      this.assignPostalLookupValue(next, lookup.districtKey, item['district']);
      this.assignPostalLookupValue(next, lookup.complementKey, item['complement']);
      this.assignPostalLookupValue(next, lookup.cityKey, item['city']);
      this.assignPostalLookupValue(next, lookup.stateKey, item['state']);
      this.assignPostalLookupValue(next, lookup.countryKey, item['country']);

      this.formValues.update((current) => ({ ...current, ...next }));
      if (lookup.numberKey) {
        queueMicrotask(() => this.focusField(lookup.numberKey as string));
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to search postal code.');
    } finally {
      this.postalLookupLoadingKey.set(null);
    }
  }

  isPostalLookupLoading(field: DirectoryField): boolean {
    return this.postalLookupLoadingKey() === field.key;
  }

  fieldClass(field: DirectoryField): string {
    return [`span-${field.span ?? 1}`, field.breakBefore ? 'break-before' : '']
      .filter(Boolean)
      .join(' ');
  }

  protected assignPostalLookupValue(
    target: DirectoryRecord,
    key: string | undefined,
    value: unknown,
  ): void {
    if (!key || value === null || value === undefined) return;
    target[key] = value;
  }

  protected focusField(key: string): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`[data-field-key="${key}"]`)?.focus();
  }

  fieldOptions(field: DirectoryField): readonly DirectoryOption[] {
    return field.options ?? this.lookupOptions(field.key);
  }

  fieldLoading(field: DirectoryField): boolean {
    return field.loading?.() ?? false;
  }

  statusOptions(): readonly DirectoryOption[] {
    return [
      { value: this.config.activeValue, label: 'Active' },
      { value: this.config.inactiveValue, label: 'Inactive' },
    ];
  }

  statusLabel(value: unknown): string {
    return this.isActiveStatus(value) ? 'Active' : 'Inactive';
  }

  isActiveStatus(value: unknown): boolean {
    return String(value ?? '') === String(this.config.activeValue);
  }

  recordUUID(row: T): string {
    return String(row[this.config.uuidField] ?? '');
  }

  columnMain(row: T, column: DirectoryColumn): string {
    if (column.lookupKey && column.uuidField) {
      return this.lookupLabel(column.lookupKey, row[column.uuidField]) || '-';
    }
    const field = column.field ?? column.id;
    return this.displayValue(row[field]);
  }

  columnUUID(row: T, column: DirectoryColumn): string {
    if (column.uuidField) return this.displayValue(row[column.uuidField]);
    return column.kind === 'identity' ? this.recordUUID(row) : '';
  }

  columnText(row: T, column: DirectoryColumn): string {
    const field = column.field ?? column.id;
    return this.displayValue(row[field]);
  }

  protected lookupOptions(_key: string): readonly DirectoryOption[] {
    return [];
  }

  protected lookupLabel(key: string, value: unknown): string {
    const option = this.lookupOptions(key).find((item) => String(item.value ?? '') === String(value ?? ''));
    return option?.label ?? '';
  }

  protected augmentPayload(payload: DirectoryRecord): DirectoryRecord {
    return payload;
  }

  private async fetchItems(filters: DirectoryFilters): Promise<T[]> {
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    params.set('offset', '0');
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '') params.set('status', String(filters.status));

    const response = await this.api.get(`${this.config.endpoint}?${params.toString()}`);
    const data = (response as { data?: unknown })?.data;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
      return (data as { items: T[] }).items;
    }
    return [];
  }

  private normalizeRows(rows: T[] | undefined): T[] {
    return Array.isArray(rows) ? rows : [];
  }

  private sortRows(rows: T[]): T[] {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    const column = this.config.columns.find((item) => item.id === active);
    return [...rows].sort((left, right) => {
      const leftValue = this.sortValue(left, column);
      const rightValue = this.sortValue(right, column);
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: T, column?: DirectoryColumn): string {
    if (!column) return '';
    if (column.kind === 'related') return this.columnMain(row, column).toLowerCase();
    const field = column.field ?? column.id;
    return this.displayValue(row[field]).toLowerCase();
  }

  private displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  private openDialog(): void {
    const dialog = this.formDialog();
    if (!dialog) return;

    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      dialog,
      'erp-directory-crud-form-dialog',
      { onEscape: () => this.closeDialog() },
    );
    bindDialogClosed(this.dialogBinding.ref, () => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    }, this.destroyRef);
  }

  private emptyFormValues(): DirectoryRecord {
    return { ...this.config.initialValues };
  }

  private formValuesFromRecord(row: T): DirectoryRecord {
    const next: DirectoryRecord = {};
    for (const field of this.config.fields) {
      next[field.key] = row[field.source ?? field.key] ?? this.config.initialValues[field.key] ?? '';
    }
    return next;
  }

  private buildPayload(): DirectoryRecord {
    const values = this.formValues();
    const payload: DirectoryRecord = {};
    for (const field of this.config.fields) {
      const key = field.payloadKey ?? field.key;
      let value = values[field.key];
      if (typeof value === 'string') value = value.trim();
      if (value === '') value = null;
      payload[key] = value;
    }
    return payload;
  }

  private validatePayload(payload: DirectoryRecord): boolean {
    for (const field of this.config.fields) {
      if (!field.required) continue;
      const value = payload[field.payloadKey ?? field.key];
      if (value === null || value === undefined || value === '') {
        this.snack.warning('Required fields are missing.');
        return false;
      }
    }
    return true;
  }

  private async confirm(title: string, message: string): Promise<boolean> {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      data: { title, message, confirmLabel: 'Delete' },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybe = error as { error?: { error?: string; message?: string }; message?: string };
      return maybe.error?.error ?? maybe.error?.message ?? maybe.message ?? 'Operation failed.';
    }
    return 'Operation failed.';
  }
}
