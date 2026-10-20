import { storageBillingActions } from '../storage-billing-actions';
import { storagePriceFields } from '../storage-price-fields';
import { STORAGE_MODULE_OPTIONS, storageGrantCollection } from '../storage-module-config';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type StorageProvider = 's3' | 'gcs' | 'azure' | 'spaces' | 'sangfor_scp';

type HostingStorageProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: StorageProvider;
};

const BUCKET_STATES: Record<string, string> = {
  pending: 'Pending',
  provisioning: 'Provisioning',
  ready: 'Ready',
  failed: 'Failed',
  deleting: 'Deleting',
  released: 'Released',
};

const VALIDATE_ACTION: ConfigurableCrudRowAction = {
  key: 'validate',
  label: 'Validate',
  icon: 'fact_check',
  tooltip: 'Validate',
};

const BUCKET_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/storage/buckets',
  uuidField: 'HsbUUID',
  pageTitle: 'Storage Buckets',
  pageDescription: 'Manage buckets and containers linked to storage providers.',
  createTitle: 'New storage bucket',
  editTitle: 'Edit storage bucket',
  dialogDescription: 'Configure storage bucket identity, provider and bucket settings.',
  searchPlaceholder: 'Name, provider or bucket',
  emptyLabel: 'No storage buckets found.',
  deleteTitle: 'Delete storage bucket',
  deleteMessage: 'Are you sure you want to delete this storage bucket?',
  deleteSelectedTitle: 'Delete selected storage buckets',
  deleteSelectedMessage: 'Delete {count} selected storage buckets?',
  savedMessage: 'Storage bucket saved successfully.',
  deletedMessage: 'Storage bucket deleted successfully.',
  deleteFailedMessage: 'Failed to delete storage bucket.',
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
    provisionMode: 'import',
    accountUuid: '',
    priceUuid: '',
    providerUuid: '',
    linkedProviderType: '',
    status: 1,
    initialModule: '',
    bucket: '',
    container: '',
    pathPrefix: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HsbName', uuidField: 'HsbUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HspName',
      uuidField: 'HostingStorageProviderHspUUID',
    },
    { id: 'bucket', label: 'Bucket', field: 'HsbBucketLabel' },
    {
      id: 'state',
      label: 'Provisioning',
      value: (row, translate) => translate(BUCKET_STATES[String(row['HsbState'])] || 'Unknown'),
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HsbIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    ...storagePriceFields('buckets'),
    {
      key: 'provisionMode',
      hiddenWhen: ({ editing }) => editing,
      label: 'Bucket operation',
      type: 'search-select',
      options: [
        { value: 'import', label: 'Import existing bucket' },
        { value: 'create', label: 'Create bucket at provider' },
      ],
      span: 1,
    },
    {
      key: 'status',
      source: 'HsbIsActive',
      hiddenWhen: ({ editing }) => !editing,
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'accountUuid',
      disabledWhen: ({ editing }) => editing,
      source: 'HostingStorageAccountHsaUUID',
      payloadKey: 'accountUuid',
      label: 'Account',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'providerUuid',
      disabledWhen: ({ editing }) => editing,
      source: 'HostingStorageProviderHspUUID',
      payloadKey: 'providerUuid',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'initialModule',
      label: 'Initial module permission',
      type: 'search-select',
      options: STORAGE_MODULE_OPTIONS,
      span: 1,
      hiddenWhen: ({ editing }) => editing,
    },
    { key: 'name', source: 'HsbName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'linkedProviderType',
      payloadKey: 'linkedProviderType',
      label: 'Provider type',
      hidden: true,
      span: 1,
    },
    {
      key: 'bucket',
      disabledWhen: ({ editing }) => editing,
      payloadKey: 'bucket',
      label: 'Bucket',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => !usesBucketField(bucketProviderType(values)),
      requiredWhen: ({ values }) =>
        values['provisionMode'] !== 'create' && requiresBucketField(bucketProviderType(values)),
    },
    {
      key: 'container',
      disabledWhen: ({ editing }) => editing,
      payloadKey: 'container',
      label: 'Container',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => bucketProviderType(values) !== 'azure',
      requiredWhen: ({ values }) =>
        values['provisionMode'] !== 'create' && bucketProviderType(values) === 'azure',
    },
    {
      key: 'pathPrefix',
      disabledWhen: ({ editing }) => editing,
      payloadKey: 'pathPrefix',
      label: 'Path prefix',
      tab: 'storage',
      span: 2,
      hiddenWhen: ({ values }) => !bucketProviderType(values),
    },
  ],
};

