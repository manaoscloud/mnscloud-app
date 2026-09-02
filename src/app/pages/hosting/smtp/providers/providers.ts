import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type SmtpProvider = 'smtp' | 'sendgrid' | 'ses' | 'mailersend';

const PROVIDER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'smtp', label: 'SMTP' },
  { value: 'sendgrid', label: 'Twilio SendGrid' },
  { value: 'ses', label: 'Amazon SES' },
  { value: 'mailersend', label: 'MailerSend' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const SECURE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'STARTTLS / Plain (587)' },
  { value: 1, label: 'Direct TLS / SSL (465)' },
];

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const PROVIDER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/smtp/providers',
  uuidField: 'HspUUID',
  pageTitle: 'SMTP Providers',
  pageDescription: 'Manage SMTP platforms and credentials.',
  createTitle: 'New SMTP provider',
  editTitle: 'Edit SMTP provider',
  dialogDescription: 'Configure SMTP provider identity, transport and credentials.',
  searchPlaceholder: 'Name or provider',
  emptyLabel: 'No SMTP providers found.',
  deleteTitle: 'Delete SMTP provider',
  deleteMessage: 'Are you sure you want to delete this SMTP provider?',
  deleteSelectedTitle: 'Delete selected SMTP providers',
  deleteSelectedMessage: 'Delete {count} selected SMTP providers?',
  savedMessage: 'SMTP provider saved successfully.',
  deletedMessage: 'SMTP provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete SMTP provider.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  authenticationTabAfterRecord: true,
  tabLabels: {
    authentication: 'Credentials',
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
    provider: 'smtp',
    status: 1,
    isDefault: 0,
    host: '',
    port: 587,
    secure: 0,
    username: '',
    password: '',
    apiKey: '',
    region: '',
    accessKeyId: '',
    secretAccessKey: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HspName', uuidField: 'HspUUID' },
    { id: 'provider', label: 'Provider', kind: 'related', field: 'HspProvider', lookupKey: 'provider' },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'HspIsDefault', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HspIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HspIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'provider',
      source: 'HspProvider',
      payloadKey: 'provider',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HspIsDefault',
      payloadKey: 'isDefault',
      label: 'Default provider',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'HspName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'host',
      source: 'HspHost',
      payloadKey: 'host',
      label: 'Host',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'smtp',
      requiredWhen: ({ values }) => provider(values['provider']) === 'smtp',
    },
    {
      key: 'port',
      source: 'HspPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'smtp',
      requiredWhen: ({ values }) => provider(values['provider']) === 'smtp',
    },
    {
      key: 'secure',
      source: 'HspSecure',
      payloadKey: 'secure',
      label: 'Security',
      type: 'search-select',
      options: SECURE_OPTIONS,
      translateOptions: false,
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'smtp',
    },
    {
      key: 'username',
      source: 'HspUsername',
      payloadKey: 'username',
      label: 'Username',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'smtp',
      requiredWhen: ({ values }) => provider(values['provider']) === 'smtp',
    },
    {
      key: 'password',
      payloadKey: 'password',
      label: 'Password',
      type: 'password',
      placeholder: 'Leave blank to keep the current password',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'smtp',
      requiredWhen: ({ editing, values }) => !editing && provider(values['provider']) === 'smtp',
    },
    {
      key: 'apiKey',
      payloadKey: 'apiKey',
      label: 'API key',
      labelWhen: ({ values }) =>
        provider(values['provider']) === 'mailersend' ? 'API token' : 'API key',
      type: 'password',
      placeholder: 'Leave blank to keep the current token',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => !['sendgrid', 'mailersend'].includes(provider(values['provider'])),
      requiredWhen: ({ editing, values }) =>
        !editing && ['sendgrid', 'mailersend'].includes(provider(values['provider'])),
    },
    {
      key: 'region',
      payloadKey: 'region',
      label: 'Region',
      placeholder: 'us-east-1',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'ses',
      requiredWhen: ({ values }) => provider(values['provider']) === 'ses',
    },
    {
      key: 'accessKeyId',
      payloadKey: 'accessKeyId',
      label: 'Access key ID',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'ses',
      requiredWhen: ({ values }) => provider(values['provider']) === 'ses',
    },
    {
      key: 'secretAccessKey',
      payloadKey: 'secretAccessKey',
      label: 'Secret access key',
      type: 'password',
      placeholder: 'Leave blank to keep the current secret access key',
      autocomplete: 'new-password',
      tab: 'authentication',
      span: 2,
      hiddenWhen: ({ values }) => provider(values['provider']) !== 'ses',
      requiredWhen: ({ editing, values }) => !editing && provider(values['provider']) === 'ses',
    },
  ],
};

