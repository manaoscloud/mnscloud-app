import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { BillingSystemLedgerEntry } from '../../shared/billing.service';

export const LEDGER_TYPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'CREDIT_TOPUP', label: 'Wallet top-up' },
  { value: 'CREDIT_MANUAL', label: 'Manual credit' },
  { value: 'CREDIT_TRIAL', label: 'Trial credit' },
  { value: 'DEBIT_SUBSCRIPTION', label: 'Subscription debit' },
  { value: 'ONE_TIME_SETUP_DEBIT', label: 'Setup debit' },
  { value: 'USAGE_DEBIT', label: 'Usage debit' },
  { value: 'DEBIT_PAY_FEE', label: 'Pay transaction fee' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'ADJUSTMENT', label: 'Adjustment' },
  { value: 'REVERSAL', label: 'Reversal' },
];

export const LEDGER_ORIGIN_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'GATEWAY', label: 'Payment gateway' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'SYSTEM', label: 'System' },
];

const DIRECTION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'CREDIT', label: 'Credit' },
  { value: 'DEBIT', label: 'Debit' },
];

const PAYMENT_METHOD_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'PIX_BOLETO', label: 'Pix/boleto' },
  { value: 'CREDIT_CARD', label: 'Credit card' },
];

const TOPUP_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELED', label: 'Canceled' },
];

/** Same label source for filters and columns; unknown codes stay readable as sent by the API. */
function optionLabel(
  options: readonly ConfigurableCrudOption[],
  value: unknown,
  translate: (key: string) => string,
): string {
  if (value === null || value === undefined || value === '') return '';
  const option = options.find((item) => item.value === value);
  return option ? translate(option.label) : String(value);
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Period presets resolve to the first included day (`dateFrom`); entries up to now are listed. */
function periodOptions(today = new Date()): readonly ConfigurableCrudOption[] {
  const daysAgo = (days: number) =>
    isoDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - days));
  return [
    { value: isoDay(today), label: 'Today' },
    { value: daysAgo(6), label: 'Last 7 days' },
    { value: daysAgo(29), label: 'Last 30 days' },
    { value: isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), label: 'This month' },
    { value: daysAgo(89), label: 'Last 90 days' },
    { value: isoDay(new Date(today.getFullYear(), 0, 1)), label: 'This year' },
  ];
}

const TENANT_FILTER: ConfigurableCrudListFilter = {
  key: 'environmentUUID',
  label: 'Tenant',
  type: 'search-select',
  span: 1,
  remoteLookup: {
    endpoint: 'system/billing/tenants',
    uuidField: 'EnvironmentUUID',
    labelField: 'EnvironmentName',
    descriptionField: 'TenantEmail',
  },
};

