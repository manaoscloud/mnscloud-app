import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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
import { portalAccessConfig, unblockRequestsConfig } from './account-portal';

export const CYBER_SECURITY_ACCOUNTS_CONFIG = resaleAccountCrud({
  endpoint: 'cyber-security/accounts',
  prefix: 'Cya',
  pageTitle: 'cyberSecurity.accounts',
  pageDescription: 'cyberSecurity.accountsDescription',
  createTitle: 'cyberSecurity.newAccount',
  editTitle: 'cyberSecurity.editAccount',
  i18n: 'cyberSecurity',
  extraColumns: [
    { id: 'servers', field: 'ServersCount', label: 'cyberSecurity.protectedServers' },
    { id: 'vaults', field: 'SecretVaultsCount', label: 'cyberSecurity.secretVaults' },
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
    const router = inject(Router);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.cyber-security.accounts.all');
    const isCustomer = (row: ConfigurableCrudRecord) => row['CyaKind'] === 'customer';
    super({
      ...CYBER_SECURITY_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'dashboard',
          label: 'cyberSecurity.accountDashboard',
          icon: 'space_dashboard',
          run: (row) =>
            void router.navigate(['/cyber-security/dashboard'], {
              queryParams: { cyberAccountUUID: row['CyaUUID'] },
            }),
        },
        ...resaleAccountRowActions({
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
        {
          key: 'portalAccess',
          label: 'cyberSecurity.portalAccess',
          icon: 'badge',
          visible: (row) => canManage() && isCustomer(row),
          collection: (row) => portalAccessConfig(row),
        },
        {
          key: 'unblockRequests',
          label: 'cyberSecurity.unblockRequests',
          icon: 'lock_open',
          visible: isCustomer,
          collection: unblockRequestsConfig(),
        },
      ],
    });
  }
}
