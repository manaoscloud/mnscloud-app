import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const statuses = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

// Assignments are revoked individually through their audited lifecycle.
const billingModes = [
  { value: 'PREPAID', label: 'Prepaid' },
  { value: 'POSTPAID', label: 'Postpaid' },
];

const config = defineCrud({
  serverSidePagination: true,
  endpoint: 'system/pay/fee-plan-assignments',
  uuidField: 'PfaUUID',
  pageTitle: 'Pay — Fee Plan Assignments',
  bulkDelete: false,
  statusOptions: statuses,
  initialValues: { status: 1, billingMode: 'PREPAID', tenantUUID: '', planUUID: '', notes: '' },
  columns: [
    { id: 'tenant', label: 'Tenant', field: 'TenantEmail', kind: 'identity' },
    {
      id: 'plan',
      label: 'Fee plan',
      field: 'FeePlanName',
      kind: 'related',
      uuidField: 'PayFeePlanPfpUUID',
    },
    {
      id: 'mode',
      label: 'Billing mode',
      field: 'PfaBillingMode',
      options: billingModes,
    },
    { id: 'from', label: 'Effective from', field: 'PfaEffectiveFrom', kind: 'datetime' },
    { id: 'to', label: 'Effective to', field: 'PfaEffectiveTo', kind: 'datetime' },
    { id: 'status', label: 'Status', field: 'PfaStatus', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'PfaStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      disabledWhen: ({ editing }) => !editing,
    },
    {
      key: 'tenantUUID',
      remoteLookup: {
        endpoint: 'system/billing/tenants',
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
      },
      source: 'UserUsrUUID',
      label: 'Tenant',
      type: 'search-select',
      quickCreate: false,
      quickCreateExemptReason: 'Tenants are provisioned through onboarding; there is no in-place create form.',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'planUUID',
      remoteLookup: {
        endpoint: 'system/pay/fee-plans',
        uuidField: 'PfpUUID',
        labelField: 'PfpName',
        selectedLabelField: 'FeePlanName',
      },
      source: 'PayFeePlanPfpUUID',
      label: 'Fee plan',
      type: 'search-select',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'billingMode',
      source: 'PfaBillingMode',
      label: 'Billing mode',
      type: 'select',
      span: 1,
      options: billingModes,
    },
    {
      key: 'effectiveFrom',
      source: 'PfaEffectiveFrom',
      label: 'Effective from (UTC)',
      type: 'datetime',
      fromRecord: (v: unknown) =>
        String(v ?? '')
          .replace(' ', 'T')
          .slice(0, 16),
      span: 1,
    },
    {
      key: 'effectiveTo',
      source: 'PfaEffectiveTo',
      label: 'Effective to (UTC)',
      type: 'datetime',
      fromRecord: (v: unknown) =>
        String(v ?? '')
          .replace(' ', 'T')
          .slice(0, 16),
      span: 1,
    },
    { key: 'notes', source: 'PfaNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
  ],
});

@Component({
  selector: 'app-fee-plan-assignments',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemPayFeePlanAssignmentsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
