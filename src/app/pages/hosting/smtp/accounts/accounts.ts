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

type HostingSmtpProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: string;
};

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/smtp/accounts',
  uuidField: 'HsaUUID',
  pageTitle: 'SMTP Accounts',
  pageDescription: 'Manage sender accounts linked to SMTP providers.',
  createTitle: 'New SMTP account',
  editTitle: 'Edit SMTP account',
  dialogDescription: 'Configure SMTP account identity, provider and sender defaults.',
  searchPlaceholder: 'Name, provider or sender',
  emptyLabel: 'No SMTP accounts found.',
  deleteTitle: 'Delete SMTP account',
  deleteMessage: 'Are you sure you want to delete this SMTP account?',
  deleteSelectedTitle: 'Delete selected SMTP accounts',
  deleteSelectedMessage: 'Delete {count} selected SMTP accounts?',
  savedMessage: 'SMTP account saved successfully.',
  deletedMessage: 'SMTP account deleted successfully.',
  deleteFailedMessage: 'Failed to delete SMTP account.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  rowActions: [VALIDATE_ACTION],
  listFilters: [
    {
      key: 'providerUuid',
      label: 'Provider',
      paramKey: 'providerUuid',
      type: 'search-select',
      placeholder: 'Search',
      emptyLabel: 'No records found.',
    },
  ],
  tabLabels: {
    authentication: 'Sender',
  },
  initialValues: {
    name: '',
    providerUuid: '',
    status: 1,
    isDefault: 0,
    defaultFromName: '',
    defaultFromEmail: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HsaName', uuidField: 'HsaUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HspName',
      uuidField: 'HostingSmtpProviderHspUUID',
    },
    { id: 'from', label: 'From', field: 'HsaDefaultFromEmail' },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'HsaIsDefault', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HsaIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HsaIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'providerUuid',
      source: 'HostingSmtpProviderHspUUID',
      payloadKey: 'providerUuid',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'isDefault',
      source: 'HsaIsDefault',
      payloadKey: 'isDefault',
      label: 'Default account',
      type: 'search-select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'HsaName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'defaultFromName',
      source: 'HsaDefaultFromName',
      payloadKey: 'defaultFromName',
      label: 'Default from name',
      tab: 'authentication',
      span: 2,
    },
    {
      key: 'defaultFromEmail',
      source: 'HsaDefaultFromEmail',
      payloadKey: 'defaultFromEmail',
      label: 'Default from email',
      type: 'email',
      tab: 'authentication',
      span: 2,
    },
  ],
};

@Component({
  selector: 'app-hosting-smtp-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingSmtpAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingSmtpProvider[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp' : 'hosting/smtp',
  );
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/accounts`);
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HspUUID,
      label: provider.HspName,
      description: provider.HspProvider,
      searchText: `${provider.HspName} ${provider.HspProvider} ${provider.HspUUID}`,
    })),
  );

  constructor() {
    super(ACCOUNT_CONFIG);
    void this.fetchProviders();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchProviders();
    return super.fetchItems(filters);
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
    if (key === 'providerUuid') return this.providerOptions();
    return [];
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    return String(row['HspProvider'] ?? '') === 'smtp' ? [VALIDATE_ACTION] : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      providerUuid: payload['providerUuid'],
      defaultFromName: payload['defaultFromName'],
      defaultFromEmail: payload['defaultFromEmail'],
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HsaUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('SMTP account validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate SMTP account.'));
    } finally {
      this.mutating.set(false);
    }
  }

  private async fetchProviders(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingSmtpProvider[] } }>(
        `${this.rootEndpoint()}/providers?limit=500&offset=0`,
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (error) {
      this.providers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load SMTP providers.'));
    }
  }
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}
