import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const DEPARTMENT_LOOKUP = {
  endpoint: 'registry/departments',
  uuidField: 'DepartmentUUID',
  labelField: 'Name',
  selectedLabelField: 'DepartmentName',
};

const RESPONSIBLE_LOOKUP = {
  endpoint: 'hr/department-approvers/candidates',
  uuidField: 'UUID',
  labelField: 'Name',
  selectedLabelField: 'ResponsibleName',
};

const KINDS = [
  { value: 'app', label: 'App user' },
  { value: 'portal', label: 'Customer Portal user' },
] as const;

// Who decides the Pulse requests of each department: an App member on the internal HR account, a
// Customer Portal user of the customer on a customer account. HR users with the requests write
// permission still decide every request of the account (fallback).
const config = defineCrud({
  endpoint: 'hr/department-approvers',
  uuidField: 'DepartmentApproverUUID',
  pageTitle: 'Approvers',
  pageDescription:
    'The responsible of each department approves the requests its employees send in Pulse. On the internal account it is an App user; on a customer account, a Customer Portal user of that customer. HR can always decide.',
  createTitle: 'New approver',
  editTitle: 'Edit approver',
  searchPlaceholder: 'Department or responsible',
  emptyLabel: 'No approvers yet.',
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: { departmentUUID: '', responsibleUUID: '', revision: null },
  columns: [
    {
      id: 'department',
      label: 'Department',
      field: 'DepartmentName',
      uuidField: 'DepartmentApproverUUID',
      kind: 'identity',
      translateValue: false,
    },
    { id: 'responsible', label: 'Responsible', field: 'ResponsibleName', translateValue: false },
    { id: 'kind', label: 'Kind', field: 'ApproverKind', options: KINDS },
  ],
  fields: [
    {
      key: 'departmentUUID',
      source: 'DepartmentUUID',
      label: 'Department',
      type: 'search-select',
      remoteLookup: DEPARTMENT_LOOKUP,
      quickCreate: quickCreateFor('RegDepartmentRdeUUID'),
      required: true,
      span: 1,
      disabledWhen: (context) => context.editing,
    },
    {
      key: 'responsibleUUID',
      source: 'ResponsibleUUID',
      label: 'Responsible',
      type: 'search-select',
      remoteLookup: RESPONSIBLE_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason:
        'Responsibles are existing App members or Customer Portal users, created in their own modules.',
      required: true,
      span: 1,
      help: 'App users on the internal account; Customer Portal users of the customer on a customer account.',
    },
    { key: 'revision', source: 'Revision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  payload: (values, editing) => ({
    ...(editing ? {} : { departmentUUID: values['departmentUUID'] }),
    responsibleUUID: values['responsibleUUID'],
    revision: values['revision'],
  }),
});

@Component({
  selector: 'app-hr-department-approvers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrDepartmentApproversPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
