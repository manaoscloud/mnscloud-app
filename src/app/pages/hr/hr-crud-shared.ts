import { ConfigurableCrudOption } from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';

/** Companies of the HR account in context (lookups of the HR pages). */
export const HR_COMPANY_LOOKUP = {
  endpoint: 'hr/companies',
  uuidField: 'RcoUUID',
  labelField: 'RcoName',
  selectedLabelField: 'CompanyName',
};

export const HR_YES_NO: readonly ConfigurableCrudOption[] = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
];

/** Optional company of a record: empty means every employee of the HR account. */
export function hrCompanyField(help: string) {
  return {
    key: 'companyUUID',
    source: 'CompanyUUID',
    label: 'Company',
    type: 'search-select' as const,
    remoteLookup: HR_COMPANY_LOOKUP,
    quickCreate: quickCreateFor('RegCompanyRcoUUID'),
    span: 1 as const,
    help,
  };
}

/** Company column that reads "All" when the record serves every company. */
export const HR_COMPANY_COLUMN = {
  id: 'company',
  label: 'Company',
  value: (row: Record<string, unknown>, t: (key: string) => string) =>
    row['CompanyName'] ? String(row['CompanyName']) : t('All'),
};

/** Hidden optimistic revision sent back on update. */
export const HR_REVISION_FIELD = {
  key: 'revision',
  source: 'Revision',
  label: 'documents.revision',
  hiddenWhen: () => true,
};
