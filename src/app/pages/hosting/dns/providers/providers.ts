import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openDataViewerDialog } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';

type HostingDnsProviderCredentialField =
  'apiEndpoint' | 'accessKey' | 'secret' | 'region' | 'hostedZoneID' | 'defaultTtl' | 'verifyTls';

type HostingDnsProviderCatalogItem = {
  value: string;
  label: string;
  supportsApi: boolean;
  supportsDns: boolean;
  supportsRegistration: boolean;
  credentialFields?: HostingDnsProviderCredentialField[];
  requiredCredentialFields?: HostingDnsProviderCredentialField[];
};

type HostingDnsProviderTestResult = {
  providerUUID: string;
  provider: string;
  providerName: string;
  status: 'success' | 'warning' | 'error' | 'skipped';
  supported: boolean;
  checkedAt: string;
  endpoint?: string | null;
  hostedZoneID?: string | null;
  message: string;
  checks: {
    name: string;
    status: 'success' | 'warning' | 'error' | 'skipped';
    message: string;
    details?: Record<string, unknown>;
  }[];
};

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const SCOPE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'TENANT', label: 'Tenant' },
  { value: 'MASTER', label: 'Master' },
];

type HostingDnsDomainTemplateItem = {
  HdtUUID: string;
  HdtName: string;
  HdtCode?: string | null;
  HdtScope?: string | null;
};

const TEST_PROVIDER_ACTION: ConfigurableCrudRowAction = {
  key: 'test',
  label: 'Test',
  icon: 'network_check',
  tooltip: 'Test provider connection',
};

