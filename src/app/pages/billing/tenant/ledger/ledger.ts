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
    { id: 'type', label: 'Type', kind: 'identity', field: 'BleType', uuidField: 'BleUUID' },
    { id: 'direction', label: 'Direction', field: 'BleDirection' },
    { id: 'amount', label: 'Amount', field: 'BleAmount' },
    { id: 'currency', label: 'Currency', field: 'BleCurrency' },
    { id: 'before', label: 'Balance before', field: 'BleBalanceBefore' },
    { id: 'after', label: 'Balance after', field: 'BleBalanceAfter' },
    { id: 'reference', label: 'Reference', field: 'BleReference' },
    { id: 'createdAt', label: 'Created at', field: 'BleDateCreated' },
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
