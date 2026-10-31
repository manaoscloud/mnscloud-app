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
import { resaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';

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
  initialValues: { name: '', notes: '', RegCustomerRcuUUID: null, status: 1 },
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
      key: 'notes',
      source: 'GacDescription',
      payloadKey: 'description',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
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
        ...resaleAccountRowActions({
          module: 'ged',
          uuidField: 'GacUUID',
          revisionField: 'GacRevision',
          portalField: 'GacPortalEnabled',
          kindField: 'GacKind',
          memberUuidField: 'GamUUID',
          memberStatusField: 'GamStatus',
          publicationLabel: 'ged.publication',
          publicationTitle: 'ged.publication',
          publicationDescription: 'ged.publicationDescription',
          portalEnabledLabel: 'ged.portalEnabled',
          assignLabel: 'ged.assignOperator',
          assignTitle: 'ged.assignOperator',
          operatorsLabel: 'ged.operators',
          operatorsTitle: 'ged.operators',
          operatorsDescription: 'ged.operatorsDescription',
          canManage,
        }),
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
