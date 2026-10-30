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
import {
  resaleAccountFields,
  resaleAccountRowActions,
} from '../../../shared/crud/configurable-crud/account-resale-actions';

export const CYBER_SECURITY_ACCOUNTS_CONFIG = defineCrud({
  endpoint: 'cyber-security/accounts',
  uuidField: 'CyaUUID',
  pageTitle: 'cyberSecurity.accounts',
  pageDescription: 'cyberSecurity.accountsDescription',
  createTitle: 'cyberSecurity.newAccount',
  editTitle: 'cyberSecurity.editAccount',
  serverSidePagination: true,
  bulkDelete: true,
  ...revisionDeletePayloads('CyaUUID', 'CyaRevision'),
  initialValues: { name: '', description: '', customerUUID: null, status: 1 },
  fields: resaleAccountFields({
    helpKey: 'cyberSecurity.accountCustomerHelp',
    statusField: 'CyaStatus',
    nameField: 'CyaName',
    descField: 'CyaDescription',
    revField: 'CyaRevision',
  }),
  columns: [
    { id: 'name', field: 'CyaName', label: 'Name', kind: 'identity' },
    {
      id: 'publication',
      field: 'CyaPortalEnabled',
      label: 'cyberSecurity.portalEnabled',
      kind: 'status',
    },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'status', field: 'CyaStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-cyber-security-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.cyber-security.accounts.all');
    super({
      ...CYBER_SECURITY_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: resaleAccountRowActions({
        module: 'cyber-security',
        uuidField: 'CyaUUID',
        revisionField: 'CyaRevision',
        portalField: 'CyaPortalEnabled',
        kindField: 'CyaKind',
        memberUuidField: 'CymUUID',
        memberStatusField: 'CymStatus',
        publicationLabel: 'cyberSecurity.publication',
        publicationTitle: 'cyberSecurity.publication',
        publicationDescription: 'cyberSecurity.publicationDescription',
        portalEnabledLabel: 'cyberSecurity.portalEnabled',
        assignLabel: 'cyberSecurity.assignOperator',
        assignTitle: 'cyberSecurity.assignOperator',
        operatorsLabel: 'cyberSecurity.operators',
        operatorsTitle: 'cyberSecurity.operators',
        operatorsDescription: 'cyberSecurity.operatorsDescription',
        canManage,
      }),
    });
  }
}
