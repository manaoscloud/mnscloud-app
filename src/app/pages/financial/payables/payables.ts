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

const config = defineCrud({
  endpoint: 'financial/payables',
  uuidField: 'FinPayableUUID',
  pageTitle: 'Accounts Payable',
  pageDescription: 'Track supplier bills and schedule outgoing payments.',
  ...financialTitleBase(title),
  columns: financialTitleColumns(title),
  fields: financialTitleFields(title),
  rowActions: financialTitleRowActions(title),
});

@Component({
  selector: 'app-financial-payables',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class FinancialPayablesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    if (Number(payload['amount']) > 0) return true;
    return this.rejectField('amount', 'Amount must be greater than zero.');
  }
}