const HOSTING_DNS_PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/dns/providers',
  uuidField: 'HdpUUID',
  pageTitle: 'DNS Providers',
  pageDescription: 'Manage DNS provider accounts used by tenant domains.',
  createTitle: 'New domain provider',
  editTitle: 'Edit domain provider',
  dialogDescription: 'Configure DNS provider identity, credentials and behavior.',
  searchPlaceholder: 'Name or platform',
  emptyLabel: 'No domain providers found.',
  deleteTitle: 'Delete domain provider',
  deleteMessage: 'Are you sure you want to delete this domain provider?',
  deleteSelectedTitle: 'Delete selected domain providers',
  deleteSelectedMessage: 'Delete {count} selected domain providers?',
  savedMessage: 'Domain provider saved successfully.',
  deletedMessage: 'Domain provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete domain provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  rowActions: [TEST_PROVIDER_ACTION],
  listFilters: [
    {
      key: 'provider',
      label: 'Platform',
      paramKey: 'provider',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: {
    authentication: 'Credentials',
    notes: 'Notes',
  },
  initialValues: {
    name: '',
    scope: 'TENANT',
    provider: 'manual',
    isDefault: 0,
    status: 1,
    apiEndpoint: '',
    accessKey: '',
    secret: '',
    region: '',
    hostedZoneID: '',
    defaultTtl: null,
    verifyTls: 1,
    templateUUID: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HdpName', uuidField: 'HdpUUID' },
    { id: 'scope', label: 'Scope', field: 'HdpScope', lookupKey: 'scope' },
    {
      id: 'provider',
      label: 'Platform',
      kind: 'related',
      field: 'HdpProvider',
      lookupKey: 'provider',
    },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HdpIsDefault',
      className: 'status-col',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HdpStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HdpStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'provider',
      source: 'HdpProvider',
      payloadKey: 'provider',
      label: 'Platform',
      type: 'search-select',
      span: 1,
      required: true,
    },
    {
      key: 'templateUUID',
      source: 'HostingDnsDomainTemplateHdtUUID',
      payloadKey: 'templateUUID',
      label: 'Default DNS template',
      type: 'search-select',
      placeholder: 'Search',
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HdpIsDefault',
      payloadKey: 'isDefault',
      label: 'Default provider',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    {
      key: 'name',
      source: 'HdpName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'ROUTE53 MAIN',
      required: true,
      span: 1,
    },
    {
      key: 'apiEndpoint',
      source: 'HdpApiEndpoint',
      payloadKey: 'apiEndpoint',
      label: 'API endpoint',
      labelWhen: ({ values }) => providerFieldLabel('apiEndpoint', values['provider']),
      placeholder: 'https://dns.example.com:2087',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('apiEndpoint', values['provider']),
      requiredWhen: ({ values }) => providerRequiresField('apiEndpoint', values['provider']),
    },
    {
      key: 'accessKey',
      source: 'HdpAccessKey',
      payloadKey: 'accessKey',
      label: 'Access key',
      labelWhen: ({ values }) => providerFieldLabel('accessKey', values['provider']),
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('accessKey', values['provider']),
      requiredWhen: ({ values }) => providerRequiresField('accessKey', values['provider']),
    },
    {
      key: 'secret',
      payloadKey: 'secret',
      label: 'Secret / API token',
      labelWhen: ({ values }) => providerFieldLabel('secret', values['provider']),
      type: 'password',
      placeholder: 'Leave blank to keep the current token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('secret', values['provider']),
      requiredWhen: ({ editing, values }) =>
        !editing && providerRequiresField('secret', values['provider']),
    },
    {
      key: 'region',
      source: 'HdpRegion',
      payloadKey: 'region',
      label: 'Region',
      placeholder: 'us-east-1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('region', values['provider']),
      requiredWhen: ({ values }) => providerRequiresField('region', values['provider']),
    },
    {
      key: 'hostedZoneID',
      source: 'HdpHostedZoneID',
      payloadKey: 'hostedZoneID',
      label: 'Hosted zone ID',
      labelWhen: ({ values }) => providerFieldLabel('hostedZoneID', values['provider']),
      placeholder: 'Z1234567890',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('hostedZoneID', values['provider']),
      requiredWhen: ({ values }) => providerRequiresField('hostedZoneID', values['provider']),
    },
    {
      key: 'defaultTtl',
      source: 'HdpDefaultTtl',
      payloadKey: 'defaultTtl',
      label: 'Default TTL',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('defaultTtl', values['provider']),
      requiredWhen: ({ values }) => providerRequiresField('defaultTtl', values['provider']),
    },
    {
      key: 'verifyTls',
      source: 'HdpVerifyTls',
      payloadKey: 'verifyTls',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !providerUsesField('verifyTls', values['provider']),
    },
    {
      key: 'notes',
      source: 'HdpNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-hosting-dns-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingDnsProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly catalog = signal<HostingDnsProviderCatalogItem[]>([]);
  private readonly templates = signal<HostingDnsDomainTemplateItem[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.catalog().map((item) => ({
      value: item.value,
      label: item.label,
      description: providerCatalogDescription(item),
      searchText: `${item.value} ${item.label}`,
    })),
  );
  private readonly templateOptions = computed<ConfigurableCrudOption[]>(() =>
    this.templates().map((item) => ({
      value: item.HdtUUID,
      label: item.HdtName,
      description: item.HdtCode || item.HdtScope || undefined,
      searchText: `${item.HdtName} ${item.HdtCode ?? ''} ${item.HdtScope ?? ''}`,
    })),
  );

  constructor() {
    super(HOSTING_DNS_PROVIDER_CONFIG);
    void this.fetchCatalog();
    void this.fetchTemplates();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.catalog().length) await this.fetchCatalog();
    if (!this.templates().length) await this.fetchTemplates();
    return super.fetchItems(filters);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'provider') return this.providerOptions();
    if (key === 'templateUUID') return this.templateOptions();
    if (key === 'scope') return SCOPE_OPTIONS;
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const provider = String(payload['provider'] ?? 'manual');

    return {
      name: payload['name'],
      scope: this.isMaster() ? 'MASTER' : 'TENANT',
      provider,
      apiEndpoint: providerUsesField('apiEndpoint', provider) ? payload['apiEndpoint'] : null,
      accessKey: providerUsesField('accessKey', provider) ? payload['accessKey'] : null,
      secret: providerUsesField('secret', provider) ? payload['secret'] : null,
      region: providerUsesField('region', provider) ? payload['region'] : null,
      hostedZoneID: providerUsesField('hostedZoneID', provider) ? payload['hostedZoneID'] : null,
      defaultTtl: providerUsesField('defaultTtl', provider) ? payload['defaultTtl'] : null,
      verifyTls: providerUsesField('verifyTls', provider) ? truthyNumber(payload['verifyTls']) : 1,
      templateUUID: payload['templateUUID'] || null,
      isDefault: truthyNumber(payload['isDefault']),
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'test') await this.testProvider(row);
  }

  private async fetchCatalog() {
    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsProviderCatalogItem[] } }>(
        `${HOSTING_DNS_PROVIDER_CONFIG.endpoint}/catalog`,
      );
      const items = response?.data?.items ?? [];
      this.catalog.set(items.length ? items : fallbackCatalog());
    } catch (error) {
      this.catalog.set(fallbackCatalog());
      this.snack.error(this.errorMessage(error) || 'Failed to load provider catalog.');
    }
  }

  private async fetchTemplates() {
    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsDomainTemplateItem[] } }>(
        'hosting/dns/templates?status=1&limit=500&offset=0',
      );
      this.templates.set(response?.data?.items ?? []);
    } catch (error) {
      this.templates.set([]);
      this.snack.error(this.errorMessage(error) || 'Failed to load DNS templates.');
    }
  }

  private async testProvider(provider: ConfigurableCrudRecord) {
    const providerUUID = String(provider['HdpUUID'] ?? '');
    if (!providerUUID) return;

    this.mutating.set(true);
    try {
      const response = await this.api.post<{
        data?: { test?: HostingDnsProviderTestResult };
      }>(`${HOSTING_DNS_PROVIDER_CONFIG.endpoint}/${providerUUID}/test`, {});
      const test = response?.data?.test;
      if (!test) {
        this.snack.warning(this.t('DNS provider test returned no details.'));
        return;
      }

      if (test.status === 'success') {
        this.snack.success(this.t('DNS provider test completed successfully.'));
      } else if (test.status === 'warning' || test.status === 'skipped') {
        this.snack.warning(this.t('DNS provider test completed with warnings.'));
      } else {
        this.snack.error(this.t('DNS provider test failed.'));
      }

      openDataViewerDialog(this.dialog, {
        title: 'DNS provider test',
        description: 'Read-only communication test for the selected DNS provider.',
        status: {
          value: testStatusLabel(test.status),
          tone: testStatusTone(test.status),
        },
        details: [
          {
            label: 'Provider',
            value: this.lookupLabel('provider', test.provider) || test.provider,
          },
          { label: 'Name', value: test.providerName },
          { label: 'Supported', value: test.supported ? 'Yes' : 'No', translate: true },
          { label: 'Checked at', value: test.checkedAt, kind: 'datetime' },
          { label: 'Endpoint', value: test.endpoint ?? '-' },
          { label: 'Hosted zone ID', value: test.hostedZoneID ?? '-' },
        ],
        sections: [
          {
            title: 'Checks',
            table: {
              columns: [
                { key: 'name', label: 'Check', translate: true },
                { key: 'status', label: 'Status', translate: true },
                { key: 'message', label: 'Message', translate: true },
              ],
              rows: test.checks.map((check) => ({
                name: check.name,
                status: testStatusLabel(check.status),
                message: check.message,
              })),
              emptyLabel: 'No records found.',
            },
          },
          {
            title: 'Raw result',
            code: {
              value: test,
              format: 'json',
              copy: true,
              download: {
                filename: `dns-provider-test-${providerUUID}.json`,
                label: 'Download',
                mimeType: 'application/json',
              },
            },
          },
        ],
      });
    } catch (error) {
      this.snack.error(this.errorMessage(error) || 'DNS provider test failed.');
    } finally {
      this.mutating.set(false);
    }
  }
}