const LEDGER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/billing/ledger',
  uuidField: 'BleUUID',
  pageTitle: 'Billing statement',
  pageDescription:
    'Audit every wallet movement of all tenants: gateway top-ups, manual credits and debits.',
  createTitle: 'New ledger entry',
  editTitle: 'Edit ledger entry',
  dialogDescription: 'Maintain ledger entry.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No ledger entries found.',
  deleteTitle: 'Delete ledger entry',
  deleteMessage: 'Delete this ledger entry?',
  deleteSelectedTitle: 'Delete selected ledger entries',
  deleteSelectedMessage: 'Delete {count} selected ledger entries?',
  savedMessage: 'Ledger entry saved successfully.',
  deletedMessage: 'Ledger entry deleted successfully.',
  deleteFailedMessage: 'Failed to delete ledger entry.',
  statusFilter: false,
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  serverSidePagination: true,
  listFilters: [
    TENANT_FILTER,
    {
      key: 'origin',
      label: 'Origin',
      type: 'select',
      span: 1,
      options: LEDGER_ORIGIN_OPTIONS,
      translateOptions: true,
    },
    {
      key: 'type',
      label: 'Type',
      type: 'select',
      span: 1,
      options: LEDGER_TYPE_OPTIONS,
      translateOptions: true,
    },
    {
      key: 'dateFrom',
      label: 'Period',
      type: 'select',
      span: 1,
      options: periodOptions(),
      translateOptions: true,
    },
  ],
  initialValues: {},
  columns: [
    { id: 'createdAt', label: 'Date', kind: 'datetime', field: 'BleDateCreated' },
    {
      id: 'tenant',
      label: 'Tenant',
      kind: 'identity',
      field: 'EnvironmentName',
      uuidField: 'EnvironmentUUID',
      detail: (row) => String(row['TenantEmail'] ?? ''),
    },
    {
      id: 'type',
      label: 'Type',
      field: 'BleType',
      value: (row, t) => optionLabel(LEDGER_TYPE_OPTIONS, row['BleType'], t),
    },
    {
      id: 'origin',
      label: 'Origin',
      field: 'EntryOrigin',
      value: (row, t) => optionLabel(LEDGER_ORIGIN_OPTIONS, row['EntryOrigin'], t),
    },
    {
      id: 'direction',
      label: 'Direction',
      field: 'BleDirection',
      value: (row, t) => optionLabel(DIRECTION_OPTIONS, row['BleDirection'], t),
      optional: true,
    },
    {
      id: 'amount',
      label: 'Amount',
      kind: 'currency',
      field: 'BleAmount',
      currencyField: 'BleCurrency',
    },
    {
      id: 'before',
      label: 'Balance before',
      kind: 'currency',
      field: 'BleBalanceBefore',
      currencyField: 'BleCurrency',
      optional: true,
    },
    {
      id: 'after',
      label: 'Balance after',
      kind: 'currency',
      field: 'BleBalanceAfter',
      currencyField: 'BleCurrency',
    },
    {
      id: 'method',
      label: 'Payment method',
      field: 'BpiPaymentMethod',
      value: (row, t) => optionLabel(PAYMENT_METHOD_OPTIONS, row['BpiPaymentMethod'], t),
      detail: (row) => String(row['PbcName'] ?? ''),
    },
    {
      id: 'topup',
      label: 'Top-up',
      field: 'BpiID',
      detail: (row, t) => optionLabel(TOPUP_STATUS_OPTIONS, row['BpiStatus'], t),
      copyable: true,
    },
    {
      id: 'bankReference',
      label: 'Bank reference',
      field: 'BpiProviderReference',
      copyable: true,
      optional: true,
    },
    {
      id: 'charged',
      label: 'Charged amount',
      kind: 'currency',
      field: 'BpiChargeAmount',
      currencyField: 'BleCurrency',
      optional: true,
    },
    {
      id: 'surcharge',
      label: 'Card fee',
      kind: 'currency',
      field: 'BpiSurchargeAmount',
      currencyField: 'BleCurrency',
      optional: true,
    },
    {
      id: 'author',
      label: 'Created by',
      field: 'CreatedByName',
      detail: (row) => String(row['CreatedByEmail'] ?? ''),
    },
    { id: 'reference', label: 'Reference', field: 'BleReference', copyable: true },
    { id: 'reason', label: 'Reason', field: 'BleReason' },
    { id: 'entryID', label: 'Entry', field: 'BleID', copyable: true, optional: true },
  ],
  fields: [],
};

@Component({
  selector: 'app-billing-system-ledger',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class BillingSystemLedgerPage extends ConfigurableCrudPageBase<
  BillingSystemLedgerEntry & ConfigurableCrudRecord
> {
  private readonly route = inject(ActivatedRoute);

  constructor() {
    super(LEDGER_CONFIG);
    // "Statement" from the wallets list opens this page already filtered by that tenant.
    const tenant = this.route.snapshot.queryParamMap.get('environmentUUID');
    if (tenant) {
      this.filterRemoteSearch(TENANT_FILTER, tenant);
      this.listFilterValues.set({ environmentUUID: tenant });
      this.applySearchFilters();
    }
  }
}
