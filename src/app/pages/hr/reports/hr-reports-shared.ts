import { ConfigurableCrudListFilter } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { currentMonth } from '../hr-time';

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