function providerCatalogDescription(item: HostingDnsProviderCatalogItem): string {
  const capabilities = [
    item.supportsApi ? 'API' : '',
    item.supportsDns ? 'DNS' : '',
    item.supportsRegistration ? 'Registration' : '',
  ].filter(Boolean);
  return capabilities.join(' / ');
}

function providerUsesField(field: HostingDnsProviderCredentialField, provider: unknown): boolean {
  return fallbackCredentialFields(String(provider ?? 'manual')).includes(field);
}

function providerRequiresField(
  field: HostingDnsProviderCredentialField,
  provider: unknown,
): boolean {
  return fallbackRequiredCredentialFields(String(provider ?? 'manual')).includes(field);
}

function providerFieldLabel(field: HostingDnsProviderCredentialField, provider: unknown): string {
  const normalizedProvider = String(provider ?? 'manual');
  if (normalizedProvider === 'route53') {
    const labels: Partial<Record<HostingDnsProviderCredentialField, string>> = {
      accessKey: 'AWS access key ID',
      secret: 'AWS secret access key',
      hostedZoneID: 'Hosted zone ID',
    };
    return labels[field] ?? genericProviderFieldLabel(field);
  }

  if (normalizedProvider === 'cpanel_dnsonly') {
    const labels: Partial<Record<HostingDnsProviderCredentialField, string>> = {
      apiEndpoint: 'WHM API endpoint',
      accessKey: 'WHM user',
      secret: 'WHM API token',
    };
    return labels[field] ?? genericProviderFieldLabel(field);
  }

  return genericProviderFieldLabel(field);
}

