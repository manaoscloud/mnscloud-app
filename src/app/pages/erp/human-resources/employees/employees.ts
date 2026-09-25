import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';

const lookups = [
  { key: 'companyUUID', endpoint: 'erp/companies', uuidField: 'CompanyUUID' },
  {
    key: 'departmentUUID',
    endpoint: 'erp/human-resources/departments',
    uuidField: 'DepartmentUUID',
  },
  { key: 'positionUUID', endpoint: 'erp/human-resources/positions', uuidField: 'PositionUUID' },
] as const;

const config = defineCrud({
  endpoint: 'erp/human-resources/employees',
  uuidField: 'EmployeeUUID',
  pageTitle: 'Employees',
  pageDescription: 'Manage employee records, company links, departments and positions.',
  bulkDelete: true,
  initialValues: {
    status: 1,
    name: '',
    document: '',
    email: '',
    phone: '',
    companyUUID: '',
    departmentUUID: '',
    positionUUID: '',
    hireDate: null,
    terminationDate: null,
    notes: '',
  },
  listFilters: [
    { key: 'companyUUID', label: 'Company', type: 'search-select', span: 1 },
    { key: 'departmentUUID', label: 'Department', type: 'search-select', span: 1 },
    { key: 'positionUUID', label: 'Position', type: 'search-select', span: 1 },
  ],
  columns: [
    { id: 'name', label: 'Name', field: 'Name', uuidField: 'EmployeeUUID', kind: 'identity' },
    { id: 'email', label: 'Email', field: 'Email' },
    { id: 'company', label: 'Company', field: 'CompanyName' },
    { id: 'department', label: 'Department', field: 'DepartmentName' },
    { id: 'position', label: 'Position', field: 'PositionName' },
    { id: 'status', label: 'Status', field: 'Status', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
    { key: 'document', source: 'Document', label: 'Document', span: 1 },
    { key: 'email', source: 'Email', label: 'Email', type: 'email', span: 1 },
    { key: 'phone', source: 'Phone', label: 'Phone', type: 'phone', span: 1 },
    {
      key: 'companyUUID',
      source: 'CompanyUUID',
      label: 'Company',
      type: 'search-select',
      remoteLookup: { endpoint: 'erp/companies', uuidField: 'CompanyUUID', labelField: 'Name' },
      quickCreate: quickCreateFor('ErpCompanyComUUID'),
      span: 1,
    },
    {
      key: 'departmentUUID',
      source: 'DepartmentUUID',
      label: 'Department',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'erp/human-resources/departments',
        uuidField: 'DepartmentUUID',
        labelField: 'Name',
      },
      quickCreate: quickCreateFor('ErpHrDepartmentEhdUUID'),
      span: 1,
    },
    {
      key: 'positionUUID',
      source: 'PositionUUID',
      label: 'Position',
      type: 'search-select',
      remoteLookup: {
        endpoint: 'erp/human-resources/positions',
        uuidField: 'PositionUUID',
        labelField: 'Name',
      },
      quickCreate: quickCreateFor('ErpHrPositionEhpUUID'),
      span: 1,
    },
    { key: 'hireDate', source: 'HireDate', label: 'Hire date', type: 'date', span: 1 },
    {
      key: 'terminationDate',
      source: 'TerminationDate',
      label: 'Termination date',
      type: 'date',
      span: 1,
    },
    {
      key: 'notes',
      source: 'Notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-erp-hr-employees',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ErpHumanResourcesEmployeesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly lookupApi = inject(ApiService);

  // List filter options for company, department and position (active records only).
  private readonly filterOptions = resource({
    defaultValue: {} as Record<string, ConfigurableCrudOption[]>,
    loader: async (): Promise<Record<string, ConfigurableCrudOption[]>> => {
      const entries = await Promise.all(
        lookups.map(async (lookup) => {
          const response = await this.lookupApi.get<{
            data?: { items?: ConfigurableCrudRecord[] };
          }>(`${lookup.endpoint}?status=1&limit=500&offset=0`);
          const options = (response?.data?.items ?? []).map((item): ConfigurableCrudOption => ({
            value: String(item[lookup.uuidField]),
            label: String(item['Name'] ?? item[lookup.uuidField]),
          }));
          return [lookup.key, options] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
  });

  constructor() {
    super(config);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return this.filterOptions.value()[key] ?? [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const nullable = (key: string) => (payload[key] ? payload[key] : null);
    return {
      ...payload,
      document: nullable('document'),
      email: nullable('email'),
      phone: nullable('phone'),
      companyUUID: nullable('companyUUID'),
      departmentUUID: nullable('departmentUUID'),
      positionUUID: nullable('positionUUID'),
      hireDate: nullable('hireDate'),
      terminationDate: nullable('terminationDate'),
      notes: nullable('notes'),
      status: Number(payload['status']),
    };
  }
}
