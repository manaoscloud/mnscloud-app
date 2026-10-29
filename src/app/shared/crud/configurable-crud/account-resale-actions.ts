import { defineCrud } from './define-crud';
import type {
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
