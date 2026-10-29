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

export const DNS_ACCOUNTS_CONFIG = defineCrud({
  endpoint: 'dns/accounts',
  uuidField: 'DacUUID',
  pageTitle: 'dns.accounts',
  pageDescription: 'dns.accountsDescription',
  createTitle: 'dns.newAccount',
  editTitle: 'dns.editAccount',
  serverSidePagination: true,
  bulkDelete: true,
  ...revisionDeletePayloads('DacUUID', 'DacRevision'),
  initialValues: { name: '', description: '', customerUUID: null, status: 1 },
  fields: [
    { key: 'status', source: 'DacStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'DacName', label: 'Name', required: true, span: 1 },
    {
      key: 'customerUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      help: 'dns.accountCustomerHelp',
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
      source: 'DacDescription',
      label: 'Description',
      type: 'textarea',
      span: 1,
    },
    { key: 'revision', source: 'DacRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'DacName', label: 'Name', kind: 'identity' },
    { id: 'publication', field: 'DacPortalEnabled', label: 'dns.portalEnabled', kind: 'status' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'sites', field: 'SitesCount', label: 'dns.cloudSites' },
    { id: 'status', field: 'DacStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-dns-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.dns.accounts.all');
    super({
      ...DNS_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'publication',
          label: 'dns.publication',
          icon: 'public',
          visible: (row) => canManage() && row['DacKind'] === 'customer',
          form: (row) =>
            defineCrud({
              endpoint: `dns/accounts/${row['DacUUID']}/portal`,
              uuidField: 'DacUUID',
              pageTitle: 'dns.publication',
              pageDescription: 'dns.publicationDescription',
              initialValues: { enabled: row['DacPortalEnabled'], revision: row['DacRevision'] },
              fields: [
                {
                  key: 'enabled',
                  label: 'dns.portalEnabled',
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
          label: 'dns.assignOperator',
          icon: 'person_add',
          visible: canManage,
          form: (row) =>
            defineCrud({
              endpoint: `dns/accounts/${row['DacUUID']}/members`,
              uuidField: 'DacUUID',
              pageTitle: 'dns.assignOperator',
              pageDescription: 'dns.operatorsDescription',
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
          label: 'dns.operators',
          icon: 'group',
          visible: canManage,
          collection: (row) =>
            defineCrud({
              endpoint: `dns/accounts/${row['DacUUID']}/members`,
              uuidField: 'DamUUID',
              pageTitle: 'dns.operators',
              pageDescription: 'dns.operatorsDescription',
              readOnly: true,
              fields: [],
              columns: [
                { id: 'user', field: 'MemberName', label: 'User', kind: 'identity' },
                { id: 'status', field: 'DamStatus', label: 'Status', kind: 'status' },
              ],
            }),
        },
      ],
    });
  }
}
