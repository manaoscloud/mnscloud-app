import { CRM_OPTIONS } from '../crm-options';
import { crmPayload } from '../crm-input';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';
const config = defineCrud({
  endpoint: 'crm/products',
  uuidField: 'CprUUID',
  pageTitle: 'crm.title.products',
  defaultCurrencyFields: ['CprCurrency'],
  initialValues: {
    CprName: '',
    CprDescription: '',
    CprAmount: 0,
    CprCurrency: '',
    CprPeriod: 'monthly',
    CprStatus: 1,
  },
  fields: [
    {
      key: 'CprStatus',
      source: 'CprStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    {
      key: 'CprPeriod',
      source: 'CprPeriod',
      label: 'crm.field.Period',
      span: 1,
      required: true,
      type: 'select',
      translateOptions: true,
      options: CRM_OPTIONS.productPeriods,
    },
    {
      key: 'CprCurrency',
      source: 'CprCurrency',
      label: 'crm.field.Currency',
      span: 1,
      required: false,
      type: 'text',
    },
    {
      key: 'CprAmount',
      source: 'CprAmount',
      label: 'crm.field.Amount',
      span: 1,
      required: true,
      type: 'currency',
      currencyKey: 'CprCurrency',
    },
    {
      key: 'CprName',
      source: 'CprName',
      label: 'crm.field.Name',
      span: 2,
      required: true,
      type: 'text',
    },
    {
      key: 'CprDescription',
      source: 'CprDescription',
      label: 'crm.field.Description',
      span: 4,
      required: false,
      type: 'textarea',
      rows: 4,
      breakBefore: true,
    },
    { key: 'CprRevision', source: 'CprRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    {
      id: 'CprName',
      field: 'CprName',
      label: 'crm.field.Name',
      kind: 'identity',
    },
    {
      id: 'CprPeriod',
      field: 'CprPeriod',
      label: 'crm.field.Period',
      kind: 'text',
      options: CRM_OPTIONS.productPeriods,
    },
    {
      id: 'CprStatus',
      field: 'CprStatus',
      label: 'crm.field.Status',
      kind: 'status',
    },
  ],
  listFilters: [
    {
      key: 'CprPeriod',
      paramKey: 'CprPeriod',
      label: 'crm.field.Period',
      type: 'select',
      translateOptions: true,
      options: CRM_OPTIONS.productPeriods,
      span: 1,
    },
  ],
  serverSidePagination: true,
  // CRM deletion is individually audited; see app.md, CRM form baseline.
  bulkDelete: false,
  quickCreateLabelField: 'CprName',
  payload: (values, editing) =>
    crmPayload(values, editing, 'CprRevision', ['CprAmount', 'CprStatus', 'CprRevision'], []),
  rowActions: crmActions('products'),
});
@Component({
  selector: 'app-crm-products',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmProductPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
