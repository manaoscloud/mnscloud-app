import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type { HostingWebhostProvider } from '../webhost.types';
import { asRecord, normalizeString, numberOrNull, truthyNumber } from '../webhost-shared';

const PLAN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/hosting/webhost/plans',
  uuidField: 'HwlUUID',
  pageTitle: 'Webhost Plans',
  pageDescription: 'Manage commercial Webhost packages. Master-only administration.',
  createTitle: 'New webhost plan',
  editTitle: 'Edit webhost plan',
  dialogDescription: 'Configure plan identity, package limits and pricing.',
  searchPlaceholder: 'Name, provider or package',
  emptyLabel: 'No webhost plans found.',
  deleteTitle: 'Delete webhost plan',
  deleteMessage: 'Are you sure you want to delete this webhost plan?',
  deleteSelectedTitle: 'Delete selected webhost plans',
  deleteSelectedMessage: 'Delete {count} selected webhost plans?',
  savedMessage: 'Webhost plan saved successfully.',
  deletedMessage: 'Webhost plan deleted successfully.',
  deleteFailedMessage: 'Failed to delete webhost plan.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: {
    storage: 'Resources',
    financial: 'Pricing',
    notes: 'Notes',
  },
  listFilters: [
    {
      key: 'provider',
      label: 'Provider',
      paramKey: 'provider',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    name: '',
    providerUUID: '',
    packageName: '',
    diskMb: 0,
    bandwidthMb: 0,
    domains: 0,
    subdomains: 0,
    emailAccounts: 0,
    databases: 0,
    ftpAccounts: 0,
    price: 0,
    setupFee: 0,
    notes: '',
    status: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HwlName', uuidField: 'HwlUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'ProviderName',
      uuidField: 'HostingWebhostProviderHwpUUID',
    },
    { id: 'package', label: 'Package', field: 'HwlPackage' },
    { id: 'resources', label: 'Resources', field: 'PlanResourcesLabel' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'HwlPrice',
      currencyField: 'HwlCurrency',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwlIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HwlIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'providerUUID',
      source: 'HostingWebhostProviderHwpUUID',
      payloadKey: 'providerUUID',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    { key: 'name', source: 'HwlName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'packageName',
      source: 'HwlPackage',
      payloadKey: 'packageName',
      label: 'Package name',
      span: 1,
    },
    {
      key: 'diskMb',
      source: 'HwlDiskMb',
      payloadKey: 'diskMb',
      label: 'Disk (MB)',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'bandwidthMb',
      source: 'HwlBandwidthMb',
      payloadKey: 'bandwidthMb',
      label: 'Bandwidth (MB)',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'domains',
      source: 'HwlDomains',
      payloadKey: 'domains',
      label: 'Domains',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'subdomains',
      source: 'HwlSubdomains',
      payloadKey: 'subdomains',
      label: 'Subdomains',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'emailAccounts',
      source: 'HwlEmailAccounts',
      payloadKey: 'emailAccounts',
      label: 'Email accounts',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'databases',
      source: 'HwlDatabases',
      payloadKey: 'databases',
      label: 'Databases',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'ftpAccounts',
      source: 'HwlFtpAccounts',
      payloadKey: 'ftpAccounts',
      label: 'FTP accounts',
      type: 'number',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'price',
      source: 'HwlPrice',
      payloadKey: 'price',
      label: 'Price',
      type: 'number',
      required: true,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'setupFee',
      source: 'HwlSetupFee',
      payloadKey: 'setupFee',
      label: 'Setup fee',
      type: 'number',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'notes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 3,
    },
  ],
};

@Component({
  selector: 'app-hosting-webhost-plans',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostPlansPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly providers = signal<HostingWebhostProvider[]>([]);
  private readonly endpoint = computed(() => 'system/hosting/webhost/plans');
  private readonly providerEndpoint = computed(() => 'system/hosting/webhost/providers');
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers()
      .filter((provider) => provider.HwpIsActive === 1)
      .map((provider) => ({
        value: provider.HwpUUID,
        label: provider.HwpName,
        description: provider.HwpProvider,
        searchText: `${provider.HwpName} ${provider.HwpProvider} ${provider.HwpUUID}`,
      })),
  );

  constructor() {
    super(PLAN_CONFIG);
    void this.fetchProviders();
  }

  protected override listEndpoint(): string {
    return this.endpoint();
  }

  protected override createEndpoint(): string {
    return this.endpoint();
  }

  protected override updateEndpoint(): string {
    return this.endpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.endpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.endpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerUUID') return this.providerOptions();
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchProviders();
    const items = await super.fetchItems(filters);
    return items.map((item) => ({
      ...item,
      PlanResourcesLabel: resourcesLabel(item),
    }));
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HwlConfig']);
    return {
      ...super.formValuesFromRecord(row),
      status: truthyNumber(row['HwlIsActive']),
      packageName: String(row['HwlPackage'] ?? ''),
      diskMb: Number(row['HwlDiskMb'] ?? 0),
      bandwidthMb: Number(row['HwlBandwidthMb'] ?? 0),
      domains: Number(row['HwlDomains'] ?? 0),
      subdomains: Number(row['HwlSubdomains'] ?? 0),
      emailAccounts: Number(row['HwlEmailAccounts'] ?? 0),
      databases: Number(row['HwlDatabases'] ?? 0),
      ftpAccounts: Number(row['HwlFtpAccounts'] ?? 0),
      price: Number(row['HwlPrice'] ?? 0),
      setupFee: Number(row['HwlSetupFee'] ?? 0),
      notes: String(config['notes'] ?? ''),
    };
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      providerUUID: payload['providerUUID'],
      packageName: normalizeString(payload['packageName']),
      diskMb: numberOrNull(payload['diskMb']),
      bandwidthMb: numberOrNull(payload['bandwidthMb']),
      domains: numberOrNull(payload['domains']),
      subdomains: numberOrNull(payload['subdomains']),
      emailAccounts: numberOrNull(payload['emailAccounts']),
      databases: numberOrNull(payload['databases']),
      ftpAccounts: numberOrNull(payload['ftpAccounts']),
      price: Number(payload['price'] ?? 0),
      setupFee: numberOrNull(payload['setupFee']),
      config: { notes: normalizeString(payload['notes']) },
      isActive: truthyNumber(payload['status']) === 1,
    };
  }

  private async fetchProviders(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingWebhostProvider[] } }>(
        `${this.providerEndpoint()}?limit=500&offset=0&status=1`,
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (error) {
      this.providers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load webhost providers.'));
    }
  }
}

function resourcesLabel(item: ConfigurableCrudRecord): string {
  const disk = Number(item['HwlDiskMb'] ?? 0);
  const bandwidth = Number(item['HwlBandwidthMb'] ?? 0);
  const domains = Number(item['HwlDomains'] ?? 0);
  const parts = [
    disk ? `${formatMb(disk)} disk` : '',
    bandwidth ? `${formatMb(bandwidth)} traffic` : '',
    domains ? `${domains} domains` : '',
  ].filter(Boolean);
  return parts.join(' · ') || '-';
}

function formatMb(value: number): string {
  if (value >= 1024 && value % 1024 === 0) return `${value / 1024} GB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${value} MB`;
}
