import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

type HostingStorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProvider;
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
  endpoint: 'hosting/storage/accounts',
  uuidField: 'HsaUUID',
  pageTitle: 'Storage Accounts',
  pageDescription: 'Manage buckets and containers linked to storage providers.',
  createTitle: 'New storage account',
  editTitle: 'Edit storage account',
  dialogDescription: 'Configure storage account identity, provider and bucket settings.',
  searchPlaceholder: 'Name, provider or bucket',
  emptyLabel: 'No storage accounts found.',
  deleteTitle: 'Delete storage account',
  deleteMessage: 'Are you sure you want to delete this storage account?',
  deleteSelectedTitle: 'Delete selected storage accounts',
  deleteSelectedMessage: 'Delete {count} selected storage accounts?',
  savedMessage: 'Storage account saved successfully.',
  deletedMessage: 'Storage account deleted successfully.',
  deleteFailedMessage: 'Failed to delete storage account.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  tabLabels: {
    storage: 'Storage',
  },
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
  initialValues: {
    name: '',
    providerUuid: '',
    linkedProviderType: '',
    status: 1,
    isDefault: 0,
    bucket: '',
    container: '',
    publicBaseUrl: '',
    pathPrefix: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HsaName', uuidField: 'HsaUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HspName',
      uuidField: 'HostingStorageProviderHspUUID',
    },
    { id: 'bucket', label: 'Bucket', field: 'HsaBucketLabel' },
    { id: 'default', label: 'Default', kind: 'boolean', field: 'HsaIsDefault', className: 'status-col' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HsaIsActive', className: 'status-col' },
  ],
  fields: [
    { key: 'status', source: 'HsaIsActive', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    {
      key: 'providerUuid',
      source: 'HostingStorageProviderHspUUID',
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
      key: 'linkedProviderType',
      payloadKey: 'linkedProviderType',
      label: 'Provider type',
      hidden: true,
      span: 1,
    },
    {
      key: 'bucket',
      payloadKey: 'bucket',
      label: 'Bucket',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => !usesBucketField(accountProviderType(values)),
      requiredWhen: ({ values }) => requiresBucketField(accountProviderType(values)),
    },
    {
      key: 'container',
      payloadKey: 'container',
      label: 'Container',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => accountProviderType(values) !== 'azure',
      requiredWhen: ({ values }) => accountProviderType(values) === 'azure',
    },
    {
      key: 'publicBaseUrl',
      payloadKey: 'publicBaseUrl',
      label: 'Public base URL',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => !accountProviderType(values),
    },
    {
      key: 'pathPrefix',
      payloadKey: 'pathPrefix',
      label: 'Path prefix',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => !accountProviderType(values),
    },
  ],
};