@Component({
  selector: 'app-hosting-storage-buckets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingStorageBucketsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected override async quickCreateOption(
    response: unknown,
    payload: ConfigurableCrudRecord,
  ): Promise<ConfigurableCrudOption | null> {
    return (
      storageBucketOptionFromResponse(response, payload) ??
      super.quickCreateOption(response, payload)
    );
  }

  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingStorageProvider[]>([]);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly rootEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/storage' : 'hosting/storage',
  );
  private readonly endpoint = computed(() => `${this.rootEndpoint()}/buckets`);
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HspUUID,
      label: provider.HspName,
      description: provider.HspProvider,
      searchText: `${provider.HspName} ${provider.HspProvider} ${provider.HspUUID}`,
    })),
  );

  constructor() {
    super(
      (() => {
        const master = inject(ActivatedRoute).snapshot.data['scope'] === 'master';
        const prefix = master ? 'system/hosting/storage' : 'hosting/storage';
        return {
          ...BUCKET_CONFIG,
          rowActions: [
            VALIDATE_ACTION,
            ...storageBillingActions('buckets', master),
            {
              key: 'permissions',
              label: 'Bucket permissions',
              icon: 'policy',
              collection: (row: ConfigurableCrudRecord) =>
                storageGrantCollection(prefix, master, String(row['HsbUUID'])),
            },
          ],
          fields: BUCKET_CONFIG.fields
            .filter((field) => !master || !field.key.startsWith('price'))
            .map((field) => ({
              ...field,
              ...(field.key === 'accountUuid'
                ? {
                    remoteLookup: {
                      endpoint: `${prefix}/accounts?status=1`,
                      uuidField: 'HsaUUID',
                      labelField: 'HsaName',
                      selectedLabelField: 'AccountName',
                    },
                    quickCreate: quickCreateFor('HostingStorageAccountHsaUUID', {
                      routeData: { scope: master ? 'master' : 'tenant' },
                    }),
                  }
                : {}),
              ...(field.key === 'providerUuid'
                ? {
                    quickCreate: quickCreateFor('HostingStorageProviderHspUUID', {
                      routeData: { scope: 'master' },
                    }),
                  }
                : {}),
            })),
        };
      })(),
    );
    void this.fetchProviders();
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchProviders();
    const items = await super.fetchItems(filters);
    return items.map((item) => ({
      ...item,
      HsbBucketLabel: bucketLabelFromRow(item),
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
      linkedProviderType:
        provider?.HspProvider ?? String(this.formValues()['linkedProviderType'] ?? ''),
    });
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const config = asRecord(row['HsbConfig']);
    const providerUuid = String(row['HostingStorageProviderHspUUID'] ?? '');
    const linkedProviderType =
      String(row['HspProvider'] ?? '') ||
      this.providers().find((item) => item.HspUUID === providerUuid)?.HspProvider ||
      '';
    return {
      ...super.formValuesFromRecord(row),
      bucket: stringValue(config['bucket']),
      container: stringValue(config['container']),
      pathPrefix: stringValue(config['pathPrefix']),
      linkedProviderType,
      status: truthyNumber(row['HsbIsActive']),
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    if (!super.validatePayload(payload)) return false;
    const provider = bucketProviderType(payload);
    if (
      payload['provisionMode'] !== 'create' &&
      requiresBucketField(provider) &&
      !String(payload['bucket'] ?? '').trim()
    ) {
      return this.rejectField('bucket', 'Bucket is required for the selected provider.');
    }
    if (
      payload['provisionMode'] !== 'create' &&
      provider === 'azure' &&
      !String(payload['container'] ?? '').trim()
    ) {
      return this.rejectField('container', 'Container is required for Azure Blob Storage.');
    }
    return true;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const provider = bucketProviderType(payload);
    const config =
      provider === 'azure'
        ? cleanRecord({
            container: payload['container'],
            pathPrefix: payload['pathPrefix'],
          })
        : cleanRecord({
            bucket: payload['bucket'],
            pathPrefix: payload['pathPrefix'],
          });

    return {
      name: payload['name'],
      provisionMode: payload['provisionMode'],
      accountUuid: payload['accountUuid'],
      priceUuid: payload['priceUuid'] || undefined,
      providerUuid: payload['providerUuid'],
      config,
      isActive: truthyNumber(payload['status']) === 1,
      initialModule: payload['initialModule'] || undefined,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const provider = String(row['HspProvider'] ?? '');
    return super
      .rowActions(row)
      .filter(
        (action) =>
          action.key !== 'validate' ||
          ['s3', 'spaces', 'sangfor_scp', 'azure', 'gcs'].includes(provider),
      );
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'validate') return;
    const uuid = String(row['HsbUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      const response = await this.api.post(`${this.endpoint()}/${uuid}/validate`, {});
      this.trackOperation(response);
      this.snack.success(this.t('Storage bucket verification queued.'));
      await this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to validate storage bucket.'));
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

export function storageBucketOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractStorageBucketRecord(response) ?? payload;
  const uuid =
    stringValue(record['HsbUUID']) ??
    stringValue(record['uuid']) ??
    stringValue(payload['HsbUUID']);
  if (!uuid) return null;
  const label = stringValue(record['HsbName']) ?? stringValue(payload['name']) ?? uuid;
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

function extractStorageBucketRecord(response: unknown): ConfigurableCrudRecord | null {
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

function bucketProviderType(values: ConfigurableCrudRecord): StorageProvider | '' {
  const normalized = String(values['linkedProviderType'] ?? '') as StorageProvider | '';
  return ['s3', 'gcs', 'azure', 'spaces', 'sangfor_scp'].includes(normalized) ? normalized : '';
}

function usesBucketField(provider: StorageProvider | ''): boolean {
  return (
    provider === 's3' || provider === 'spaces' || provider === 'gcs' || provider === 'sangfor_scp'
  );
}

function requiresBucketField(provider: StorageProvider | ''): boolean {
  return usesBucketField(provider);
}

function bucketLabelFromRow(row: ConfigurableCrudRecord): string {
  const config = asRecord(row['HsbConfig']);
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
  return typeof value === 'string'
    ? value
    : value === null || value === undefined
      ? ''
      : String(value);
}

function cleanRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined && item !== ''),
  );
}
