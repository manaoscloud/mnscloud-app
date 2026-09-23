import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudOption,
  ConfigurableCrudConfig,
  ConfigurableCrudRowAction,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';

const statuses = [
  { value: 'open', label: 'Open' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Canceled' },
];
// Financial records use individual deletion only; bank-backed records remain protected by DB/API.
const config = defineCrud({
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
      source: 'CustomerUUID',
      label: 'Customer',
      type: 'search-select',
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
      source: 'GatewayAccountUUID',
      label: 'Payment provider',
      type: 'search-select',
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

  private readonly lookupApi = inject(ApiService);
  private readonly customers = resource({
    defaultValue: [] as ConfigurableCrudRecord[],
    loader: async () =>
      (await this.lookupApi.get<any>('erp/customers?status=1&limit=5000'))?.data?.items ?? [],
  });
  private readonly gateways = resource({
    defaultValue: [] as ConfigurableCrudRecord[],
    loader: async () =>
      (await this.lookupApi.get<any>('erp/financial/payment/gateways?limit=5000'))?.data?.items ??
      [],
  });
  override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID')
      return this.customers
        .value()
        .map((r: ConfigurableCrudRecord) => ({
          value: String(r['CustomerUUID']),
          label: String(r['Name']),
        }));
    if (key === 'gatewayAccountUUID')
      return this.gateways
        .value()
        .map((r: ConfigurableCrudRecord) => ({
          value: String(r['EfgUUID']),
          label: String(r['EfgName']),
        }));
    return super.lookupOptions(key);
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
