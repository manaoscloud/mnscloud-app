import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import {
  financialTitleBase,
  financialTitleColumns,
  financialTitleFields,
  financialTitleRowActions,
  type FinancialTitleSpec,
} from '../financial-titles';

const title: FinancialTitleSpec = {
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

const config = defineCrud({
  endpoint: 'financial/receivables',
  uuidField: 'FinReceivableUUID',
  pageTitle: 'Accounts Receivable',
  pageDescription: 'Track incoming payments and outstanding customer invoices.',
  ...financialTitleBase(title),
  columns: financialTitleColumns(title),
  fields: financialTitleFields(title),
  rowActions: financialTitleRowActions(title),
});

@Component({
  selector: 'app-financial-receivables',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialReceivablesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (Number(payload['amount']) > 0) return true;
    return this.rejectField('amount', 'Amount must be greater than zero.');
  }
}
