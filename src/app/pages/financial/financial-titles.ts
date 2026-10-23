import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudQuickCreateConfig,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import { settlementsCollection } from './settlements';

/** Building blocks of the Financial title pages: receivables and payables differ only by party. */

export type FinancialTitleSpec = {
  /** Settlement direction and the title UUID field (`FinReceivableUUID`, `FinPayableUUID`). */
  direction: 'receivable' | 'payable';
  uuidField: string;
  /** Counterparty: customer of a receivable, supplier of a payable. */
  party: {
    key: string;
    source: string;
    label: string;
    nameField: string;
    endpoint: string;
    quickCreate: ConfigurableCrudQuickCreateConfig;
  };
  settlementsLabel: string;
};

export const FINANCIAL_TITLE_STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'partial', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'canceled', label: 'Canceled' },
];

/** Status behaviour, bulk delete and initial values shared by every title page. */
export function financialTitleBase(spec: FinancialTitleSpec) {
  return {
    bulkDelete: true,
    statusMode: 'string' as const,
    activeValue: 'open',
    inactiveValue: 'canceled',
    statusOptions: FINANCIAL_TITLE_STATUSES,
    activeStatusValues: ['open', 'partial', 'paid'],
    initialValues: {
      status: 'open',
      [spec.party.key]: '',
      description: '',
      docNumber: '',
      dueDate: null,
      amount: 0,
      notes: '',
    },
    payload: financialTitlePayload,
  };
}

export function financialTitleColumns(spec: FinancialTitleSpec): ConfigurableCrudColumn[] {
  return [
    {
      id: 'description',
      label: 'Description',
      field: 'Description',
      uuidField: spec.uuidField,
      kind: 'identity',
    },
    {
      id: spec.party.key.replace(/UUID$/, ''),
      label: spec.party.label,
      field: spec.party.nameField,
    },
    { id: 'docNumber', label: 'Document number', field: 'DocNumber' },
    { id: 'dueDate', label: 'Due date', field: 'DueDate', kind: 'date' },
    { id: 'amount', label: 'Amount', field: 'Amount', kind: 'currency' },
    { id: 'open', label: 'Open balance', field: 'OpenAmount', kind: 'currency' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ];
}

export function financialTitleFields(spec: FinancialTitleSpec): ConfigurableCrudField[] {
  return [
    {
      key: 'status',
      source: 'Status',
      label: 'Status',
      type: 'status',
      options: FINANCIAL_TITLE_STATUSES,
      span: 1,
    },
    {
      key: spec.party.key,
      source: spec.party.source,
      label: spec.party.label,
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: spec.party.endpoint,
        searchParam: 'q',
        uuidField: spec.party.source,
        labelField: 'Name',
        selectedLabelField: spec.party.nameField,
      },
      quickCreate: spec.party.quickCreate,
      span: 1,
    },
    { key: 'description', source: 'Description', label: 'Description', required: true, span: 2 },
    { key: 'docNumber', source: 'DocNumber', label: 'Document number', span: 1 },
    { key: 'dueDate', source: 'DueDate', label: 'Due date', type: 'date', required: true, span: 1 },
    {
      key: 'amount',
      source: 'Amount',
      label: 'Amount',
      type: 'currency',
      required: true,
      positive: true,
      span: 1,
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ];
}

export function financialTitleRowActions(spec: FinancialTitleSpec): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'settlements',
      label: spec.settlementsLabel,
      icon: 'payments',
      collection: settlementsCollection(spec.direction, spec.uuidField),
    },
  ];
}

/** Payload sent by both title pages: optional texts as null, amount as a number. */
export function financialTitlePayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
  return {
    ...payload,
    docNumber: payload['docNumber'] || null,
    notes: payload['notes'] || null,
    amount: Number(payload['amount']),
  };
}

export const RECEIVABLE_TITLE: FinancialTitleSpec = {
  direction: 'receivable',
  uuidField: 'FinReceivableUUID',
  party: {
    key: 'customerUUID',
    source: 'CustomerUUID',
    label: 'Customer',
    nameField: 'CustomerName',
    endpoint: 'registry/customers',
    quickCreate: quickCreateFor('RegCustomerRcuUUID'),
  },
  settlementsLabel: 'Receipts',
};

export const PAYABLE_TITLE: FinancialTitleSpec = {
  direction: 'payable',
  uuidField: 'FinPayableUUID',
  party: {
    key: 'supplierUUID',
    source: 'SupplierUUID',
    label: 'Supplier',
    nameField: 'SupplierName',
    endpoint: 'registry/suppliers',
    quickCreate: quickCreateFor('RegSupplierRsuUUID'),
  },
  settlementsLabel: 'Payments',
};

/** A title page configuration except its endpoint, identity, texts and fields. */
export function financialTitleCrud(spec: FinancialTitleSpec) {
  return {
    ...financialTitleBase(spec),
    columns: financialTitleColumns(spec),
    rowActions: financialTitleRowActions(spec),
  };
}
