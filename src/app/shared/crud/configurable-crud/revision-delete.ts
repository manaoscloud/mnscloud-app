import type { ConfigurableCrudConfig } from './configurable-crud-page-base';

/** Keep the revisions selected by the user for both individual and bulk deletion. */
export function revisionDeletePayloads(
  uuidField: string,
  revisionField: string,
): Pick<ConfigurableCrudConfig, 'deletePayload' | 'bulkDeletePayload'> {
  return {
    deletePayload: (row) => ({ revision: row[revisionField] }),
    bulkDeletePayload: (rows) => ({
      ids: rows.map((row) => row[uuidField]),
      revisions: Object.fromEntries(
        rows.map((row) => [String(row[uuidField]), row[revisionField]]),
      ),
    }),
  };
}
