import { Component, inject, resource } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudOption,
  ConfigurableCrudConfig,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const statuses = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

// Assignments are revoked individually through their audited lifecycle.
const config = defineCrud({
  endpoint: 'system/pay/fee-plan-assignments',
  uuidField: 'BpaUUID',
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
      uuidField: 'BillingFeePlanBfpUUID',
    },
    {
      id: 'mode',
      label: 'Billing mode',
      field: 'BpaBillingMode',
      options: [
        { value: 'PREPAID', label: 'Prepaid' },
        { value: 'POSTPAID', label: 'Postpaid' },
      ],
    },
    { id: 'status', label: 'Status', field: 'BpaStatus', kind: 'status' },
  ],
  fields: [
    {
      key: 'status',
      source: 'BpaStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      disabledWhen: ({ editing }) => !editing,
    },
    {
      key: 'tenantUUID',
      source: 'UserUsrUUID',
      label: 'Tenant',
      type: 'search-select',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'planUUID',
      source: 'BillingFeePlanBfpUUID',
      label: 'Fee plan',
      type: 'search-select',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'billingMode',
      source: 'BpaBillingMode',
      label: 'Billing mode',
      type: 'select',
      span: 1,
      options: [
        { value: 'PREPAID', label: 'Prepaid' },
        { value: 'POSTPAID', label: 'Postpaid' },
      ],
    },
    { key: 'notes', source: 'BpaNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
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

  private readonly lookupApi = inject(ApiService);
  private readonly tenants = resource({
    defaultValue: [] as ConfigurableCrudRecord[],
    loader: async () => {
      const items: ConfigurableCrudRecord[] = [];
      for (let offset = 0; ; offset += 50) {
        const page =
          (await this.lookupApi.get<any>(`system/billing/tenants?limit=50&offset=${offset}`))?.data
            ?.items ?? [];
        items.push(...page);
        if (page.length < 50) return items;
      }
    },
  });
  private readonly plans = resource({
    defaultValue: [] as ConfigurableCrudRecord[],
    loader: async () =>
      (await this.lookupApi.get<any>('system/pay/fee-plans?limit=5000'))?.data?.items ?? [],
  });
  override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'tenantUUID')
      return this.tenants.value().map((r: ConfigurableCrudRecord) => ({
        value: String(r['EnvironmentUUID']),
        label: String(r['EnvironmentName'] ?? r['TenantEmail'] ?? r['EnvironmentUUID']),
      }));
    if (key === 'planUUID')
      return this.plans.value().map((r: ConfigurableCrudRecord) => ({
        value: String(r['BfpUUID']),
        label: String(r['BfpName']),
      }));
    return super.lookupOptions(key);
  }
}
