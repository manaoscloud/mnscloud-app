import { crudReportMask } from './crud-report-mask';
import { generateCrudPassword } from './password-generation';
import { PhoneInputComponent } from '../../phone-input/phone-input.component';
import { remoteLookupParameters } from './remote-lookup-parameters';
import { isRecordUUID, shortRecordUUID } from './record-uuid-label';
import { MNS_MENU } from '../../menu/mns-menu';
import {
  CrudDensity,
  CrudViewPreferences,
  DEFAULT_CRUD_VIEW,
  crudViewStorageKey,
  isCrudColumnVisible,
  isDefaultCrudView,
  readCrudViewPreferences,
  setCrudColumnVisible,
  writeCrudViewPreferences,
} from './crud-view-preferences';

/** Revealed secrets hide again after this delay. */
const SECRET_REVEAL_MS = 10_000;
/** Table view menus with more columns than this offer a column search. */
const COLUMN_SEARCH_MIN = 8;
import { resolveCrudFieldHelp } from './crud-field-help';
import { FieldHelpComponent } from '../../forms/field-help';
import { payErrorMessage } from '../../payment/pay-error';
import { billingErrorText } from '../../billing/billing-error';
import { CheckboxGroupFieldComponent } from '../../forms/checkbox-group-field';
import { AsyncOperationsService } from '../../operations/async-operations.service';
import {
  Directive,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  Type,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgClass, NgComponentOutlet, NgTemplateOutlet } from '@angular/common';

import { firstValueFrom, map, Observable } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogState } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabGroup, MatTabsModule } from '@angular/material/tabs';
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
import { MnsOverflowTooltipDirective } from '../../overflow-tooltip/overflow-tooltip.directive';
import { formatDateInput, toDateOnly } from '../../date-mask/date-input-format';
import { MnsDateAdapterModule } from '../../date-mask/mns-date-adapter.module';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../dialog/crud-dialog.util';
import { CONFIGURABLE_CRUD_QUICK_CREATE, quickCreateRegistryEntry } from './quick-create';
import {
  CONFIGURABLE_CRUD_EMBEDDED,
  ConfigurableCrudEmbeddedHost,
} from './configurable-crud-embedded';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import { bindDialogClosed } from '../../dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../forms/mns-search-select-field/mns-search-select-field';
import { MnsPermissionTreeFieldComponent } from '../../forms/mns-permission-tree-field/mns-permission-tree-field';
import { SecretContentFieldComponent } from '../../secret-content/secret-content-field';
import { FieldInvalidDirective } from '../../forms/field-invalid.directive';
import {
  FieldError,
  customFieldError,
  fieldError,
  focusFirstInvalidField,
  isBlankFieldValue,
  missingFieldsToast,
} from '../../forms/field-validation';
import { apiErrorFields } from '../../../services/api-error-fields';
import { RefreshButtonComponent } from '../../refresh-button/refresh-button';
import { ReportProblemButtonComponent } from '../../support-report-dialog/report-problem-button';
import { SlowConfirmDialogComponent } from '../../slow-confirm-dialog/slow-confirm-dialog';
import {
  buildFileUploadViewModel,
  createInitialFileUploadProgress,
  FileUploadExecution,
  FileUploadProgress,
  runFileUploadExecution,
} from '../../upload/file-upload-progress';

export const CONFIGURABLE_CRUD_IMPORTS = [
  FieldInvalidDirective,
  FieldHelpComponent,
  ReportProblemButtonComponent,
  CheckboxGroupFieldComponent,
  SecretContentFieldComponent,
  RouterLink,
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
  MNS_MENU,
  MatPaginatorModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatSelectModule,
  MatSortModule,
  MatTableModule,
  MatTabsModule,
  PhoneInputComponent,
  MatTooltipModule,
  NgTemplateOutlet,
  NgComponentOutlet,
  NgClass,
  MnsSearchSelectFieldComponent,
  MnsPermissionTreeFieldComponent,
  TranslocoPipe,
  CurrencyMaskDirective,
  DateMaskDirective,
  MnsDateAdapterModule,
  MnsOverflowTooltipDirective,
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

/**
 * Opens the referenced resource's canonical configurable CRUD page (`component` or lazy
 * `loadComponent`) in quick-create mode. Never point this at a lightweight duplicate form.
 */
export type ConfigurableCrudQuickCreateConfig = {
  /** Explicit related-resource values, calculated from the parent form; never authority. */
  initialValues?:
    | ConfigurableCrudRecord
    | ((context: ConfigurableCrudQuickCreateContext) => ConfigurableCrudRecord);
  enabled?: boolean | ((context: ConfigurableCrudQuickCreateContext) => boolean);
  label?: string;
  component?: Type<unknown>;
  loadComponent?: () => Promise<Type<unknown>>;
  /** Effective permission required to create the referenced record (e.g. master-only resources). */
  permission?: string;
  /** Route data the referenced page reads (e.g. `scope`, a catalog kind) when opened in place. */
  routeData?: Record<string, unknown>;
};

export type ConfigurableCrudFieldType =
  | 'secret-content'
  | 'time'
  | 'datetime'
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'currency'
  | 'phone'
  | 'date'
  | 'select'
  | 'checkbox-group'
  | 'multi-select'
  | 'search-select'
  | 'permission-tree'
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
  /** Receives the IBGE municipality code (7 digits) of Brazilian postal codes. */
  municipalityCodeKey?: string;
  numberKey?: string;
};

export type ConfigurableCrudField = {
  remoteLookup?: {
    endpoint: string;
    uuidField: string;
    labelField: string;
    /** Optional secondary line of each option (for example an e-mail). */
    descriptionField?: string;
    selectedLabelField?: string;
    /** Query parameter -> parent form field. Waits until all bound values are present. */
    parameters?: Readonly<Record<string, string>>;
    /**
     * Form field -> field of the selected item. On selection, each empty (or previously filled)
     * target receives the item's value; values typed by the operator are never overwritten.
     */
    fill?: Readonly<Record<string, string>>;
    searchParam?: string;
  };
  key: string;
  /** Explicit capture classification for non-secret controls with credential-like names. */
  reportMask?: boolean;
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
    | 'public'
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
    | 'fiscal'
    | 'diagnostics'
    | 'codecs'
    | 'retention'
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
  /** Generated credential length; APIs remain responsible for credential policy. */
  generatedPasswordLength?: number;
  /** Discriminator field for a structured secret editor. */
  contentTypeKey?: string;
  accept?: string;
  /** ISO 4217 code used when the record does not carry its own currency field. */
  currencyCode?: string;
  /** Key holding the ISO 4217 code for this monetary value. */
  currencyKey?: string;
  options?: readonly ConfigurableCrudOption[];
  /**
   * FK quick-create. Omitted: resolved from `QUICK_CREATE_REGISTRY` by `source`. `false` opts
   * out and requires `quickCreateExemptReason` (enforced by `npm run check:crud:fk`).
   */
  quickCreate?: ConfigurableCrudQuickCreateConfig | false;
  quickCreateExemptReason?: string;
  /** Set to false for protocol/vendor option labels that must remain literal. */
  translateOptions?: boolean;
  /** Enables multiple selection for a searchable relation field. */
  multiple?: boolean;
  /**
   * Single remote relation only: when creating and the first unfiltered page has exactly one
   * option, select it. The operator still sees and can change it; nothing is selected on edit.
   */
  autoSelectSingle?: boolean;
  loading?: () => boolean;
  hiddenWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  requiredWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  disabledWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  /** Optional supplementary guidance; translated and rendered by the shared help control. */
  help?: string;
  helpWhen?: (context: ConfigurableCrudFieldContext) => string;
  /** Interpolation values for the guidance key (e.g. `{{ ip }}`), so the text stays translatable. */
  helpParams?: (context: ConfigurableCrudFieldContext) => Record<string, string | number>;
  suffixButtons?: readonly ConfigurableCrudFieldSuffixButton[];
};

export type ConfigurableCrudFieldSuffixButton = {
  icon: string;
  tooltip: string;
  color?: 'primary' | 'accent' | 'warn';
  visibleWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  disabledWhen?: (context: ConfigurableCrudFieldContext) => boolean;
  onClick: (
    context: ConfigurableCrudFieldContext,
    host: ConfigurableCrudPageBase<any>,
  ) => void | Promise<void>;
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
    | 'number'
    | 'image'
    /** Credential shown masked, with per-row show (auto-hides) and copy actions. */
    | 'secret';
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
  /**
   * `secret` columns whose value is not in the list: fetched only on Show/Copy (for example a
   * generated password revealed by a dedicated audited endpoint) and dropped again on hide.
   */
  secretLoader?: (row: ConfigurableCrudRecord) => Promise<string>;
  /** With `secretLoader`: whether this row has a value to load (defaults to true). */
  secretAvailable?: (row: ConfigurableCrudRecord) => boolean;
  hiddenWhen?: () => boolean;
  /**
   * Computed display value (also used for sorting); `translate` resolves Transloco keys and
   * `filters` holds the applied list filter values (for example a test number).
   */
  value?: (
    row: ConfigurableCrudRecord,
    translate: (key: string) => string,
    filters: Readonly<Record<string, string | number | boolean | null>>,
  ) => string;
  /** Material icon shown before a text cell value (for example the resource type). */
  icon?: (row: ConfigurableCrudRecord) => string;
  /** Secondary line under identity/related values, shown instead of the UUID when not empty. */
  detail?: (row: ConfigurableCrudRecord, translate: (key: string) => string) => string;
  /** Key of a row action: the cell value becomes a link that runs it (when the action is visible). */
  rowAction?: string;
  /**
   * Maximum width of the single-line cell value before it is truncated with an ellipsis (the
   * full value shows in a tooltip). Defaults to `lg` for text, identity and related columns.
   */
  width?: ConfigurableCrudColumnWidth;
  /** Hidden by default; users can show it from the table view menu. */
  optional?: boolean;
};

export type ConfigurableCrudColumnWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type ConfigurableCrudListFilter = {
  remoteLookup?: ConfigurableCrudField['remoteLookup'];
  key: string;
  label: string;
  paramKey?: string;
  /** `text` is a free-form input applied like Search (Enter or Apply). */
  type: 'select' | 'search-select' | 'text';
  /**
   * Client-side predicate over the loaded rows. A filter with `match` is never sent to the API
   * (for example testing a number against each row regex).
   */
  match?: (row: ConfigurableCrudRecord, value: string | number | boolean) => boolean;
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
  visible?: (row: ConfigurableCrudRecord) => boolean;
  /**
   * Keeps the action listed but disabled for this row; the returned translation key tells the
   * user why (shown under the label). Return `null` when the action is available.
   */
  disabledReason?: (row: ConfigurableCrudRecord) => string | null;
  collection?: (row: ConfigurableCrudRecord) => ConfigurableCrudConfig;
  form?: (row: ConfigurableCrudRecord) => ConfigurableCrudConfig;
  /** Declarative one-click API call (for example "set as cover"); reloads the list on success. */
  request?: ConfigurableCrudRowActionRequest;
  /** Client-side action (for example downloading a private file); also works inside collection dialogs. */
  run?: (row: ConfigurableCrudRecord) => void | Promise<void>;
};

export type ConfigurableCrudRowActionRequest = {
  method: 'post' | 'put';
  endpoint: (row: ConfigurableCrudRecord) => string;
  /** Request body; defaults to `{}`. */
  body?: (row: ConfigurableCrudRecord) => Record<string, unknown>;
  successMessage: string;
  confirm?: { title: string; message: string; confirmLabel?: string };
};

export type ConfigurableCrudRelatedCollectionColumn = {
  id: string;
  label: string;
  field?: string;
  kind?: 'text' | 'number' | 'status' | 'related';
  lookupKey?: string;
  /** Computed display value; `translate` resolves Transloco keys. */
  value?: (row: ConfigurableCrudRecord, translate: (key: string) => string) => string;
};

/**
 * Child records edited inside a parent form tab. The tab renders the global table
 * (`ConfigurableCrudEmbeddedCollection`): search, status filter, density, columns, pagination,
 * mobile cards, report problem and the standard create/edit dialog for `fields`.
 */
