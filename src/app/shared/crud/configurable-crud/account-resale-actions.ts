import { defineCrud } from './define-crud';
import { revisionDeletePayloads } from './revision-delete';
import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudRowAction,
} from './configurable-crud-page-base';

export interface ResaleAccountFieldsOptions {
  helpKey: string;
  statusField: string;
  nameField: string;
  descField: string;
  revField: string;
}

export function resaleAccountFields(
  options: ResaleAccountFieldsOptions,
): ConfigurableCrudField[] {
  return [
    { key: 'status', source: options.statusField, label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: options.nameField, label: 'Name', required: true, span: 1 },
    {
      key: 'customerUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      help: options.helpKey,
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    {
      key: 'description',
      source: options.descField,
      label: 'Description',
      type: 'textarea',
      span: 1,
    },
    {
      key: 'revision',
      source: options.revField,
      label: 'documents.revision',
      hiddenWhen: () => true,
    },
  ];
}

export interface ResaleAccountCrudOptions {
  endpoint: string;
  /** Column prefix of the account table, for example `Cya` (CyaUUID, CyaName, ...). */
  prefix: string;
  /** Translation keys of the page; `i18n` is the namespace of the remaining labels. */
  pageTitle: string;
  pageDescription: string;
  createTitle: string;
  editTitle: string;
  i18n: string;
  extraColumns?: ConfigurableCrudColumn[];
}

/** List and form of a reseller account page (internal or customer kind). */
export function resaleAccountCrud(options: ResaleAccountCrudOptions) {
  const { endpoint, prefix, i18n, extraColumns = [], ...labels } = options;
  return defineCrud({
    ...labels,
    endpoint,
    uuidField: `${prefix}UUID`,
    serverSidePagination: true,
    bulkDelete: true,
    ...revisionDeletePayloads(`${prefix}UUID`, `${prefix}Revision`),
    initialValues: { name: '', description: '', customerUUID: null, status: 1 },
    fields: resaleAccountFields({
      helpKey: `${i18n}.accountCustomerHelp`,
      statusField: `${prefix}Status`,
      nameField: `${prefix}Name`,
      descField: `${prefix}Description`,
      revField: `${prefix}Revision`,
    }),
    columns: [
      { id: 'name', field: `${prefix}Name`, label: 'Name', kind: 'identity' },
      {
        id: 'publication',
        field: `${prefix}PortalEnabled`,
        label: `${i18n}.portalEnabled`,
        kind: 'status',
      },
      { id: 'customer', field: 'CustomerName', label: 'Customer' },
      ...extraColumns,
      { id: 'status', field: `${prefix}Status`, label: 'Status', kind: 'status' },
    ],
  });
}

export interface ResaleAccountActionOptions {
  module: string;
  uuidField: string;
  revisionField: string;
  portalField: string;
  kindField: string;
  memberUuidField: string;
  memberStatusField: string;
  publicationLabel: string;
  publicationTitle: string;
  publicationDescription: string;
  portalEnabledLabel: string;
  assignLabel: string;
  assignTitle: string;
  operatorsLabel: string;
  operatorsTitle: string;
  operatorsDescription: string;
  canManage: () => boolean;
}

export function resaleAccountRowActions(
  options: ResaleAccountActionOptions,
): ConfigurableCrudRowAction[] {
  const {
    module,
    uuidField,
    revisionField,
    portalField,
    kindField,
    memberUuidField,
    memberStatusField,
    publicationLabel,
    publicationTitle,
    publicationDescription,
    portalEnabledLabel,
    assignLabel,
    assignTitle,
    operatorsLabel,
    operatorsTitle,
    operatorsDescription,
    canManage,
  } = options;

  return [
    {
      key: 'publication',
      label: publicationLabel,
      icon: 'public',
      visible: (row) => canManage() && row[kindField] === 'customer',
      form: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/portal`,
          uuidField,
          pageTitle: publicationTitle,
          pageDescription: publicationDescription,
          initialValues: { enabled: row[portalField], revision: row[revisionField] },
          fields: [
            {
              key: 'enabled',
              label: portalEnabledLabel,
              type: 'select',
              span: 2,
              options: [
                { value: 0, label: 'No' },
                { value: 1, label: 'Yes' },
              ],
            },
            { key: 'revision', label: 'documents.revision', hiddenWhen: () => true },
          ],
          columns: [],
        }),
    },
    {
      key: 'assign',
      label: assignLabel,
      icon: 'person_add',
      visible: canManage,
      form: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/members`,
          uuidField,
          pageTitle: assignTitle,
          pageDescription: operatorsDescription,
          initialValues: { UserUsrUUID: '', status: 1 },
          fields: [
            {
              key: 'UserUsrUUID',
              source: 'UserUsrUUID',
              label: 'User',
              type: 'search-select',
              required: true,
              span: 1,
              remoteLookup: {
                endpoint: 'user/access/members',
                uuidField: 'UserUUID',
                labelField: 'Name',
              },
              quickCreate: false,
              quickCreateExemptReason:
                'Tenant operators must be invited through tenant access management.',
            },
            { key: 'status', label: 'Status', type: 'status', span: 1 },
          ],
          columns: [],
        }),
    },
    {
      key: 'operators',
      label: operatorsLabel,
      icon: 'group',
      visible: canManage,
      collection: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/members`,
          uuidField: memberUuidField,
          pageTitle: operatorsTitle,
          pageDescription: operatorsDescription,
          readOnly: true,
          fields: [],
          columns: [
            { id: 'user', field: 'MemberName', label: 'User', kind: 'identity' },
            { id: 'status', field: memberStatusField, label: 'Status', kind: 'status' },
          ],
        }),
    },
  ];
}
