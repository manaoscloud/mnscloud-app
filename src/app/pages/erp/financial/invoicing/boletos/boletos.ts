import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../../shared/crud/configurable-crud/quick-create';

const statuses = [
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Canceled' },
];
// Financial records use individual deletion only; bank-backed records remain protected by DB/API.
const config = defineCrud({
  serverSidePagination: true,
  canEditRow: (row) => !row['GatewayChargeId'] && !row['GatewayAccountUUID'],
  canDeleteRow: (row) => !row['GatewayChargeId'] && !row['GatewayAccountUUID'],
  endpoint: 'erp/financial/invoicing/boletos',
  uuidField: 'ErpFinInvBoletoUUID',
  pageTitle: 'Boletos',
  bulkDelete: false,
  statusMode: 'string',
  activeValue: 'open',
  inactiveValue: 'canceled',
  statusOptions: statuses,
  initialValues: {
    title: '',
    amount: 0,
    status: 'open',
    dueDate: null,
    notes: '',
    issueAtGateway: true,
    customerUUID: '',
    gatewayAccountUUID: '',
  },
  columns: [
    { id: 'title', label: 'Title', field: 'Title', kind: 'identity' },
    { id: 'date', label: 'Due date', field: 'DueDate', kind: 'date' },
    { id: 'amount', label: 'Amount', field: 'Amount', kind: 'currency' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'status',
      span: 1,
      options: statuses,
    },
    { key: 'title', source: 'Title', label: 'Title', required: true, span: 1 },
    {
      key: 'customerUUID',
      remoteLookup: {
        endpoint: 'erp/customers?status=1',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
      },
      source: 'CustomerUUID',
      label: 'Customer',
      type: 'search-select',
      quickCreate: quickCreateFor('CustomerCusUUID'),
      span: 1,
    },
    { key: 'amount', source: 'Amount', label: 'Amount', type: 'currency', required: true, span: 1 },
    { key: 'dueDate', source: 'DueDate', label: 'Due date', type: 'date', required: true, span: 1 },
    {
      key: 'issueAtGateway',
      label: 'Issue at bank',
      type: 'select',
      span: 1,
      options: [
        { value: true, label: 'Yes' },
        { value: false, label: 'No' },
      ],
      hiddenWhen: ({ editing }) => editing,
    },
    {
      key: 'gatewayAccountUUID',
      remoteLookup: {
        endpoint: 'erp/financial/payment/gateways?status=1',
        uuidField: 'EfgUUID',
        labelField: 'EfgName',
      },
      source: 'GatewayAccountUUID',
      label: 'Payment provider',
      type: 'search-select',
      quickCreate: quickCreateFor('ErpFinPayGatewayAccountEfgUUID'),
      span: 1,
      hiddenWhen: ({ editing, values }) => editing || !values['issueAtGateway'],
    },
    { key: 'notes', source: 'Notes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
  ],
  rowActions: [
    {
      key: 'sync',
      label: 'Synchronize payment',
      icon: 'sync',
      visible: (r) => Boolean(r['GatewayChargeId']),
    },
  ],
  payload: (v, editing) =>
    editing
      ? {
          title: v['title'],
          customerUUID: v['customerUUID'],
          amount: v['amount'],
          status: v['status'],
          dueDate: v['dueDate'],
          notes: v['notes'],
        }
      : {
          ...v,
          gatewayAccountUUID: v['issueAtGateway'] ? v['gatewayAccountUUID'] : null,
          gatewayPayload: null,
        },
});

@Component({
  selector: 'app-boletos',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InvoicingBoletosPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'sync') return;
    try {
      await this.api.post(`${this.config.endpoint}/${this.recordUUID(row)}/sync`, {});
      this.snack.success(this.t('Payment synchronized.'));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
  override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (!Number.isFinite(Number(payload['amount'])) || Number(payload['amount']) <= 0) {
      this.snack.warning(this.t('Amount must be greater than zero.'));
      return false;
    }
    return true;
  }
}
