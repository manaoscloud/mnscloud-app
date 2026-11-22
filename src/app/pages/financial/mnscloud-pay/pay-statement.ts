import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const accountOptions = [
  { value: 'subaccount_balance', label: 'Subaccount balance' },
  { value: 'customer_receipts', label: 'Received from customers' },
  { value: 'fees', label: 'MNSCloud Pay fees' },
  { value: 'payout_in_transit', label: 'Payouts in transit' },
  { value: 'tenant_bank', label: 'Paid out to your bank' },
];
const sourceOptions = [
  { value: 'charge_paid', label: 'Payment received' },
  { value: 'charge_reversed', label: 'Refund' },
  { value: 'payout_requested', label: 'Payout requested' },
  { value: 'payout_done', label: 'Payout completed' },
  { value: 'payout_returned', label: 'Payout returned' },
];
const directionOptions = [
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
];

/** MNSCloud Pay statement: immutable ledger entries of the tenant (handoff 2026-11-21, G2). */
@Component({
  selector: 'app-financial-pay-statement',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPayStatementPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(
      defineCrud({
        serverSidePagination: true,
        endpoint: 'financial/gateway-accounts/mnscloud-pay/ledger',
        uuidField: 'PleUUID',
        pageTitle: 'MNSCloud Pay statement',
        pageDescription:
          'Every payment received, MNSCloud Pay fee, refund and payout of your account, as immutable double-entry records.',
        readOnly: true,
        statusFilter: false,
        initialValues: {},
        fields: [],
        columns: [
          { id: 'date', label: 'Date', field: 'DateCreated', kind: 'datetime' },
          { id: 'title', label: 'Description', field: 'SourceTitle', kind: 'identity' },
          { id: 'source', label: 'Event', field: 'SourceType', options: sourceOptions },
          { id: 'account', label: 'Account', field: 'Account', options: accountOptions },
          { id: 'direction', label: 'Entry', field: 'Direction', options: directionOptions },
          { id: 'amount', label: 'Amount', field: 'Amount', kind: 'currency' },
        ],
      }),
    );
  }
}
