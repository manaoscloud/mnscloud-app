import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const statusOptions = [
  { value: 'requested', label: 'Requested' },
  { value: 'pending_bank', label: 'At the bank' },
  { value: 'done', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
];

/**
 * MNSCloud Pay payouts of the tenant: history and manual request (handoff 2026-11-21, G2).
 * Payouts go only to the CPF/CNPJ Pix key or bank account of the tenant itself.
 */
@Component({
  selector: 'app-financial-pay-payouts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPayPayoutsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(
      defineCrud({
        serverSidePagination: true,
        endpoint: 'financial/gateway-accounts/mnscloud-pay/payouts',
        createEndpoint: 'financial/gateway-accounts/mnscloud-pay/payouts/request',
        uuidField: 'PtpUUID',
        pageTitle: 'MNSCloud Pay payouts',
        pageDescription:
          'Transfers of your MNSCloud Pay balance to your own CPF/CNPJ Pix key or bank account.',
        createLabel: 'Request payout',
        createTitle: 'Request payout',
        dialogDescription: 'Leave the amount empty to transfer the whole available balance.',
        savedMessage: 'Payout requested.',
        canEdit: false,
        canDelete: false,
        statusFilter: false,
        initialValues: { amount: null },
        fields: [
          {
            key: 'amount',
            label: 'Amount',
            type: 'number',
            span: 1,
            help: 'Minimum R$ 50.00. Empty transfers the whole available balance.',
          },
        ],
        payload: (v) => ({
          amount: v['amount'] === '' || v['amount'] === null ? undefined : v['amount'],
          // One key per request: a retried submit never transfers twice.
          idempotencyKey: crypto.randomUUID(),
        }),
        columns: [
          { id: 'id', label: 'ID', field: 'PtpID', kind: 'identity' },
          { id: 'date', label: 'Requested at', field: 'PtpDateCreated', kind: 'datetime' },
          { id: 'amount', label: 'Amount', field: 'PtpAmount', kind: 'currency' },
          {
            id: 'status',
            label: 'Status',
            field: 'PtpStatus',
            kind: 'status',
            options: statusOptions,
          },
          { id: 'destination', label: 'Destination', field: 'PtpDestinationSummary' },
          { id: 'done', label: 'Completed at', field: 'PtpDateCompleted', kind: 'datetime' },
        ],
      }),
    );
  }
}
