import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { CHARGE_STATUSES, ITEM_NATURES } from './billing-options';

const config = defineCrud({
  endpoint: 'customer-billing/charges',
  uuidField: 'BchUUID',
  pageTitle: 'Billing charges',
  pageDescription:
    'One charge per contract cycle with its receivable; paying the receivable marks it paid and reactivates a contract suspended for overdue.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: CHARGE_STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'id', label: 'Charge', field: 'BchID', uuidField: 'BchUUID', kind: 'identity' },
    { id: 'contract', label: 'Contract', field: 'ContractID' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'start', label: 'Period start', field: 'BchPeriodStart', kind: 'date' },
    { id: 'end', label: 'Period end', field: 'BchPeriodEnd', kind: 'date', optional: true },
    { id: 'due', label: 'Due date', field: 'BchDueDate', kind: 'date' },
    { id: 'total', label: 'Total', field: 'BchTotal', kind: 'currency' },
    { id: 'status', label: 'Status', field: 'BchStatus', options: CHARGE_STATUSES },
  ],
  fields: [],
  rowActions: [
    {
      key: 'lines',
      label: 'Lines',
      icon: 'list',
      collection: (row) =>
        defineCrud({
          endpoint: `customer-billing/charges/${row['BchUUID']}/lines`,
          uuidField: 'lineUUID',
          pageTitle: 'Charge lines',
          pageDescription: 'Recurring, one-off, usage and adjustment lines of the charge.',
          readOnly: true,
          statusFilter: false,
          columns: [
            { id: 'description', label: 'Description', field: 'description' },
            { id: 'module', label: 'Source module', field: 'module' },
            { id: 'nature', label: 'Nature', field: 'nature', options: ITEM_NATURES },
            { id: 'quantity', label: 'Quantity', field: 'quantity', kind: 'number' },
            { id: 'amount', label: 'Amount', field: 'amount', kind: 'currency' },
          ],
          fields: [],
        }),
    },
    {
      key: 'fiscal',
      label: 'Issue fiscal documents',
      icon: 'receipt_long',
      visible: (row) => ['issued', 'partial', 'overdue', 'paid'].includes(String(row['BchStatus'])),
      request: {
        method: 'post',
        endpoint: (row) => `customer-billing/charges/${row['BchUUID']}/fiscal`,
        successMessage: 'Fiscal documents requested; follow them in Fiscal › Documents.',
        confirm: {
          title: 'Issue fiscal documents',
          message:
            'Issue one fiscal document per model of the lines (NF-e for goods, NFCom for communication, NFS-e for services)? Running it again returns the same documents.',
          confirmLabel: 'Issue',
        },
      },
    },
  ],
});

@Component({
  selector: 'app-customer-billing-charges',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingChargesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
