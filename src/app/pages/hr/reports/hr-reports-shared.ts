import { Signal, computed, inject } from '@angular/core';
import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AppI18nService } from '../../../services/app-i18n.service';
import { currentMonth, formatMinutes, monthOptions } from '../hr-time';

export const MONTH_FILTER_KEY = 'month';

export const COMPANY_FILTER_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  selectedLabelField: 'CompanyName',
};

export const LOCATION_FILTER_LOOKUP = {
  endpoint: 'registry/locations',
  uuidField: 'LocationUUID',
  labelField: 'Name',
  selectedLabelField: 'LocationName',
};

export const EMPLOYEE_FILTER_LOOKUP = {
  endpoint: 'hr/employees',
  uuidField: 'RemUUID',
  labelField: 'RemName',
};

/** Filters shared by both reports: month (default: current), company, location and employee. */
export const REPORT_FILTERS: readonly ConfigurableCrudListFilter[] = [
  {
    key: MONTH_FILTER_KEY,
    paramKey: 'month',
    label: 'Month',
    type: 'select',
    span: 1,
  },
  {
    key: 'companyUUID',
    paramKey: 'companyUUID',
    label: 'Company',
    type: 'search-select',
    span: 1,
    emptyLabel: 'All',
    remoteLookup: COMPANY_FILTER_LOOKUP,
  },
  {
    key: 'locationUUID',
    paramKey: 'locationUUID',
    label: 'Location',
    type: 'search-select',
    span: 1,
    emptyLabel: 'All',
    remoteLookup: LOCATION_FILTER_LOOKUP,
  },
  {
    key: 'employeeUUID',
    paramKey: 'employeeUUID',
    label: 'Employee',
    type: 'search-select',
    span: 1,
    emptyLabel: 'All',
    remoteLookup: EMPLOYEE_FILTER_LOOKUP,
  },
];

/** Standard deviation in minutes with one decimal; `—` when the API has none (too few days). */
export function formatDeviation(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const minutes = Number(value);
  return Number.isFinite(minutes) ? minutes.toFixed(1) : '—';
}

/** Share `0..1` as a whole percentage. */
export function formatShare(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  const share = Number(value);
  return Number.isFinite(share) ? `${Math.round(share * 100)}%` : '—';
}

/** Month filter value of a list: the chosen month, or the current one. */
export function reportMonth(extra: Record<string, unknown> | undefined, now = new Date()): string {
  const value = extra?.[MONTH_FILTER_KEY];
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
    ? value
    : currentMonth(now);
}

/** Settings shared by both read-only report lists (server paging, export, search, no editing). */
export const REPORT_LIST_SETTINGS = {
  listExport: true,
  uuidField: 'RowKey',
  searchPlaceholder: 'Employee or registration number',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {},
  fields: [],
} as const;

/** Who the row is about: employee, location, company and registration number. */
export const REPORT_PERSON_COLUMNS: readonly ConfigurableCrudColumn[] = [
  {
    id: 'employee',
    label: 'Employee',
    field: 'EmployeeName',
    uuidField: 'EmployeeUUID',
    kind: 'identity',
    translateValue: false,
  },
  { id: 'location', label: 'Location', field: 'LocationName', translateValue: false },
  { id: 'company', label: 'Company', field: 'CompanyName', translateValue: false, optional: true },
  {
    id: 'registration',
    label: 'Registration',
    field: 'RegistrationNumber',
    translateValue: false,
    optional: true,
  },
];

/** Leading columns of both reports: the person plus the days counted. */
export const REPORT_IDENTITY_COLUMNS: readonly ConfigurableCrudColumn[] = [
  ...REPORT_PERSON_COLUMNS,
  { id: 'days', label: 'Days', field: 'Days', kind: 'number' },
];

/** Minutes column (`H:MM`, signed for balances) reading `field` of the API row. */
export const minutesColumn = (
  id: string,
  label: string,
  field: string,
  signed = false,
  optional = false,
): ConfigurableCrudColumn => ({
  id,
  label,
  field,
  value: (row) => formatMinutes(row[field], signed),
  ...(optional ? { optional } : {}),
});

/** Localized month options of the month filter (call in a field initializer: uses `inject`). */
export function reportMonthOptions(): Signal<readonly ConfigurableCrudOption[]> {
  const i18n = inject(AppI18nService);
  return computed(() => monthOptions(i18n.language()));
}

/** Options of a report filter: the month list for the month filter, otherwise the default ones. */
export function reportFilterOptions(
  filter: ConfigurableCrudListFilter,
  months: Signal<readonly ConfigurableCrudOption[]>,
  fallback: () => readonly ConfigurableCrudOption[],
): readonly ConfigurableCrudOption[] {
  return filter.key === MONTH_FILTER_KEY ? months() : fallback();
}

/** The month filter always has a value: the current month (on open and when the filters are cleared). */
export function resetReportMonth(
  page: ConfigurableCrudPageBase<ConfigurableCrudRecord>,
  month = currentMonth(),
): void {
  page.listFilterValues.update((values) => ({ ...values, [MONTH_FILTER_KEY]: month }));
  page.appliedFilters.update((filters) => ({
    ...filters,
    extra: { ...filters.extra, [MONTH_FILTER_KEY]: month },
  }));
}

/**
 * Read-only HR list with a month filter that always has a value (the current month, or the one
 * `defaultMonth` gives): on open and when the filters are cleared.
 */
export abstract class HrMonthListPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly months = reportMonthOptions();

  protected constructor(
    config: ConfigurableCrudConfig,
    private readonly defaultMonth: () => string = currentMonth,
  ) {
    super(config);
    resetReportMonth(this, defaultMonth());
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return reportFilterOptions(filter, this.months, () => super.listFilterOptions(filter));
  }

  override clearSearchFilters(): void {
    super.clearSearchFilters();
    resetReportMonth(this, this.defaultMonth());
  }
}
