import {
  Directive,
  DestroyRef,
  ElementRef,
  TemplateRef,
  Type,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
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

import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SystemParameterService } from '../../../services/system-parameter.service';
import {
  CurrencyMaskDirective,
  parseCurrencyAmount,
} from '../../currency-mask/currency-mask.directive';
import { DateMaskDirective } from '../../date-mask/date-mask.directive';
import { formatDateInput, toDateOnly } from '../../date-mask/date-input-format';
import { MnsDateAdapterModule } from '../../date-mask/mns-date-adapter.module';
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
  NgTemplateOutlet,
  NgClass,
  MnsSearchSelectFieldComponent,
  TranslocoPipe,
  CurrencyMaskDirective,
  DateMaskDirective,
  MnsDateAdapterModule,
];

export type ConfigurableCrudRecord = Record<string, unknown>;

export type ConfigurableCrudOption = MnsSearchSelectFieldOption & {
  value: string | number | boolean | null;
  label: string;
};

export type ConfigurableCrudQuickCreateResult = {
  option: ConfigurableCrudOption | null;
  response?: unknown;
  payload?: ConfigurableCrudRecord;
};

export type ConfigurableCrudQuickCreateContext = {
  editing: boolean;
  values: ConfigurableCrudRecord;
};

export type ConfigurableCrudQuickCreateConfig = {
  enabled?: boolean | ((context: ConfigurableCrudQuickCreateContext) => boolean);
  label?: string;
  component: Type<unknown>;
};

export type ConfigurableCrudFieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'currency'
  | 'phone'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'search-select'
  | 'status'
  | 'textarea'
  | 'file';

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
  /** Set to false for protocol/vendor terms that must remain literal. */
  translateLabel?: boolean;
  source?: string;
  /** Maps a persisted value into the field value used by the generic form. */
  fromRecord?: (value: unknown, row: ConfigurableCrudRecord) => unknown;
  payloadKey?: string;
  format?: 'json';
  type?: ConfigurableCrudFieldType;
  tab?:
    | 'record'
    | 'address'
    | 'financial'
    | 'network'
    | 'routing'
    | 'storage'
    | 'monitoring'
    | 'match'
    | 'transform'
    | 'authentication'
    | 'limits'
    | 'diagnostics'
    | 'codecs'
    | 'notes';
  addressSection?: string;
  span?: 1 | 2 | 3 | 4;
  lineFillAfter?: 1 | 2 | 3;
  breakBefore?: boolean;
  breakBeforeWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  postalLookup?: ConfigurableCrudPostalCodeLookup;
  rows?: number;
  required?: boolean;
  hidden?: boolean;
  placeholder?: string;
  autocomplete?: string;
  accept?: string;
  /** ISO 4217 code used when the record does not carry its own currency field. */
  currencyCode?: string;
  /** Key holding the ISO 4217 code for this monetary value. */
  currencyKey?: string;
  options?: readonly ConfigurableCrudOption[];
  quickCreate?: ConfigurableCrudQuickCreateConfig;
  /** Set to false for protocol/vendor option labels that must remain literal. */
  translateOptions?: boolean;
  /** Enables multiple selection for a searchable relation field. */
  multiple?: boolean;
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
  kind?:
    | 'identity'
    | 'related'
    | 'status'
    | 'boolean'
    | 'text'
    | 'date'
    | 'datetime'
    | 'currency'
    | 'number';
  lookupKey?: string;
  className?: string;
  options?: readonly ConfigurableCrudOption[];
  chipClass?: (value: unknown, row: ConfigurableCrudRecord) => string;
  currencyField?: string;
  currencyCode?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  translateValue?: boolean;
  /** Renders a copy action beside the displayed value when the record has a value. */
  copyable?: boolean;
  hiddenWhen?: () => boolean;
};

export type ConfigurableCrudListFilter = {
  key: string;
  label: string;
  paramKey?: string;
  type: 'select' | 'search-select';
  /** List filters follow the standard single-column grid contract. */
  span?: 1;
  placeholder?: string;
  emptyLabel?: string;
  loading?: () => boolean;
  options?: readonly ConfigurableCrudOption[];
  translateOptions?: boolean;
  hiddenWhen?: () => boolean;
};

export type ConfigurableCrudRowAction = {
  key: string;
  label: string;
  icon: string;
  tooltip?: string;
};

export type ConfigurableCrudRelatedCollectionColumn = {
  id: string;
  label: string;
  field?: string;
  kind?: 'text' | 'number' | 'status' | 'related';
  lookupKey?: string;
};