@Component({
  selector: 'app-hosting-storage-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingStorageProvider[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage' : 'hosting/storage',
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
    const items = await super.fetchItems(filters);
    return items.map((item) => ({
      ...item,
      HsaBucketLabel: bucketLabelFromRow(item),
    }));
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

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'providerUuid') return;
    const provider = this.providers().find((item) => item.HspUUID === String(value ?? ''));
    this.patchFormValues({
      linkedProviderType: provider?.HspProvider ?? String(this.formValues()['linkedProviderType'] ?? ''),
    });
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HsaConfig']);
    const providerUuid = String(row['HostingStorageProviderHspUUID'] ?? '');
    const linkedProviderType =
      String(row['HspProvider'] ?? '') ||
      this.providers().find((item) => item.HspUUID === providerUuid)?.HspProvider ||
      '';
    return {
      ...super.formValuesFromRecord(row),
      bucket: stringValue(config['bucket']),
      container: stringValue(config['container']),
      publicBaseUrl: stringValue(config['publicBaseUrl']),
      pathPrefix: stringValue(config['pathPrefix']),
      linkedProviderType,
      isDefault: truthyNumber(row['HsaIsDefault']),
      status: truthyNumber(row['HsaIsActive']),
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const provider = accountProviderType(payload);
    if (requiresBucketField(provider) && !String(payload['bucket'] ?? '').trim()) {
      this.snack.warning(this.t('Bucket is required for the selected provider.'));
      return false;
    }
    if (provider === 'azure' && !String(payload['container'] ?? '').trim()) {
      this.snack.warning(this.t('Container is required for Azure Blob Storage.'));
      return false;
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const provider = accountProviderType(payload);
    const config =
      provider === 'azure'
        ? cleanRecord({
            container: payload['container'],
            publicBaseUrl: payload['publicBaseUrl'],
            pathPrefix: payload['pathPrefix'],
          })
        : cleanRecord({
            bucket: payload['bucket'],
            publicBaseUrl: payload['publicBaseUrl'],
            pathPrefix: payload['pathPrefix'],
          });

    return {
      name: payload['name'],
      providerUuid: payload['providerUuid'],
      config,
      isActive: truthyNumber(payload['status']) === 1,
      isDefault: truthyNumber(payload['isDefault']) === 1,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const provider = String(row['HspProvider'] ?? '');
    return provider === 's3' || provider === 'spaces' || provider === 'sangfor_scp'
      ? [VALIDATE_ACTION]
      : [];
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HsaUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.snack.success(this.t('Storage account validated.'));
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate storage account.'));
    } finally {
      this.mutating.set(false);
    }
  }

  protected async fetchProviders(): Promise<void> {
    try {
      const response = await this.api.get<{ data?: { items?: HostingStorageProvider[] } }>(
        `${this.rootEndpoint()}/providers?limit=500&offset=0`,
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (error) {
      this.providers.set([]);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load storage providers.'));
    }
  }
}

@Component({
  selector: 'app-hosting-storage-accounts-quick-create-host',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: [
    '../../../../shared/crud/configurable-crud/configurable-crud-page.scss',
    '../../../erp/customer/customer-quick-create-host.scss',
  ],
})
export class HostingStorageAccountsQuickCreateHostComponent extends HostingStorageAccountsPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<HostingStorageAccountsQuickCreateHostComponent, ConfigurableCrudQuickCreateResult>,
  );
  private savingFromQuickCreate = false;

  constructor() {
    super();
    queueMicrotask(() => this.startCreate());
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    this.savingFromQuickCreate = true;
    try {
      await super.saveItem(saveAndNew);
    } finally {
      this.savingFromQuickCreate = false;
    }
  }

  override closeDialog(): void {
    super.closeDialog();
    if (!this.savingFromQuickCreate) {
      this.quickDialogRef.close({ option: null });
    }
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    await super.afterSave(context);
    if (context.mode !== 'create') return;
    this.quickDialogRef.close({
      option: storageAccountOptionFromResponse(context.response, context.payload),
      response: context.response,
      payload: context.payload,
    });
  }
}

export function storageAccountOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractStorageAccountRecord(response) ?? payload;
  const uuid =
    stringValue(record['HsaUUID']) ??
    stringValue(record['uuid']) ??
    stringValue(payload['HsaUUID']);
  if (!uuid) return null;
  const label = stringValue(record['HsaName']) ?? stringValue(payload['name']) ?? uuid;
  const description = [record['HspName'], record['HspProvider']]
    .map((value) => stringValue(value))
    .filter((value): value is string => Boolean(value))
    .join(' - ');
  return {
    value: uuid,
    label,
    description,
    searchText: `${label} ${description} ${uuid}`,
  };
}

function extractStorageAccountRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as
    | {
        data?: unknown;
        item?: unknown;
        record?: unknown;
      }
    | null
    | undefined;
  const candidates = [
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).item,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).record,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).data,
    value?.data,
    value?.item,
    value?.record,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') {
      return candidate as ConfigurableCrudRecord;
    }
  }
  return null;
}

function accountProviderType(values: ConfigurableCrudRecord): StorageProvider | '' {
  const normalized = String(values['linkedProviderType'] ?? '') as StorageProvider | '';
  return ['s3', 'gcs', 'azure', 'spaces', 'sangfor_scp'].includes(normalized) ? normalized : '';
}

function usesBucketField(provider: StorageProvider | ''): boolean {
  return (
    provider === 's3' ||
    provider === 'spaces' ||
    provider === 'gcs' ||
    provider === 'sangfor_scp'
  );
}

function requiresBucketField(provider: StorageProvider | ''): boolean {
  return usesBucketField(provider);
}

function bucketLabelFromRow(row: ConfigurableCrudRecord): string {
  const config = asRecord(row['HsaConfig']);
  return String(config['bucket'] || config['container'] || '-');
}

function truthyNumber(value: unknown): number {
  return value === true || value === 1 || value === '1' ? 1 : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);
}

function cleanRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== null && item !== undefined && item !== '',
    ),
  );
}
