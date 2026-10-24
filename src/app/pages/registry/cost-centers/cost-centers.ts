import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const COMPANY_LOOKUP = {
  endpoint: 'registry/companies?status=1',
  uuidField: 'CompanyUUID',
  labelField: 'Name',
  selectedLabelField: 'CompanyName',
};

/** Organization structure shared by Financial titles, Accounting mappings, Stock and HR. */
const config = defineCrud({
  endpoint: 'registry/cost-centers',
  uuidField: 'RccUUID',
  pageTitle: 'Cost centers',
  pageDescription:
    'Cost centers of your organization, optionally grouped under a parent and linked to a company, shared by the financial titles and the accounting mappings.',
  createTitle: 'New cost center',
  editTitle: 'Edit cost center',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: { status: 1, code: '', name: '', parentUUID: '', companyUUID: '', revision: null },
  listFilters: [
    {
      key: 'companyUUID',
      label: 'Company',
      paramKey: 'companyUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: COMPANY_LOOKUP,
    },
  ],
  columns: [
    { id: 'code', label: 'Code', field: 'RccCode', uuidField: 'RccUUID', kind: 'identity' },
    { id: 'name', label: 'Name', field: 'RccName' },
    { id: 'parent', label: 'Parent cost center', field: 'ParentName' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'status', label: 'Status', field: 'RccStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'RccStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'code', source: 'RccCode', label: 'Code', required: true, span: 1 },
    { key: 'name', source: 'RccName', label: 'Name', required: true, span: 2 },
    {
      key: 'parentUUID',
      source: 'RccParentRccUUID',
      label: 'Parent cost center',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'registry/cost-centers?status=1',
        uuidField: 'RccUUID',
        labelField: 'RccName',
        descriptionField: 'RccCode',
        selectedLabelField: 'ParentName',
      },
      quickCreate: quickCreateFor('RegCostCenterRccUUID'),
      span: 2,
    },
    {
      key: 'companyUUID',
      source: 'RegCompanyRcoUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: COMPANY_LOOKUP,
      span: 2,
    },
    { key: 'revision', source: 'RccRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing ? { revision: Number(values['revision']) } : {}),
    code: values['code'],
    name: values['name'],
    parentUUID: values['parentUUID'] || null,
    companyUUID: values['companyUUID'] || null,
    status: Number(values['status'] ?? 1),
  }),
});

@Component({
  selector: 'app-registry-cost-centers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegCostCenterPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
