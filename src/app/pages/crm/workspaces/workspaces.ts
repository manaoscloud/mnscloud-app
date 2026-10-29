import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmActions } from '../crm-actions';

export const CRM_WORKSPACE_LOOKUP = {
  endpoint: 'crm/workspaces?status=1',
  uuidField: 'CwsUUID',
  labelField: 'CwsName',
  selectedLabelField: 'WorkspaceName',
};

export const CRM_WORKSPACES_CONFIG = defineCrud({
  endpoint: 'crm/workspaces',
  uuidField: 'CwsUUID',
  pageTitle: 'crm.title.workspaces',
  pageDescription: 'crm.description.workspaces',
  createTitle: 'crm.newWorkspace',
  editTitle: 'crm.editWorkspace',
  serverSidePagination: true,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: row['CwsRevision'] }),
  initialValues: { CwsName: '', CwsDescription: '', RegCustomerRcuUUID: null, CwsStatus: 1 },
  fields: [
    {
      key: 'CwsStatus',
      source: 'CwsStatus',
      label: 'crm.field.Status',
      span: 1,
      required: true,
      type: 'status',
    },
    { key: 'CwsName', source: 'CwsName', label: 'crm.field.Name', required: true, span: 2 },
    {
      key: 'RegCustomerRcuUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 2,
      help: 'crm.workspaceCustomerHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    {
      key: 'CwsDescription',
      source: 'CwsDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
      rows: 4,
    },
    { key: 'CwsRevision', source: 'CwsRevision', label: 'crm.field.Revision', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'CwsName', label: 'crm.field.Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'kind', field: 'CwsKind', label: 'Type' },
    { id: 'publication', field: 'CwsPortalEnabled', label: 'crm.portalEnabled', kind: 'status' },
    { id: 'status', field: 'CwsStatus', label: 'crm.field.Status', kind: 'status' },
  ],
  rowActions: crmActions('workspaces'),
});

@Component({
  selector: 'app-crm-workspaces',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmWorkspacePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected readonly workspaceConfig = CRM_WORKSPACES_CONFIG;

  constructor() {
    super(CRM_WORKSPACES_CONFIG);
  }
}
