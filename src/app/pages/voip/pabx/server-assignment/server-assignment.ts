import { Component, inject, signal } from '@angular/core';
import { ApiService } from '../../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const config: ConfigurableCrudConfig = {
  endpoint: 'system/voip/pabx/servers/assignments',
  uuidField: 'VasUUID',
  pageTitle: 'PABX server assignments',
  pageDescription: 'Assign platform PABX servers to tenants.',
  createTitle: 'New PABX server assignment',
  editTitle: 'Edit PABX server assignment',
  dialogDescription: 'Select the tenant and server. Disable an assignment to revoke access.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No PABX server assignments found.',
  deleteTitle: 'Delete PABX server assignment',
  deleteMessage: 'Delete this PABX server assignment?',
  deleteSelectedTitle: 'Delete PABX server assignments',
  deleteSelectedMessage: 'Delete {count} PABX server assignments?',
  savedMessage: 'PABX server assignment saved successfully.',
  deletedMessage: 'PABX server assignment deleted successfully.',
  deleteFailedMessage: 'Failed to delete PABX server assignment.',
  statusMode: 'number', activeValue: 1, inactiveValue: 0,
  statusFilter: true, bulkDelete: false,
  statusOptions: [{ value: 1, label: 'Active' }, { value: 0, label: 'Inactive' }],
  initialValues: { status: 1, environmentUUID: '', serverUUID: '' },
  columns: [
    { id: 'tenant', label: 'Tenant', field: 'TenantName' },
    { id: 'server', label: 'Server', field: 'VpsName' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VasStatus' },
  ],
  fields: [
    { key: 'status', source: 'VasStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'environmentUUID', source: 'UserUsrUUID', label: 'Tenant', type: 'search-select', required: true, span: 1, disabledWhen: ({ editing }) => editing },
    { key: 'serverUUID', source: 'VoipPabxServerVpsUUID', label: 'Server', type: 'search-select', required: true, span: 1, disabledWhen: ({ editing }) => editing },
  ],
};

@Component({
  selector: 'app-voip-pabx-server-assignment',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxServerAssignmentPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly lookupApi = inject(ApiService);
  private readonly tenants = signal<ConfigurableCrudOption[]>([]);
  private readonly servers = signal<ConfigurableCrudOption[]>([]);

  constructor() {
    super(config);
    void this.loadOptions();
  }

  override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'environmentUUID') return this.tenants();
    if (key === 'serverUUID') return this.servers();
    return super.lookupOptions(key);
  }

  private async loadOptions(): Promise<void> {
    try {
      const [tenants, servers] = await Promise.all([
        this.lookupApi.get<any>('system/billing/tenants?limit=5000'),
        this.lookupApi.get<any>('system/voip/pabx/servers?limit=5000'),
      ]);
      this.tenants.set((tenants?.data?.items ?? []).map((row: any) => ({
        value: row.EnvironmentUUID,
        label: row.EnvironmentName || row.TenantEmail || row.EnvironmentUUID,
        searchText: `${row.EnvironmentName ?? ''} ${row.TenantEmail ?? ''}`,
      })));
      this.servers.set((servers?.data?.items ?? []).map((row: any) => ({
        value: row.VpsUUID, label: row.VpsName || row.VpsUUID,
      })));
    } catch {
      // ApiService displays the translated request failure through the shared interceptor.
    }
  }
}