function genericProviderFieldLabel(field: HostingDnsProviderCredentialField): string {
  const labels: Record<HostingDnsProviderCredentialField, string> = {
    apiEndpoint: 'API endpoint',
    accessKey: 'Access key',
    secret: 'Secret / API token',
    region: 'Region',
    hostedZoneID: 'Hosted zone ID',
    defaultTtl: 'Default TTL',
    verifyTls: 'Verify TLS',
  };
  return labels[field];
}

function fallbackCredentialFields(provider: string): HostingDnsProviderCredentialField[] {
  switch (provider) {
    case 'route53':
      return ['accessKey', 'secret', 'region', 'hostedZoneID', 'defaultTtl'];
    case 'cpanel_dnsonly':
      return ['apiEndpoint', 'accessKey', 'secret', 'defaultTtl', 'verifyTls'];
    case 'manual':
    case 'google_domains':
      return ['defaultTtl'];
    case 'cloudflare':
      return ['secret', 'defaultTtl', 'verifyTls'];
    case 'godaddy':
    case 'locaweb':
    case 'hostinger':
      return ['accessKey', 'secret', 'defaultTtl'];
    case 'namecheap':
      return ['apiEndpoint', 'accessKey', 'secret'];
    case 'hostgator':
    case 'kinghost':
    case 'bluehost':
      return ['apiEndpoint', 'accessKey', 'secret', 'defaultTtl', 'verifyTls'];
    case 'registro_br':
    case 'enom':
    case 'resellerclub':
      return ['accessKey', 'secret'];
    default:
      return [
        'apiEndpoint',
        'accessKey',
        'secret',
        'region',
        'hostedZoneID',
        'defaultTtl',
        'verifyTls',
      ];
  }
}

function fallbackRequiredCredentialFields(provider: string): HostingDnsProviderCredentialField[] {
  switch (provider) {
    case 'route53':
      return ['accessKey', 'secret', 'hostedZoneID'];
    case 'cpanel_dnsonly':
      return ['apiEndpoint', 'accessKey', 'secret'];
    case 'manual':
    case 'google_domains':
    case 'hostgator':
    case 'kinghost':
    case 'bluehost':
      return [];
    case 'cloudflare':
      return ['secret'];
    case 'namecheap':
    case 'godaddy':
    case 'locaweb':
    case 'hostinger':
    case 'registro_br':
    case 'enom':
    case 'resellerclub':
      return ['accessKey', 'secret'];
    default:
      return [];
  }
}

function fallbackCatalog(): HostingDnsProviderCatalogItem[] {
  return [
    'registro_br',
    'cloudflare',
    'godaddy',
    'namecheap',
    'enom',
    'resellerclub',
    'hostgator',
    'locaweb',
    'kinghost',
    'hostinger',
    'bluehost',
    'route53',
    'cpanel_dnsonly',
    'google_domains',
    'manual',
  ].map((value) => ({
    value,
    label: value,
    supportsApi: value !== 'manual',
    supportsDns: true,
    supportsRegistration: false,
    credentialFields: fallbackCredentialFields(value),
    requiredCredentialFields: fallbackRequiredCredentialFields(value),
  }));
}

function truthyNumber(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function testStatusLabel(status: HostingDnsProviderTestResult['status']): string {
  const labels: Record<HostingDnsProviderTestResult['status'], string> = {
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    skipped: 'Skipped',
  };
  return labels[status] ?? status;
}

function testStatusTone(status: HostingDnsProviderTestResult['status']) {
  if (status === 'success') return 'success';
  if (status === 'warning') return 'warning';
  if (status === 'error') return 'danger';
  return 'neutral';
}
