import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingTenantLookupItem } from '../../shared/billing.service';
import { BILLING_STATUS_OPTIONS } from '../../shared/billing-crud';

const WALLETS_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/tenants',
  uuidField: 'EnvironmentUUID',
  pageTitle: 'Billing ledger',
  pageDescription: 'Monitor tenant wallet summaries and billing ledger ownership.',
  createTitle: 'New wallet entry',
  editTitle: 'Edit wallet entry',
  dialogDescription: 'Maintain wallet entry.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No tenant wallets found.',
  deleteTitle: 'Delete wallet entry',
  deleteMessage: 'Delete this wallet entry?',
  deleteSelectedTitle: 'Delete selected wallet entries',
  deleteSelectedMessage: 'Delete {count} selected wallet entries?',
  savedMessage: 'Wallet entry saved successfully.',
  deletedMessage: 'Wallet entry deleted successfully.',
  deleteFailedMessage: 'Failed to delete wallet entry.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  ...BILLING_STATUS_OPTIONS,
  initialValues: {},
  columns: [
    {
      id: 'tenant',
      label: 'Tenant',
      kind: 'identity',
      field: 'EnvironmentName',
      uuidField: 'EnvironmentUUID',
    },
    { id: 'email', label: 'E-mail', field: 'TenantEmail' },
    { id: 'currency', label: 'Currency', field: 'DefaultCurrency' },
    { id: 'wallets', label: 'Wallets', field: 'WalletCount' },
    { id: 'summary', label: 'Wallet summary', field: 'WalletSummary' },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'TenantStatus',
      className: 'status-col',
    },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-system-wallets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingSystemWalletsPage extends ConfigurableCrudPageBase<
  BillingTenantLookupItem & ConfigurableCrudRecord
> {
  constructor() {
    super(WALLETS_CONFIG);
  }
}
