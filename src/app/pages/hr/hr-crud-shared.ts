import { MatDialog } from '@angular/material/dialog';
import { ConfigurableCrudOption } from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  DataViewerDetail,
  openDataViewerDialog,
} from '../../shared/data-viewer-dialog/data-viewer-dialog';
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

/** What a page lends to the shared HR row operations (its own protected helpers, bound). */
export type HrPageOps = {
  confirm: (title: string, message: string, confirmLabel: string) => Promise<boolean>;
  post: (path: string, body: unknown) => Promise<unknown>;
  success: (message: string) => void;
  failure: (error: unknown, fallback: string) => void;
  refresh: () => void;
};

/** Asks, posts, tells and refreshes; false when cancelled or refused. */
export async function confirmedPost(
  ops: HrPageOps,
  action: string,
  question: string,
  path: string,
  body: unknown,
  success: string,
  failure: string,
): Promise<boolean> {
  if (!(await ops.confirm(action, question, action))) return false;
  try {
    await ops.post(path, body);
    ops.success(success);
    ops.refresh();
    return true;
  } catch (error) {
    ops.failure(error, failure);
    return false;
  }
}

/** A secret shown once (temporary password, time clock PIN, activation code), with copy. */
export function showHrSecret(
  dialog: MatDialog,
  title: string,
  description: string,
  details: DataViewerDetail[],
  value: string,
  sectionTitle = title,
): void {
  openDataViewerDialog(dialog, {
    title,
    description,
    details,
    sections: [{ title: sectionTitle, code: { value, format: 'text', copy: true } }],
  });
}
