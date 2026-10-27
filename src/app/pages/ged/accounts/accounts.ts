import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { Component } from '@angular/core';
import { CONFIGURABLE_CRUD_IMPORTS, ConfigurableCrudPageBase, ConfigurableCrudRecord } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const GED_ACCOUNTS_CONFIG = defineCrud({
  endpoint: 'ged/accounts', uuidField: 'GacUUID', pageTitle: 'ged.accounts',
  pageDescription: 'ged.accountsDescription',
  createTitle: 'ged.newAccount', editTitle: 'ged.editAccount',
  serverSidePagination: true, bulkDelete: true,
  ...revisionDeletePayloads('GacUUID', 'GacRevision'),
  initialValues: { name: '', description: '', RegCustomerRcuUUID: null, status: 1 },
  fields: [
    { key: 'status', source: 'GacStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'GacName', label: 'Name', required: true, span: 1 },
    { key: 'RegCustomerRcuUUID', source: 'RegCustomerRcuUUID', label: 'Customer',
      type: 'search-select', span: 1, help: 'ged.accountCustomerHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: { endpoint: 'registry/customers?status=1', uuidField: 'CustomerUUID', labelField: 'Name', selectedLabelField: 'CustomerName' } },
    { key: 'description', source: 'GacDescription', label: 'Description', type: 'textarea', span: 1 },
    { key: 'revision', source: 'GacRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'GacName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'status', field: 'GacStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-accounts', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class GedAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() { super(GED_ACCOUNTS_CONFIG); }
}
