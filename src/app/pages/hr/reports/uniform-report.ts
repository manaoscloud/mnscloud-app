import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  REPORT_FILTERS,
  REPORT_IDENTITY_COLUMNS,
  REPORT_LIST_SETTINGS,
  formatDeviation,
  formatShare,
  reportFilterOptions,
  reportMonthOptions,
  resetReportMonth,
} from './hr-reports-shared';

// Months whose punch times are suspiciously uniform (Súmula 338, III of the TST). An indicator for
// HR review only: the API never creates, changes or rounds a punch.
const config = defineCrud({
  ...REPORT_LIST_SETTINGS,
  endpoint: 'hr/reports/uniform-punches',
  pageTitle: 'British schedule',
  pageDescription:
    'Flags months with uniform punch times (Súmula 338, III of the TST) for HR review: at least 10 days with entry and exit varying up to 3 minutes, or 80% or more of the punches on a minute multiple of 5. Punches are never changed.',
  emptyLabel: 'No employees found in the month.',
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
    ...REPORT_IDENTITY_COLUMNS,
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
      value: (row, t) =>
        row['Uniform'] === true || Number(row['Uniform']) === 1 ? t('Uniform') : '—',
    },
  ],
});

@Component({
  selector: 'app-hr-uniform-report',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrUniformReportPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly months = reportMonthOptions();

  constructor() {
    super(config);
    resetReportMonth(this);
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return reportFilterOptions(filter, this.months, () => super.listFilterOptions(filter));
  }

  override clearSearchFilters(): void {
    super.clearSearchFilters();
    resetReportMonth(this);
  }
}
