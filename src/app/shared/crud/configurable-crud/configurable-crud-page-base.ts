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
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
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

import { ApiService } from '../../../services/api.service';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { DateMaskDirective } from '../../date-mask/date-mask.directive';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../dialog/crud-dialog.util';
import { bindDialogClosed } from '../../dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../forms/mns-search-select-field/mns-search-select-field';
import { RefreshButtonComponent } from '../../refresh-button/refresh-button';
import { SlowConfirmDialogComponent } from '../../slow-confirm-dialog/slow-confirm-dialog';

export const CONFIGURABLE_CRUD_IMPORTS = [
  RefreshButtonComponent,
  MatButtonModule,
  MatCardModule,
  MatCheckboxModule,
  MatChipsModule,
  MatNativeDateModule,
  MatDatepickerModule,
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
  DateMaskDirective,
];

export type ConfigurableCrudRecord = Record<string, unknown>;

export type ConfigurableCrudOption = MnsSearchSelectFieldOption & {
  value: string | number | boolean | null;
  label: string;
};

export type ConfigurableCrudFieldType =
  | 'text'
  | 'email'
  | 'number'
  | 'phone'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'search-select'
  | 'status'
  | 'textarea';

export type ConfigurableCrudPostalCodeLookup = {
  streetKey?: string;
  districtKey?: string;
  complementKey?: string;
  cityKey?: string;
  stateKey?: string;
  countryKey?: string;
  numberKey?: string;
};

export type ConfigurableCrudField = {
  key: string;
  label: string;
  labelWhen?: (context: ConfigurableCrudFieldContext) => string;
  source?: string;
  payloadKey?: string;
  format?: 'json';
  type?: ConfigurableCrudFieldType;
  tab?:
    | 'record'
    | 'address'
    | 'financial'
    | 'network'
    | 'monitoring'
    | 'match'
    | 'authentication'
    | 'limits'
    | 'codecs'
    | 'notes';
  addressSection?: string;
  span?: 1 | 2 | 3 | 4;
  breakBefore?: boolean;
  postalLookup?: ConfigurableCrudPostalCodeLookup;
  rows?: number;
  required?: boolean;
  textCase?: 'uppercase';
  hidden?: boolean;
  placeholder?: string;
  autocomplete?: string;
  options?: readonly ConfigurableCrudOption[];
  loading?: () => boolean;
  hiddenWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  requiredWhen?: (context: ConfigurableCrudFieldContext) => boolean;
};

export type ConfigurableCrudFieldContext = {
  editing: boolean;
  values: ConfigurableCrudRecord;
};

export type ConfigurableCrudCopyAction = {
  key: string;
  label: string;
  addressSection?: string;
  defaultEnabled?: boolean;
  summaryLabel?: string;
  fromPrefix: string;
  toPrefix: string;
  fields: readonly string[];
};

export type ConfigurableCrudAddressSection = {
  key: string;
  label: string;
};

export type ConfigurableCrudAddressSectionView = ConfigurableCrudAddressSection & {
  fields: readonly ConfigurableCrudField[];
  copyActions: readonly ConfigurableCrudCopyAction[];
};

export type ConfigurableCrudColumn = {
  id: string;
  label: string;
  field?: string;
  uuidField?: string;
  kind?: 'identity' | 'related' | 'status' | 'boolean' | 'text' | 'date' | 'datetime';
  lookupKey?: string;
  className?: string;
};

export type ConfigurableCrudListFilter = {
  key: string;
  label: string;
  paramKey?: string;
  type: 'select' | 'search-select';
  span?: 1 | 2 | 3 | 4;
  placeholder?: string;
  emptyLabel?: string;
  loading?: () => boolean;
  options?: readonly ConfigurableCrudOption[];
  translateOptions?: boolean;
};

export type ConfigurableCrudRowAction = {
  key: string;
  label: string;
  icon: string;
  tooltip?: string;
};

export type ConfigurableCrudStatusMode = 'number' | 'string';

export type ConfigurableCrudConfig = {
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
  fields: readonly ConfigurableCrudField[];
  columns: readonly ConfigurableCrudColumn[];
  initialValues: ConfigurableCrudRecord;
  statusMode: ConfigurableCrudStatusMode;
  activeValue: string | number;
  inactiveValue: string | number;
  statusOptions?: readonly ConfigurableCrudOption[];
  activeStatusValues?: readonly (string | number)[];
  addressSections?: readonly ConfigurableCrudAddressSection[];
  addressCopyActions?: readonly ConfigurableCrudCopyAction[];
  listFilters?: readonly ConfigurableCrudListFilter[];
  rowActions?: readonly ConfigurableCrudRowAction[];
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  bulkDelete?: boolean;
  statusFilter?: boolean;
  tabLabels?: Partial<Record<NonNullable<ConfigurableCrudField['tab']>, string>>;
};

