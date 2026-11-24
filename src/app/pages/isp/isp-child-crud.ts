import {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

/** Chip palette of the ISP subscription states (operational status and effective state). */
export function ispStateChipClass(value: unknown): string {
  switch (String(value ?? '')) {
    case 'active':
      return 'chip-success';
    case 'pending':
    case 'reduced':
      return 'chip-warning';
    case 'blocked':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
}

export type IspChildCollectionSpec = {
  key: string;
  label: string;
  emptyLabel: string;
  /** Collection list/create endpoint under the parent record. */
  endpoint: (parentUUID: string) => string;
  /** Complete URL of one child record (update and delete). */
  itemEndpoint?: (row: ConfigurableCrudRecord) => string;
  uuidField: string;
  /** Revision column of the child row; enables the revision on update and delete. */
  revisionField?: string;
  fields: readonly ConfigurableCrudField[];
  columns: readonly ConfigurableCrudColumn[];
  initialValues?: ConfigurableCrudRecord;
  payload?: (values: ConfigurableCrudRecord, editing: boolean) => ConfigurableCrudRecord;
  addLabel?: string;
  createTitle?: string;
  editTitle?: string;
  savedMessage?: string;
  deletedMessage?: string;
  /** Child rows are edited (needs `itemEndpoint`). */
  editable?: boolean;
  /** No create, edit or delete: the history of the parent. */
  readOnly?: boolean;
  statusFilter?: boolean;
  description: string;
};

/**
 * Child records of an ISP parent form tab (plan add-ons, subscription IP assignments and events):
 * the global table with the standard create/edit dialog, answering `data.items` and deleting with
 * the revision of the child row.
 */
export function ispChildCollection(
  spec: IspChildCollectionSpec,
): ConfigurableCrudRelatedCollection {
  const itemEndpoint = spec.itemEndpoint ?? (() => '');
  return {
    key: spec.key,
    label: spec.label,
    emptyLabel: spec.emptyLabel,
    uuidField: spec.uuidField,
    endpoint: spec.endpoint,
    deleteEndpoint: (_parent, row) => itemEndpoint(row),
    initialValues: {},
    fields: [],
    columns: [],
    config: (parentUUID) =>
      defineCrud({
        endpoint: spec.endpoint(parentUUID),
        uuidField: spec.uuidField,
        pageTitle: spec.label,
        pageDescription: spec.description,
        emptyLabel: spec.emptyLabel,
        createLabel: spec.addLabel,
        createTitle: spec.createTitle ?? spec.addLabel ?? 'New',
        editTitle: spec.editTitle ?? 'Edit',
        savedMessage: spec.savedMessage ?? 'Record saved successfully.',
        deletedMessage: spec.deletedMessage ?? 'Record deleted successfully.',
        readOnly: spec.readOnly,
        canEdit: Boolean(spec.editable),
        updateEndpoint: spec.editable ? itemEndpoint : undefined,
        deleteEndpoint: itemEndpoint,
        deletePayload: spec.revisionField
          ? (row) => ({ revision: Number(row[spec.revisionField as string]) })
          : undefined,
        bulkDelete: false,
        statusFilter: spec.statusFilter ?? false,
        serverSidePagination: true,
        initialValues: spec.initialValues ?? {},
        fields: spec.fields,
        columns: spec.columns,
        payload: spec.payload,
      }),
  };
}
