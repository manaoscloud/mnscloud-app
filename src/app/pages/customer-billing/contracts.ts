import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import { COMPANY_LOOKUP } from '../fiscal/fiscal-options';
import {
  ADJUSTMENT_STATUSES,
  BILLING_CYCLES,
  CONTRACT_STATUSES,
  ITEM_KINDS,
  CYBER_SECURITY_METRICS,
  ITEM_NATURES,
  MODULE_LOOKUP,
} from './billing-options';

const today = () => new Date().toISOString().slice(0, 10);
const optionLabel = (options: readonly { value: string; label: string }[], value: unknown) =>
  options.find((option) => option.value === value)?.label ?? String(value ?? '');

const statusAction = (key: string, label: string, icon: string, to: string, from: string[]) => ({
  key,
  label,
  icon,
  visible: (row: ConfigurableCrudRecord) => from.includes(String(row['BctStatus'])),
  request: {
    method: 'post' as const,
    endpoint: (row: ConfigurableCrudRecord) =>
      `customer-billing/contracts/${row['BctUUID']}/status`,
    body: () => ({ status: to }),
    successMessage: 'Contract status changed.',
    ...(to === 'cancelled'
      ? {
          confirm: {
            title: 'Cancel contract',
            message:
              'Cancel this contract? It stops billing and the modules of its items are told to cancel their resources. A cancelled contract cannot reopen.',
            confirmLabel: 'Cancel contract',
          },
        }
      : {}),
  },
});

