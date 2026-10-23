import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { financialTitleCrud, financialTitleFields, RECEIVABLE_TITLE } from '../financial-titles';

const config = defineCrud({
  endpoint: 'financial/receivables',
  uuidField: 'FinReceivableUUID',
  pageTitle: 'Accounts Receivable',
  pageDescription: 'Track incoming payments and outstanding customer invoices.',
  ...financialTitleCrud(RECEIVABLE_TITLE),
  fields: financialTitleFields(RECEIVABLE_TITLE),
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
}