@Component({
  selector: 'app-hosting-smtp-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingSmtpProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp/providers' : PROVIDER_CONFIG.endpoint,
  );

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
    if (key === 'provider') return PROVIDER_OPTIONS;
    return [];
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return provider(row['HspProvider']) === 'smtp' ? [VALIDATE_ACTION] : [];
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'provider') return;
    const nextProvider = provider(value);
    const defaults = providerDefaults(nextProvider, true, this.formValues());
    this.patchFormValues(defaults);
  }

  protected override patchFormValues(values: ConfigurableCrudRecord): void {
    const normalized = { ...values };
    normalized['provider'] = provider(normalized['provider']);
    normalized['secure'] = truthyNumber(normalized['secure']);
    normalized['isDefault'] = truthyNumber(normalized['isDefault']);
    normalized['status'] = truthyNumber(normalized['status'] ?? normalized['isActive'] ?? 1);
    const config = normalized['HspConfig'];
    if (config && typeof config === 'object') {
      const itemConfig = config as Record<string, unknown>;
      normalized['host'] = normalized['host'] ?? itemConfig['host'] ?? '';
      normalized['port'] = normalized['port'] ?? itemConfig['port'] ?? defaultPort(provider(normalized['provider']));
      normalized['secure'] = truthyNumber(normalized['secure'] ?? itemConfig['secure']);
      normalized['username'] = normalized['username'] ?? itemConfig['username'] ?? '';
      normalized['region'] = normalized['region'] ?? itemConfig['region'] ?? '';
      normalized['accessKeyId'] = normalized['accessKeyId'] ?? itemConfig['accessKeyId'] ?? '';
    }
    super.patchFormValues({ ...providerDefaults(provider(normalized['provider']), false, normalized), ...normalized });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const selectedProvider = provider(payload['provider']);
    return {
      name: payload['name'],
      provider: selectedProvider,
      config: buildProviderConfig(selectedProvider, payload),
      credentials: buildProviderCredentials(selectedProvider, payload),
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HspUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('SMTP provider validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate SMTP provider.'));
    } finally {
      this.mutating.set(false);
    }
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    return super.fetchItems(filters);
  }
}

function provider(value: unknown): SmtpProvider {
  const normalized = String(value ?? 'smtp') as SmtpProvider;
  return ['smtp', 'sendgrid', 'ses', 'mailersend'].includes(normalized) ? normalized : 'smtp';
}

function defaultPort(value: SmtpProvider): number {
  return value === 'mailersend' ? 443 : 587;
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function providerDefaults(
  value: SmtpProvider,
  force: boolean,
  current: ConfigurableCrudRecord,
): ConfigurableCrudRecord {
  if (value === 'sendgrid') {
    return {
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: 0,
      username: 'apikey',
      ...(force ? { password: '', apiKey: '' } : {}),
    };
  }
  if (value === 'ses') {
    const region = String(current['region'] ?? '').trim();
    return {
      host: region ? `email-smtp.${region}.amazonaws.com` : '',
      port: 587,
      secure: 0,
    };
  }
  if (value === 'mailersend') {
    return {
      host: 'api.mailersend.com',
      port: 443,
      secure: 1,
      username: '',
      ...(force ? { apiKey: '' } : {}),
    };
  }
  return {
    port: force || !current['port'] ? 587 : current['port'],
    secure: force ? 0 : truthyNumber(current['secure']),
  };
}

function buildProviderConfig(
  value: SmtpProvider,
  payload: ConfigurableCrudRecord,
): Record<string, unknown> {
  if (value === 'sendgrid') {
    return { service: 'sendgrid', host: 'smtp.sendgrid.net', port: 587, secure: false };
  }
  if (value === 'ses') {
    const region = String(payload['region'] ?? '').trim();
    return {
      region,
      accessKeyId: String(payload['accessKeyId'] ?? '').trim(),
      host: `email-smtp.${region}.amazonaws.com`,
      port: 587,
      secure: false,
    };
  }
  if (value === 'mailersend') {
    return { service: 'mailersend', host: 'api.mailersend.com', port: 443, secure: true };
  }
  return {
    host: String(payload['host'] ?? '').trim(),
    port: Number(payload['port'] ?? 587),
    secure: truthyNumber(payload['secure']) === 1,
    username: String(payload['username'] ?? '').trim(),
  };
}

function buildProviderCredentials(
  value: SmtpProvider,
  payload: ConfigurableCrudRecord,
): Record<string, unknown> {
  if (value === 'sendgrid' || value === 'mailersend') {
    const apiKey = String(payload['apiKey'] ?? '').trim();
    return apiKey ? { apiKey } : {};
  }
  if (value === 'ses') {
    const secretAccessKey = String(payload['secretAccessKey'] ?? '').trim();
    return secretAccessKey ? { secretAccessKey } : {};
  }
  const password = String(payload['password'] ?? '').trim();
  return password ? { password } : {};
}