const config = defineCrud({
  endpoint: 'customer-billing/contracts',
  uuidField: 'BctUUID',
  pageTitle: 'Billing contracts',
  pageDescription:
    'Recurring billing of your customers for any module (ISP, hosting, VoIP, sales or manual items): cycle, items, usage and adjustments become one charge per cycle with its receivable.',
  createTitle: 'New billing contract',
  editTitle: 'Edit billing contract',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  canDeleteRow: (row) => row['BctStatus'] === 'draft',
  listFilters: [
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: CONTRACT_STATUSES,
      emptyLabel: 'All',
    },
  ],
  initialValues: {
    customerUUID: '',
    companyUUID: '',
    cycle: 'monthly',
    startDate: today(),
    endDate: '',
    dueDayUUID: '',
    paymentTermsDays: 10,
    graceDays: 5,
    notes: '',
    revision: null,
  },
  columns: [
    { id: 'id', label: 'Contract', field: 'BctID', uuidField: 'BctUUID', kind: 'identity' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'company', label: 'Company', field: 'CompanyName', optional: true },
    { id: 'cycle', label: 'Cycle', field: 'BctCycle', options: BILLING_CYCLES },
    { id: 'recurring', label: 'Recurring amount', field: 'RecurringAmount', kind: 'currency' },
    { id: 'next', label: 'Next cycle', field: 'BctNextCycleStart', kind: 'date' },
    { id: 'dueDay', label: 'Due-day rule', field: 'DueDayName', optional: true },
    { id: 'status', label: 'Status', field: 'BctStatus', options: CONTRACT_STATUSES },
  ],
  fields: [
    {
      key: 'customerUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'registry/customers',
        searchParam: 'q',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
      quickCreate: quickCreateFor('RegCustomerRcuUUID'),
    },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      required: true,
      remoteLookup: COMPANY_LOOKUP,
      help: 'Establishment that issues the receivables and the fiscal documents.',
    },
    {
      key: 'cycle',
      source: 'BctCycle',
      label: 'Cycle',
      type: 'select',
      options: BILLING_CYCLES,
      required: true,
      span: 1,
    },
    {
      key: 'startDate',
      source: 'BctStartDate',
      label: 'Start date',
      type: 'date',
      required: true,
      help: 'First cycle starts on this date; a billed contract keeps it.',
      span: 1,
    },
    { key: 'endDate', source: 'BctEndDate', label: 'End date', type: 'date', span: 1 },
    {
      key: 'dueDayUUID',
      source: 'BillDueDayBddUUID',
      label: 'Due-day rule',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'customer-billing/due-days?status=1',
        searchParam: 'search',
        uuidField: 'BddUUID',
        labelField: 'BddName',
        selectedLabelField: 'DueDayName',
      },
      help: 'With a rule, cycles follow the calendar month, are issued on its billing day and fall due on its fixed day; the first cycle is prorated.',
    },
    {
      key: 'paymentTermsDays',
      source: 'BctPaymentTermsDays',
      label: 'Payment terms (days)',
      type: 'number',
      help: 'Days from the issue of a charge to its due date, for contracts without a due-day rule.',
      span: 1,
    },
    {
      key: 'graceDays',
      source: 'BctGraceDays',
      label: 'Grace (days)',
      type: 'number',
      help: 'Days after the due date before the contract is suspended and its modules suspend their resources.',
      span: 1,
    },
    { key: 'notes', source: 'BctNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
    { key: 'revision', source: 'BctRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    customerUUID: values['customerUUID'],
    companyUUID: values['companyUUID'],
    cycle: values['cycle'],
    startDate: values['startDate'],
    endDate: values['endDate'] || null,
    dueDayUUID: values['dueDayUUID'] || null,
    paymentTermsDays: values['paymentTermsDays'] === '' ? null : Number(values['paymentTermsDays']),
    graceDays: values['graceDays'] === '' ? null : Number(values['graceDays']),
    notes: values['notes'] || null,
  }),
  rowActions: [
    statusAction('activate', 'Activate', 'play_arrow', 'active', ['draft']),
    statusAction('suspend', 'Suspend', 'pause', 'suspended', ['active']),
    statusAction('reactivate', 'Reactivate', 'play_arrow', 'active', ['suspended']),
    statusAction('cancel', 'Cancel contract', 'block', 'cancelled', [
      'draft',
      'active',
      'suspended',
    ]),
    {
      key: 'charge',
      label: 'Bill next cycle',
      icon: 'request_quote',
      visible: (row) => ['active', 'suspended'].includes(String(row['BctStatus'])),
      request: {
        method: 'post',
        endpoint: (row) => `customer-billing/contracts/${row['BctUUID']}/charges`,
        successMessage: 'Charge generated.',
        confirm: {
          title: 'Bill next cycle',
          message:
            'Generate the charge of the next cycle with its receivable? Running it again for the same cycle returns the same charge.',
          confirmLabel: 'Generate',
        },
      },
    },
  ],
  relatedCollections: [
    {
      key: 'items',
      label: 'Items',
      emptyLabel: 'No contract items yet.',
      addLabel: 'Add',
      createTitle: 'New contract item',
      editTitle: 'Edit contract item',
      savedMessage: 'Contract item saved successfully.',
      deletedMessage: 'Contract item deleted successfully.',
      endpoint: (contract) => `customer-billing/contracts/${contract}/items`,
      updateEndpoint: (contract) => `customer-billing/contracts/${contract}/items`,
      deleteEndpoint: (contract, row) =>
        `customer-billing/contracts/${contract}/items/${row['BciUUID']}`,
      uuidField: 'BciUUID',
      initialValues: {
        status: 1,
        module: 'manual',
        resourceUUID: '',
        productUUID: '',
        description: '',
        nature: 'communication',
        kind: 'recurring',
        quantity: 1,
        unitPrice: 0,
        metric: '',
        includedQuantity: 0,
        overagePrice: 0,
        startDate: today(),
        endDate: '',
      },
      fields: [
        { key: 'status', source: 'BciStatus', label: 'Status', type: 'status', span: 1 },
        {
          key: 'module',
          source: 'BillSourceModuleBsmCode',
          label: 'Source module',
          type: 'search-select',
          required: true,
          remoteLookup: MODULE_LOOKUP,
          quickCreate: false,
          quickCreateExemptReason: 'Source modules are registered by the modules themselves.',
          help: 'Module that owns the billed resource; it receives the suspend, reactivate and cancel requests of the contract.',
          span: 1,
        },
        {
          key: 'resourceUUID',
          hiddenWhen: ({ values }) =>
            values['module'] === 'ged' || values['module'] === 'cyber_security',
          source: 'BciSourceResourceUUID',
          label: 'Resource UUID',
          help: 'Resource in the source module (connection, VPS, account...). Required for usage items.',
        },
        {
          key: 'gedAccountUUID',
          source: 'BciSourceResourceUUID',
          label: 'ged.account',
          type: 'search-select',
          hiddenWhen: ({ values }) => values['module'] !== 'ged',
          requiredWhen: ({ values }) => values['module'] === 'ged',
          remoteLookup: { endpoint: 'ged/accounts', uuidField: 'GacUUID', labelField: 'GacName' },
          quickCreate: quickCreateFor('GedAccountGacUUID'),
        },
        {
          key: 'cyberAccountUUID',
          source: 'BciSourceResourceUUID',
          label: 'cyberSecurity.account',
          type: 'search-select',
          help: 'cyberSecurity.contractItemHelp',
          hiddenWhen: ({ values }) => values['module'] !== 'cyber_security',
          requiredWhen: ({ values }) => values['module'] === 'cyber_security',
          remoteLookup: {
            endpoint: 'cyber-security/accounts?status=1',
            uuidField: 'CyaUUID',
            labelField: 'CyaName',
          },
          quickCreate: false,
          quickCreateExemptReason:
            'Cyber Security accounts are created by account administrators in Customer accounts.',
        },
        {
          key: 'productUUID',
          source: 'SaleProductSprUUID',
          label: 'Catalog item',
          type: 'search-select',
          remoteLookup: {
            endpoint: 'sale/products',
            uuidField: 'SprUUID',
            labelField: 'SprName',
            selectedLabelField: 'ProductName',
          },
          quickCreate: quickCreateFor('SaleProductSprUUID'),
        },
        {
          key: 'description',
          source: 'BciDescription',
          label: 'Description',
          required: true,
        },
        {
          key: 'nature',
          source: 'BciNature',
          label: 'Nature',
          type: 'select',
          options: ITEM_NATURES,
          required: true,
          help: 'Chooses the fiscal document of the line: goods NF-e, communication and telephony NFCom, services NFS-e.',
        },
        {
          key: 'kind',
          source: 'BciKind',
          label: 'Kind',
          type: 'select',
          options: ITEM_KINDS,
          required: true,
          help: 'Recurring is prorated by days in the cycle; one-off is billed once; usage bills what the module reports above the included quantity.',
        },
        { key: 'quantity', source: 'BciQuantity', label: 'Quantity', type: 'number', span: 1 },
        {
          key: 'unitPrice',
          source: 'BciUnitPrice',
          label: 'Unit price',
          type: 'currency',
          span: 1,
        },
        {
          key: 'metric',
          source: 'BciMetric',
          label: 'Metric',
          help: 'Name of the metric reported by the module (for example minutes or gigabytes).',
          // Cyber Security reports two fixed metrics, chosen in the field below.
          hiddenWhen: ({ values }) =>
            values['kind'] !== 'usage' || values['module'] === 'cyber_security',
          requiredWhen: ({ values }) =>
            values['kind'] === 'usage' && values['module'] !== 'cyber_security',
        },
        {
          key: 'cyberMetric',
          source: 'BciMetric',
          label: 'cyberSecurity.billingMetric',
          type: 'select',
          options: CYBER_SECURITY_METRICS,
          help: 'cyberSecurity.billingMetricHelp',
          hiddenWhen: ({ values }) =>
            values['kind'] !== 'usage' || values['module'] !== 'cyber_security',
          requiredWhen: ({ values }) =>
            values['kind'] === 'usage' && values['module'] === 'cyber_security',
          span: 1,
        },
        {
          key: 'includedQuantity',
          source: 'BciIncludedQuantity',
          label: 'Included quantity',
          type: 'number',
          hiddenWhen: ({ values }) => values['kind'] !== 'usage',
          span: 1,
        },
        {
          key: 'overagePrice',
          source: 'BciOveragePrice',
          label: 'Overage price',
          type: 'currency',
          hiddenWhen: ({ values }) => values['kind'] !== 'usage',
          span: 1,
        },
        {
          key: 'startDate',
          source: 'BciStartDate',
          label: 'Start date',
          type: 'date',
          required: true,
          span: 1,
        },
        { key: 'endDate', source: 'BciEndDate', label: 'End date', type: 'date', span: 1 },
      ],
      payload: (values) => ({
        module: values['module'] || 'manual',
        resourceUUID:
          (values['module'] === 'ged'
            ? values['gedAccountUUID']
            : values['module'] === 'cyber_security'
              ? values['cyberAccountUUID']
              : values['resourceUUID']) || null,
        productUUID: values['productUUID'] || null,
        description: values['description'],
        nature: values['nature'],
        kind: values['kind'],
        quantity: Number(values['quantity'] ?? 1),
        unitPrice: Number(values['unitPrice'] ?? 0),
        metric:
          values['kind'] !== 'usage'
            ? null
            : (values['module'] === 'cyber_security' ? values['cyberMetric'] : values['metric']) ||
              null,
        includedQuantity: Number(values['includedQuantity'] ?? 0),
        overagePrice: Number(values['overagePrice'] ?? 0),
        startDate: values['startDate'],
        endDate: values['endDate'] || null,
        status: Number(values['status'] ?? 1),
      }),
      columns: [
        { id: 'description', label: 'Description', field: 'BciDescription' },
        { id: 'module', label: 'Source module', field: 'ModuleName' },
        {
          id: 'kind',
          label: 'Kind',
          field: 'BciKind',
          value: (row, t) => t(optionLabel(ITEM_KINDS, row['BciKind'])),
        },
        {
          id: 'nature',
          label: 'Nature',
          field: 'BciNature',
          value: (row, t) => t(optionLabel(ITEM_NATURES, row['BciNature'])),
        },
        { id: 'quantity', label: 'Quantity', field: 'BciQuantity', kind: 'number' },
        { id: 'price', label: 'Unit price', field: 'BciUnitPrice', kind: 'number' },
        { id: 'status', label: 'Status', field: 'BciStatus', kind: 'status' },
      ],
    },
    {
      key: 'adjustments',
      label: 'Adjustments',
      emptyLabel: 'No adjustments yet.',
      addLabel: 'Add',
      createTitle: 'New adjustment',
      dialogDescription:
        'A debit (positive) or credit (negative) applied once on the next charge of the contract.',
      savedMessage: 'Adjustment saved successfully.',
      endpoint: (contract) => `customer-billing/contracts/${contract}/adjustments`,
      deleteEndpoint: (_contract, row) => `customer-billing/adjustments/${row['BadUUID']}`,
      uuidField: 'BadUUID',
      initialValues: { description: '', amount: 0 },
      fields: [
        {
          key: 'description',
          source: 'BadDescription',
          label: 'Description',
          required: true,
        },
        {
          key: 'amount',
          source: 'BadAmount',
          label: 'Amount',
          type: 'currency',
          required: true,
          help: 'Negative for a credit.',
          span: 1,
        },
      ],
      payload: (values) => ({
        description: values['description'],
        amount: Number(values['amount']),
      }),
      columns: [
        { id: 'description', label: 'Description', field: 'BadDescription' },
        { id: 'amount', label: 'Amount', field: 'BadAmount', kind: 'number' },
        {
          id: 'status',
          label: 'Status',
          field: 'BadStatus',
          value: (row, t) => t(optionLabel(ADJUSTMENT_STATUSES, row['BadStatus'])),
        },
      ],
    },
  ],
});

@Component({
  selector: 'app-customer-billing-contracts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CustomerBillingContractsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