export type ConfigurableCrudRelatedCollection = {
  key: string;
  label: string;
  emptyLabel: string;
  addLabel?: string;
  savedMessage?: string;
  deletedMessage?: string;
  endpoint: (parentUUID: string) => string;
  deleteEndpoint: (parentUUID: string, row: ConfigurableCrudRecord) => string;
  uuidField: string;
  initialValues: ConfigurableCrudRecord;
  fields: readonly ConfigurableCrudField[];
  columns: readonly ConfigurableCrudRelatedCollectionColumn[];
  payload?: (values: ConfigurableCrudRecord) => ConfigurableCrudRecord;
};

export type ConfigurableCrudFilterAction = {
  key: string;
  label: string;
  icon: string;
  tooltip?: string;
};

/**
 * Optional contextual action group rendered before the standard Apply/Clear controls.
 * Pages opt in explicitly, so the default CRUD filter layout remains unchanged.
 */
export type ConfigurableCrudFilterActionMenu = {
  label: string;
  icon: string;
  tooltip?: string;
  actions: readonly ConfigurableCrudFilterAction[];
};

export type ConfigurableCrudStatusMode = 'number' | 'string';

export type ConfigurableCrudConfig = {
  endpoint: string;
  /** Optional lifecycle endpoint when a resource reads from a projection but creates elsewhere. */
  createEndpoint?: string;
  /** Optional lifecycle endpoint when updates are handled by a dedicated resource route. */
  updateEndpoint?: string;
  /** Optional lifecycle endpoint for delete. The resolver supports mixed lifecycle rows. */
  deleteEndpoint?: string | ((row: ConfigurableCrudRecord) => string);
  /** Optional lifecycle endpoint for bulk delete. */
  bulkDeleteEndpoint?: string;
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
  relatedCollections?: readonly ConfigurableCrudRelatedCollection[];
  filterActions?: readonly ConfigurableCrudFilterAction[];
  filterActionMenu?: ConfigurableCrudFilterActionMenu;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Optional per-record deletion rule for resources with protected lifecycle states. */
  canDeleteRow?: (row: ConfigurableCrudRecord) => boolean;
  bulkDelete?: boolean;
  statusFilter?: boolean;
  tabLabels?: Partial<Record<NonNullable<ConfigurableCrudField['tab']>, string>>;
  /** Places Authentication directly after Record without changing the default tab sequence. */
  authenticationTabAfterRecord?: boolean;
  /** Uses the API list envelope total/limit/offset instead of slicing a local in-memory page. */
  serverSidePagination?: boolean;
  pageSizeOptions?: readonly number[];
  initialPageSize?: number;
};

export type ConfigurableCrudSaveContext<T extends ConfigurableCrudRecord> = {
  mode: 'create' | 'update';
  saveAndNew: boolean;
  payload: ConfigurableCrudRecord;
  response: unknown;
  record: T | null;
};

export type ConfigurableCrudFilters = {
  search: string;
  status: '' | string | number;
  extra: Record<string, string | number | boolean | null>;
};

export type ConfigurableCrudListParams = ConfigurableCrudFilters & {
  limit: number;
  offset: number;
  pageIndex: number;
  pageSize: number;
};