export type ConfigurableCrudSaveContext<T extends ConfigurableCrudRecord> = {
  mode: 'create' | 'update';
  saveAndNew: boolean;
  payload: ConfigurableCrudRecord;
  response: unknown;
  record: T | null;
};

type ConfigurableCrudFilters = {
  search: string;
  status: '' | string | number;
  extra: Record<string, string | number | boolean | null>;
};

@Directive()
export abstract class ConfigurableCrudPageBase<T extends ConfigurableCrudRecord> {
  protected readonly api = inject(ApiService);
  protected readonly snack = inject(SnackbarService);
  protected readonly dateTime = inject(DateTimeFormatService);
  protected readonly dialog = inject(MatDialog);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly listLimit = 500;
  protected readonly config: ConfigurableCrudConfig;

  readonly formDialog = viewChild<TemplateRef<unknown>>('crudFormDialog');
  protected dialogBinding: CrudDialogBinding | null = null;

  readonly search = signal('');
  readonly status = signal<'' | string | number>('');
  readonly listFilterValues = signal<Record<string, string | number | boolean | null>>({});
  readonly appliedFilters = signal<ConfigurableCrudFilters>({ search: '', status: '', extra: {} });
  readonly selectedUUIDs = signal(new Set<string>());
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly postalLookupLoadingKey = signal<string | null>(null);
  readonly editingRecord = signal<T | null>(null);
  readonly formValues = signal<ConfigurableCrudRecord>({});
  readonly enabledCopyActions = signal(new Set<string>());

  readonly itemsResource;

