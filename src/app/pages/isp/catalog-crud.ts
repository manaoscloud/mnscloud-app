import {
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/** Column prefix of the ISP platform catalog tables (`Icv` vendors, `Icm` models). */
export type IspCatalogPrefix = 'Icv' | 'Icm';

/** List and delete options shared by the ISP platform catalog pages. */
export function ispCatalogListOptions(prefix: IspCatalogPrefix) {
  return {
    serverSidePagination: true,
    serverSideSorting: true,
    initialPageSize: 50,
    // Each deletion carries its own revision; there is no bulk deletion contract.
    bulkDelete: false,
    deletePayload: (row: ConfigurableCrudRecord) => ({
      revision: Number(row[`${prefix}Revision`]),
    }),
  };
}

/**
 * Normalizes a catalog payload: status as a number, empty optional texts as null, and the
 * create-only keys (fixed at creation) removed on update; the revision is sent only on update.
 */
export function ispCatalogPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
  createOnly: string[],
  nullable: string[],
): ConfigurableCrudRecord {
  const payload: ConfigurableCrudRecord = { ...values, status: Number(values['status']) };
  for (const key of nullable) payload[key] = values[key] || null;
  if (editing) for (const key of createOnly) delete payload[key];
  else delete payload['revision'];
  return payload;
}

/** Hidden revision, status and the immutable code fields of a catalog form. */
export function ispCatalogHeadFields(prefix: IspCatalogPrefix): ConfigurableCrudField[] {
  return [
    {
      key: 'revision',
      source: `${prefix}Revision`,
      label: 'Revision',
      type: 'number',
      hidden: true,
    },
    { key: 'status', source: `${prefix}Status`, label: 'Status', type: 'status', span: 1 },
  ];
}

/** The code (lowercase slug) is fixed at creation. */
export function ispCatalogCodeField(prefix: IspCatalogPrefix): ConfigurableCrudField {
  return {
    key: 'code',
    source: `${prefix}Code`,
    label: 'Code',
    required: true,
    span: 1,
    help: 'isp.catalogCodeHelp',
    disabledWhen: ({ editing }) => editing,
  };
}

/** Internal platform notes (never returned to tenants). */
export function ispCatalogNotesField(prefix: IspCatalogPrefix): ConfigurableCrudField {
  return {
    key: 'notes',
    source: `${prefix}Notes`,
    label: 'Notes',
    type: 'textarea',
    tab: 'notes',
    span: 4,
    rows: 4,
  };
}
