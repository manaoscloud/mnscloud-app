import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { Component, inject } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const GED_ACCOUNTS_CONFIG = defineCrud({
  endpoint: 'ged/accounts',
  uuidField: 'GacUUID',
  pageTitle: 'ged.accounts',
  pageDescription: 'ged.accountsDescription',
  createTitle: 'ged.newAccount',
  editTitle: 'ged.editAccount',
  serverSidePagination: true,
  bulkDelete: true,
  ...revisionDeletePayloads('GacUUID', 'GacRevision'),
  initialValues: { name: '', description: '', RegCustomerRcuUUID: null, status: 1 },
  fields: [
    { key: 'status', source: 'GacStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'GacName', label: 'Name', required: true, span: 1 },
    {
      key: 'RegCustomerRcuUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      help: 'ged.accountCustomerHelp',
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
      source: 'GacDescription',
      label: 'Description',
      type: 'textarea',
      span: 1,
    },
    { key: 'revision', source: 'GacRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'GacName', label: 'Name', kind: 'identity' },
    { id: 'publication', field: 'GacPortalEnabled', label: 'ged.portalEnabled', kind: 'status' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'status', field: 'GacStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class GedAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.ged.accounts.all');
    super({
      ...GED_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'publication',
          label: 'ged.publication',
          icon: 'public',
          visible: (row) => canManage() && row['GacKind'] === 'customer',
          form: (row) =>
            defineCrud({
              endpoint: `ged/accounts/${row['GacUUID']}/portal`,
              uuidField: 'GacUUID',
              pageTitle: 'ged.publication',
              pageDescription: 'ged.publicationDescription',
              initialValues: { enabled: row['GacPortalEnabled'], revision: row['GacRevision'] },
              fields: [
                {
                  key: 'enabled',
                  label: 'ged.portalEnabled',
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
          label: 'ged.assignOperator',
          icon: 'person_add',
          visible: canManage,
          form: (row) =>
            defineCrud({
              endpoint: `ged/accounts/${row['GacUUID']}/members`,
              uuidField: 'GacUUID',
              pageTitle: 'ged.assignOperator',
              pageDescription: 'ged.operatorsDescription',
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
          label: 'ged.operators',
          icon: 'group',
          visible: canManage,
          collection: (row) =>
            defineCrud({
              endpoint: `ged/accounts/${row['GacUUID']}/members`,
              uuidField: 'GamUUID',
              pageTitle: 'ged.operators',
              pageDescription: 'ged.operatorsDescription',
              readOnly: true,
              fields: [],
              columns: [
                { id: 'user', field: 'MemberName', label: 'User', kind: 'identity' },
                { id: 'status', field: 'GamStatus', label: 'Status', kind: 'status' },
              ],
            }),
        },
        {
          key: 'usage',
          label: 'ged.usage',
          icon: 'data_usage',
          collection: (row) =>
            defineCrud({
              endpoint: `ged/accounts/${row['GacUUID']}/usage`,
              uuidField: 'GacUUID',
              pageTitle: 'ged.usage',
              pageDescription: 'ged.usageDescription',
              readOnly: true,
              fields: [],
              columns: [
                { id: 'dossiers', field: 'Dossiers', label: 'ged.dossiers' },
                { id: 'documents', field: 'Documents', label: 'documents.title' },
                { id: 'versions', field: 'ReadyVersions', label: 'documents.versions' },
                { id: 'bytes', field: 'ReadyVersionBytes', label: 'ged.readyBytes' },
                { id: 'ai', field: 'AiCalls', label: 'ged.aiCalls' },
              ],
            }),
        },
      ],
    });
  }
}