export type ConfigurableCrudRelatedCollection = {
  key: string;
  label: string;
  emptyLabel: string;
  /** Label of the header create button (defaults to `New`). */
  addLabel?: string;
  /** Title of the create dialog (defaults to `addLabel`, then `New`). */
  createTitle?: string;
  /** Title of the edit dialog; editing needs `updateEndpoint`. */
  editTitle?: string;
  dialogDescription?: string;
  savedMessage?: string;
  deletedMessage?: string;
  endpoint: (parentUUID: string) => string;
  deleteEndpoint: (parentUUID: string, row: ConfigurableCrudRecord) => string;
  /** Update route without the record UUID (the table appends it); enables the edit action. */
  updateEndpoint?: (parentUUID: string) => string;
  uuidField: string;
  initialValues: ConfigurableCrudRecord;
  fields: readonly ConfigurableCrudField[];
  columns: readonly ConfigurableCrudRelatedCollectionColumn[];
  payload?: (values: ConfigurableCrudRecord) => ConfigurableCrudRecord;
  /** Declarative per-row API actions rendered before delete; the collection reloads on success. */
  rowActions?: readonly ConfigurableCrudRelatedRowAction[];
};

export type ConfigurableCrudRelatedRowAction = {
  key: string;
  label: string;
  icon: string;
  visible?: (row: ConfigurableCrudRecord) => boolean;
  request: ConfigurableCrudRowActionRequest;
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
  collectionDialog?: boolean;
  formOnly?: boolean;
  /** Set by `ConfigurableCrudEmbeddedCollection`: the table renders inside a parent form tab. */
  embedded?: boolean;
  /** Label of the header create button (defaults to `New`). */
  createLabel?: string;
  /**
   * Read-only global table (`mns-global-table`): no filters, header actions, create, edit, delete
   * or selection; sorting, density, columns, pagination, mobile cards and row actions remain.
   */
  readOnly?: boolean;
  /** Local rows instead of an API list (dashboards and result panels); `endpoint` is not read. */
  rows?: () => readonly ConfigurableCrudRecord[];
  /** Loading state of local `rows`. */
  rowsLoading?: () => boolean;
  /** `false` hides the paginator when the page paginates the rows itself. */
  pagination?: boolean;
  defaultCurrencyFields?: readonly string[];
  defaultCurrencyScope?: 'master' | 'tenant';
  payload?: (values: ConfigurableCrudRecord, editing: boolean) => ConfigurableCrudRecord;
  endpoint: string;
  /** Optional lifecycle endpoint when a resource reads from a projection but creates elsewhere. */
  createEndpoint?: string;
  /** Optional lifecycle endpoint when updates are handled by a dedicated resource route. */
  updateEndpoint?: string;
  /** Optional lifecycle endpoint for delete. The resolver supports mixed lifecycle rows. */
  deleteEndpoint?: string | ((row: ConfigurableCrudRecord) => string);
  /** Resource-specific concurrency precondition, e.g. the revision confirmed by the user. */
  deletePayload?: (row: ConfigurableCrudRecord) => ConfigurableCrudRecord;
  /** Optional lifecycle endpoint for bulk delete. */
  bulkDeleteEndpoint?: string;
  /** Preconditions captured from selected rows, such as optimistic revisions. */
  bulkDeletePayload?: (rows: ConfigurableCrudRecord[]) => ConfigurableCrudRecord;
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
  /**
   * Fresh values for each create dialog (generated usernames, passwords, codes). Never used to
   * fill an edit dialog: a generated value would look persisted and be saved over the record.
   */
  initialValuesFactory?: () => ConfigurableCrudRecord;
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
  /**
   * Derives dependent form values after a field changes. `current` already holds the new `value`
   * under `key`; return the complete next record.
   */
  fieldChange?: (
    key: string,
    value: unknown,
    current: ConfigurableCrudRecord,
  ) => ConfigurableCrudRecord;
  filterActions?: readonly ConfigurableCrudFilterAction[];
  filterActionMenu?: ConfigurableCrudFilterActionMenu;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Field key whose value labels a record created through FK quick-create. Defaults to `name`. */
  quickCreateLabelField?: string;
  /** Optional per-record deletion rule for resources with protected lifecycle states. */
  canEditRow?: (row: ConfigurableCrudRecord) => boolean;
  canDeleteRow?: (row: ConfigurableCrudRecord) => boolean;
  bulkDelete?: boolean;
  statusFilter?: boolean;
  tabLabels?: Partial<Record<NonNullable<ConfigurableCrudField['tab']>, string>>;
  /** Places Authentication directly after Record without changing the default tab sequence. */
  authenticationTabAfterRecord?: boolean;
  /**
   * Create sends the selected file field as multipart/form-data with upload progress instead of
   * JSON (for upload-only collections such as product images). Updates stay JSON.
   */
  createUpload?: { fileField: string; formField: string };
  /** Fixed list query parameters sent with every list request (for example `scope=all`). */
  listQuery?: Readonly<Record<string, string>>;
  /** Uses the API list envelope total/limit/offset instead of slicing a local in-memory page. */
  serverSidePagination?: boolean;
  /** Send canonical column fields to APIs supporting global ordering. */
  serverSideSorting?: boolean;
  pageSizeOptions?: readonly number[];
  initialPageSize?: number;
  /**
   * @deprecated Async operation feedback lives in the shell Activity Center.
   * This flag is ignored and kept only for temporary call-site compatibility.
   */
  showAsyncOperationStatus?: boolean;
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
  sortBy?: string;
  sortDirection?: string;
  pageIndex: number;
  pageSize: number;
};

@Directive()
export abstract class ConfigurableCrudPageBase<T extends ConfigurableCrudRecord> {
  protected readonly operations = inject(AsyncOperationsService);
  protected trackOperation(response: unknown): boolean {
    return this.operations.observe(response, this.destroyRef, () => this.refreshList());
  }

