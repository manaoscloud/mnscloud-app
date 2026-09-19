import { Component, computed } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  WEBHOST_PROVIDER_OPTIONS,
  YES_NO_OPTIONS,
  asRecord,
  normalizeString,
  truthyNumber,
} from '../webhost-shared';

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'system/hosting/webhost/providers',
  uuidField: 'HwpUUID',
  pageTitle: 'Webhost Providers',
  pageDescription: 'Manage cPanel/WHM panels and credentials. Master-only administration.',
  createTitle: 'New webhost provider',
  editTitle: 'Edit webhost provider',
  dialogDescription: 'Configure provider identity, panel host and API credentials.',
  searchPlaceholder: 'Name, hostname or username',
  emptyLabel: 'No webhost providers found.',
  deleteTitle: 'Delete webhost provider',
  deleteMessage: 'Are you sure you want to delete this webhost provider?',
  deleteSelectedTitle: 'Delete selected webhost providers',
  deleteSelectedMessage: 'Delete {count} selected webhost providers?',
  savedMessage: 'Webhost provider saved successfully.',
  deletedMessage: 'Webhost provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete webhost provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  authenticationTabAfterRecord: true,
  tabLabels: {
    authentication: 'Credentials',
    notes: 'Notes',
  },
  rowActions: [VALIDATE_ACTION],
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
    provider: 'cpanel_whm',
    status: 1,
    isDefault: 0,
    hostname: '',
    port: 2087,
    username: '',
    apiToken: '',
    sslVerify: 1,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HwpName', uuidField: 'HwpUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HwpProvider',
      lookupKey: 'provider',
    },
    { id: 'host', label: 'Host', field: 'ProviderHostLabel' },
    { id: 'username', label: 'Username', field: 'ProviderUsernameLabel' },
    {
      id: 'default',
      label: 'Default',
      kind: 'boolean',
      field: 'HwpIsDefault',
      className: 'status-col',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'HwpIsActive', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'HwpIsActive',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'provider',
      source: 'HwpProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
      translateOptions: false,
    },
    {
      key: 'isDefault',
      source: 'HwpIsDefault',
      payloadKey: 'isDefault',
      label: 'Default provider',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'HwpName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'hostname',
      payloadKey: 'hostname',
      label: 'Hostname',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'port',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'sslVerify',
      payloadKey: 'sslVerify',
      label: 'Verify TLS',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'username',
      payloadKey: 'username',
      label: 'Username',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'apiToken',
      payloadKey: 'apiToken',
      label: 'API token',
      type: 'password',
      placeholder: 'Leave blank to keep the current API token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 1,
      requiredWhen: ({ editing }) => !editing,
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
  selector: 'app-hosting-webhost-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingWebhostProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly endpoint = computed(() => 'system/hosting/webhost/providers');

  constructor() {
    super(PROVIDER_CONFIG);
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
    if (key === 'provider') return WEBHOST_PROVIDER_OPTIONS;
    return [];
  }

  protected override async fetchItems(
    filters: ConfigurableCrudFilters,
  ) {
    const items = await super.fetchItems(filters);
    return items.map((item) => {
      const config = asRecord(item['HwpConfig']);
      const credentials = asRecord(item['credentials']);
      const hostname = String(config['hostname'] ?? '');
      const port = Number(config['port'] ?? 2087);
      return {
        ...item,
        ProviderHostLabel: hostname ? `${hostname}:${port}` : '-',
        ProviderUsernameLabel: String(credentials['username'] ?? '-'),
      };
    });
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HwpConfig']);
    const credentials = asRecord(row['credentials']);
    return {
      ...super.formValuesFromRecord(row),
      provider: String(row['HwpProvider'] ?? 'cpanel_whm') || 'cpanel_whm',
      isDefault: truthyNumber(row['HwpIsDefault']),
      status: truthyNumber(row['HwpIsActive']),
      hostname: String(config['hostname'] ?? ''),
      port: Number(config['port'] ?? 2087),
      sslVerify: config['sslVerify'] === false ? 0 : 1,
      notes: String(config['notes'] ?? ''),
      username: String(credentials['username'] ?? ''),
      apiToken: '',
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const port = Number(payload['port'] ?? 0);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.snack.warning(this.t('Port must be between 1 and 65535.'));
      return false;
    }
    if (!this.editingRecord() && !String(payload['apiToken'] ?? '').trim()) {
      this.snack.warning(this.t('API token is required for new providers.'));
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const credentials = cleanCredentials({
      username: normalizeString(payload['username']),
      apiToken: normalizeString(payload['apiToken']),
    });
    return {
      name: payload['name'],
      provider: 'cpanel_whm',
      config: {
        hostname: normalizeString(payload['hostname']),
        port: Number(payload['port'] || 2087),
        sslVerify: truthyNumber(payload['sslVerify']) === 1,
        notes: normalizeString(payload['notes']),
      },
      ...(credentials ? { credentials } : {}),
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HwpUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('Webhost provider validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate webhost provider.'));
    } finally {
      this.mutating.set(false);
    }
  }
}

function cleanCredentials(
  value: Record<string, string | null>,
): Record<string, string> | null {
  const cleaned = Object.fromEntries(
    Object.entries(value).filter(([, item]) => Boolean(item)),
  ) as Record<string, string>;
  return Object.keys(cleaned).length ? cleaned : null;
}
