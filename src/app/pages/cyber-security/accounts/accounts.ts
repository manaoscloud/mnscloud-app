import { Component, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  resaleAccountCrud,
  resaleAccountRowActions,
} from '../../../shared/crud/configurable-crud/account-resale-actions';

export const CYBER_SECURITY_ACCOUNTS_CONFIG = resaleAccountCrud({
  endpoint: 'cyber-security/accounts',
  prefix: 'Cya',
  pageTitle: 'cyberSecurity.accounts',
  pageDescription: 'cyberSecurity.accountsDescription',
  createTitle: 'cyberSecurity.newAccount',
  editTitle: 'cyberSecurity.editAccount',
  i18n: 'cyberSecurity',
  extraColumns: [{ id: 'vaults', field: 'SecretVaultsCount', label: 'cyberSecurity.secretVaults' }],
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
