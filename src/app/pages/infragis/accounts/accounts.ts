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

const RESALE_ACCOUNTS = resaleAccountCrud({
  endpoint: 'infragis/accounts',
  prefix: 'Igc',
  pageTitle: 'infragis.accounts',
  pageDescription: 'infragis.accountsDescription',
  createTitle: 'infragis.newAccount',
  editTitle: 'infragis.editAccount',
  i18n: 'infragis',
  extraColumns: [
    { id: 'projects', field: 'ProjectsCount', label: 'Projects', kind: 'number' },
    { id: 'assets', field: 'AssetsCount', label: 'Assets', kind: 'number' },
    { id: 'maxAssets', field: 'IgcMaxAssets', label: 'infragis.maxAssets', kind: 'number' },
  ],
});

// InfraGIS adds the asset limit of the account; the API has no bulk delete for accounts.
export const INFRAGIS_ACCOUNTS_CONFIG = {
  ...RESALE_ACCOUNTS,
  bulkDelete: false,
  initialValues: { ...RESALE_ACCOUNTS.initialValues, maxAssets: null },
  fields: RESALE_ACCOUNTS.fields.flatMap((field) =>
    field.key === 'name'
      ? [
          field,
          {
            key: 'maxAssets',
            source: 'IgcMaxAssets',
            label: 'infragis.maxAssets',
            type: 'number' as const,
            span: 1 as const,
            help: 'infragis.maxAssetsHelp',
          },
        ]
      : [field],
  ),
};

@Component({
  selector: 'app-infragis-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InfraGisAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.infragis.accounts.all');
    super({
      ...INFRAGIS_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'dashboard',
          label: 'infragis.accountDashboard',
          icon: 'space_dashboard',
          run: (row) =>
            void router.navigate(['/infragis'], {
              queryParams: { accountUUID: row['IgcUUID'] },
            }),
        },
        {
          key: 'map',
          label: 'infragis.accountMap',
          icon: 'travel_explore',
          run: (row) =>
            void router.navigate(['/infragis/map'], {
              queryParams: { accountUUID: row['IgcUUID'] },
            }),
        },
        ...resaleAccountRowActions({
          module: 'infragis',
          uuidField: 'IgcUUID',
          revisionField: 'IgcRevision',
          portalField: 'IgcPortalEnabled',
          kindField: 'IgcKind',
          memberUuidField: 'IgbUUID',
          memberStatusField: 'IgbStatus',
          publicationLabel: 'infragis.publication',
          publicationTitle: 'infragis.publication',
          publicationDescription: 'infragis.publicationDescription',
          portalEnabledLabel: 'infragis.portalEnabled',
          assignLabel: 'infragis.assignOperator',
          assignTitle: 'infragis.assignOperator',
          operatorsLabel: 'infragis.operators',
          operatorsTitle: 'infragis.operators',
          operatorsDescription: 'infragis.operatorsDescription',
          canManage,
        }),
      ],
    });
  }
}
