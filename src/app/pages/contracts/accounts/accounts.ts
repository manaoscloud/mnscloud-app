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

export const CONTRACT_ACCOUNTS_CONFIG = resaleAccountCrud({
  endpoint: 'contracts/accounts', prefix: 'Cta', i18n: 'contracts',
  pageTitle: 'contracts.accounts', pageDescription: 'contracts.accountsDescription',
  createTitle: 'contracts.newAccount', editTitle: 'contracts.editAccount',
  extraColumns: [
    { id: 'documents', field: 'DocumentsCount', label: 'contracts.documentsCount' },
    { id: 'templates', field: 'TemplatesCount', label: 'contracts.templatesCount' },
    { id: 'clauses', field: 'ClausesCount', label: 'contracts.clausesCount' },
  ],
});

@Component({
  selector: 'app-contract-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ContractAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.contracts.accounts.all');
    super({
      ...CONTRACT_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        ...resaleAccountRowActions({
          module: 'contracts',
          uuidField: 'CtaUUID',
          revisionField: 'CtaRevision',
          portalField: 'CtaPortalEnabled',
          kindField: 'CtaKind',
          memberUuidField: 'CtmUUID',
          memberStatusField: 'CtmStatus',
          publicationLabel: 'contracts.publication',
          publicationTitle: 'contracts.publication',
          publicationDescription: 'contracts.publicationDescription',
          portalEnabledLabel: 'contracts.portalEnabled',
          assignLabel: 'contracts.assignOperator',
          assignTitle: 'contracts.assignOperator',
          operatorsLabel: 'contracts.operators',
          operatorsTitle: 'contracts.operators',
          operatorsDescription: 'contracts.operatorsDescription',
          canManage,
        }),
      ],
    });
  }
}
