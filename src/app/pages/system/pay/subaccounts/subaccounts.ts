import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const kycOptions = [
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting approval' },
  { value: 'REJECTED', label: 'Rejected' },
];

/** Master view of every tenant MNSCloud Pay subaccount (handoff 2026-11-21, G2). */
@Component({
  selector: 'app-system-pay-subaccounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPaySubaccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(
      defineCrud({
        serverSidePagination: true,
        endpoint: 'system/pay/subaccounts',
        uuidField: 'PtsUUID',
        pageTitle: 'MNSCloud Pay subaccounts',
        pageDescription:
          'Every tenant subaccount with verification, ledger balance and the last 30 days of payments, fees and payouts.',
        readOnly: true,
        statusFilter: false,
        initialValues: {},
        fields: [],
        columns: [
          { id: 'tenant', label: 'Tenant', field: 'TenantName', kind: 'identity' },
          { id: 'email', label: 'E-mail', field: 'TenantEmail' },
          {
            id: 'kyc',
            label: 'Verification',
            field: 'KycGeneralStatus',
            kind: 'status',
            options: kycOptions,
          },
          { id: 'balance', label: 'Balance', field: 'BalanceAmount', kind: 'currency' },
          { id: 'received', label: 'Received (30 days)', field: 'Received30d', kind: 'currency' },
          { id: 'fees', label: 'Fees (30 days)', field: 'Fees30d', kind: 'currency' },
          { id: 'payouts', label: 'Payouts (30 days)', field: 'Payouts30d', kind: 'currency' },
          { id: 'environment', label: 'Environment', field: 'Environment' },
          { id: 'created', label: 'Created at', field: 'DateCreated', kind: 'datetime' },
        ],
      }),
    );
  }
}