  readonly displayedColumns = computed(() => [
    ...(this.bulkDeleteEnabled() ? ['select'] : []),
    ...this.config.columns.map((column) => column.id),
    ...(this.hasRowActions() ? ['actions'] : []),
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
    this.config.fields.filter(
      (field) => this.isFieldVisible(field) && (!field.tab || field.tab === 'record'),
    ),
  );
  readonly addressFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'address'),
  );
  readonly addressSections = computed<ConfigurableCrudAddressSectionView[]>(() => {
    const fields = this.addressFields();
    const copyActions = this.addressCopyActions();
    const configuredSections = this.config.addressSections ?? [];

    if (!configuredSections.length) {
      return [{ key: 'address', label: '', fields, copyActions }];
    }

    return configuredSections
      .map((section) => ({
        ...section,
        fields: fields.filter((field) => field.addressSection === section.key),
        copyActions: copyActions.filter((action) => action.addressSection === section.key),
      }))
      .filter((section) => section.fields.length || section.copyActions.length);
  });
  readonly financialFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'financial'),
  );
  readonly networkFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'network'),
  );
  readonly monitoringFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'monitoring'),
  );
  readonly matchFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'match'),
  );
  readonly authenticationFields = computed(() =>
    this.config.fields.filter(
      (field) => this.isFieldVisible(field) && field.tab === 'authentication',
    ),
  );
  readonly limitsFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'limits'),
  );
  readonly codecFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'codecs'),
  );
  readonly notesFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'notes'),
  );
  readonly dialogTitle = computed(() =>
    this.editingRecord() ? this.config.editTitle : this.config.createTitle,
  );
  readonly canCreate = computed(() => this.config.canCreate !== false);
  readonly canEdit = computed(() => this.config.canEdit !== false);
  readonly canDelete = computed(() => this.config.canDelete !== false);
  readonly bulkDeleteEnabled = computed(() => this.canDelete() && this.config.bulkDelete !== false);
  readonly statusFilterEnabled = computed(() => this.config.statusFilter !== false);
  readonly hasRowActions = computed(
    () => this.canEdit() || this.canDelete() || Boolean(this.config.rowActions?.length),
  );
  readonly listFilters = computed(() => this.config.listFilters ?? []);

  protected constructor(config: ConfigurableCrudConfig) {
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
      extra: { ...this.listFilterValues() },
    });
  }

  clearSearchFilters(): void {
    this.search.set('');
    this.status.set('');
    this.listFilterValues.set({});
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
    if (!this.canCreate()) return;
    this.editingRecord.set(null);
    this.formValues.set(this.emptyFormValues());
    this.enabledCopyActions.set(this.defaultCopyActionKeys());
    for (const action of this.addressCopyActions()) {
      if (this.isCopyActionEnabled(action)) this.copyAddressValues(action);
    }
    this.openDialog();
  }

  startEdit(row: T): void {
    if (!this.canEdit()) return;
    this.editingRecord.set(row);
    this.formValues.set(this.formValuesFromRecord(row));
    this.enabledCopyActions.set(this.inferredCopyActionKeys());
    this.copyEnabledAddressValues();
    this.openDialog();
  }

  async saveItem(saveAndNew = false): Promise<void> {
    if (this.editingRecord() ? !this.canEdit() : !this.canCreate()) return;
    this.copyEnabledAddressValues();
    const payload = this.augmentPayload(this.buildPayload());
    if (!this.validatePayload(payload)) return;

    this.saving.set(true);
    try {
      const current = this.editingRecord();
      let response: unknown;
      if (current) {
        response = await this.api.put(
          `${this.config.endpoint}/${this.recordUUID(current)}`,
          payload,
        );
      } else {
        response = await this.api.post(this.config.endpoint, payload);
      }
      this.snack.success(this.config.savedMessage);
      if (current) this.reflectSavedRecord(current, payload);
      this.itemsResource.reload();
      if (saveAndNew) {
        this.editingRecord.set(null);
        this.formValues.set(this.emptyFormValues());
      } else {
        this.closeDialog();
      }
      await this.afterSave({
        mode: current ? 'update' : 'create',
        saveAndNew,
        payload,
        response,
        record: current,
      });
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteItem(row: T): Promise<void> {
    if (!this.canDelete()) return;
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

  rowActions(_row: T): readonly ConfigurableCrudRowAction[] {
    return this.config.rowActions ?? [];
  }

  handleRowAction(_action: ConfigurableCrudRowAction, _row: T): void | Promise<void> {}

  protected afterSave(_context: ConfigurableCrudSaveContext<T>): void | Promise<void> {}

  async deleteSelectedItems(): Promise<void> {
    if (!this.bulkDeleteEnabled()) return;
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

  fieldValueArray(key: string): readonly unknown[] {
    const value = this.formValues()[key];
    return Array.isArray(value) ? value : [];
  }

  setFieldValue(key: string, value: unknown): void {
    const field = this.config.fields.find((item) => item.key === key);
    const normalized =
      field?.textCase === 'uppercase' && typeof value === 'string'
        ? value.toLocaleUpperCase()
        : value;
    this.formValues.update((current) => ({ ...current, [key]: normalized }));
    this.onFieldValueChanged(key, normalized);
    this.syncCopyActionsForSource(key);
    this.clearCopyActionsForTarget(key);
  }

  async searchPostalCode(field: ConfigurableCrudField, event?: Event): Promise<void> {
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
      const response = await this.api.get<{ data?: { item?: ConfigurableCrudRecord } }>(
        `postal-codes/${normalizedZip}`,
      );
      const item = response?.data?.item ?? {};
      const lookup = field.postalLookup;
      const next: ConfigurableCrudRecord = { [field.key]: normalizedZip };

      this.assignPostalLookupValue(next, lookup.streetKey, item['street']);
      this.assignPostalLookupValue(next, lookup.districtKey, item['district']);
      this.assignPostalLookupValue(next, lookup.complementKey, item['complement']);
      this.assignPostalLookupValue(next, lookup.cityKey, item['city']);
      this.assignPostalLookupValue(next, lookup.stateKey, item['state']);
      this.assignPostalLookupValue(next, lookup.countryKey, item['country']);

      this.formValues.update((current) => ({ ...current, ...next }));
      for (const key of Object.keys(next)) {
        this.syncCopyActionsForSource(key);
      }
      if (lookup.numberKey) {
        queueMicrotask(() => this.focusField(lookup.numberKey as string));
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to search postal code.');
    } finally {
      this.postalLookupLoadingKey.set(null);
    }
  }

  isPostalLookupLoading(field: ConfigurableCrudField): boolean {
    return this.postalLookupLoadingKey() === field.key;
  }

  fieldClass(field: ConfigurableCrudField): string {
    return [`span-${field.span ?? 1}`, field.breakBefore ? 'break-before' : '']
      .filter(Boolean)
      .join(' ');
  }

  fieldLabel(field: ConfigurableCrudField): string {
    return (
      field.labelWhen?.({
        editing: Boolean(this.editingRecord()),
        values: this.formValues(),
      }) ?? field.label
    );
  }

  tabLabel(tab: NonNullable<ConfigurableCrudField['tab']>, fallback: string): string {
    return this.config.tabLabels?.[tab] ?? fallback;
  }

  protected assignPostalLookupValue(
    target: ConfigurableCrudRecord,
    key: string | undefined,
    value: unknown,
  ): void {
    if (!key || value === null || value === undefined) return;
    target[key] = value;
  }

  protected focusField(key: string): void {
    this.host.nativeElement.querySelector<HTMLInputElement>(`[data-field-key="${key}"]`)?.focus();
  }

  fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    return field.options ?? this.lookupOptions(field.key);
  }

  listFilterOptions(filter: ConfigurableCrudListFilter): readonly ConfigurableCrudOption[] {
    if (filter.type === 'search-select') {
      return filter.options ?? this.lookupOptions(filter.key);
    }
    return [{ value: '', label: 'All' }, ...(filter.options ?? this.lookupOptions(filter.key))];
  }

  listFilterValue(filter: ConfigurableCrudListFilter): string | number | boolean | null {
    return this.listFilterValues()[filter.key] ?? '';
  }

  setListFilterValue(filter: ConfigurableCrudListFilter, value: string | number | boolean | null) {
    this.listFilterValues.update((current) => ({ ...current, [filter.key]: value }));
  }

  listFilterClass(filter: ConfigurableCrudListFilter): string {
    return `span-${filter.span ?? 1}`;
  }

  listFilterLoading(filter: ConfigurableCrudListFilter): boolean {
    return filter.loading?.() ?? false;
  }

  fieldLoading(field: ConfigurableCrudField): boolean {
    return field.loading?.() ?? false;
  }

  addressCopyActions(): readonly ConfigurableCrudCopyAction[] {
    return this.config.addressCopyActions ?? [];
  }

  isCopyActionEnabled(action: ConfigurableCrudCopyAction): boolean {
    return this.enabledCopyActions().has(action.key);
  }

  isFieldDisabled(field: ConfigurableCrudField): boolean {
    return this.addressCopyActions().some(
      (action) =>
        this.isCopyActionEnabled(action) &&
        action.fields.some((fieldName) => `${action.toPrefix}${fieldName}` === field.key),
    );
  }

  isFieldVisible(field: ConfigurableCrudField): boolean {
    if (field.hidden) return false;
    return !field.hiddenWhen?.({
      editing: Boolean(this.editingRecord()),
      values: this.formValues(),
    });
  }

  isFieldRequired(field: ConfigurableCrudField): boolean {
    if (field.requiredWhen) {
      return field.requiredWhen({
        editing: Boolean(this.editingRecord()),
        values: this.formValues(),
      });
    }
    return Boolean(field.required);
  }

  isAddressSectionCompact(section: ConfigurableCrudAddressSectionView): boolean {
    return section.copyActions.some((action) => this.isCopyActionEnabled(action));
  }

  addressSectionSummary(section: ConfigurableCrudAddressSectionView): string {
    const enabledAction = section.copyActions.find((action) => this.isCopyActionEnabled(action));
    if (enabledAction) return enabledAction.summaryLabel ?? 'Same as main address';

    const values = this.formValues();
    const summaryParts = section.fields
      .filter((field) => !field.postalLookup && field.type !== 'search-select')
      .map((field) => String(values[field.key] ?? '').trim())
      .filter(Boolean);
    return summaryParts.slice(0, 4).join(', ') || '-';
  }

  editAddressSection(section: ConfigurableCrudAddressSectionView): void {
    const next = new Set(this.enabledCopyActions());
    for (const action of section.copyActions) {
      next.delete(action.key);
    }
    this.enabledCopyActions.set(next);
  }

  toggleCopyAction(action: ConfigurableCrudCopyAction, checked: boolean): void {
    const next = new Set(this.enabledCopyActions());
    if (checked) {
      next.add(action.key);
      this.copyAddressValues(action);
    } else {
      next.delete(action.key);
    }
    this.enabledCopyActions.set(next);
  }

  statusOptions(): readonly ConfigurableCrudOption[] {
    return (
      this.config.statusOptions ?? [
        { value: this.config.activeValue, label: 'Active' },
        { value: this.config.inactiveValue, label: 'Inactive' },
      ]
    );
  }

  statusLabel(value: unknown): string {
    const option = this.statusOptions().find(
      (candidate) => String(candidate.value ?? '') === String(value ?? ''),
    );
    return option?.label ?? (this.isActiveStatus(value) ? 'Active' : 'Inactive');
  }

  isActiveStatus(value: unknown): boolean {
    const activeValues = this.config.activeStatusValues ?? [this.config.activeValue];
    return activeValues.some((activeValue) => String(value ?? '') === String(activeValue));
  }

  booleanLabel(value: unknown): string {
    return this.isTruthyValue(value) ? 'Yes' : 'No';
  }

  isTruthyValue(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return ['1', 'true', 'yes', 'y', 'active', 'enabled', 'default'].includes(normalized);
  }

  recordUUID(row: T): string {
    return String(row[this.config.uuidField] ?? '');
  }

  columnMain(row: T, column: ConfigurableCrudColumn): string {
    if (column.lookupKey && column.uuidField) {
      return this.lookupLabel(column.lookupKey, row[column.uuidField]) || '-';
    }
    const field = column.field ?? column.id;
    return this.displayValue(row[field]);
  }

  columnUUID(row: T, column: ConfigurableCrudColumn): string {
    if (column.uuidField) return this.displayValue(row[column.uuidField]);
    return column.kind === 'identity' ? this.recordUUID(row) : '';
  }

  columnText(row: T, column: ConfigurableCrudColumn): string {
    const field = column.field ?? column.id;
    if (column.kind === 'boolean') return this.booleanLabel(row[field]);
    if (column.kind === 'date') return this.dateTime.formatDate(this.dateValue(row[field])) || '-';
    if (column.kind === 'datetime' || this.isDateTimeColumn(column, row[field])) {
      return this.dateTime.formatDateTime(this.dateValue(row[field])) || '-';
    }
    return this.displayValue(row[field]);
  }

  protected lookupOptions(_key: string): readonly ConfigurableCrudOption[] {
    return [];
  }

  protected lookupLabel(key: string, value: unknown): string {
    const option = this.lookupOptions(key).find(
      (item) => String(item.value ?? '') === String(value ?? ''),
    );
    return option?.label ?? '';
  }

  protected augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return payload;
  }

  protected onFieldValueChanged(_key: string, _value: unknown): void {}

  protected patchFormValues(values: ConfigurableCrudRecord): void {
    this.formValues.update((current) => ({ ...current, ...values }));
    for (const key of Object.keys(values)) {
      this.syncCopyActionsForSource(key);
    }
  }

  private defaultCopyActionKeys(): Set<string> {
    return new Set(
      this.addressCopyActions()
        .filter((action) => action.defaultEnabled)
        .map((action) => action.key),
    );
  }

  private inferredCopyActionKeys(): Set<string> {
    const next = new Set<string>();
    for (const action of this.addressCopyActions()) {
      if (this.copyActionTargetIsEmpty(action) || this.copyActionTargetMatchesSource(action)) {
        next.add(action.key);
      }
    }
    return next;
  }

  private copyAddressValues(action: ConfigurableCrudCopyAction): void {
    const current = this.formValues();
    const next: ConfigurableCrudRecord = {};
    for (const field of action.fields) {
      next[`${action.toPrefix}${field}`] = current[`${action.fromPrefix}${field}`] ?? '';
    }
    this.formValues.update((values) => ({ ...values, ...next }));
  }

  private copyEnabledAddressValues(): void {
    for (const action of this.addressCopyActions()) {
      if (this.isCopyActionEnabled(action)) this.copyAddressValues(action);
    }
  }

  private copyActionTargetIsEmpty(action: ConfigurableCrudCopyAction): boolean {
    const current = this.formValues();
    return action.fields.every(
      (field) => !String(current[`${action.toPrefix}${field}`] ?? '').trim(),
    );
  }

  private copyActionTargetMatchesSource(action: ConfigurableCrudCopyAction): boolean {
    const current = this.formValues();
    return action.fields.every((field) => {
      const source = String(current[`${action.fromPrefix}${field}`] ?? '').trim();
      const target = String(current[`${action.toPrefix}${field}`] ?? '').trim();
      return source === target;
    });
  }

  private syncCopyActionsForSource(changedKey: string): void {
    for (const action of this.addressCopyActions()) {
      if (!this.isCopyActionEnabled(action)) continue;
      const shouldCopy = action.fields.some(
        (field) => `${action.fromPrefix}${field}` === changedKey,
      );
      if (shouldCopy) this.copyAddressValues(action);
    }
  }

  private clearCopyActionsForTarget(changedKey: string): void {
    const selected = this.enabledCopyActions();
    if (!selected.size) return;

    const next = new Set(selected);
    for (const action of this.addressCopyActions()) {
      if (!next.has(action.key)) continue;
      const isTarget = action.fields.some((field) => `${action.toPrefix}${field}` === changedKey);
      if (isTarget) next.delete(action.key);
    }
    if (next.size !== selected.size) this.enabledCopyActions.set(next);
  }

  private async fetchItems(filters: ConfigurableCrudFilters): Promise<T[]> {
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    params.set('offset', '0');
    if (filters.search) params.set('search', filters.search);
    if (this.statusFilterEnabled() && filters.status !== '')
      params.set('status', String(filters.status));
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }

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

  private sortValue(row: T, column?: ConfigurableCrudColumn): string {
    if (!column) return '';
    if (column.kind === 'related') return this.columnMain(row, column).toLowerCase();
    const field = column.field ?? column.id;
    if (column.kind === 'boolean') return this.isTruthyValue(row[field]) ? '1' : '0';
    if (
      column.kind === 'date' ||
      column.kind === 'datetime' ||
      this.isDateTimeColumn(column, row[field])
    ) {
      return String(this.dateTime.toEpoch(this.dateValue(row[field]))).padStart(16, '0');
    }
    return this.displayValue(row[field]).toLowerCase();
  }

  private dateValue(value: unknown): Date | string | number | null | undefined {
    if (
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      value instanceof Date
    ) {
      return value;
    }
    return String(value);
  }

  private isDateTimeColumn(column: ConfigurableCrudColumn, value: unknown): boolean {
    if (value === null || value === undefined || value === '') return false;
    const name = `${column.id} ${column.field ?? ''}`.toLowerCase();
    const looksLikeDateField =
      name.includes('date') ||
      name.endsWith(' at') ||
      name.endsWith('at') ||
      name.includes('createdat') ||
      name.includes('updatedat');
    if (!looksLikeDateField || typeof value !== 'string') return false;
    return !Number.isNaN(new Date(value).getTime());
  }

  private displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  private openDialog(): void {
    const dialog = this.formDialog();
    if (!dialog) return;

    this.dialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'crud-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    bindDialogClosed(
      this.dialogBinding.ref,
      () => {
        this.dialogBinding?.stop();
        this.dialogBinding = null;
      },
      this.destroyRef,
    );
  }

  private emptyFormValues(): ConfigurableCrudRecord {
    return { ...this.config.initialValues };
  }

  private formValuesFromRecord(row: T): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      const value = row[field.source ?? field.key] ?? this.config.initialValues[field.key] ?? '';
      next[field.key] = field.format === 'json' ? this.formatJsonValue(value) : value;
    }
    return next;
  }

  private reflectSavedRecord(current: T, payload: ConfigurableCrudRecord): void {
    const uuid = this.recordUUID(current);
    const values: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      const payloadKey = field.payloadKey ?? field.key;
      const source = field.source ?? field.key;
      values[source] = payload[payloadKey] ?? null;
    }
    this.itemsResource.update((rows) =>
      rows.map((row) => (this.recordUUID(row) === uuid ? ({ ...row, ...values } as T) : row)),
    );
  }

  private buildPayload(): ConfigurableCrudRecord {
    const values = this.formValues();
    const payload: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      const key = field.payloadKey ?? field.key;
      let value = values[field.key];
      if (field.format === 'json') value = this.parseJsonValue(value);
      if (typeof value === 'string') value = value.trim();
      if (value === '') value = null;
      payload[key] = value;
    }
    return payload;
  }

  private formatJsonValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return '';
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return trimmed;
      }
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private parseJsonValue(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  private validatePayload(payload: ConfigurableCrudRecord): boolean {
    for (const field of this.config.fields) {
      if (!this.isFieldVisible(field) || !this.isFieldRequired(field)) continue;
      const value = payload[field.payloadKey ?? field.key];
      if (value === null || value === undefined || value === '') {
        this.snack.warning('Required fields are missing.');
        return false;
      }
    }
    return true;
  }

  protected async confirmAction(
    title: string,
    message: string,
    confirmLabel = 'Confirm',
  ): Promise<boolean> {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
      data: { title, message, confirmLabel },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private async confirm(title: string, message: string): Promise<boolean> {
    return this.confirmAction(title, message, 'Delete');
  }

  private errorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybe = error as { error?: { error?: string; message?: string }; message?: string };
      return maybe.error?.error ?? maybe.error?.message ?? maybe.message ?? 'Operation failed.';
    }
    return 'Operation failed.';
  }
}
