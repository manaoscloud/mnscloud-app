import { Component, computed, inject } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { AppI18nService } from '../../../services/app-i18n.service';
import { currentMonth, monthOptions } from '../hr-time';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  MONTH_FILTER_KEY,
  REPORT_FILTERS,
  formatDeviation,
  formatShare,
} from './hr-reports-shared';

// Months whose punch times are suspiciously uniform (Súmula 338, III of the TST). An indicator for
// HR review only: the API never creates, changes or rounds a punch.
const config = defineCrud({
  listExport: true,
  endpoint: 'hr/reports/uniform-punches',
  uuidField: 'EmploymentUUID',
  pageTitle: 'British schedule',
  pageDescription:
    'Flags months with uniform punch times (Súmula 338, III of the TST) for HR review: at least 10 days with entry and exit varying up to 3 minutes, or 80% or more of the punches on a minute multiple of 5. Punches are never changed.',
  searchPlaceholder: 'Employee',
  emptyLabel: 'No employees found in the month.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialPageSize: 25,
  initialValues: {},
  listFilters: [
    ...REPORT_FILTERS,
    {
      key: 'onlyUniform',
      paramKey: 'onlyUniform',
      label: 'Show',
      type: 'select',
      span: 1,
      emptyLabel: 'All employees',
      translateOptions: true,
      options: [{ value: 'true', label: 'Only uniform' }],
    },
  ],
  columns: [
    {
      id: 'employee',
      label: 'Employee',
      field: 'EmployeeName',
      uuidField: 'EmployeeUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'location', label: 'Location', field: 'LocationName', translateValue: false },
    {
      id: 'company',
      label: 'Company',
      field: 'CompanyName',
      translateValue: false,
      optional: true,
    },
    {
      id: 'registration',
      label: 'Registration',
      field: 'RegistrationNumber',
      translateValue: false,
      optional: true,
    },
    { id: 'days', label: 'Days', field: 'Days', kind: 'number' },
    { id: 'punches', label: 'Punches', field: 'Punches', kind: 'number' },
    {
      id: 'entryDeviation',
      label: 'Entry deviation (min)',
      field: 'EntryStdDevMinutes',
      value: (row) => formatDeviation(row['EntryStdDevMinutes']),
    },
    {
      id: 'exitDeviation',
      label: 'Exit deviation (min)',
      field: 'ExitStdDevMinutes',
      value: (row) => formatDeviation(row['ExitStdDevMinutes']),
    },
    {
      id: 'roundShare',
      label: 'Round minutes',
      field: 'RoundShare',
      value: (row) => formatShare(row['RoundShare']),
    },
    {
      id: 'uniform',
      label: 'Uniform',
      field: 'Uniform',
      kind: 'status',
      value: (row, t) =>
        row['Uniform'] === true || Number(row['Uniform']) === 1 ? t('Uniform') : '',
      chipClass: () => 'chip-warning',
    },
  ],
  fields: [],
});

@Component({
  selector: 'app-hr-uniform-report',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrUniformReportPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly i18n = inject(AppI18nService);
  private readonly months = computed(() => monthOptions(this.i18n.language()));

  constructor() {
    super(config);
    this.resetMonth();
  }

  /** The month filter always has a value and offers localized month names. */
  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return filter.key === MONTH_FILTER_KEY ? this.months() : super.listFilterOptions(filter);
  }

  /** Clearing the filters keeps the current month. */
  override clearSearchFilters(): void {
    super.clearSearchFilters();
    this.resetMonth();
  }

  private resetMonth(): void {
    const month = currentMonth();
    this.listFilterValues.update((values) => ({ ...values, [MONTH_FILTER_KEY]: month }));
    this.appliedFilters.update((filters) => ({
      ...filters,
      extra: { ...filters.extra, [MONTH_FILTER_KEY]: month },
    }));
  }
}
