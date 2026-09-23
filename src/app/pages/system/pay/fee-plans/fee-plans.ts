import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudConfig,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const bankPartners = [
  { value: '', label: 'All' },
  { value: 'inter_business', label: 'Inter Empresas' },
];

const transactionTypes = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
];

const statuses = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

// Financial configuration deletes remain individual: no bulk endpoint is authorized.
function tiers(rate: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `system/pay/fee-plans/rates/${rate['PfrUUID']}/tiers`,
    updateEndpoint: 'system/pay/fee-plans/tiers',
    deleteEndpoint: 'system/pay/fee-plans/tiers',
    uuidField: 'PftUUID',
    pageTitle: 'Pay — Volume tiers',
    statusFilter: false,
    bulkDelete: false,
    initialValues: { fixedAmount: 0, percentRate: 0, periodType: 'MONTHLY' },
    columns: [
      { id: 'count', label: 'Minimum volume count', field: 'PftMinVolumeCount', kind: 'identity' },
      {
        id: 'volume',
        label: 'Minimum volume amount',
        field: 'PftMinVolumeAmount',
        kind: 'currency',
        currencyCode: String(rate['PfrCurrency']),
      },
      {
        id: 'fixed',
        label: 'Fixed amount',
        field: 'PftFixedAmount',
        kind: 'currency',
        currencyCode: String(rate['PfrCurrency']),
      },
      { id: 'percent', label: 'Percentage rate', field: 'PftPercentRate', kind: 'number' },
    ],
    fields: [
      {
        key: 'minVolumeCount',
        source: 'PftMinVolumeCount',
        label: 'Minimum volume count',
        type: 'number',
        span: 1,
      },
      {
        key: 'minVolumeAmount',
        source: 'PftMinVolumeAmount',
        label: 'Minimum volume amount',
        type: 'currency',
        currencyCode: String(rate['PfrCurrency']),
        span: 1,
      },
      {
        key: 'fixedAmount',
        source: 'PftFixedAmount',
        label: 'Fixed amount',
        type: 'currency',
        currencyCode: String(rate['PfrCurrency']),
        span: 1,
      },
      {
        key: 'percentRate',
        source: 'PftPercentRate',
        label: 'Percentage rate',
        type: 'number',
        span: 1,
      },
      {
        key: 'minFeeAmount',
        source: 'PftMinFeeAmount',
        label: 'Minimum fee',
        type: 'currency',
        currencyCode: String(rate['PfrCurrency']),
        span: 1,
      },
      {
        key: 'maxFeeAmount',
        source: 'PftMaxFeeAmount',
        label: 'Maximum fee',
        type: 'currency',
        currencyCode: String(rate['PfrCurrency']),
        span: 1,
      },
      {
        key: 'periodType',
        source: 'PftPeriodType',
        label: 'Period',
        type: 'select',
        span: 1,
        options: [{ value: 'MONTHLY', label: 'Monthly' }],
      },
    ],
  });
}
function rates(plan: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `system/pay/fee-plans/${plan['PfpUUID']}/rates`,
    updateEndpoint: 'system/pay/fee-plans/rates',
    deleteEndpoint: 'system/pay/fee-plans/rates',
    uuidField: 'PfrUUID',
    pageTitle: 'Pay — Rates',
    statusFilter: false,
    bulkDelete: false,
    defaultCurrencyFields: ['currency'],
    defaultCurrencyScope: 'master',
    initialValues: { transactionType: 'boleto', provider: '', fixedAmount: 0, percentRate: 0 },
    columns: [
      {
        id: 'transaction',
        label: 'Transaction type',
        field: 'PfrTransactionType',
        kind: 'identity',
        options: transactionTypes,
      },
      { id: 'provider', label: 'Bank partner', field: 'PfrProvider', options: bankPartners },
      {
        id: 'fixed',
        label: 'Fixed amount',
        field: 'PfrFixedAmount',
        kind: 'currency',
        currencyField: 'PfrCurrency',
      },
      { id: 'percent', label: 'Percentage rate', field: 'PfrPercentRate', kind: 'number' },
    ],
    fields: [
      {
        key: 'transactionType',
        source: 'PfrTransactionType',
        label: 'Transaction type',
        type: 'select',
        span: 1,
        required: true,
        options: transactionTypes,
        disabledWhen: ({ editing }) => editing,
      },
      {
        key: 'provider',
        source: 'PfrProvider',
        label: 'Bank partner',
        type: 'select',
        span: 1,
        options: bankPartners,
        disabledWhen: ({ editing }) => editing,
      },
      { key: 'currency', source: 'PfrCurrency', label: 'Currency', span: 1, required: true },
      {
        key: 'fixedAmount',
        source: 'PfrFixedAmount',
        label: 'Fixed amount',
        type: 'currency',
        currencyKey: 'currency',
        span: 1,
      },
      {
        key: 'percentRate',
        source: 'PfrPercentRate',
        label: 'Percentage rate',
        type: 'number',
        span: 1,
      },
      {
        key: 'minFeeAmount',
        source: 'PfrMinFeeAmount',
        label: 'Minimum fee',
        type: 'currency',
        currencyKey: 'currency',
        span: 1,
      },
      {
        key: 'maxFeeAmount',
        source: 'PfrMaxFeeAmount',
        label: 'Maximum fee',
        type: 'currency',
        currencyKey: 'currency',
        span: 1,
      },
    ],
    rowActions: [{ key: 'tiers', label: 'Volume tiers', icon: 'stairs', collection: tiers }],
  });
}
const config = defineCrud({
  serverSidePagination: true,
  endpoint: 'system/pay/fee-plans',
  uuidField: 'PfpUUID',
  pageTitle: 'Pay — Fee Plans',
  bulkDelete: false,
  statusOptions: statuses,
  initialValues: { status: 1, isDefault: 0, name: '', description: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'PfpName', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'PfpDescription' },
    { id: 'default', label: 'Default', field: 'PfpIsDefault', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'PfpStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'PfpStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'PfpName', label: 'Name', required: true, span: 1 },
    {
      key: 'isDefault',
      source: 'PfpIsDefault',
      label: 'Default',
      type: 'select',
      span: 1,
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
    {
      key: 'description',
      source: 'PfpDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
    },
  ],
  rowActions: [{ key: 'rates', label: 'Rates', icon: 'price_change', collection: rates }],
});

@Component({
  selector: 'app-fee-plans',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPayFeePlansPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
