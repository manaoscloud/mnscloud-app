import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const COMMERCIAL = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'canceled', label: 'Canceled' },
];
const PAYMENT = [
  { value: 'pending', label: 'Payment pending' },
  { value: 'confirmed', label: 'Paid' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'unknown', label: 'Unknown' },
];
const FISCAL = [
  { value: 'none', label: 'No fiscal document' },
  { value: 'pending', label: 'Fiscal pending' },
  { value: 'authorized', label: 'Authorized' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'contingency', label: 'Contingency' },
  { value: 'canceled', label: 'Canceled' },
];
const SYNC = [
  { value: 'accepted', label: 'Accepted' },
  { value: 'conflict', label: 'Needs review' },
];

// Sales are created at the POS only. Each state (commercial, payment, fiscal, sync) is shown on
// its own; a sale is never edited, only canceled with a reason.
const config = defineCrud({
  endpoint: 'pos/sales',
  uuidField: 'PsaUUID',
  pageTitle: 'POS sales',
  pageDescription:
    'Sales made at the point of sale with their commercial, payment, fiscal and synchronization states.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'terminalUUID',
      label: 'Terminal',
      paramKey: 'terminalUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'pos/terminals', uuidField: 'PtmUUID', labelField: 'PtmName' },
    },
  ],
  columns: [
    { id: 'id', label: 'Sale', field: 'PsaID', uuidField: 'PsaUUID', kind: 'identity' },
    { id: 'occurred', label: 'Occurred at', field: 'PsaOccurredAt', kind: 'datetime' },
    { id: 'terminal', label: 'Terminal', field: 'TerminalName' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'total', label: 'Total', field: 'PsaTotal', kind: 'currency' },
    { id: 'commercial', label: 'Sale', field: 'PsaCommercialState', options: COMMERCIAL },
    { id: 'payment', label: 'Payment', field: 'PsaPaymentState', options: PAYMENT },
    { id: 'fiscal', label: 'Fiscal', field: 'PsaFiscalState', options: FISCAL },
    { id: 'sync', label: 'Synchronization', field: 'PsaSyncState', options: SYNC },
  ],
  fields: [],
  rowActions: [
    {
      key: 'nfce',
      label: 'Issue NFC-e',
      icon: 'receipt',
      visible: (row) =>
        row['PsaCommercialState'] === 'confirmed' &&
        ['none', 'rejected'].includes(String(row['PsaFiscalState'])),
      request: {
        method: 'post',
        endpoint: (row) => `fiscal/pos-sales/${row['PsaUUID']}/nfce`,
        successMessage: 'NFC-e requested; follow it in Fiscal › Documents.',
      },
    },
    {
      key: 'cancel',
      label: 'Cancel sale',
      icon: 'block',
      visible: (row) => row['PsaCommercialState'] === 'confirmed',
      form: (row) =>
        defineCrud({
          endpoint: `pos/sales/${row['PsaUUID']}/cancel`,
          uuidField: 'PsaUUID',
          pageTitle: 'Cancel sale',
          pageDescription:
            'Returns the stock, reverses the receipts and refunds the cash of the sale.',
          createTitle: 'Cancel sale',
          savedMessage: 'Sale canceled.',
          statusFilter: false,
          initialValues: { reason: '' },
          columns: [],
          fields: [{ key: 'reason', label: 'Reason', required: true, span: 1 }],
        }),
    },
  ],
});

@Component({
  selector: 'app-pos-sales',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosSalesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
