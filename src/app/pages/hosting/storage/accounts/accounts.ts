import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CONFIGURABLE_CRUD_IMPORTS, ConfigurableCrudPageBase, ConfigurableCrudRecord, ConfigurableCrudOption } from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'hosting/storage/accounts', uuidField: 'HsaUUID', pageTitle: 'Storage Accounts',
  pageDescription: 'Group customer buckets in commercial storage accounts.',
  dialogDescription: 'Set the account name, customer and status.',
  createTitle: 'New storage account', editTitle: 'Edit storage account',
  statusMode: 'number', activeValue: 1, inactiveValue: 0, statusFilter: true, bulkDelete: true,
  initialValues: { name: '', customerUuid: '', status: 1 },
  fields: [
    { key: 'status', source: 'HsaIsActive', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'HsaName', label: 'Name', required: true, span: 1 },
    { key: 'customerUuid', source: 'CustomerCusUUID', label: 'Customer', type: 'search-select', span: 1 },
  ],
  columns: [
    { id: 'name', field: 'HsaName', uuidField: 'HsaUUID', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'HsaIsActive', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-hosting-storage-accounts', standalone: true, imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly customers = signal<ConfigurableCrudOption[]>([]);
  constructor() { super(config); void this.loadCustomers(); }
  private endpoint(): string {
    return this.route.snapshot.data['scope'] === 'master' ? 'system/hosting/storage/accounts' : 'hosting/storage/accounts';
  }
  protected override listEndpoint(): string { return this.endpoint(); }
  protected override createEndpoint(): string { return this.endpoint(); }
  protected override updateEndpoint(): string { return this.endpoint(); }
  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string { return this.endpoint(); }
  protected override bulkDeleteEndpoint(): string { return `${this.endpoint()}/bulk`; }
  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'customerUuid' ? this.customers() : [];
  }
  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { name: payload['name'], customerUuid: payload['customerUuid'] || null, isActive: Number(payload['status']) === 1 };
  }
  private async loadCustomers(): Promise<void> {
    if (this.route.snapshot.data['scope'] === 'master') return;
    try {
      const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>('erp/customers?limit=500&offset=0');
      this.customers.set((response.data?.items ?? []).map((row) => ({ value: String(row['CusUUID']), label: String(row['CusName']) })));
    } catch (error) { this.snack.error(this.errorMessage(error)); }
  }
}
