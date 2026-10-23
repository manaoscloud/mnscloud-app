import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { financialTitleCrud, financialTitleFields, PAYABLE_TITLE } from '../financial-titles';

const config = defineCrud({
  endpoint: 'financial/payables',
  uuidField: 'FinPayableUUID',
  pageTitle: 'Accounts Payable',
  pageDescription: 'Track supplier bills and schedule outgoing payments.',
  ...financialTitleCrud(PAYABLE_TITLE),
  fields: financialTitleFields(PAYABLE_TITLE),
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
}
