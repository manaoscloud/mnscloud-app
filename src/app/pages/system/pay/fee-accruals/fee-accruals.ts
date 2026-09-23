import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

// Financial accruals are immutable here; the only mutation is authorized settlement.
const config = defineCrud({
  serverSidePagination: true,
  endpoint: 'system/pay/fee-accruals',
  uuidField: 'PacUUID',
  pageTitle: 'Pay — Postpaid Accruals',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusMode: 'string',
  activeValue: 'open',
  inactiveValue: 'settled',
  statusOptions: [
    { value: 'open', label: 'Open' },
    { value: 'settled', label: 'Settled' },
  ],
  fields: [],
  columns: [
    { id: 'tenant', label: 'Tenant', field: 'TenantEmail', kind: 'identity' },
    {
      id: 'amount',
      label: 'Amount',
      field: 'PacAmount',
      kind: 'currency',
      currencyField: 'PacCurrency',
    },
    {
      id: 'transaction',
      label: 'Transaction type',
      field: 'PacTransactionType',
      options: [
        { value: 'boleto', label: 'Boleto' },
        { value: 'pix', label: 'Pix' },
      ],
    },
    { id: 'status', label: 'Status', field: 'PacStatus', kind: 'status' },
    { id: 'reference', label: 'Settlement reference', field: 'PacSettlementReference' },
    { id: 'settled', label: 'Settled at', field: 'PacDateSettled', kind: 'datetime' },
    { id: 'created', label: 'Created', field: 'PacDateCreated', kind: 'datetime' },
  ],
  rowActions: [
    {
      key: 'settle',
      label: 'Settle',
      icon: 'done_all',
      visible: (r) => r['PacStatus'] === 'open',
      form: (r) =>
        defineCrud({
          endpoint: `system/pay/fee-accruals/${r['PacUUID']}/settle`,
          uuidField: 'PacUUID',
          pageTitle: 'Settle fee accrual',
          createTitle: 'Settle fee accrual',
          dialogDescription: 'Record the external settlement reference.',
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          columns: [],
          fields: [{ key: 'reference', label: 'Settlement reference', span: 1 }],
          initialValues: { reference: '' },
          savedMessage: 'Fee accrual marked settled.',
        }),
    },
  ],
});

@Component({
  selector: 'app-fee-accruals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPayFeeAccrualsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
