import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudOption,
  ConfigurableCrudConfig,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

// Financial accruals are immutable here; the only mutation is authorized settlement.
const config = defineCrud({
  endpoint: 'system/pay/fee-accruals',
  uuidField: 'BfaUUID',
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
      field: 'BfaAmount',
      kind: 'currency',
      currencyField: 'BfaCurrency',
    },
    { id: 'transaction', label: 'Transaction type', field: 'BfaTransactionType' },
    { id: 'status', label: 'Status', field: 'BfaStatus', kind: 'status' },
    { id: 'created', label: 'Created', field: 'BfaDateCreated', kind: 'datetime' },
  ],
  rowActions: [
    {
      key: 'settle',
      label: 'Settle',
      icon: 'done_all',
      visible: (r) => r['BfaStatus'] === 'open',
      form: (r) =>
        defineCrud({
          endpoint: `system/pay/fee-accruals/${r['BfaUUID']}/settle`,
          uuidField: 'BfaUUID',
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
