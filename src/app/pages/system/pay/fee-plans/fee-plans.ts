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

const statuses = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

// Financial configuration deletes remain individual: no bulk endpoint is authorized.
function tiers(rate: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `system/pay/fee-plans/rates/${rate['BfrUUID']}/tiers`,
    updateEndpoint: 'system/pay/fee-plans/tiers',
    deleteEndpoint: 'system/pay/fee-plans/tiers',
    uuidField: 'BftUUID',
    pageTitle: 'Pay — Volume tiers',
    statusFilter: false,
    bulkDelete: false,
    initialValues: { fixedAmount: 0, percentRate: 0, periodType: 'MONTHLY' },
    columns: [
      { id: 'count', label: 'Minimum volume count', field: 'BftMinVolumeCount', kind: 'identity' },
      {
        id: 'volume',
        label: 'Minimum volume amount',
        field: 'BftMinVolumeAmount',
        kind: 'currency',
        currencyCode: String(rate['BfrCurrency']),
      },
      {
        id: 'fixed',
        label: 'Fixed amount',
        field: 'BftFixedAmount',
        kind: 'currency',
        currencyCode: String(rate['BfrCurrency']),
      },
      { id: 'percent', label: 'Percentage rate', field: 'BftPercentRate', kind: 'number' },
    ],
    fields: [
      {
        key: 'minVolumeCount',
        source: 'BftMinVolumeCount',
        label: 'Minimum volume count',
        type: 'number',
        span: 1,
      },
      {
        key: 'minVolumeAmount',
        source: 'BftMinVolumeAmount',
        label: 'Minimum volume amount',
        type: 'currency',
        currencyCode: String(rate['BfrCurrency']),
        span: 1,
      },
      {
        key: 'fixedAmount',
        source: 'BftFixedAmount',
        label: 'Fixed amount',
        type: 'currency',
        currencyCode: String(rate['BfrCurrency']),
        span: 1,
      },
      {
        key: 'percentRate',
        source: 'BftPercentRate',
        label: 'Percentage rate',
        type: 'number',
        span: 1,
      },
      {
        key: 'minFeeAmount',
        source: 'BftMinFeeAmount',
        label: 'Minimum fee',
        type: 'currency',
        currencyCode: String(rate['BfrCurrency']),
        span: 1,
      },
      {
        key: 'maxFeeAmount',
        source: 'BftMaxFeeAmount',
        label: 'Maximum fee',
        type: 'currency',
        currencyCode: String(rate['BfrCurrency']),
        span: 1,
      },
      {
        key: 'periodType',
        source: 'BftPeriodType',
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
    endpoint: `system/pay/fee-plans/${plan['BfpUUID']}/rates`,
    updateEndpoint: 'system/pay/fee-plans/rates',
    deleteEndpoint: 'system/pay/fee-plans/rates',
    uuidField: 'BfrUUID',
    pageTitle: 'Pay — Rates',
    statusFilter: false,
    bulkDelete: false,
    defaultCurrencyFields: ['currency'],
    initialValues: { transactionType: 'boleto', provider: '', fixedAmount: 0, percentRate: 0 },
    columns: [
      {
        id: 'transaction',
        label: 'Transaction type',
        field: 'BfrTransactionType',
        kind: 'identity',
        options: [
          { value: 'boleto', label: 'Boleto' },
          { value: 'pix', label: 'Pix' },
        ],
      },
      { id: 'provider', label: 'Bank partner', field: 'BfrProvider' },
      {
        id: 'fixed',
        label: 'Fixed amount',
        field: 'BfrFixedAmount',
        kind: 'currency',
        currencyField: 'BfrCurrency',
      },
      { id: 'percent', label: 'Percentage rate', field: 'BfrPercentRate', kind: 'number' },
    ],
    fields: [
      {
        key: 'transactionType',
        source: 'BfrTransactionType',
        label: 'Transaction type',
        type: 'select',
        span: 1,
        required: true,
        options: [
          { value: 'boleto', label: 'Boleto' },
          { value: 'pix', label: 'Pix' },
        ],
        disabledWhen: ({ editing }) => editing,
      },
      {
        key: 'provider',
        source: 'BfrProvider',
        label: 'Bank partner',
        type: 'select',
        span: 1,
        options: [
          { value: '', label: 'All' },
          { value: 'inter_business', label: 'Inter Empresas' },
        ],
        disabledWhen: ({ editing }) => editing,
      },
      { key: 'currency', source: 'BfrCurrency', label: 'Currency', span: 1, required: true },
      {
        key: 'fixedAmount',
        source: 'BfrFixedAmount',
        label: 'Fixed amount',
        type: 'currency',
        currencyKey: 'currency',
        span: 1,
      },
      {
        key: 'percentRate',
        source: 'BfrPercentRate',
        label: 'Percentage rate',
        type: 'number',
        span: 1,
      },
      {
        key: 'minFeeAmount',
        source: 'BfrMinFeeAmount',
        label: 'Minimum fee',
        type: 'currency',
        currencyKey: 'currency',
        span: 1,
      },
      {
        key: 'maxFeeAmount',
        source: 'BfrMaxFeeAmount',
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
  endpoint: 'system/pay/fee-plans',
  uuidField: 'BfpUUID',
  pageTitle: 'Pay — Fee Plans',
  bulkDelete: false,
  statusOptions: statuses,
  initialValues: { status: 1, isDefault: 0, name: '', description: '' },
  columns: [
    { id: 'name', label: 'Name', field: 'BfpName', kind: 'identity' },
    { id: 'description', label: 'Description', field: 'BfpDescription' },
    { id: 'default', label: 'Default', field: 'BfpIsDefault', kind: 'boolean' },
    { id: 'status', label: 'Status', field: 'BfpStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'BfpStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'BfpName', label: 'Name', required: true, span: 1 },
    {
      key: 'isDefault',
      source: 'BfpIsDefault',
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
      source: 'BfpDescription',
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
