import { Component, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { resaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';

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
      rowActions: resaleAccountRowActions({
        module: 'dns',
        uuidField: 'DacUUID',
        revisionField: 'DacRevision',
        portalField: 'DacPortalEnabled',
        kindField: 'DacKind',
        memberUuidField: 'DamUUID',
        memberStatusField: 'DamStatus',
        publicationLabel: 'dns.publication',
        publicationTitle: 'dns.publication',
        publicationDescription: 'dns.publicationDescription',
        portalEnabledLabel: 'dns.portalEnabled',
        assignLabel: 'dns.assignOperator',
        assignTitle: 'dns.assignOperator',
        operatorsLabel: 'dns.operators',
        operatorsTitle: 'dns.operators',
        operatorsDescription: 'dns.operatorsDescription',
        canManage,
      }),
    });
  }
}
