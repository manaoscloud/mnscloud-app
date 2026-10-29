import { defineCrud } from './define-crud';
import type { ConfigurableCrudRowAction } from './configurable-crud-page-base';

export interface ResaleAccountActionOptions {
  module: string;
  uuidField: string;
  revisionField: string;
  portalField: string;
  kindField: string;
  memberUuidField: string;
  memberStatusField: string;
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
    canManage,
  } = options;

  return [
    {
      key: 'publication',
      label: `${module}.publication`,
      icon: 'public',
      visible: (row) => canManage() && row[kindField] === 'customer',
      form: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/portal`,
          uuidField,
          pageTitle: `${module}.publication`,
          pageDescription: `${module}.publicationDescription`,
          initialValues: { enabled: row[portalField], revision: row[revisionField] },
          fields: [
            {
              key: 'enabled',
              label: `${module}.portalEnabled`,
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
      label: `${module}.assignOperator`,
      icon: 'person_add',
      visible: canManage,
      form: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/members`,
          uuidField,
          pageTitle: `${module}.assignOperator`,
          pageDescription: `${module}.operatorsDescription`,
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
      label: `${module}.operators`,
      icon: 'group',
      visible: canManage,
      collection: (row) =>
        defineCrud({
          endpoint: `${module}/accounts/${row[uuidField]}/members`,
          uuidField: memberUuidField,
          pageTitle: `${module}.operators`,
          pageDescription: `${module}.operatorsDescription`,
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
