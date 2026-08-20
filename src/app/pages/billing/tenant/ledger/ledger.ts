import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingLedgerEntry } from '../../shared/billing.service';

const LEDGER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'billing/ledger',
  uuidField: 'BleUUID',
  pageTitle: 'Billing ledger',
  pageDescription: 'Review wallet movements and billing references.',
  createTitle: 'New ledger entry',
  editTitle: 'Edit ledger entry',
  dialogDescription: 'Maintain ledger entry.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No ledger entries found.',
  deleteTitle: 'Delete ledger entry',
  deleteMessage: 'Delete this ledger entry?',
  deleteSelectedTitle: 'Delete selected ledger entries',
  deleteSelectedMessage: 'Delete {count} selected ledger entries?',
  savedMessage: 'Ledger entry saved successfully.',
  deletedMessage: 'Ledger entry deleted successfully.',
  deleteFailedMessage: 'Failed to delete ledger entry.',
  statusFilter: false,
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  initialValues: {},
  columns: [
    {
      id: 'type',
      label: 'Type',
      kind: 'identity',
      field: 'BleType',
      uuidField: 'BleUUID',
      translateValue: true,
    },
    { id: 'direction', label: 'Direction', field: 'BleDirection', translateValue: true },
    {
      id: 'amount',
      label: 'Amount',
      kind: 'currency',
      field: 'BleAmount',
      currencyField: 'BleCurrency',
    },
    {
      id: 'before',
      label: 'Balance before',
      kind: 'currency',
      field: 'BleBalanceBefore',
      currencyField: 'BleCurrency',
    },
    {
      id: 'after',
      label: 'Balance after',
      kind: 'currency',
      field: 'BleBalanceAfter',
      currencyField: 'BleCurrency',
    },
    { id: 'reference', label: 'Reference', field: 'BleReference' },
    { id: 'createdAt', label: 'Created at', kind: 'datetime', field: 'BleDateCreated' },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-tenant-ledger',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
})
export class BillingTenantLedgerPage extends ConfigurableCrudPageBase<
  BillingLedgerEntry & ConfigurableCrudRecord
> {
  constructor() {
    super(LEDGER_CONFIG);
  }
}