@Directive()
export abstract class ConfigurableCrudPageBase<T extends ConfigurableCrudRecord> {
  protected readonly api = inject(ApiService);
  protected readonly snack = inject(SnackbarService);
  protected readonly dateTime = inject(DateTimeFormatService);
  protected readonly parameters = inject(SystemParameterService);
  protected readonly dialog = inject(MatDialog);
  protected readonly transloco = inject(TranslocoService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appI18n = inject(AppI18nService);
  protected readonly listLimit = 500;
  protected readonly config: ConfigurableCrudConfig;

  readonly formDialog = viewChild<TemplateRef<unknown>>('crudFormDialog');
  protected dialogBinding: CrudDialogBinding | null = null;

  readonly search = signal('');
  readonly status = signal<'' | string | number>('');
  readonly listFilterValues = signal<Record<string, string | number | boolean | null>>({});
  readonly appliedFilters = signal<ConfigurableCrudFilters>({ search: '', status: '', extra: {} });
  readonly selectedUUIDs = signal(new Set<string>());
  readonly revealedPasswordFields = signal<ReadonlySet<string>>(new Set());
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly serverTotal = signal(0);
  readonly saving = signal(false);
  readonly mutating = signal(false);
  readonly relatedRows = signal<Record<string, ConfigurableCrudRecord[]>>({});
  readonly relatedForms = signal<Record<string, ConfigurableCrudRecord>>({});
  readonly relatedLoading = signal(new Set<string>());
  readonly relatedSaving = signal(new Set<string>());
  readonly postalLookupLoadingKey = signal<string | null>(null);
  readonly editingRecord = signal<T | null>(null);
  readonly formValues = signal<ConfigurableCrudRecord>({});
  readonly enabledCopyActions = signal(new Set<string>());
  readonly defaultCurrency = signal('BRL');
  /**
   * Material owns the live text while a date is incomplete. Keeping that draft outside
   * the form signal prevents Angular from writing an incomplete string back through
   * MatDatepickerInput, which would deserialize it as invalid and clear the input.
   */
  private readonly dateDrafts = new Map<string, string>();

  readonly itemsResource;

  readonly columns = computed(() => this.config.columns.filter((column) => !column.hiddenWhen?.()));
  readonly displayedColumns = computed(() => [
    ...(this.bulkDeleteEnabled() ? ['select'] : []),
    ...this.columns().map((column) => column.id),
    ...(this.hasRowActions() ? ['actions'] : []),
  ]);
  readonly rows = computed(() => this.normalizeRows(this.itemsResource.value() as T[]));
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    if (this.serverSidePagination()) return this.sortedRows();
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly paginatorLength = computed(() =>
    this.serverSidePagination() ? this.serverTotal() : this.sortedRows().length,
  );
  readonly pageSizeOptions = computed(() => this.config.pageSizeOptions ?? [5, 10, 25, 50]);
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
  readonly routingFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'routing'),
  );
  readonly storageFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'storage'),
  );
  readonly monitoringFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'monitoring'),
  );
  readonly matchFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'match'),
  );
  readonly transformFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'transform'),
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
  readonly diagnosticsFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'diagnostics'),
  );
  readonly notesFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'notes'),
  );
  readonly listFilters = computed(() =>
    (this.config.listFilters ?? []).filter((filter) => !filter.hiddenWhen?.()),
  );
  readonly relatedCollections = computed(() => this.config.relatedCollections ?? []);
  readonly showRelatedCollections = computed(
    () => Boolean(this.editingRecord()) && this.relatedCollections().length > 0,
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

  protected constructor(config: ConfigurableCrudConfig) {
    this.config = config;
    this.pageSize.set(config.initialPageSize ?? 5);
    void this.parameters
      .resolveDefaultCurrency('BRL')
      .then((currency) => this.defaultCurrency.set(currency));
    this.formValues.set(this.emptyFormValues());
    this.itemsResource = resource({
      params: () => this.listResourceParams(),
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

  serverSidePagination(): boolean {
    return this.config.serverSidePagination === true;
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
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.editingRecord.set(null);
    this.formValues.set(this.emptyFormValues());
    this.relatedForms.set({});
    this.relatedRows.set({});
    this.enabledCopyActions.set(this.defaultCopyActionKeys());
    for (const action of this.addressCopyActions()) {
      if (this.isCopyActionEnabled(action)) this.copyAddressValues(action);
    }
    this.openDialog();
  }

  startEdit(row: T): void {
    if (!this.canEdit()) return;
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.editingRecord.set(row);
    this.formValues.set(this.formValuesFromRecord(row));
    this.relatedForms.set(this.emptyRelatedForms());
    this.relatedRows.set({});
    this.enabledCopyActions.set(this.inferredCopyActionKeys());
    this.copyEnabledAddressValues();
    this.openDialog();
    void this.loadRelatedCollections();
  }

  async saveItem(saveAndNew = false): Promise<void> {
    if (this.editingRecord() ? !this.canEdit() : !this.canCreate()) return;
    if (!this.commitDateDrafts()) return;
    this.copyEnabledAddressValues();
    const payload = this.augmentPayload(this.buildPayload());
    if (!this.validatePayload(payload)) return;

    this.saving.set(true);
    try {
      const current = this.editingRecord();
      let response: unknown;
      if (current) {
        response = await this.api.put(
          `${this.updateEndpoint()}/${this.recordUUID(current)}`,
          payload,
        );
      } else {
        response = await this.api.post(this.createEndpoint(), payload);
      }
      this.snack.success(this.t(this.config.savedMessage));
      if (current) this.reflectSavedRecord(current, payload);
      this.itemsResource.reload();
      if (saveAndNew) {
        this.editingRecord.set(null);
        this.formValues.set(this.emptyFormValues());
        this.dateDrafts.clear();
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
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteItem(row: T): Promise<void> {
    if (!this.canDeleteRow(row)) return;
    const confirmed = await this.confirm(this.config.deleteTitle, this.config.deleteMessage);
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.api.delete(`${this.deleteEndpointFor(row)}/${this.recordUUID(row)}`);
      this.snack.success(this.t(this.config.deletedMessage));
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || this.config.deleteFailedMessage));
    } finally {
      this.mutating.set(false);
    }
  }

  relatedCollectionRows(collection: ConfigurableCrudRelatedCollection): ConfigurableCrudRecord[] {
    return this.relatedRows()[collection.key] ?? [];
  }

  relatedCollectionFormValue(
    collection: ConfigurableCrudRelatedCollection,
    field: ConfigurableCrudField,
  ): string | number | boolean | null {
    const value = this.relatedForms()[collection.key]?.[field.key];
    if (value === undefined) return '';
    return value as string | number | boolean | null;
  }

  relatedCollectionFieldValueString(
    collection: ConfigurableCrudRelatedCollection,
    field: ConfigurableCrudField,
  ): string {
    const value = this.relatedForms()[collection.key]?.[field.key];
    if (value === undefined || value === null) return '';
    return String(value);
  }

  setRelatedCollectionFieldValue(
    collection: ConfigurableCrudRelatedCollection,
    field: ConfigurableCrudField,
    value: unknown,
  ): void {
    const forms = { ...this.relatedForms() };
    forms[collection.key] = {
      ...(forms[collection.key] ?? collection.initialValues),
      [field.key]: value,
    };
    this.relatedForms.set(forms);
    this.afterRelatedFieldChange(collection, field, value);
  }

  relatedCollectionFieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    return this.lookupOptions(field.key) ?? field.options ?? [];
  }

  relatedCollectionColumnValue(
    row: ConfigurableCrudRecord,
    column: ConfigurableCrudRelatedCollectionColumn,
  ): string {
    if (column.kind === 'related' && column.lookupKey) {
      const value = String(row[column.field ?? column.id] ?? '');
      const option = this.lookupOptions(column.lookupKey).find(
        (candidate) => String(candidate.value) === value,
      );
      return option?.label ?? String(row[column.field ?? column.id] ?? '-');
    }
    if (column.kind === 'status') {
      return this.isTruthyValue(row[column.field ?? column.id])
        ? this.t('Active')
        : this.t('Inactive');
    }
    return this.displayValue(row[column.field ?? column.id]);
  }

  isRelatedCollectionLoading(collection: ConfigurableCrudRelatedCollection): boolean {
    return this.relatedLoading().has(collection.key);
  }

  isRelatedCollectionSaving(collection: ConfigurableCrudRelatedCollection): boolean {
    return this.relatedSaving().has(collection.key);
  }

  relatedCollectionFormValid(collection: ConfigurableCrudRelatedCollection): boolean {
    const form = this.relatedForms()[collection.key] ?? collection.initialValues;
    return collection.fields.every((field) => {
      if (!this.isFieldRequired(field)) return true;
      const value = form[field.key];
      return value !== null && value !== undefined && String(value).trim() !== '';
    });
  }

  async addRelatedCollectionRow(collection: ConfigurableCrudRelatedCollection): Promise<void> {
    if (!this.editingRecord() || !this.relatedCollectionFormValid(collection)) return;
    const parentUUID = this.recordUUID(this.editingRecord() as T);
    const values = this.relatedForms()[collection.key] ?? collection.initialValues;
    const payload = collection.payload
      ? collection.payload(values)
      : this.relatedPayload(values, collection.fields);
    this.setRelatedSaving(collection.key, true);
    try {
      const response = await this.api.post(
        this.relatedCollectionEndpoint(collection, parentUUID),
        payload,
      );
      const rows = extractCrudItems(response);
      this.relatedRows.update((current) => ({
        ...current,
        [collection.key]: rows.length ? rows : this.relatedCollectionRows(collection),
      }));
      this.relatedForms.update((current) => ({
        ...current,
        [collection.key]: { ...collection.initialValues },
      }));
      this.snack.success(this.t(collection.savedMessage ?? 'Record saved successfully.'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.setRelatedSaving(collection.key, false);
    }
  }

  async deleteRelatedCollectionRow(
    collection: ConfigurableCrudRelatedCollection,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (!this.editingRecord()) return;
    const parentUUID = this.recordUUID(this.editingRecord() as T);
    const confirmed = await this.confirm('Delete', 'Delete this record?');
    if (!confirmed) return;
    this.setRelatedSaving(collection.key, true);
    try {
      await this.api.delete(this.relatedCollectionDeleteEndpoint(collection, parentUUID, row));
      this.relatedRows.update((current) => ({
        ...current,
        [collection.key]: this.relatedCollectionRows(collection).filter(
          (candidate) => candidate[collection.uuidField] !== row[collection.uuidField],
        ),
      }));
      this.snack.success(this.t(collection.deletedMessage ?? 'Record deleted successfully.'));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.setRelatedSaving(collection.key, false);
    }
  }

  rowActions(_row: T): readonly ConfigurableCrudRowAction[] {
    return this.config.rowActions ?? [];
  }

  filterActions(): readonly ConfigurableCrudFilterAction[] {
    return this.config.filterActions ?? [];
  }

  filterActionMenu(): ConfigurableCrudFilterActionMenu | null {
    return this.config.filterActionMenu ?? null;
  }

  isFilterActionMenuDisabled(menu: ConfigurableCrudFilterActionMenu): boolean {
    return (
      !menu.actions.length || menu.actions.every((action) => this.isFilterActionDisabled(action))
    );
  }

  isFilterActionDisabled(_action: ConfigurableCrudFilterAction): boolean {
    return false;
  }

  canDeleteRow(row: T): boolean {
    return this.canDelete() && (this.config.canDeleteRow?.(row) ?? true);
  }

  handleRowAction(_action: ConfigurableCrudRowAction, _row: T): void | Promise<void> {}

  handleFilterAction(_action: ConfigurableCrudFilterAction): void | Promise<void> {}

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
      await this.api.delete(this.bulkDeleteEndpoint(), {
        ids,
      });
      this.selectedUUIDs.set(new Set());
      this.snack.success(this.t(this.config.deletedMessage));
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || this.config.deleteFailedMessage));
    } finally {
      this.mutating.set(false);
    }
  }

  closeDialog(): void {
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.dialogBinding?.ref.close();
  }

  fieldValue(key: string): string | number | boolean | null {
    const value = this.formValues()[key];
    if (value === undefined) return '';
    return value as string | number | boolean | null;
  }

  fieldValueString(key: string): string {
    const value = this.formValues()[key];
    const field = this.config.fields.find((candidate) => candidate.key === key);
    if (field?.type === 'date') return this.formatDateForInput(value);
    return value === null || value === undefined ? '' : String(value);
  }

  htmlInputType(field: ConfigurableCrudField): 'email' | 'number' | 'password' | 'text' {
    if (field.type === 'number') return 'number';
    if (field.type === 'email') return 'email';
    if (field.type === 'password') {
      return this.revealedPasswordFields().has(field.key) ? 'text' : 'password';
    }
    return 'text';
  }

  isPasswordVisible(key: string): boolean {
    return this.revealedPasswordFields().has(key);
  }

  togglePasswordVisibility(key: string): void {
    this.revealedPasswordFields.update((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /** Value binding for MatDatepickerInput must always be a Date or null, never typed text. */
  fieldDateValue(key: string): Date | null {
    const normalized = this.normalizeDateForPayload(this.formValues()[key]);
    if (!normalized) return null;

    const [year, month, day] = normalized.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  onDateInput(key: string, event: { value: Date | null; targetElement: HTMLElement }): void {
    const rawValue =
      event.targetElement instanceof HTMLInputElement ? event.targetElement.value.trim() : '';

    // A non-empty null value is an incomplete or invalid draft. Do not write it through
    // the datepicker value accessor, otherwise Material clears the user's typed text.
    if (event.value === null && rawValue) {
      this.dateDrafts.set(key, rawValue);
      return;
    }

    this.dateDrafts.delete(key);
    this.setFieldValue(key, event.value);
  }

  currencyForField(field: ConfigurableCrudField): string {
    const fromRecord = field.currencyKey ? this.formValues()[field.currencyKey] : null;
    const candidate = fromRecord ?? field.currencyCode ?? this.defaultCurrency();
    const currency = String(candidate ?? '')
      .trim()
      .toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : this.defaultCurrency();
  }

  currencyLabelSuffix(field: ConfigurableCrudField): string {
    return field.type === 'currency' ? ` (${this.currencyForField(field)})` : '';
  }

  fieldValueArray(key: string): readonly unknown[] {
    const value = this.formValues()[key];
    return Array.isArray(value) ? value : [];
  }

  fieldFileName(key: string): string {
    const value = this.formValues()[key];
    return value instanceof File ? value.name : '';
  }

  onFileInput(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFieldValue(key, input.files?.[0] ?? null);
  }

  setFieldValue(key: string, value: unknown): void {
    this.formValues.update((current) => ({ ...current, [key]: value }));
    this.onFieldValueChanged(key, value);
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
    const breakBefore =
      field.breakBefore ||
      field.breakBeforeWhen?.({
        editing: Boolean(this.editingRecord()),
        values: this.formValues(),
      });
    return [`span-${field.span ?? 1}`, breakBefore ? 'break-before' : ''].filter(Boolean).join(' ');
  }

  fieldLabel(field: ConfigurableCrudField): string {
    return (
      field.labelWhen?.({
        editing: Boolean(this.editingRecord()),
        values: this.formValues(),
      }) ?? field.label
    );
  }

  translatedFieldLabel(field: ConfigurableCrudField): string {
    const label = this.fieldLabel(field);
    return field.translateLabel === false ? label : this.t(label);
  }

  translatedOptionLabel(field: ConfigurableCrudField, option: ConfigurableCrudOption): string {
    return field.translateOptions === false ? option.label : this.t(option.label);
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

  listFilterLoading(filter: ConfigurableCrudListFilter): boolean {
    return filter.loading?.() ?? false;
  }

  fieldLoading(field: ConfigurableCrudField): boolean {
    return field.loading?.() ?? false;
  }

  canQuickCreate(field: ConfigurableCrudField): boolean {
    const quickCreate = field.quickCreate;
    if (!quickCreate) return false;
    const context: ConfigurableCrudQuickCreateContext = {
      editing: Boolean(this.editingRecord()),
      values: this.formValues(),
    };
    return typeof quickCreate.enabled === 'function'
      ? quickCreate.enabled(context)
      : quickCreate.enabled !== false;
  }

  quickCreateLabel(field: ConfigurableCrudField): string {
    return field.quickCreate?.label ?? 'Create new';
  }

  async quickCreateField(field: ConfigurableCrudField): Promise<void> {
    const quickCreate = field.quickCreate;
    if (!quickCreate || !this.canQuickCreate(field)) return;

    const ref = this.dialog.open<unknown, unknown, ConfigurableCrudQuickCreateResult>(
      quickCreate.component,
      {
        width: '0',
        height: '0',
        maxWidth: '0',
        maxHeight: '0',
        autoFocus: false,
        restoreFocus: true,
        panelClass: ['quick-create-host-dialog'],
      },
    );
    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.option) return;

    this.afterQuickCreate(field, result.option, result);
    this.setFieldValue(field.key, result.option.value);
  }

  protected afterQuickCreate(
    _field: ConfigurableCrudField,
    _option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void {}

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

  statusLabelForColumn(row: T, column: ConfigurableCrudColumn): string {
    const value = row[column.field ?? column.id];
    const options = column.options ?? this.statusOptions();
    const option = options.find(
      (candidate) => String(candidate.value ?? '') === String(value ?? ''),
    );
    return option?.label ?? this.statusLabel(value);
  }

  statusChipClass(row: T, column: ConfigurableCrudColumn): string {
    const value = row[column.field ?? column.id];
    const customClass = column.chipClass?.(value, row);
    if (customClass) return customClass;
    return this.isActiveStatus(value) ? 'chip-success' : 'chip-skipped';
  }

  hasCustomStatusChipClass(column: ConfigurableCrudColumn): boolean {
    return typeof column.chipClass === 'function';
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
    const value = this.displayValue(row[field]);
    return column.translateValue && value !== '-' ? this.transloco.translate(value) : value;
  }

  columnUUID(row: T, column: ConfigurableCrudColumn): string {
    if (column.uuidField) return this.displayValue(row[column.uuidField]);
    return column.kind === 'identity' ? this.recordUUID(row) : '';
  }

  columnText(row: T, column: ConfigurableCrudColumn): string {
    const field = column.field ?? column.id;
    if (column.lookupKey) {
      return this.lookupLabel(column.lookupKey, row[field]) || this.displayValue(row[field]);
    }
    if (column.kind === 'boolean') return this.booleanLabel(row[field]);
    if (column.kind === 'date') return this.dateTime.formatDate(this.dateValue(row[field])) || '-';
    if (column.kind === 'datetime' || this.isDateTimeColumn(column, row[field])) {
      return this.dateTime.formatDateTime(this.dateValue(row[field])) || '-';
    }
    if (column.kind === 'currency') return this.formatCurrencyColumn(row, column, row[field]);
    if (column.kind === 'number') return this.formatNumberColumn(column, row[field]);
    if (column.translateValue) {
      const value = this.displayValue(row[field]);
      return value === '-' ? value : this.transloco.translate(value);
    }
    return this.displayValue(row[field]);
  }

  canCopyColumn(row: T, column: ConfigurableCrudColumn): boolean {
    return column.copyable === true && this.columnCopyValue(row, column) !== '';
  }

  async copyColumnValue(row: T, column: ConfigurableCrudColumn): Promise<void> {
    const value = this.columnCopyValue(row, column);
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      this.snack.success(this.t('Data copied.'));
    } catch {
      this.snack.error(this.t('Failed to copy data.'));
    }
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

  protected afterRelatedFieldChange(
    _collection: ConfigurableCrudRelatedCollection,
    _field: ConfigurableCrudField,
    _value: unknown,
  ): void {}

  protected deleteEndpointFor(row: T): string {
    const endpoint = this.config.deleteEndpoint;
    return typeof endpoint === 'function' ? endpoint(row) : (endpoint ?? this.config.endpoint);
  }

  protected listEndpoint(): string {
    return this.config.endpoint;
  }

  protected createEndpoint(): string {
    return this.config.createEndpoint ?? this.config.endpoint;
  }

  protected updateEndpoint(): string {
    return this.config.updateEndpoint ?? this.config.endpoint;
  }

  protected bulkDeleteEndpoint(): string {
    return this.config.bulkDeleteEndpoint ?? `${this.config.endpoint}/bulk`;
  }

  protected relatedCollectionEndpoint(
    collection: ConfigurableCrudRelatedCollection,
    parentUUID: string,
  ): string {
    return collection.endpoint(parentUUID);
  }

  protected relatedCollectionDeleteEndpoint(
    collection: ConfigurableCrudRelatedCollection,
    parentUUID: string,
    row: ConfigurableCrudRecord,
  ): string {
    return collection.deleteEndpoint(parentUUID, row);
  }

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

  private emptyRelatedForms(): Record<string, ConfigurableCrudRecord> {
    const forms: Record<string, ConfigurableCrudRecord> = {};
    for (const collection of this.relatedCollections()) {
      forms[collection.key] = { ...collection.initialValues };
    }
    return forms;
  }

  private async loadRelatedCollections(): Promise<void> {
    const row = this.editingRecord();
    if (!row) return;
    const parentUUID = this.recordUUID(row);
    await Promise.all(
      this.relatedCollections().map((collection) =>
        this.loadRelatedCollection(collection, parentUUID),
      ),
    );
  }

  private async loadRelatedCollection(
    collection: ConfigurableCrudRelatedCollection,
    parentUUID: string,
  ): Promise<void> {
    this.setRelatedLoading(collection.key, true);
    try {
      const response = await this.api.get(collection.endpoint(parentUUID));
      this.relatedRows.update((current) => ({
        ...current,
        [collection.key]: extractCrudItems(response),
      }));
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.setRelatedLoading(collection.key, false);
    }
  }

  private relatedPayload(
    values: ConfigurableCrudRecord,
    fields: readonly ConfigurableCrudField[],
  ): ConfigurableCrudRecord {
    const payload: ConfigurableCrudRecord = {};
    for (const field of fields) {
      payload[field.payloadKey ?? field.key] = values[field.key] ?? null;
    }
    return payload;
  }

  private setRelatedLoading(key: string, loading: boolean): void {
    this.relatedLoading.update((current) => {
      const next = new Set(current);
      if (loading) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  private setRelatedSaving(key: string, saving: boolean): void {
    this.relatedSaving.update((current) => {
      const next = new Set(current);
      if (saving) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<T[]> {
    const params = new URLSearchParams();
    const limit = this.serverSidePagination()
      ? (filters as ConfigurableCrudListParams).limit
      : this.listLimit;
    const offset = this.serverSidePagination() ? (filters as ConfigurableCrudListParams).offset : 0;
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    if (filters.search) params.set('search', filters.search);
    if (this.statusFilterEnabled() && filters.status !== '')
      params.set('status', String(filters.status));
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }

    const response = await this.api.get(`${this.listEndpoint()}?${params.toString()}`);
    const data = (response as { data?: unknown })?.data;
    if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
      if (this.serverSidePagination()) {
        const total = Number((data as { total?: unknown }).total ?? 0);
        this.serverTotal.set(Number.isFinite(total) ? total : 0);
      }
      return (data as { items: T[] }).items;
    }
    if (this.serverSidePagination()) this.serverTotal.set(0);
    return [];
  }

  private listResourceParams(): ConfigurableCrudFilters | ConfigurableCrudListParams {
    const filters = this.appliedFilters();
    if (!this.serverSidePagination()) return filters;
    const pageSize = this.pageSize();
    const pageIndex = this.pageIndex();
    return {
      ...filters,
      pageSize,
      pageIndex,
      limit: pageSize,
      offset: pageIndex * pageSize,
    };
  }

  private normalizeRows(rows: T[] | undefined): T[] {
    return Array.isArray(rows) ? rows : [];
  }

  private sortRows(rows: T[]): T[] {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    const column = this.columns().find((item) => item.id === active);
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
    if (column.kind === 'currency' || column.kind === 'number') {
      const numeric = Number(row[field]);
      return Number.isFinite(numeric) ? String(numeric).padStart(16, '0') : '';
    }
    if (
      column.kind === 'date' ||
      column.kind === 'datetime' ||
      this.isDateTimeColumn(column, row[field])
    ) {
      return String(this.dateTime.toEpoch(this.dateValue(row[field]))).padStart(16, '0');
    }
    return this.displayValue(row[field]).toLowerCase();
  }

  private columnCopyValue(row: T, column: ConfigurableCrudColumn): string {
    const value =
      column.kind === 'identity' || column.kind === 'related'
        ? this.columnMain(row, column)
        : this.columnText(row, column);
    return value === '-' ? '' : value.trim();
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

  private formatCurrencyColumn(row: T, column: ConfigurableCrudColumn, value: unknown): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    const candidate = column.currencyField ? row[column.currencyField] : column.currencyCode;
    const currency = String(candidate ?? column.currencyCode ?? this.defaultCurrency())
      .trim()
      .toUpperCase();
    const currencyCode = /^[A-Z]{3}$/.test(currency) ? currency : this.defaultCurrency();
    try {
      return new Intl.NumberFormat(this.appI18n.language(), {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: column.minimumFractionDigits ?? 2,
        maximumFractionDigits: column.maximumFractionDigits ?? 2,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(column.maximumFractionDigits ?? 2)}`;
    }
  }

  private formatNumberColumn(column: ConfigurableCrudColumn, value: unknown): string {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return '-';
    try {
      return new Intl.NumberFormat(this.appI18n.language(), {
        minimumFractionDigits: column.minimumFractionDigits ?? 0,
        maximumFractionDigits: column.maximumFractionDigits ?? 6,
      }).format(amount);
    } catch {
      return String(amount);
    }
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

  protected formValuesFromRecord(row: T): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      const value = row[field.source ?? field.key] ?? this.config.initialValues[field.key] ?? '';
      const formatted = field.format === 'json' ? this.formatJsonValue(value) : value;
      next[field.key] = field.fromRecord ? field.fromRecord(formatted, row) : formatted;
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
      if (field.type === 'date') {
        const normalizedDate = this.normalizeDateForPayload(value);
        if (normalizedDate !== undefined) value = normalizedDate;
      }
      if (field.type === 'currency') {
        const normalizedCurrency = this.normalizeCurrencyForPayload(
          value,
          this.currencyForField(field),
        );
        if (normalizedCurrency !== undefined) value = normalizedCurrency;
      }
      if (typeof value === 'string') value = value.trim();
      if (value === '') value = null;
      payload[key] = value;
    }
    return payload;
  }

  private normalizeCurrencyForPayload(value: unknown, currency: string): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    return parseCurrencyAmount(value, this.currencyLocale(currency)) ?? undefined;
  }

  private currencyLocale(currency: string): string {
    return (
      ({ BRL: 'pt-BR', EUR: 'de-DE', GBP: 'en-GB', USD: 'en-US' } as Record<string, string>)[
        currency
      ] ?? this.dateTime.locale()
    );
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

  protected validatePayload(payload: ConfigurableCrudRecord): boolean {
    for (const field of this.config.fields) {
      const value = payload[field.payloadKey ?? field.key];
      if (this.isFieldVisible(field) && field.type === 'date' && value !== null && value !== '') {
        if (this.normalizeDateForPayload(value) === undefined) {
          this.snack.warning('Invalid date. Use the system date format.');
          return false;
        }
      }
      if (!this.isFieldVisible(field) || !this.isFieldRequired(field)) continue;
      if (value === null || value === undefined || value === '') {
        this.snack.warning('Required fields are missing.');
        return false;
      }
    }
    return true;
  }

  /**
   * A partial date must not replace the current form value while the user is typing,
   * because MatDatepickerInput only accepts Date values. Before saving, validate and
   * commit any remaining locale-formatted drafts into the canonical date-only value.
   */
  private commitDateDrafts(): boolean {
    if (this.dateDrafts.size === 0) return true;

    const committed: ConfigurableCrudRecord = {};
    for (const [key, draft] of this.dateDrafts) {
      const normalized = this.normalizeDateForPayload(draft);
      if (!normalized) {
        this.snack.warning('Invalid date. Use the system date format.');
        return false;
      }
      committed[key] = normalized;
    }

    this.formValues.update((values) => ({ ...values, ...committed }));
    this.dateDrafts.clear();
    return true;
  }

  private normalizeDateForPayload(value: unknown): string | null | undefined {
    if (value === null || value === undefined || value === '') return null;
    return toDateOnly(value, this.appI18n.language()) ?? undefined;
  }

  private formatDateForInput(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return '';
      return formatDateInput(value, this.appI18n.language());
    }
    if (typeof value !== 'string') return String(value);

    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!iso) return value;
    const normalized = toDateOnly(value, this.appI18n.language());
    if (!normalized) return value;
    return formatDateInput(new Date(`${normalized}T00:00:00`), this.appI18n.language());
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
      data: {
        title: this.t(title),
        message: this.t(message),
        confirmLabel: this.t(confirmLabel),
      },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private async confirm(title: string, message: string): Promise<boolean> {
    return this.confirmAction(title, message, 'Delete');
  }

  protected errorMessage(error: unknown): string {
    if (error && typeof error === 'object') {
      const maybe = error as { error?: { error?: string; message?: string }; message?: string };
      return maybe.error?.error ?? maybe.error?.message ?? maybe.message ?? 'Operation failed.';
    }
    return 'Operation failed.';
  }

  protected t(key: string, params?: Record<string, string | number>): string {
    return this.transloco.translate(key, params);
  }
}

function extractCrudItems(response: unknown): ConfigurableCrudRecord[] {
  const data = (response as { data?: unknown })?.data;
  if (Array.isArray(data)) return data as ConfigurableCrudRecord[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: ConfigurableCrudRecord[] }).items;
  }
  return [];
}
