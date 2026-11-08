import type {
  ConfigurableCrudField,
  ConfigurableCrudColumn,
  ConfigurableCrudListFilter,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

const lookup = {
  endpoint: 'crm/workspaces?status=1',
  uuidField: 'CwsUUID',
  labelField: 'CwsName',
  selectedLabelField: 'WorkspaceName',
};

export const crmWorkspaceField: ConfigurableCrudField = {
  key: 'CrmWorkspaceCwsUUID',
  source: 'CrmWorkspaceCwsUUID',
  label: 'crm.field.Workspace',
  type: 'search-select',
  span: 1,
  required: true,
  remoteLookup: lookup,
  disabledWhen: ({ editing }) => editing,
};

export const crmWorkspaceFilter: ConfigurableCrudListFilter = {
  key: 'CrmWorkspaceCwsUUID',
  paramKey: 'CrmWorkspaceCwsUUID',
  label: 'crm.field.Workspace',
  type: 'search-select',
  span: 1,
  remoteLookup: lookup,
};

export const crmWorkspaceColumn: ConfigurableCrudColumn = {
  id: 'WorkspaceName',
  field: 'WorkspaceName',
  label: 'crm.field.Workspace',
};
