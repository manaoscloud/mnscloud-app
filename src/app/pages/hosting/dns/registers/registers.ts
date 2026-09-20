import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  hostingDnsRegistrarCatalogOptions,
  hostingDnsRegistrarLabel,
} from '../dns-register-catalog';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

type RegistrarCatalogItem = {
  code: string;
};

const HOSTING_DNS_REGISTER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/dns/registers',
  uuidField: 'HrgUUID',
  pageTitle: 'Registers',
  pageDescription: 'Track domain registrations, registrar metadata, and customer ownership.',
  createTitle: 'New register',
  editTitle: 'Edit register',
  dialogDescription: 'Store registered domain name, customer, registrar, and notes.',
  searchPlaceholder: 'Search by domain name',
  emptyLabel: 'No domain registers found.',
  deleteTitle: 'Delete register',
  deleteMessage:
    'Delete this domain register? Linked DNS zones or webhost hosts must be removed or reassigned first.',
  deleteSelectedTitle: 'Delete selected registers',
  deleteSelectedMessage: 'Delete {count} selected domain registers?',
  savedMessage: 'Domain register saved successfully.',
  deletedMessage: 'Domain register deleted successfully.',
  deleteFailedMessage: 'Failed to delete domain register.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  listFilters: [
    {
      key: 'registrar',
      label: 'Registrar',
      paramKey: 'registrar',
      type: 'search-select',
      placeholder: 'Search registrars',
      emptyLabel: 'No records found.',
    },
    {
      key: 'customerUUID',
      label: 'Customer',
      paramKey: 'customerUUID',
      type: 'search-select',
      placeholder: 'Search customers',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: { notes: 'Notes' },
  initialValues: {
    name: '',
    customerUUID: '',
    registrar: '',
    status: 1,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Domain', kind: 'identity', field: 'HrgName', uuidField: 'HrgUUID' },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      field: 'CustomerName',
      uuidField: 'CustomerCusUUID',
    },
    { id: 'registrar', label: 'Registrar', field: 'RegistrarLabel' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HrgStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HrgStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'registrar',
      source: 'HrgRegistrar',
      payloadKey: 'registrar',
      label: 'Registrar',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HrgName',
      payloadKey: 'name',
      label: 'Domain name',
      placeholder: 'example.com',
      required: true,
      span: 1,
    },
    {
      key: 'notes',
      source: 'HrgNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      placeholder: 'Optional notes',
    },
  ],
};

@Component({
  selector: 'app-hosting-dns-registers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingDnsRegistersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly customers = signal<CustomerOption[]>([]);
  private readonly registrarCodes = signal<string[]>(
    hostingDnsRegistrarCatalogOptions().map((item) => item.code),
  );
  private readonly customerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.customers().map((customer) => ({
      value: customer.CustomerUUID,
      label: customer.Name,
      description: customer.Document ?? undefined,
      searchText: [customer.Name, customer.Document].filter(Boolean).join(' '),
    })),
  );

  private readonly registrarOptions = computed<ConfigurableCrudOption[]>(() =>
    this.registrarCodes().map((code) => ({
      value: code,
      label: hostingDnsRegistrarLabel(code),
      searchText: `${hostingDnsRegistrarLabel(code)} ${code}`,
    })),
  );

  constructor() {
    super(HOSTING_DNS_REGISTER_CONFIG);
    void Promise.all([this.fetchCustomers(), this.fetchRegistrarCatalog()]);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.customers().length ? Promise.resolve() : this.fetchCustomers(),
      this.registrarCodes().length ? Promise.resolve() : this.fetchRegistrarCatalog(),
    ]);
    const rows = await super.fetchItems(filters);
    return rows.map((row) => ({
      ...row,
      RegistrarLabel: hostingDnsRegistrarLabel(String(row['HrgRegistrar'] ?? '')),
    }));
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'registrar') return this.registrarOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: String(payload['name'] ?? '').trim(),
      customerUUID: payload['customerUUID'],
      registrar: String(payload['registrar'] ?? '').trim().toLowerCase(),
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  private async fetchRegistrarCatalog() {
    try {
      const response = await this.api.get<{ data?: { items?: RegistrarCatalogItem[] } }>(
        'hosting/dns/registers/catalog',
      );
      const items = response?.data?.items ?? [];
      if (items.length) {
        this.registrarCodes.set(items.map((item) => String(item.code ?? '').toLowerCase()).filter(Boolean));
      }
    } catch {
      this.registrarCodes.set(hostingDnsRegistrarCatalogOptions().map((item) => item.code));
    }
  }

  private async fetchCustomers() {
    try {
      const response = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'erp/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(response?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'Failed to load customers.');
    }
  }
}