  readonly api = inject(ApiService);
  private readonly quickCreateAuth = inject(AuthService);
  readonly snack = inject(SnackbarService);
  protected readonly dateTime = inject(DateTimeFormatService);
  protected readonly parameters = inject(SystemParameterService);
  protected readonly dialog = inject(MatDialog);
  protected readonly transloco = inject(TranslocoService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly appI18n = inject(AppI18nService);
  protected readonly listLimit = 500;
  protected readonly config: ConfigurableCrudConfig;
  private readonly quickCreateSession = inject(CONFIGURABLE_CRUD_QUICK_CREATE, { optional: true });
  /** True when this page runs as the create form of an FK select in another CRUD. */
  readonly quickCreateMode = this.quickCreateSession !== null;
  private quickCreateSaving = false;
  private quickCreateResult: ConfigurableCrudQuickCreateResult | null = null;
  /** Options created through quick-create, merged into the field options until the next reload. */
  private readonly quickCreatedOptions = signal<Record<string, ConfigurableCrudOption[]>>({});

  readonly formDialog = viewChild<TemplateRef<unknown>>('crudFormDialog');
  protected dialogBinding: CrudDialogBinding | null = null;
  readonly isFormDialogOpen = signal(false);

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
  /** Generic file-upload-progress state (app.md "File Upload Progress Baseline"). */
  readonly fileUploadActive = signal(false);
  readonly fileUploadProgress = signal<FileUploadProgress<unknown> | null>(null);
  readonly fileUploadViewModel = computed(() =>
    buildFileUploadViewModel(this.fileUploadProgress(), this.fileUploadActive()),
  );
  private fileUploadExecution: FileUploadExecution | null = null;
  /** Global table component of related collection tabs, loaded on the first edit. */
  readonly embeddedCollectionComponent = signal<Type<unknown> | null>(null);
  private readonly embeddedInjectors = new Map<string, Injector>();
  private readonly embeddedReloads = new Map<string, () => void>();
  private readonly pageInjector = inject(Injector);
  readonly postalLookupLoadingKey = signal<string | null>(null);
  readonly editingRecord = signal<T | null>(null);
  readonly formValues = signal<ConfigurableCrudRecord>({});
  /**
   * Required Field Feedback Baseline (app.md): after a save attempt, invalid fields turn red,
   * show the reason under the field and the first one receives focus. Keys are field keys;
   * related collection drafts use `<collectionKey>::<fieldKey>`.
   */
  readonly submitAttempted = signal(false);
  private readonly rawFieldErrors = signal<ReadonlyMap<string, FieldError>>(new Map());
  readonly fieldErrors = computed<ReadonlyMap<string, FieldError>>(() => {
    const errors = this.rawFieldErrors();
    if (!errors.size) return errors;
    const visible = new Map<string, FieldError>();
    for (const [key, error] of errors) {
      const field = key.includes(RELATED_FIELD_SEPARATOR)
        ? undefined
        : this.config.fields.find((item) => item.key === key);
      if (field && !this.isFieldVisible(field)) continue;
      if (field && error.kind === 'required' && !this.isFieldRequired(field)) continue;
      visible.set(key, error);
    }
    return visible;
  });
  readonly formTabGroup = viewChild<MatTabGroup>('crudFormTabs');
  readonly enabledCopyActions = signal(new Set<string>());
  readonly defaultCurrency = signal('BRL');
  readonly currencyReady = signal(false);
  private readonly selectedRemoteOptions = new Map<string, ConfigurableCrudOption>();
  /** Last value written by remoteLookup.fill per target, so later selections may replace it. */
  private readonly remoteFilledValues = new Map<string, string>();
  readonly remoteQueries = signal<Record<string, { search: string; offset: number }>>({});
  private readonly remoteBoundParameters = computed(() =>
    JSON.stringify(
      Object.fromEntries(
        this.config.fields
          .filter((field) => field.remoteLookup)
          .map((field) => [
            field.key,
            remoteLookupParameters(field.remoteLookup?.parameters, this.formValues()),
          ]),
      ),
    ),
  );
  readonly remoteLookups = resource({
    params: () => ({
      queries: this.remoteQueries(),
      boundParameters: this.remoteBoundParameters(),
      fields: this.config.fields.filter((f) => f.remoteLookup),
    }),
    defaultValue: {} as Record<string, { items: ConfigurableCrudRecord[]; error: boolean }>,
    loader: async ({ params }) =>
      Object.fromEntries(
        await Promise.all(
          params.fields.map(async (field) => {
            const bound: { ready: boolean; query: string } = JSON.parse(params.boundParameters)[
              field.key
            ];
            if (!bound.ready) return [field.key, { items: [], error: false }];
            const query = params.queries[field.key] ?? { search: '', offset: 0 };
            const endpoint = field.remoteLookup!.endpoint;
            const url = `${endpoint}${endpoint.includes('?') ? '&' : '?'}limit=50&offset=${query.offset}&${field.remoteLookup!.searchParam ?? 'search'}=${encodeURIComponent(query.search)}${bound.query ? `&${bound.query}` : ''}`;
            try {
              const response = await this.api.get<{ data: { items: ConfigurableCrudRecord[] } }>(
                url,
              );
              return [field.key, { items: response.data.items, error: false }];
            } catch {
              return [field.key, { items: [], error: true }];
            }
          }),
        ),
      ),
  });
  /**
   * Material owns the live text while a date is incomplete. Keeping that draft outside
   * the form signal prevents Angular from writing an incomplete string back through
   * MatDatepickerInput, which would deserialize it as invalid and clear the input.
   */
  private readonly dateDrafts = new Map<string, string>();

  readonly itemsResource;

  readonly columns = computed(() => this.config.columns.filter((column) => !column.hiddenWhen?.()));
  private viewStorageKey = '';
  readonly viewPreferences = signal<CrudViewPreferences>(DEFAULT_CRUD_VIEW);
  readonly compactDensity = computed(() => this.viewPreferences().density === 'compact');
  readonly customizedView = computed(() => !isDefaultCrudView(this.viewPreferences()));
  /** Columns rendered in the table: the first (identity) column always stays visible. */
  readonly tableColumns = computed(() =>
    this.columns().filter((column) => this.isColumnVisible(column)),
  );
  /** Phones and narrow windows list records as cards instead of the table. */
  readonly mobileLayout = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  readonly cardTitleColumn = computed(() => this.tableColumns()[0] ?? null);
  /** Table view menu: column search appears for long column lists and resets on close. */
  readonly columnSearch = signal('');
  readonly columnSearchEnabled = computed(() => this.columns().length > COLUMN_SEARCH_MIN);
  readonly viewMenuColumns = computed(() => {
    const term = this.columnSearch().trim().toLocaleLowerCase();
    if (!term) return this.columns();
    return this.columns().filter((column) =>
      this.t(column.label).toLocaleLowerCase().includes(term),
    );
  });
  /**
   * Column choices staged while the table view menu is open. The menu trigger lives in the table
   * header, which mat-table re-creates when columns change (closing the menu), so the choices
   * apply to the table when the menu closes.
   */
  readonly columnDraft = signal<CrudViewPreferences | null>(null);
  readonly visibleColumnCount = computed(
    () => this.columns().filter((column) => this.isColumnChecked(column)).length,
  );
  readonly cardStatusColumn = computed(
    () =>
      this.tableColumns().find((column, index) => index > 0 && column.kind === 'status') ?? null,
  );
  /** Card body: every other visible column, keeping copy and show actions on each value. */
  readonly cardFieldColumns = computed(() =>
    this.tableColumns().filter(
      (column) => column !== this.cardTitleColumn() && column !== this.cardStatusColumn(),
    ),
  );
  readonly displayedColumns = computed(() => [
    ...(this.bulkDeleteEnabled() ? ['select'] : []),
    ...this.tableColumns().map((column) => column.id),
    ...(this.hasRowActions() ? ['actions'] : []),
  ]);
  readonly listFailed = computed(() => !!this.itemsResource.error());
  readonly rows = computed(() => {
    if (this.config.rows) return this.normalizeRows([...this.config.rows()] as T[]);
    return this.itemsResource.hasValue()
      ? this.normalizeRows(this.itemsResource.value() as T[])
      : ([] as T[]);
  });
  readonly filteredRows = computed(() => {
    const raw = this.rows();
    if (this.serverSidePagination()) return raw;
    return this.filterRows(raw);
  });
  readonly sortedRows = computed(() =>
    this.config.serverSideSorting ? this.filteredRows() : this.sortRows(this.filteredRows()),
  );
  readonly visibleRows = computed(() => {
    if (this.serverSidePagination()) return this.sortedRows();
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly paginatorLength = computed(() =>
    this.serverSidePagination() ? this.serverTotal() : this.sortedRows().length,
  );
  readonly pageSizeOptions = computed(() => this.config.pageSizeOptions ?? [5, 10, 25, 50]);
  readonly loading = computed(
    () =>
      (this.config.rowsLoading?.() ?? false) || this.itemsResource.isLoading() || this.mutating(),
  );
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
  readonly publicFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'public'),
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
  readonly fiscalFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'fiscal'),
  );
  readonly codecFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'codecs'),
  );
  readonly diagnosticsFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'diagnostics'),
  );
  readonly retentionFields = computed(() =>
    this.config.fields.filter((field) => this.isFieldVisible(field) && field.tab === 'retention'),
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
  /** Window details sent with "Report problem" from the form dialog (never form values). */
  readonly reportContext = computed(() => {
    const isForm = this.isFormDialogOpen();
    const record = this.editingRecord();
    return {
      resource: this.config.endpoint,
      mode: isForm ? (record ? ('edit' as const) : ('create' as const)) : undefined,
      recordUUID: record ? this.recordUUID(record) || undefined : undefined,
    };
  });
  readonly canCreate = computed(
    () =>
      !this.config.readOnly &&
      this.config.canCreate !== false &&
      (!(this.config.defaultCurrencyScope || this.config.defaultCurrencyFields?.length) ||
        this.currencyReady()),
  );
  readonly canEdit = computed(() => !this.config.readOnly && this.config.canEdit !== false);
  readonly canDelete = computed(() => !this.config.readOnly && this.config.canDelete !== false);
  readonly bulkDeleteEnabled = computed(() => this.canDelete() && this.config.bulkDelete !== false);
  readonly statusFilterEnabled = computed(
    () => !this.config.readOnly && this.config.statusFilter !== false,
  );
  readonly hasRowActions = computed(
    () => this.canEdit() || this.canDelete() || Boolean(this.config.rowActions?.length),
  );

  protected constructor(config: ConfigurableCrudConfig) {
    this.config = config;
    this.viewStorageKey = crudViewStorageKey(config.endpoint);
    this.viewPreferences.set(readCrudViewPreferences(this.viewStorageKey));
    this.destroyRef.onDestroy(() => this.secretTimers.forEach((timer) => clearTimeout(timer)));
    this.pageSize.set(config.initialPageSize ?? 5);
    let currencyInitialization: Promise<unknown>;
    if (config.defaultCurrencyScope) {
      this.defaultCurrency.set('');
      const scope = config.defaultCurrencyScope === 'master' ? 'system' : 'settings';
      currencyInitialization = this.api
        .get<any>(`${scope}/parameters/resolve/DEFAULT_CURRENCY`)
        .then((response) => {
          const currency = String(response?.data?.items?.[0]?.SprValue ?? '')
            .trim()
            .toUpperCase();
          if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Default currency is not configured.');
          this.defaultCurrency.set(currency);
          this.currencyReady.set(true);
        })
        .catch(() => this.snack.warning(this.t('Default currency is not configured.')));
    } else {
      currencyInitialization = this.parameters.resolveDefaultCurrency('BRL').then((currency) => {
        this.defaultCurrency.set(currency);
        this.currencyReady.set(true);
      });
    }
    this.formValues.set(this.emptyFormValues());
    this.itemsResource = resource({
      params: () =>
        this.quickCreateMode || this.config.rows ? undefined : this.listResourceParams(),
      defaultValue: [] as T[],
      loader: ({ params }) => this.fetchItems(params),
    });

    if (this.quickCreateMode) {
      afterNextRender(async () => {
        if (config.defaultCurrencyScope || config.defaultCurrencyFields?.length)
          await currencyInitialization;
        if (this.destroyRef.destroyed) return;
        if (this.canCreate()) this.startCreate();
        else this.quickCreateSession?.complete({ option: null });
      });
    }

    effect(() => {
      const lookups = this.remoteLookups.value();
      if (this.editingRecord()) return;
      for (const field of this.config.fields) {
        if (!field.autoSelectSingle || !field.remoteLookup || field.multiple) continue;
        const query = this.remoteQueries()[field.key];
        const items = lookups[field.key]?.items ?? [];
        if (query?.search || query?.offset || items.length !== 1) continue;
        if (String(this.formValues()[field.key] ?? '')) continue;
        const value = String(items[0][field.remoteLookup.uuidField] ?? '');
        if (value) untracked(() => this.setFieldValue(field.key, value));
      }
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

  onSearchInput(value: string): void {
    this.search.set(value);
    if (!value.trim() && this.appliedFilters().search) {
      this.applySearchFilters();
    }
  }

  onStatusFilterChange(value: '' | string | number): void {
    this.status.set(value);
    this.applySearchFilters();
  }

  onListFilterChange(
    filter: ConfigurableCrudListFilter,
    value: string | number | boolean | null,
  ): void {
    this.setListFilterValue(filter, value);
    this.applySearchFilters();
  }

  /** Explicit parent destination; never relies on browser history. */
  backLink(): string | null {
    return null;
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
    this.resetFieldErrors();
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.editingRecord.set(null);
    this.formValues.set(this.emptyFormValues());
    this.enabledCopyActions.set(this.defaultCopyActionKeys());
    for (const action of this.addressCopyActions()) {
      if (this.isCopyActionEnabled(action)) this.copyAddressValues(action);
    }
    this.openDialog();
  }

  /**
   * Open the create dialog prefilled from an existing row (copy / duplicate).
   * Keeps editingRecord null so save issues a create.
   */
  protected startCreateWithValues(values: ConfigurableCrudRecord): void {
    if (!this.canCreate()) return;
    this.resetFieldErrors();
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.editingRecord.set(null);
    this.formValues.set({ ...this.emptyFormValues(), ...values });
    this.enabledCopyActions.set(this.defaultCopyActionKeys());
    for (const action of this.addressCopyActions()) {
      if (this.isCopyActionEnabled(action)) this.copyAddressValues(action);
    }
    this.openDialog();
  }

  startEdit(row: T): void {
    this.resetFieldErrors();
    if (!this.canEditRow(row)) return;
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.editingRecord.set(row);
    this.formValues.set(this.formValuesFromRecord(row));
    this.enabledCopyActions.set(this.inferredCopyActionKeys());
    this.copyEnabledAddressValues();
    this.prepareRelatedCollections();
    this.openDialog();
  }

  async saveItem(saveAndNew = false): Promise<void> {
    if (this.editingRecord() ? !this.canEdit() : !this.canCreate()) return;
    this.clearFieldErrors(null);
    if (!this.commitDateDrafts()) return;
    this.copyEnabledAddressValues();
    // Validate the flat form payload before augmentPayload reshapes nested
    // config/credentials objects; otherwise required fields look missing.
    const formPayload = this.buildPayload();
    if (!this.validatePayload(formPayload)) return;
    if (!(await this.confirmBeforeSave(formPayload))) return;

    this.saving.set(true);
    this.quickCreateSaving = this.quickCreateMode;
    try {
      const payload = this.augmentPayload(formPayload);
      const current = this.editingRecord();
      let response: unknown;
      if (current) {
        response = await this.api.put(
          `${this.updateEndpoint()}/${this.recordUUID(current)}`,
          payload,
        );
      } else if (this.config.createUpload) {
        response = await this.uploadCreate(formPayload, this.config.createUpload);
      } else {
        response = await this.api.post(this.createEndpoint(), payload);
      }
      const asynchronous = this.trackOperation(response);
      if (!asynchronous) this.snack.success(this.t(this.config.savedMessage));
      if (current && !asynchronous) this.reflectSavedRecord(current, payload);
      this.itemsResource.reload();
      if (saveAndNew) {
        this.resetFieldErrors();
        this.editingRecord.set(null);
        this.formValues.set(this.emptyFormValues());
        this.dateDrafts.clear();
      } else if (!this.keepDialogOpenAfterSave()) {
        this.closeDialog();
      }
      await this.afterSave({
        mode: current ? 'update' : 'create',
        saveAndNew,
        payload,
        response,
        record: current,
      });
      if (this.quickCreateMode && !current) {
        this.quickCreateResult = {
          option: await this.quickCreateOption(response, payload),
          response,
          payload,
        };
        if (!this.keepDialogOpenAfterSave())
          this.quickCreateSession?.complete(this.quickCreateResult);
      }
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
      this.markServerRejectedFields(error);
    } finally {
      this.saving.set(false);
      this.quickCreateSaving = false;
      // A failure after the form dialog closed must still release the invisible host.
      if (this.quickCreateMode && this.dialogBinding?.ref.getState() !== MatDialogState.OPEN) {
        this.quickCreateSession?.complete(this.quickCreateResult ?? { option: null });
      }
    }
  }

  /**
   * Maps the record created in quick-create mode to the requesting FK option. Uses the create
   * response when it carries the record; otherwise finds the new record through the list endpoint.
   * Override only to enrich `description`/`searchText`; value must stay the resource UUID.
   */
  protected async quickCreateOption(
    response: unknown,
    payload: ConfigurableCrudRecord,
  ): Promise<ConfigurableCrudOption | null> {
    const labelField =
      this.config.fields.find(
        (field) => field.key === (this.config.quickCreateLabelField ?? 'name'),
      ) ??
      this.config.fields.find((field) => field.required && (!field.type || field.type === 'text'));
    const labelSource = labelField?.source ?? labelField?.key ?? '';
    const payloadLabel = labelField
      ? optionText(payload[labelField.payloadKey ?? labelField.key])
      : null;
    const toOption = (record: ConfigurableCrudRecord): ConfigurableCrudOption | null => {
      const uuid = optionText(record[this.config.uuidField]) ?? optionText(record['uuid']);
      if (!uuid) return null;
      const label = optionText(record[labelSource]) ?? payloadLabel ?? uuid;
      return { value: uuid, label, searchText: `${label} ${uuid}` };
    };

    const created = quickCreateResponseRecord(response);
    const direct = created ? toOption(created) : null;
    if (direct) return direct;
    if (!payloadLabel) return null;

    try {
      const params = new URLSearchParams({ search: payloadLabel, limit: '25', offset: '0' });
      const list = await this.api.get<unknown>(`${this.config.endpoint}?${params}`);
      const candidates = extractCrudItems(list)
        .map(toOption)
        .filter((option): option is ConfigurableCrudOption => option !== null);
      const exact = candidates.filter(
        (option) => option.label.toLowerCase() === payloadLabel.toLowerCase(),
      );
      return exact.length === 1 ? exact[0] : null;
    } catch {
      return null;
    }
  }

  async deleteItem(row: T): Promise<void> {
    if (!this.canDeleteRow(row)) return;
    const confirmed = await this.confirm(this.config.deleteTitle, this.config.deleteMessage);
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.api.delete(
        this.deleteUrlFor(row),
        this.config.deletePayload?.(row),
      );
      if (!this.trackOperation(response)) this.snack.success(this.t(this.config.deletedMessage));
      this.itemsResource.reload();
      this.afterDelete(row);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || this.config.deleteFailedMessage));
    } finally {
      this.mutating.set(false);
    }
  }

  /**
   * Options of a related collection form field. `values` is the child form being edited, so
   * dependent options (for example an IVR destination per route type) follow the child draft.
   */
  relatedCollectionFieldOptions(
    field: ConfigurableCrudField,
    _collection: ConfigurableCrudRelatedCollection,
    _values: ConfigurableCrudRecord,
  ): readonly ConfigurableCrudOption[] {
    return this.lookupOptions(field.key);
  }

  /**
   * Derives dependent child form values after a related field changes (same contract as
   * `config.fieldChange`); return the complete next child record.
   */
  protected relatedCollectionFieldChange(
    _collection: ConfigurableCrudRelatedCollection,
    _key: string,
    _value: unknown,
    current: ConfigurableCrudRecord,
  ): ConfigurableCrudRecord {
    return current;
  }

  relatedCollectionColumnValue(
    row: ConfigurableCrudRecord,
    column: ConfigurableCrudRelatedCollectionColumn,
  ): string {
    if (column.value) return column.value(row, (key) => this.t(key));
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

  /** Hook after a related row is created (for example to offer applying it elsewhere). */
  protected afterRelatedCollectionRowAdded(
    _collection: ConfigurableCrudRelatedCollection,
    _parentUUID: string,
    _created: ConfigurableCrudRecord | null,
  ): void | Promise<void> {}

  /** Reloads the global table of one related collection of the record being edited. */
  protected reloadRelatedCollection(collection: ConfigurableCrudRelatedCollection): void {
    this.embeddedReloads.get(collection.key)?.();
  }

  /** Injector of a related collection tab: carries the embedded host for the record being edited. */
  relatedCollectionInjector(collection: ConfigurableCrudRelatedCollection): Injector | undefined {
    const row = this.editingRecord();
    if (!row) return undefined;
    const parentUUID = this.recordUUID(row);
    const cacheKey = `${collection.key}:${parentUUID}`;
    let injector = this.embeddedInjectors.get(cacheKey);
    if (!injector) {
      injector = Injector.create({
        parent: this.pageInjector,
        providers: [
          {
            provide: CONFIGURABLE_CRUD_EMBEDDED,
            useValue: this.embeddedCollectionHost(collection, parentUUID),
          },
          // The child table is never the create form of an FK select of this page.
          { provide: CONFIGURABLE_CRUD_QUICK_CREATE, useValue: null },
        ],
      });
      this.embeddedInjectors.set(cacheKey, injector);
    }
    return injector;
  }

  private prepareRelatedCollections(): void {
    this.embeddedInjectors.clear();
    if (!this.relatedCollections().length || this.embeddedCollectionComponent()) return;
    void import('./configurable-crud-embedded-collection').then(
      ({ ConfigurableCrudEmbeddedCollection }) =>
        this.embeddedCollectionComponent.set(ConfigurableCrudEmbeddedCollection),
    );
  }

  private embeddedCollectionHost(
    collection: ConfigurableCrudRelatedCollection,
    parentUUID: string,
  ): ConfigurableCrudEmbeddedHost {
    return {
      config: this.embeddedCollectionConfig(collection, parentUUID),
      options: (field, values) => this.relatedCollectionFieldOptions(field, collection, values),
      label: (key, value) => this.lookupLabel(key, value),
      loading: (field) => !field.remoteLookup && this.fieldLoading(field),
      deleteUrl: (row) => collection.deleteEndpoint(parentUUID, row),
      rowAdded: async (created) => {
        this.refreshList();
        await this.afterRelatedCollectionRowAdded(collection, parentUUID, created);
      },
      changed: () => this.refreshList(),
      attach: (reload) => {
        this.embeddedReloads.set(collection.key, reload);
        return () => {
          if (this.embeddedReloads.get(collection.key) === reload)
            this.embeddedReloads.delete(collection.key);
        };
      },
    };
  }

  private embeddedCollectionConfig(
    collection: ConfigurableCrudRelatedCollection,
    parentUUID: string,
  ): ConfigurableCrudConfig {
    const [path, query = ''] = collection.endpoint(parentUUID).split('?', 2);
    const updateEndpoint = collection.updateEndpoint?.(parentUUID);
    return {
      endpoint: path,
      listQuery: Object.fromEntries(new URLSearchParams(query)),
      updateEndpoint,
      uuidField: collection.uuidField,
      pageTitle: collection.label,
      // Not rendered: the parent tab label names the collection.
      pageDescription: collection.dialogDescription ?? collection.label,
      createTitle: collection.createTitle ?? collection.addLabel ?? 'New',
      editTitle: collection.editTitle ?? 'Edit',
      createLabel: collection.addLabel,
      dialogDescription: collection.dialogDescription ?? '',
      searchPlaceholder: 'Search',
      emptyLabel: collection.emptyLabel,
      deleteTitle: 'Delete',
      deleteMessage: 'Delete this record?',
      deleteSelectedTitle: 'Delete selected',
      deleteSelectedMessage: 'Delete {count} records?',
      savedMessage: collection.savedMessage ?? 'Record saved successfully.',
      deletedMessage: collection.deletedMessage ?? 'Record deleted successfully.',
      deleteFailedMessage: 'Failed to delete record.',
      canEdit: Boolean(updateEndpoint),
      bulkDelete: false,
      statusFilter: collection.columns.some((column) => column.kind === 'status'),
      statusMode: 'number',
      activeValue: 1,
      inactiveValue: 0,
      activeStatusValues: [1, 'true'],
      initialValues: collection.initialValues,
      fields: collection.fields,
      columns: collection.columns.map((column) =>
        column.kind === 'status'
          ? { id: column.id, label: column.label, field: column.field, kind: 'status' as const }
          : {
              id: column.id,
              label: column.label,
              field: column.field,
              kind: column.kind === 'number' ? ('number' as const) : ('text' as const),
              value: (row: ConfigurableCrudRecord) =>
                this.relatedCollectionColumnValue(row, column),
            },
      ),
      rowActions: (collection.rowActions ?? []).map((action) => ({
        key: action.key,
        label: action.label,
        icon: action.icon,
        tooltip: action.label,
        visible: action.visible,
        request: action.request,
      })),
      payload: (values) =>
        collection.payload ? collection.payload(values) : relatedPayload(values, collection.fields),
      fieldChange: (key, value, current) =>
        this.relatedCollectionFieldChange(collection, key, value, current),
    };
  }

  /** Row action bound to a column (`column.rowAction`), when visible for the row. */
  columnRowAction(row: T, column: ConfigurableCrudColumn): ConfigurableCrudRowAction | null {
    if (!column.rowAction) return null;
    return this.rowActions(row).find((action) => action.key === column.rowAction) ?? null;
  }

  collectionActions(): readonly ConfigurableCrudRowAction[] {
    const row = this.editingRecord();
    return row ? this.rowActions(row).filter((action) => Boolean(action.collection)) : [];
  }

  rowActions(_row: T): readonly ConfigurableCrudRowAction[] {
    return (this.config.rowActions ?? []).filter((action) => action.visible?.(_row) !== false);
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

  /**
   * Translation key shown under a disabled contextual filter action (for example "select a
   * PABX first"). Pages that disable actions override it; `null` keeps only the tooltip line.
   */
  filterActionDisabledReason(_action: ConfigurableCrudFilterAction): string | null {
    return null;
  }

  canEditRow(row: T): boolean {
    return this.canEdit() && (this.config.canEditRow?.(row) ?? true);
  }

  canDeleteRow(row: T): boolean {
    return this.canDelete() && (this.config.canDeleteRow?.(row) ?? true);
  }

  /** Translation key explaining why a listed row action is disabled, or `null`. */
  rowActionDisabledReason(action: ConfigurableCrudRowAction, row: T): string | null {
    return action.disabledReason?.(row) ?? null;
  }

  /**
   * Record name shown in the row actions menu heading: the first visible column that is not a
   * status chip (pages such as Agents lead with the status column).
   */
  rowMenuHint(row: T): string {
    const column = this.tableColumns().find((item) => item.kind !== 'status');
    return column ? this.columnText(row, column) : '';
  }

  async runRowAction(action: ConfigurableCrudRowAction, row: T): Promise<void> {
    if (action.visible?.(row) === false) return;
    if (this.rowActionDisabledReason(action, row)) return;
    if (action.run) {
      await action.run(row);
      return;
    }
    if (action.request) {
      await this.runRowActionRequest(action.request, row);
      return;
    }
    const factory = action.collection ?? action.form;
    if (!factory) {
      await this.handleRowAction(action, row);
      return;
    }
    const { ConfigurableCrudCollectionDialog } =
      await import('./configurable-crud-collection-dialog');
    const formOnly = Boolean(action.form);
    if (!formOnly) {
      const binding = openCrudTemplateDialog(
        this.dialog,
        ConfigurableCrudCollectionDialog,
        ['crud-form-dialog', 'crud-collection-dialog'],
        { data: { ...factory(row), collectionDialog: true, formOnly: false } },
      );
      await firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
      this.refreshList();
      return;
    }
    const ref = this.dialog.open(ConfigurableCrudCollectionDialog, {
      data: { ...factory(row), collectionDialog: true, formOnly: true },
      width: '0',
      maxWidth: '0',
      height: '0',
      maxHeight: '0',
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'quick-create-host-dialog',
      disableClose: true,
    });
    await firstValueFrom(ref.afterClosed());
    this.refreshList();
  }

  closeCollectionDialog(): void {}

  handleRowAction(_action: ConfigurableCrudRowAction, _row: T): void | Promise<void> {}

  handleFilterAction(_action: ConfigurableCrudFilterAction): void | Promise<void> {}

  protected afterSave(_context: ConfigurableCrudSaveContext<T>): void | Promise<void> {}

  /**
   * Override and return true when `afterSave` still needs the dialog open, e.g. to run a
   * managed file upload and show its progress (app.md "File Upload Progress Baseline"). The
   * subclass is then responsible for calling `closeDialog()` itself once the upload settles.
   */
  protected keepDialogOpenAfterSave(): boolean {
    return false;
  }

  /**
   * Runs a `postFormWithProgress`-style upload while updating `fileUploadActive`/
   * `fileUploadProgress` for the shared dialog progress UI. Resolves with the last known
   * progress; rejects with `UploadCancelledError` on `cancelFileUpload()`.
   */
  protected async runManagedFileUpload<U = unknown>(
    source: Observable<FileUploadProgress<U>>,
    fileSize: number | null,
  ): Promise<FileUploadProgress<U>> {
    this.fileUploadActive.set(true);
    let last: FileUploadProgress<U> = createInitialFileUploadProgress<U>(fileSize);
    const execution = runFileUploadExecution<U>({
      fileSize,
      source,
      setProgress: (progress) => {
        last = progress;
        this.fileUploadProgress.set(progress as FileUploadProgress<unknown>);
      },
      currentProgress: () => last,
      errorMessage: (error) => this.errorMessage(error),
    });
    this.fileUploadExecution = execution;
    try {
      await execution.done;
    } finally {
      this.fileUploadExecution = null;
      this.fileUploadActive.set(false);
    }
    return last;
  }

  private async runRowActionRequest(
    request: ConfigurableCrudRowActionRequest,
    row: T,
  ): Promise<void> {
    if (request.confirm) {
      const confirmed = await this.confirmAction(
        request.confirm.title,
        request.confirm.message,
        request.confirm.confirmLabel,
      );
      if (!confirmed) return;
    }
    this.mutating.set(true);
    try {
      const endpoint = request.endpoint(row);
      const body = request.body?.(row) ?? {};
      if (request.method === 'put') await this.api.put(endpoint, body);
      else await this.api.post(endpoint, body);
      // A row action may replace a loaded secret (e.g. a regenerated password): never show the old one.
      for (const column of this.config.columns) {
        if (column.secretLoader) this.resetSecret(row, column.id);
      }
      this.snack.success(this.t(request.successMessage));
      this.itemsResource.reload();
      this.afterRowActionRequest(row);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.mutating.set(false);
    }
  }

  private async uploadCreate(
    formPayload: ConfigurableCrudRecord,
    upload: NonNullable<ConfigurableCrudConfig['createUpload']>,
  ): Promise<unknown> {
    const file = formPayload[upload.fileField];
    if (!(file instanceof File)) throw new Error(this.t('Select a file to upload.'));
    const body = new FormData();
    body.append(upload.formField, file);
    const progress = await this.runManagedFileUpload(
      this.api.postFormWithProgress(this.createEndpoint(), body),
      file.size,
    );
    return progress.response;
  }

  cancelFileUpload(): void {
    this.fileUploadExecution?.cancel();
  }

  async deleteSelectedItems(): Promise<void> {
    if (!this.bulkDeleteEnabled()) return;
    const ids = [...this.selectedUUIDs()];
    if (!ids.length) return;
    const preconditions = this.config.bulkDeletePayload?.(
      this.rows().filter((row) => ids.includes(String(row[this.config.uuidField]))),
    );

    const message = this.config.deleteSelectedMessage.replace('{count}', String(ids.length));
    const confirmed = await this.confirm(this.config.deleteSelectedTitle, message);
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      const response = await this.api.delete<{ data?: { failed?: ConfigurableCrudRecord[] } }>(
        this.bulkDeleteEndpoint(),
        {
          ids,
          ...preconditions,
        },
      );
      const displayedUUIDs = new Map(ids.map((id) => [id.replaceAll('-', '').toLowerCase(), id]));
      this.selectedUUIDs.set(
        new Set(
          (response?.data?.failed ?? [])
            .map((item) => String(item['uuid'] ?? item[this.config.uuidField] ?? ''))
            .map((id) => displayedUUIDs.get(id.replaceAll('-', '').toLowerCase()) ?? id)
            .filter(Boolean),
        ),
      );
      if (!this.trackOperation(response)) this.snack.success(this.t(this.config.deletedMessage));
      if (response?.data?.failed?.length)
        this.snack.warning(this.t(this.config.deleteFailedMessage));
      this.itemsResource.reload();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error) || this.config.deleteFailedMessage));
    } finally {
      this.mutating.set(false);
    }
  }

  closeDialog(): void {
    this.isFormDialogOpen.set(false);
    this.resetFieldErrors();
    this.dateDrafts.clear();
    this.revealedPasswordFields.set(new Set());
    this.dialogBinding?.ref.close();
    if (this.quickCreateMode && !this.quickCreateSaving) {
      this.quickCreateSession?.complete(this.quickCreateResult ?? { option: null });
    }
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

  htmlInputType(field: ConfigurableCrudField): 'email' | 'number' | 'password' | 'text' | 'time' {
    if (field.type === 'time') return 'time';
    if (field.type === 'number') return 'number';
    if (field.type === 'email') return 'email';
    if (field.type === 'password') {
      return this.revealedPasswordFields().has(field.key) ? 'text' : 'password';
    }
    return 'text';
  }

  /**
   * `data-report-mask` value for a form control: passwords stay hidden in the report print even
   * while revealed, and so do fields named like credentials (UUID references are not secrets).
   */
  reportMask(field: { key: string; type?: string; reportMask?: boolean }): '' | null {
    return crudReportMask(field);
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

  generatePasswordField(key: string): void {
    const field = this.config.fields.find((item) => item.key === key);
    this.setFieldValue(key, generateCrudPassword(field?.generatedPasswordLength ?? 10));
  }

  fieldContext(): ConfigurableCrudFieldContext {
    return {
      editing: this.editingRecord() !== null,
      values: this.formValues(),
    };
  }

  isSuffixButtonDisabled(button: ConfigurableCrudFieldSuffixButton): boolean {
    return button.disabledWhen ? button.disabledWhen(this.fieldContext()) : false;
  }

  runSuffixButton(button: ConfigurableCrudFieldSuffixButton): void {
    void button.onClick(this.fieldContext(), this);
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

  private fillFromRemoteSelection(field: ConfigurableCrudField, value: unknown): void {
    const lookup = field.remoteLookup!;
    const item = (this.remoteLookups.value()[field.key]?.items ?? []).find(
      (row: ConfigurableCrudRecord) => String(row[lookup.uuidField] ?? '') === String(value ?? ''),
    );
    if (!item) return;
    for (const [target, source] of Object.entries(lookup.fill ?? {})) {
      const next = item[source];
      if (next === null || next === undefined || next === '') continue;
      const current = String(this.formValues()[target] ?? '');
      if (current && current !== this.remoteFilledValues.get(target)) continue;
      this.remoteFilledValues.set(target, String(next));
      this.formValues.update((values) => ({ ...values, [target]: next }));
    }
  }

  setFieldValue(key: string, value: unknown): void {
    const previous = this.formValues()[key];
    const remoteField = this.config.fields.find((field) => field.key === key && field.remoteLookup);
    if (remoteField) {
      const option = this.fieldOptions(remoteField).find((item) => item.value === value);
      if (option) this.selectedRemoteOptions.set(key, option);
      else this.selectedRemoteOptions.delete(key);
    }
    try {
      this.formValues.update((current) => {
        const next = { ...current, [key]: value };
        return this.config.fieldChange?.(key, value, next) ?? next;
      });
    } catch (error) {
      this.snack.error(
        this.t(error instanceof Error ? error.message : 'Enter a valid JSON object.'),
      );
      return;
    }
    if (previous !== this.formValues()[key]) {
      for (const field of this.config.fields) {
        if (Object.values(field.remoteLookup?.parameters ?? {}).includes(key)) {
          this.formValues.update((current) => ({
            ...current,
            [field.key]: field.multiple ? [] : '',
          }));
          this.selectedRemoteOptions.delete(field.key);
          this.remoteQueries.update((queries) => ({
            ...queries,
            [field.key]: { search: '', offset: 0 },
          }));
        }
      }
    }
    if (remoteField?.remoteLookup?.fill && previous !== value)
      this.fillFromRemoteSelection(remoteField, value);
    this.onFieldValueChanged(key, value);
    this.syncCopyActionsForSource(key);
    this.clearCopyActionsForTarget(key);
    this.refreshFieldError(key);
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
      this.assignPostalLookupValue(next, lookup.municipalityCodeKey, item['ibgeCode']);

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

  /** Supplemental guidance follows the values of its own form (child tables have their own). */
  fieldHelp(field: ConfigurableCrudField): string {
    return resolveCrudFieldHelp(
      field,
      { editing: Boolean(this.editingRecord()), values: this.formValues() },
      (text, params) => this.t(text, params),
    );
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
    focusFirstInvalidField(() => this.formRoots(), [key], 0);
  }

  // ---- Required Field Feedback Baseline (app.md) ----

  hasFieldError(field: { key: string }, collection?: ConfigurableCrudRelatedCollection): boolean {
    return this.fieldErrors().has(this.fieldErrorKey(field, collection));
  }

  /** Translated reason shown under the field, or '' when the field is valid. */
  fieldErrorText(field: { key: string }, collection?: ConfigurableCrudRelatedCollection): string {
    const error = this.fieldErrors().get(this.fieldErrorKey(field, collection));
    return error ? this.t(error.message, error.params) : '';
  }

  /** `labelClass` of a form tab: identifies it for focus and marks it while it holds errors. */
  tabLabelClass(tab: string): string {
    const marker = `crud-tab-${tab}`;
    return this.tabHasErrors(marker) ? `${marker} crud-tab-invalid` : marker;
  }

  relatedTabLabelClass(collection: ConfigurableCrudRelatedCollection): string {
    return this.tabLabelClass(`related-${collection.key}`);
  }

  private tabHasErrors(marker: string): boolean {
    for (const key of this.fieldErrors().keys()) {
      if (this.errorTabMarker(key) === marker) return true;
    }
    return false;
  }

  private errorTabMarker(key: string): string {
    const [collectionKey] = key.split(RELATED_FIELD_SEPARATOR, 1);
    if (key.includes(RELATED_FIELD_SEPARATOR)) return `crud-tab-related-${collectionKey}`;
    const field = this.config.fields.find((item) => item.key === key);
    return `crud-tab-${field?.tab ?? 'record'}`;
  }

  protected fieldErrorKey(
    field: { key: string },
    collection?: ConfigurableCrudRelatedCollection | string | null,
  ): string {
    const scope = typeof collection === 'string' ? collection : collection?.key;
    return scope ? `${scope}${RELATED_FIELD_SEPARATOR}${field.key}` : field.key;
  }

  /** First of `keys` whose field is visible, to point a rule about a group of fields at one. */
  protected firstVisibleField(keys: readonly string[]): string {
    return (
      keys.find((key) => {
        const field = this.config.fields.find((item) => item.key === key);
        return !!field && this.isFieldVisible(field);
      }) ?? keys[0]
    );
  }

  /**
   * Page-specific validation: marks `key` invalid with `message`, shows it as a toast and
   * focuses the field. Returns false so overrides can `return this.rejectField(...)`.
   */
  protected rejectField(
    key: string,
    message: string,
    params?: Record<string, string | number>,
  ): false {
    this.reportFieldErrors(new Map([[key, customFieldError(message, params)]]), null, {
      key: message,
      params: params ?? {},
    });
    return false;
  }

  /**
   * Marks `errors` (replacing the previous errors of the same scope: the main form when
   * `scope` is null, otherwise one related collection), shows one toast and focuses the first
   * invalid field in visual order, switching tab or expanding a compact address section.
   */
  protected reportFieldErrors(
    errors: ReadonlyMap<string, FieldError>,
    scope: string | null = null,
    toast?: { key: string; params: Record<string, string | number> },
  ): void {
    if (!errors.size) return;
    this.submitAttempted.set(true);
    const next = new Map(
      [...this.rawFieldErrors()].filter(([key]) => this.errorScope(key) !== scope),
    );
    for (const [key, error] of errors) next.set(key, error);
    this.rawFieldErrors.set(next);

    const ordered = this.orderedErrorKeys([...errors.keys()]);
    const message = toast ?? this.errorToast(ordered, errors);
    this.snack.warning(message.key, 5000, message.params);
    this.revealField(ordered[0], ordered);
  }

  protected clearFieldErrors(scope: string | null): void {
    const current = this.rawFieldErrors();
    if (![...current.keys()].some((key) => this.errorScope(key) === scope)) return;
    this.rawFieldErrors.set(
      new Map([...current].filter(([key]) => this.errorScope(key) !== scope)),
    );
  }

  protected resetFieldErrors(): void {
    this.submitAttempted.set(false);
    if (this.rawFieldErrors().size) this.rawFieldErrors.set(new Map());
  }

  private errorScope(key: string): string | null {
    return key.includes(RELATED_FIELD_SEPARATOR) ? key.split(RELATED_FIELD_SEPARATOR, 1)[0] : null;
  }

  private errorToast(
    ordered: readonly string[],
    errors: ReadonlyMap<string, FieldError>,
  ): { key: string; params: Record<string, string | number> } {
    const required = ordered.filter((key) => errors.get(key)?.kind === 'required');
    if (required.length)
      return missingFieldsToast(required.map((key) => this.errorFieldLabel(key)));
    const first = errors.get(ordered[0])!;
    return {
      key: 'form.validation.invalidField',
      params: {
        field: this.errorFieldLabel(ordered[0]),
        reason: this.t(first.message, first.params),
      },
    };
  }

  private errorField(key: string): ConfigurableCrudField | undefined {
    const scope = this.errorScope(key);
    if (!scope) return this.config.fields.find((field) => field.key === key);
    const fieldKey = key.slice(scope.length + RELATED_FIELD_SEPARATOR.length);
    return this.relatedCollections()
      .find((collection) => collection.key === scope)
      ?.fields.find((field) => field.key === fieldKey);
  }

  private errorFieldLabel(key: string): string {
    const field = this.errorField(key);
    return field ? this.translatedFieldLabel(field) : key;
  }

  /** Visual order: rendered tab order first, then declaration order inside the tab. */
  private orderedErrorKeys(keys: readonly string[]): string[] {
    const tabs = this.formTabGroup()?._tabs?.toArray() ?? [];
    const tabIndex = (key: string) => {
      const marker = this.errorTabMarker(key);
      const index = tabs.findIndex((tab) => labelClassList(tab.labelClass).includes(marker));
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    const declarationIndex = (key: string) => {
      const scope = this.errorScope(key);
      const fields = scope
        ? (this.relatedCollections().find((collection) => collection.key === scope)?.fields ?? [])
        : this.config.fields;
      const field = this.errorField(key);
      return field ? fields.indexOf(field) : Number.MAX_SAFE_INTEGER;
    };
    return [...keys].sort(
      (left, right) =>
        tabIndex(left) - tabIndex(right) || declarationIndex(left) - declarationIndex(right),
    );
  }

  private revealField(key: string | undefined, ordered: readonly string[] = []): void {
    if (!key) return;
    const field = this.errorField(key);
    if (field?.tab === 'address' && !this.errorScope(key)) {
      const section = this.addressSections().find((item) =>
        item.fields.some((candidate) => candidate.key === key),
      );
      if (section && this.isAddressSectionCompact(section)) this.editAddressSection(section);
    }
    const marker = this.errorTabMarker(key);
    const group = this.formTabGroup();
    const index = group?._tabs
      ?.toArray()
      .findIndex((tab) => labelClassList(tab.labelClass).includes(marker));
    if (group && index !== undefined && index >= 0 && group.selectedIndex !== index) {
      group.selectedIndex = index;
    }
    const fieldKey = (candidate: string) => {
      const scope = this.errorScope(candidate);
      return scope ? candidate.slice(scope.length + RELATED_FIELD_SEPARATOR.length) : candidate;
    };
    const keys = [key, ...ordered.filter((candidate) => candidate !== key)].map(fieldKey);
    focusFirstInvalidField(() => this.formRoots(), keys);
  }

  private formRoots(): ParentNode[] {
    const dialogId = this.dialogBinding?.ref.id;
    const dialog = dialogId ? document.getElementById(dialogId) : null;
    return [dialog, this.host.nativeElement].filter((root): root is HTMLElement => !!root);
  }

  /** After a save attempt, editing a field clears its error or re-flags a still-empty one. */
  private refreshFieldError(key: string): void {
    const current = this.rawFieldErrors();
    if (!current.has(key) && !this.submitAttempted()) return;
    const next = new Map(current);
    next.delete(key);
    const field = this.config.fields.find((item) => item.key === key);
    if (
      this.submitAttempted() &&
      field &&
      this.isFieldVisible(field) &&
      this.isFieldRequired(field) &&
      isBlankFieldValue(this.formValues()[key])
    ) {
      next.set(key, fieldError('required'));
    }
    if (next.size !== current.size || next.get(key) !== current.get(key)) {
      this.rawFieldErrors.set(next);
    }
  }

  /**
   * A 400 whose body lists `fields` (API `VALIDATION_FAILED` contract) marks those fields;
   * the API message itself was already shown as a toast.
   */
  private markServerRejectedFields(error: unknown): void {
    const names = apiErrorFields(error);
    if (!names.length) return;
    const errors = new Map<string, FieldError>();
    for (const name of names) {
      const leaf = name.split('.').pop() ?? name;
      const field =
        this.config.fields.find((item) => (item.payloadKey ?? item.key) === name) ??
        this.config.fields.find((item) => item.key === name) ??
        this.config.fields.find((item) => (item.payloadKey ?? item.key) === leaf);
      if (field && this.isFieldVisible(field)) {
        errors.set(field.key, customFieldError('form.validation.serverRejected'));
      }
    }
    if (!errors.size) return;
    this.submitAttempted.set(true);
    this.rawFieldErrors.set(errors);
    const ordered = this.orderedErrorKeys([...errors.keys()]);
    this.revealField(ordered[0], ordered);
  }

  /** Labels seen on remote pages, so multi-selections keep readable chips across pages. */
  private readonly remoteOptionLabels = new Map<string, string>();

  fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    if (field.remoteLookup) {
      const lookup = field.remoteLookup;
      const result = this.remoteLookups.value()[field.key];
      const options: ConfigurableCrudOption[] = (result?.items ?? []).map(
        (r: ConfigurableCrudRecord) => {
          const value = String(r[lookup.uuidField]);
          const label = String(r[lookup.labelField] ?? r[lookup.uuidField]);
          this.remoteOptionLabels.set(`${field.key}:${value}`, label);
          const description = lookup.descriptionField
            ? String(r[lookup.descriptionField] ?? '').trim()
            : '';
          return description ? { value, label, description } : { value, label };
        },
      );
      // Keep selected values that are not on the current remote page; an empty selection
      // (single '' or multiple []) never produces a blank option.
      const selectedValues = field.multiple
        ? this.fieldValueArray(field.key).map(String)
        : [String(this.fieldValue(field.key) ?? '')];
      for (const selected of selectedValues.filter(Boolean).reverse()) {
        if (options.some((o) => o.value === selected)) continue;
        options.unshift({
          value: selected,
          label: String(
            (this.selectedRemoteOptions.get(field.key)?.value === selected
              ? this.selectedRemoteOptions.get(field.key)?.label
              : undefined) ??
              this.remoteOptionLabels.get(`${field.key}:${selected}`) ??
              (field.multiple
                ? undefined
                : this.editingRecord()?.[lookup.selectedLabelField ?? lookup.labelField]) ??
              selected,
          ),
        });
      }
      return this.withQuickCreatedOptions(field, options);
    }

    return this.withQuickCreatedOptions(field, field.options ?? this.lookupOptions(field.key));
  }

  translatedSelectOptions(
    field: ConfigurableCrudField,
    options: readonly ConfigurableCrudOption[],
  ): readonly ConfigurableCrudOption[] {
    return options.map((option) => ({
      ...option,
      label: this.translatedOptionLabel(field, option),
    }));
  }

  statusFilterOptions(): readonly ConfigurableCrudOption[] {
    return [
      { value: '', label: this.t('All') },
      ...this.statusOptions().map((option) => ({ ...option, label: this.t(option.label) })),
    ];
  }

  readonly filterRemoteQueries = signal<Record<string, { search: string; offset: number }>>({});
  readonly filterRemoteLookups = resource({
    params: () => ({
      queries: this.filterRemoteQueries(),
      filters: this.config.listFilters?.filter((f) => f.remoteLookup) ?? [],
    }),
    defaultValue: {} as Record<
      string,
      { items: ConfigurableCrudRecord[]; total: number; error: boolean }
    >,
    loader: async ({ params }) =>
      Object.fromEntries(
        await Promise.all(
          params.filters.map(async (f) => {
            const q = params.queries[f.key] ?? { search: '', offset: 0 };
            const lookup = f.remoteLookup!;
            const query = new URLSearchParams({
              limit: '50',
              offset: String(q.offset),
              [lookup.searchParam ?? 'search']: q.search,
            });
            try {
              const response = await this.api.get<{
                data: { items: ConfigurableCrudRecord[]; total: number };
              }>(`${lookup.endpoint}${lookup.endpoint.includes('?') ? '&' : '?'}${query}`);
              return [f.key, { ...response.data, error: false }];
            } catch {
              return [f.key, { items: [], total: 0, error: true }];
            }
          }),
        ),
      ),
  });
  filterRemoteSearch(filter: ConfigurableCrudListFilter, search: string) {
    this.filterRemoteQueries.update((q) => ({ ...q, [filter.key]: { search, offset: 0 } }));
  }
  filterRemotePage(filter: ConfigurableCrudListFilter, direction: number) {
    const old = this.filterRemoteQueries()[filter.key] ?? { search: '', offset: 0 };
    this.filterRemoteQueries.update((q) => ({
      ...q,
      [filter.key]: { ...old, offset: Math.max(0, old.offset + direction * 50) },
    }));
  }
  filterRemoteNext(filter: ConfigurableCrudListFilter) {
    return (
      (this.filterRemoteQueries()[filter.key]?.offset ?? 0) + 50 <
      (this.filterRemoteLookups.value()[filter.key]?.total ?? 0)
    );
  }
  filterRemotePrevious(filter: ConfigurableCrudListFilter) {
    return (this.filterRemoteQueries()[filter.key]?.offset ?? 0) > 0;
  }
  filterRemoteError(filter: ConfigurableCrudListFilter) {
    return this.filterRemoteLookups.value()[filter.key]?.error ?? false;
  }
  listFilterOptions(filter: ConfigurableCrudListFilter): readonly ConfigurableCrudOption[] {
    if (filter.remoteLookup)
      return (this.filterRemoteLookups.value()[filter.key]?.items ?? []).map(
        (row: ConfigurableCrudRecord) => ({
          value: String(row[filter.remoteLookup!.uuidField]),
          label: String(row[filter.remoteLookup!.labelField] ?? ''),
        }),
      );
    if (filter.type === 'search-select') {
      return filter.options ?? this.lookupOptions(filter.key);
    }
    return [{ value: '', label: 'All' }, ...(filter.options ?? this.lookupOptions(filter.key))];
  }

  translatedListFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return this.listFilterOptions(filter).map((option) => ({
      ...option,
      label:
        filter.translateOptions || (option.value === '' && option.label === 'All')
          ? this.t(option.label)
          : option.label,
    }));
  }

  listFilterValue(filter: ConfigurableCrudListFilter): string | number | boolean | null {
    return this.listFilterValues()[filter.key] ?? '';
  }

  setListFilterValue(filter: ConfigurableCrudListFilter, value: string | number | boolean | null) {
    this.listFilterValues.update((current) => ({ ...current, [filter.key]: value }));
  }

  /** Text filters apply like Search: on Enter/Apply, or at once when cleared. */
  onListFilterInput(filter: ConfigurableCrudListFilter, value: string): void {
    this.setListFilterValue(filter, value);
    if (!value.trim() && this.appliedFilters().extra[filter.key]) this.applySearchFilters();
  }

  listFilterLoading(filter: ConfigurableCrudListFilter): boolean {
    return filter.remoteLookup
      ? this.filterRemoteLookups.isLoading()
      : (filter.loading?.() ?? false);
  }

  remoteSearchChanged(field: ConfigurableCrudField, search: string): void {
    if (!field.remoteLookup) return;
    this.remoteQueries.update((q) => ({ ...q, [field.key]: { search, offset: 0 } }));
  }
  remotePageChanged(field: ConfigurableCrudField, direction: number): void {
    const old = this.remoteQueries()[field.key] ?? { search: '', offset: 0 };
    this.remoteQueries.update((q) => ({
      ...q,
      [field.key]: { ...old, offset: Math.max(0, old.offset + direction * 50) },
    }));
  }
  remoteHasNext(field: ConfigurableCrudField): boolean {
    return (this.remoteLookups.value()[field.key]?.items.length ?? 0) === 50;
  }
  remoteHasPrevious(field: ConfigurableCrudField): boolean {
    return (this.remoteQueries()[field.key]?.offset ?? 0) > 0;
  }
  remoteError(field: ConfigurableCrudField): boolean {
    return this.remoteLookups.value()[field.key]?.error ?? false;
  }

  fieldLoading(field: ConfigurableCrudField): boolean {
    return field.remoteLookup ? this.remoteLookups.isLoading() : (field.loading?.() ?? false);
  }

  /** Explicit field config wins; otherwise the canonical registry entry for the FK `source`. */
  protected resolveQuickCreate(
    field: ConfigurableCrudField,
  ): ConfigurableCrudQuickCreateConfig | null {
    if (field.quickCreate === false) return null;
    if (field.quickCreate) return field.quickCreate;
    if (field.type !== 'search-select') return null;
    return quickCreateRegistryEntry(field.source);
  }

  canQuickCreate(field: ConfigurableCrudField): boolean {
    const quickCreate = this.resolveQuickCreate(field);
    if (!quickCreate || this.isFieldDisabled(field)) return false;
    if (
      quickCreate.permission &&
      !hasEffectivePermission(
        this.quickCreateAuth.user()?.permissions ?? [],
        quickCreate.permission,
      )
    ) {
      return false;
    }
    const context: ConfigurableCrudQuickCreateContext = {
      editing: Boolean(this.editingRecord()),
      values: this.formValues(),
    };
    return typeof quickCreate.enabled === 'function'
      ? quickCreate.enabled(context)
      : quickCreate.enabled !== false;
  }

  quickCreateLabel(field: ConfigurableCrudField): string {
    return this.resolveQuickCreate(field)?.label ?? 'Create new';
  }

  async quickCreateField(field: ConfigurableCrudField): Promise<void> {
    const quickCreate = this.resolveQuickCreate(field);
    if (!quickCreate || !this.canQuickCreate(field)) return;
    const { openQuickCreate } = await import('./configurable-crud-quick-create-host');
    const initialValues =
      typeof quickCreate.initialValues === 'function'
        ? quickCreate.initialValues({
            editing: Boolean(this.editingRecord()),
            values: this.formValues(),
          })
        : quickCreate.initialValues;
    const result = await openQuickCreate(this.dialog, { ...quickCreate, initialValues });
    const option = result?.option;
    if (!result || !option) return;

    this.quickCreatedOptions.update((current) => ({
      ...current,
      [field.key]: [
        option,
        ...(current[field.key] ?? []).filter((item) => String(item.value) !== String(option.value)),
      ],
    }));
    if (field.remoteLookup) this.selectedRemoteOptions.set(field.key, option);
    await this.afterQuickCreate(field, option, result);
    if (field.multiple) {
      const selected = this.formValues()[field.key];
      const values = Array.isArray(selected) ? selected : [];
      this.setFieldValue(field.key, [
        ...values.filter((value) => value !== option.value),
        option.value,
      ]);
    } else {
      this.setFieldValue(field.key, option.value);
    }
  }

  /** Keeps options created through quick-create visible until the page reloads its lookups. */
  private withQuickCreatedOptions(
    field: ConfigurableCrudField,
    options: readonly ConfigurableCrudOption[],
  ): readonly ConfigurableCrudOption[] {
    const created = this.quickCreatedOptions()[field.key];
    if (!created?.length) return options;
    const known = new Set(options.map((option) => String(option.value)));
    const missing = created.filter((option) => !known.has(String(option.value)));
    return missing.length ? [...missing, ...options] : options;
  }

  protected afterQuickCreate(
    _field: ConfigurableCrudField,
    _option: ConfigurableCrudOption,
    _result: ConfigurableCrudQuickCreateResult,
  ): void | Promise<void> {}

  addressCopyActions(): readonly ConfigurableCrudCopyAction[] {
    return this.config.addressCopyActions ?? [];
  }

  isCopyActionEnabled(action: ConfigurableCrudCopyAction): boolean {
    return this.enabledCopyActions().has(action.key);
  }

  isFieldDisabled(field: ConfigurableCrudField): boolean {
    if (
      field.disabledWhen?.({
        editing: Boolean(this.editingRecord()),
        values: this.formValues(),
      })
    ) {
      return true;
    }
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
    // A computed label (translation key) wins, for example a readable sync state.
    if (column.value) return this.columnComputedValue(row, column) ?? '-';
    const value = row[column.field ?? column.id];
    const options = column.options ?? this.statusOptions();
    const option = options.find(
      (candidate) => String(candidate.value ?? '') === String(value ?? ''),
    );
    if (option) return option.label;
    // Free-form job/health states (custom chip palette) show their own value.
    if (column.chipClass)
      return value === null || value === undefined || value === '' ? '-' : String(value);
    return this.statusLabel(value);
  }

  statusChipClass(row: T, column: ConfigurableCrudColumn): string {
    const value = row[column.field ?? column.id];
    const customClass = column.chipClass?.(value, row);
    if (customClass) return customClass;
    return this.isActiveStatus(value) ? 'chip-success' : 'chip-skipped';
  }

  imageUrl(row: T, column: ConfigurableCrudColumn): string | null {
    const value = row[column.field ?? column.id];
    return typeof value === 'string' && value.trim() ? value : null;
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

  private columnOptionLabel(row: T, column: ConfigurableCrudColumn): string | undefined {
    const value = row[column.field ?? column.id];
    const option = column.options?.find((item) => String(item.value ?? '') === String(value ?? ''));
    return option ? this.t(option.label) : undefined;
  }

  columnMain(row: T, column: ConfigurableCrudColumn): string {
    const computed = this.columnComputedValue(row, column);
    if (computed !== undefined) return computed;
    const label = this.columnOptionLabel(row, column);
    if (label !== undefined) return label;
    if (column.lookupKey && column.uuidField) {
      const lookup = this.lookupLabel(column.lookupKey, row[column.uuidField]);
      if (lookup) return lookup;
    }
    const field = column.field ?? column.id;
    const value = this.displayValue(row[field]);
    return column.translateValue && value !== '-' ? this.transloco.translate(value) : value;
  }

  columnUUID(row: T, column: ConfigurableCrudColumn): string {
    const detail = column.detail?.(row, (key) => this.transloco.translate(key))?.trim();
    if (detail) return detail;
    if (column.uuidField) return this.displayValue(row[column.uuidField]);
    return column.kind === 'identity' ? this.recordUUID(row) : '';
  }

  columnText(row: T, column: ConfigurableCrudColumn): string {
    const computed = this.columnComputedValue(row, column);
    if (computed !== undefined) return computed;
    const label = this.columnOptionLabel(row, column);
    if (label !== undefined) return label;
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

  private columnComputedValue(row: T, column: ConfigurableCrudColumn): string | undefined {
    if (!column.value) return undefined;
    return (
      column
        .value(row, (key) => this.transloco.translate(key), this.appliedFilters().extra)
        ?.trim() || '-'
    );
  }

  /** True when the secondary line holds a record UUID (not a readable `detail`). */
  columnHasUUIDLine(row: T, column: ConfigurableCrudColumn): boolean {
    const detail = column.detail?.(row, (key) => this.transloco.translate(key))?.trim();
    return !detail && isRecordUUID(this.columnUUID(row, column));
  }

  /** Secondary line text: readable detail as is, UUIDs shortened to their first characters. */
  columnUUIDLabel(row: T, column: ConfigurableCrudColumn): string {
    const value = this.columnUUID(row, column);
    return this.columnHasUUIDLine(row, column) ? shortRecordUUID(value) : value;
  }

  copyColumnUUID(row: T, column: ConfigurableCrudColumn): Promise<void> {
    return this.copyText(this.columnUUID(row, column));
  }

  isColumnLocked(column: ConfigurableCrudColumn): boolean {
    return this.columns()[0]?.id === column.id;
  }

  isColumnVisible(column: ConfigurableCrudColumn): boolean {
    return (
      this.isColumnLocked(column) ||
      isCrudColumnVisible(this.viewPreferences(), column.id, column.optional === true)
    );
  }

  setColumnVisible(column: ConfigurableCrudColumn, visible: boolean): void {
    if (this.isColumnLocked(column)) return;
    this.saveViewPreferences(
      setCrudColumnVisible(this.viewPreferences(), column.id, column.optional === true, visible),
    );
  }

  /** Column state shown in the table view menu, including staged (not yet applied) choices. */
  isColumnChecked(column: ConfigurableCrudColumn): boolean {
    return (
      this.isColumnLocked(column) ||
      isCrudColumnVisible(
        this.columnDraft() ?? this.viewPreferences(),
        column.id,
        column.optional === true,
      )
    );
  }

  toggleColumnDraft(column: ConfigurableCrudColumn): void {
    if (this.isColumnLocked(column)) return;
    this.columnDraft.set(
      setCrudColumnVisible(
        this.columnDraft() ?? this.viewPreferences(),
        column.id,
        column.optional === true,
        !this.isColumnChecked(column),
      ),
    );
  }

  /** Table view menu closed: apply staged column choices and clear the column search. */
  applyColumnDraft(): void {
    this.columnSearch.set('');
    const draft = this.columnDraft();
    if (!draft) return;
    this.columnDraft.set(null);
    this.saveViewPreferences({
      ...this.viewPreferences(),
      hidden: draft.hidden,
      shown: draft.shown,
    });
  }

  setDensity(density: CrudDensity): void {
    this.saveViewPreferences({ ...this.viewPreferences(), density });
  }

  resetView(): void {
    this.columnDraft.set(null);
    this.saveViewPreferences(DEFAULT_CRUD_VIEW);
  }

  private saveViewPreferences(preferences: CrudViewPreferences): void {
    this.viewPreferences.set(preferences);
    writeCrudViewPreferences(this.viewStorageKey, preferences);
  }

  private readonly revealedSecrets = signal<ReadonlySet<string>>(new Set());
  private readonly secretTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Values fetched by `secretLoader`, kept only while revealed. */
  private readonly loadedSecrets = signal<ReadonlyMap<string, string>>(new Map());
  readonly loadingSecrets = signal<ReadonlySet<string>>(new Set());

  private secretKey(row: T, column: ConfigurableCrudColumn): string {
    return `${this.recordUUID(row)}:${column.id}`;
  }

  hasSecretValue(row: T, column: ConfigurableCrudColumn): boolean {
    if (column.secretLoader) return column.secretAvailable?.(row) ?? true;
    return this.columnCopyValue(row, column) !== '';
  }

  isSecretRevealed(row: T, column: ConfigurableCrudColumn): boolean {
    return this.revealedSecrets().has(this.secretKey(row, column));
  }

  isSecretLoading(row: T, column: ConfigurableCrudColumn): boolean {
    return this.loadingSecrets().has(this.secretKey(row, column));
  }

  secretText(row: T, column: ConfigurableCrudColumn): string {
    if (!column.secretLoader) return this.columnText(row, column);
    return this.loadedSecrets().get(this.secretKey(row, column)) ?? '';
  }

  /** Loads a `secretLoader` value; null (with an error toast) when it cannot be read. */
  private async loadSecret(row: T, column: ConfigurableCrudColumn): Promise<string | null> {
    const key = this.secretKey(row, column);
    const cached = this.loadedSecrets().get(key);
    if (cached !== undefined) return cached;
    this.loadingSecrets.update((current) => new Set(current).add(key));
    try {
      return await column.secretLoader!(row);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
      return null;
    } finally {
      this.loadingSecrets.update((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  private forgetSecret(key: string): void {
    if (!this.loadedSecrets().has(key)) return;
    this.loadedSecrets.update((current) => {
      const next = new Map(current);
      next.delete(key);
      return next;
    });
  }

  async toggleSecret(row: T, column: ConfigurableCrudColumn): Promise<void> {
    const key = this.secretKey(row, column);
    clearTimeout(this.secretTimers.get(key));
    this.secretTimers.delete(key);
    const reveal = !this.revealedSecrets().has(key);
    if (reveal && column.secretLoader) {
      const value = await this.loadSecret(row, column);
      if (value === null) return;
      this.loadedSecrets.update((current) => new Map(current).set(key, value));
    }
    this.setSecretRevealed(key, reveal);
    if (!reveal) return;
    this.secretTimers.set(
      key,
      setTimeout(() => {
        this.secretTimers.delete(key);
        this.setSecretRevealed(key, false);
      }, SECRET_REVEAL_MS),
    );
  }

  private setSecretRevealed(key: string, revealed: boolean): void {
    if (!revealed) this.forgetSecret(key);
    this.revealedSecrets.update((current) => {
      const next = new Set(current);
      if (revealed) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  columnWidthClass(column: ConfigurableCrudColumn): string {
    return `crud-cell-w-${column.width ?? 'lg'}`;
  }

  canCopyColumn(row: T, column: ConfigurableCrudColumn): boolean {
    if (column.secretLoader) return column.copyable === true && this.hasSecretValue(row, column);
    return column.copyable === true && this.columnCopyValue(row, column) !== '';
  }

  async copyColumnValue(row: T, column: ConfigurableCrudColumn): Promise<void> {
    if (!column.secretLoader) return this.copyText(this.columnCopyValue(row, column));
    // Copy without revealing: the loaded value is not kept unless the secret is shown.
    const value = await this.loadSecret(row, column);
    if (value !== null) await this.copyText(value);
  }

  /** Drops a loaded `secretLoader` value (for example after the secret was regenerated). */
  protected resetSecret(row: T, columnId: string): void {
    const key = `${this.recordUUID(row)}:${columnId}`;
    clearTimeout(this.secretTimers.get(key));
    this.secretTimers.delete(key);
    this.setSecretRevealed(key, false);
  }

  protected async copyText(value: string): Promise<void> {
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
    return this.config.payload?.(payload, Boolean(this.editingRecord())) ?? payload;
  }

  protected onFieldValueChanged(_key: string, _value: unknown): void {}

  /**
   * Last chance to show an impact preview/confirmation for the validated flat form payload;
   * returning false keeps the dialog open without saving.
   */
  protected confirmBeforeSave(_payload: ConfigurableCrudRecord): Promise<boolean> {
    return Promise.resolve(true);
  }

  /** Full URL of the delete request of one row. */
  protected deleteUrlFor(row: T): string {
    return `${this.deleteEndpointFor(row)}/${this.recordUUID(row)}`;
  }

  /** Hook after a row was deleted. */
  protected afterDelete(_row: T): void {}

  /** Hook after a declarative row action request succeeded. */
  protected afterRowActionRequest(_row: T): void {}

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

  protected async fetchItems(
    filters: ConfigurableCrudFilters | ConfigurableCrudListParams,
  ): Promise<T[]> {
    if (this.config.formOnly) return [];
    const params = new URLSearchParams();
    const limit = this.serverSidePagination()
      ? (filters as ConfigurableCrudListParams).limit
      : this.listLimit;
    const offset = this.serverSidePagination() ? (filters as ConfigurableCrudListParams).offset : 0;
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    const ordering = filters as ConfigurableCrudListParams;
    if (this.config.serverSideSorting && ordering.sortBy && ordering.sortDirection) {
      params.set('sortBy', ordering.sortBy);
      params.set('sortDirection', ordering.sortDirection);
    }
    if (filters.search) params.set('search', filters.search);
    if (this.statusFilterEnabled() && filters.status !== '')
      params.set('status', String(filters.status));
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (filter.match || value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }
    for (const [key, value] of Object.entries(this.config.listQuery ?? {})) params.set(key, value);

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
      ...(this.config.serverSideSorting
        ? {
            sortBy: this.columns().find((column) => column.id === this.sortActive())?.field,
            sortDirection: this.sortDirection(),
          }
        : {}),
    };
  }

  private normalizeRows(rows: T[] | undefined): T[] {
    return Array.isArray(rows) ? rows : [];
  }

  private filterRows(rows: T[]): T[] {
    const filters = this.appliedFilters();
    const searchTerm = filters.search?.trim().toLowerCase();
    const statusFilter = filters.status;
    const extraFilters = filters.extra ?? {};
    const columns = this.columns();

    return rows.filter((row) => {
      if (
        this.statusFilterEnabled() &&
        statusFilter !== '' &&
        statusFilter !== null &&
        statusFilter !== undefined
      ) {
        if (!this.matchesStatusFilter(row, statusFilter)) return false;
      }

      for (const filter of this.listFilters()) {
        const filterVal = extraFilters[filter.key];
        if (filterVal !== null && filterVal !== undefined && filterVal !== '') {
          if (!this.matchesListFilter(row, filter, filterVal)) return false;
        }
      }

      if (searchTerm) {
        if (!this.matchesSearchFilter(row, searchTerm, columns)) return false;
      }

      return true;
    });
  }

  private matchesStatusFilter(row: T, statusFilter: string | number): boolean {
    const statusCol =
      this.columns().find((c) => c.kind === 'status') ??
      this.columns().find((c) => c.id === 'status');
    const statusField =
      statusCol?.field ??
      this.config.fields.find((f) => f.type === 'status' || f.key === 'status')?.source ??
      'status';
    const rowStatus = row[statusField] ?? row['status'];

    if (String(statusFilter) === 'active') {
      return this.isActiveStatus(rowStatus);
    }
    return String(rowStatus ?? '') === String(statusFilter);
  }

  private matchesListFilter(
    row: T,
    filter: ConfigurableCrudListFilter,
    filterVal: unknown,
  ): boolean {
    const target = String(filterVal ?? '');
    if (!target) return true;
    if (filter.match) return filter.match(row, filterVal as string | number | boolean);

    if (String(row[filter.key] ?? '') === target) return true;
    if (filter.paramKey && String(row[filter.paramKey] ?? '') === target) return true;

    const mappedField = this.config.fields.find(
      (f) => f.key === filter.key || f.payloadKey === filter.key,
    );
    if (mappedField?.source && String(row[mappedField.source] ?? '') === target) return true;

    const matchedCol = this.columns().find(
      (c) =>
        c.uuidField === filter.key ||
        c.field === filter.key ||
        (mappedField?.source && c.uuidField === mappedField.source),
    );
    if (matchedCol?.uuidField && String(row[matchedCol.uuidField] ?? '') === target) return true;

    return false;
  }

  private matchesSearchFilter(
    row: T,
    term: string,
    columns: readonly ConfigurableCrudColumn[],
  ): boolean {
    for (const column of columns) {
      const copyVal = this.columnCopyValue(row, column).toLowerCase();
      if (copyVal && copyVal.includes(term)) return true;

      const text = this.columnText(row, column).toLowerCase();
      if (text && text.includes(term)) return true;

      const detail = column.detail?.(row, (key) => this.transloco.translate(key))?.toLowerCase();
      if (detail && detail.includes(term)) return true;

      const field = column.field ?? column.id;
      if (column.lookupKey) {
        const lookup = this.lookupLabel(column.lookupKey, row[field])?.toLowerCase();
        if (lookup && lookup.includes(term)) return true;
      }

      const raw = row[field];
      if (typeof raw === 'string' && raw.toLowerCase().includes(term)) return true;
      if (typeof raw === 'number' && String(raw).includes(term)) return true;
    }

    for (const field of this.config.fields) {
      const val = row[field.source ?? field.key];
      if (typeof val === 'string' && val.toLowerCase().includes(term)) return true;
      if (typeof val === 'number' && String(val).includes(term)) return true;
    }

    return false;
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
    const label = this.columnOptionLabel(row, column);
    if (label !== undefined) return label.toLowerCase();
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

    this.isFormDialogOpen.set(true);
    this.dialogBinding = openCrudTemplateDialog(this.dialog, dialog, 'crud-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    bindDialogClosed(
      this.dialogBinding.ref,
      () => {
        this.isFormDialogOpen.set(false);
        this.dialogBinding?.stop();
        this.dialogBinding = null;
      },
      this.destroyRef,
    );
  }

  private resolveInitialValues(): ConfigurableCrudRecord {
    return this.config.initialValuesFactory
      ? this.config.initialValuesFactory()
      : this.config.initialValues;
  }

  private emptyFormValues(): ConfigurableCrudRecord {
    const values = { ...this.resolveInitialValues(), ...this.quickCreateSession?.initialValues };
    for (const key of this.config.defaultCurrencyFields ?? []) values[key] = this.defaultCurrency();
    return values;
  }

  protected formValuesFromRecord(row: T): ConfigurableCrudRecord {
    // Static defaults only: create-time generated values never fill an existing record.
    const initial = this.config.initialValues;
    const next: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      let value = row[field.source ?? field.key] ?? initial[field.key] ?? '';
      if (this.config.defaultCurrencyFields?.includes(field.key) && !String(value).trim()) {
        value = this.defaultCurrency();
      }
      const formatted = field.format === 'json' ? this.formatJsonValue(value) : value;
      next[field.key] = field.fromRecord ? field.fromRecord(formatted, row) : formatted;
    }
    return next;
  }

  protected reflectSavedRecord(current: T, payload: ConfigurableCrudRecord): void {
    const uuid = this.recordUUID(current);
    const values: ConfigurableCrudRecord = {};
    for (const field of this.config.fields) {
      const payloadKey = field.payloadKey ?? field.key;
      const source = field.source ?? field.key;
      // Form-only controls (for example a separate time input) may be consumed by
      // payload augmentation. They must not erase the persisted source value.
      if (Object.hasOwn(payload, payloadKey)) values[source] = payload[payloadKey] ?? null;
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
      if (typeof value === 'string' && field.type !== 'password' && field.type !== 'secret-content')
        value = value.trim();
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

  /**
   * Collects every invalid visible field (malformed JSON, invalid date, missing required value)
   * and reports them together. Overrides add page rules with `rejectField(...)`.
   */
  protected validatePayload(payload: ConfigurableCrudRecord): boolean {
    const errors = new Map<string, FieldError>();
    for (const field of this.config.fields) {
      if (!this.isFieldVisible(field)) continue;
      if (field.format === 'json') {
        const raw = this.formValues()[field.key];
        if (typeof raw === 'string' && raw.trim()) {
          try {
            JSON.parse(raw);
          } catch {
            errors.set(field.key, fieldError('invalidJson'));
            continue;
          }
        }
      }
      const value = payload[field.payloadKey ?? field.key];
      if (field.type === 'date' && value !== null && value !== '' && value !== undefined) {
        if (this.normalizeDateForPayload(value) === undefined) {
          errors.set(field.key, fieldError('invalidDate'));
          continue;
        }
      }
      if (this.isFieldRequired(field) && isBlankFieldValue(value)) {
        errors.set(field.key, fieldError('required'));
      }
    }
    if (!errors.size) return true;
    this.reportFieldErrors(errors);
    return false;
  }

  /**
   * A partial date must not replace the current form value while the user is typing,
   * because MatDatepickerInput only accepts Date values. Before saving, validate and
   * commit any remaining locale-formatted drafts into the canonical date-only value.
   */
  private commitDateDrafts(): boolean {
    if (this.dateDrafts.size === 0) return true;

    const committed: ConfigurableCrudRecord = {};
    const invalid = new Map<string, FieldError>();
    for (const [key, draft] of this.dateDrafts) {
      const normalized = this.normalizeDateForPayload(draft);
      if (!normalized) invalid.set(key, fieldError('invalidDate'));
      else committed[key] = normalized;
    }
    if (invalid.size) {
      this.reportFieldErrors(invalid);
      return false;
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
    const payMessage = payErrorMessage(error);
    if (payMessage) return payMessage;
    const billing = billingErrorText(error);
    if (billing) {
      const module = billing.params?.['module'];
      return billing.params
        ? this.t(billing.key, {
            module: module?.startsWith('i18n:') ? this.t(module.slice(5)) : (module ?? ''),
          })
        : billing.key;
    }
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

const RELATED_FIELD_SEPARATOR = '::';

/** Default child payload: every related field under its payload key. */
function relatedPayload(
  values: ConfigurableCrudRecord,
  fields: readonly ConfigurableCrudField[],
): ConfigurableCrudRecord {
  const payload: ConfigurableCrudRecord = {};
  for (const field of fields) payload[field.payloadKey ?? field.key] = values[field.key] ?? null;
  return payload;
}

function labelClassList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : value.split(/\s+/)).filter(Boolean);
}

function extractCrudItems(response: unknown): ConfigurableCrudRecord[] {
  const data = (response as { data?: unknown })?.data;
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: ConfigurableCrudRecord[] }).items;
  }
  return [];
}

function optionText(value: unknown): string | null {
  if (value === null || value === undefined || typeof value === 'object') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

/** Create responses carry the record under different envelopes; return the first object found. */
function quickCreateResponseRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const data = value?.data as
    { item?: unknown; record?: unknown; data?: unknown; items?: unknown } | undefined;
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const candidates = [data?.item, data?.record, data?.data, items[0], value?.data, value?.item];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as ConfigurableCrudRecord;
    }
  }
  return null;
}
