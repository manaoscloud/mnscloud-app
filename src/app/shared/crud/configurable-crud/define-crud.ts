import { ConfigurableCrudConfig } from './configurable-crud-page-base';

/**
 * Shared defaults for declarative resource pages; no duplicated page markup. Every page states what
 * the resource is for (`pageDescription`, app.md "Page Description Contract"): there is no default.
 */
export function defineCrud(
  config: Pick<
    ConfigurableCrudConfig,
    'endpoint' | 'uuidField' | 'pageTitle' | 'pageDescription' | 'fields' | 'columns'
  > &
    Partial<ConfigurableCrudConfig>,
): ConfigurableCrudConfig {
  return {
    createTitle: 'New',
    editTitle: 'Edit',
    dialogDescription: '',
    searchPlaceholder: 'Search',
    emptyLabel: 'No records found.',
    deleteTitle: 'Delete',
    deleteMessage: 'Delete this record?',
    deleteSelectedTitle: 'Delete selected',
    deleteSelectedMessage: 'Delete {count} records?',
    savedMessage: 'Record saved successfully.',
    deletedMessage: 'Record deleted successfully.',
    deleteFailedMessage: 'Failed to delete record.',
    initialValues: {},
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusFilter: true,
    ...config,
  };
}
