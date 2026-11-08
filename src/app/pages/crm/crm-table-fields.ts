import type {
  ConfigurableCrudColumn,
  ConfigurableCrudListFilter,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

export function crmRecordColumn(
  field: string,
  label: string,
  kind: ConfigurableCrudColumn['kind'] = 'text',
): ConfigurableCrudColumn {
  return { id: field, field, label, kind };
}

export const crmOperatorFilter: ConfigurableCrudListFilter = {
  key: 'AssignedUserUsrUUID',
  paramKey: 'AssignedUserUsrUUID',
  label: 'crm.field.AssignedUserUsrUUID',
  type: 'search-select',
  span: 1,
  remoteLookup: { endpoint: 'crm/members', uuidField: 'UsrUUID', labelField: 'UsrName' },
};
