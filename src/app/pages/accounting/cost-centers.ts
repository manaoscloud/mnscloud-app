import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'accounting/cost-centers',
  uuidField: 'AccUUID',
  pageTitle: 'Cost centers',
  pageDescription:
    "Cost centers of your accountant's plan, used by the account mappings of the accounting events.",
  createTitle: 'New cost center',
  editTitle: 'Edit cost center',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: { status: 1, code: '', name: '', revision: null },
  columns: [
    { id: 'code', label: 'Code', field: 'AccCode', uuidField: 'AccUUID', kind: 'identity' },
    { id: 'name', label: 'Name', field: 'AccName' },
    { id: 'status', label: 'Status', field: 'AccStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'AccStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'code', source: 'AccCode', label: 'Code', required: true, span: 1 },
    { key: 'name', source: 'AccName', label: 'Name', required: true, span: 2 },
    { key: 'revision', source: 'AccRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    code: values['code'],
    name: values['name'],
    status: Number(values['status'] ?? 1),
  }),
});

@Component({
  selector: 'app-accounting-cost-centers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AccountingCostCentersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
