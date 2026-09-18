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
import type {
  HostingVpsContainerPlanConfig,
  HostingVpsContainerProvider,
  VpsContainerCatalogOption,
  VpsContainerProvider,
  VpsContainerProviderCatalog,
  VpsContainerProviderConfig,
} from '../vps-container.types';

const PROVIDER_TYPE_OPTIONS: readonly { value: VpsContainerProvider; label: string }[] = [
  { value: 'incus', label: 'Incus' },
];

const COPY_PLAN_ACTION: ConfigurableCrudRowAction = {
  key: 'copy',
  label: 'Copy',
  icon: 'content_copy',
  tooltip: 'Copy plan',
};

const HOSTING_VPS_CONTAINER_PLAN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps-container/plans',
  uuidField: 'HcnUUID',
  pageTitle: 'VPS Container Plans',
  pageDescription:
    'Define commercial prices and technical defaults for provider instance sizes.',
  createTitle: 'New VPS Container plan',
  editTitle: 'Edit VPS Container plan',
  dialogDescription: 'Create a commercial VPS Container plan from provider catalog data.',
  searchPlaceholder: 'Name, provider, region or size',
  emptyLabel: 'No VPS Container plans found.',
  deleteTitle: 'Delete VPS Container plan',
  deleteMessage: 'Are you sure you want to delete this VPS Container plan?',
  deleteSelectedTitle: 'Delete selected VPS Container plans',
  deleteSelectedMessage:
    'Are you sure you want to delete {count} selected VPS Container plan(s)?',
  savedMessage: 'VPS Container plan saved successfully.',
  deletedMessage: 'VPS Container plan deleted successfully.',
  deleteFailedMessage: 'Failed to delete VPS Container plan.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  pageSizeOptions: [5, 10, 25, 100],
  rowActions: [COPY_PLAN_ACTION],
  tabLabels: {
    storage: 'Config',
    financial: 'Pricing',
    notes: 'Notes',
  },
  listFilters: [
    {
      key: 'providerFilter',
      label: 'Provider',
      paramKey: 'providerUUID',
      type: 'search-select',
      placeholder: 'Search provider',
      emptyLabel: 'No records found.',
    },
  ],
  initialValues: {
    isActive: 1,
    providerUUID: '',
    name: '',
    price: 0,
    setupFee: 0,
    region: '',
    regionManual: '',
    size: '',
    sizeManual: '',
    image: '',
    imageManual: '',
    cpu: 0,
    memoryMb: 0,
    diskGb: 0,
    transferGb: 0,
    profile: '',
    profileManual: '',
    storagePool: '',
    storagePoolManual: '',
    network: '',
    networkManual: '',
    target: '',
    imageServer: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HcnName', uuidField: 'HcnUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      lookupKey: 'providerUUID',
      uuidField: 'HostingVpsContainerProviderHcpUUID',
    },
    { id: 'region', label: 'Region', field: 'HcnRegion' },
    { id: 'size', label: 'Size', field: 'HcnSize' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'HcnPrice',
      currencyField: 'HcnCurrency',
    },
    {
      id: 'setupFee',
      label: 'Setup fee',
      kind: 'currency',
      field: 'HcnSetupFee',
      currencyField: 'HcnCurrency',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HcnIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HcnIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'providerUUID',
      source: 'HostingVpsContainerProviderHcpUUID',
      payloadKey: 'providerUUID',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HcnName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'Incus Basic 1GB',
      required: true,
      span: 1,
    },
    {
      key: 'price',
      source: 'HcnPrice',
      payloadKey: 'price',
      label: 'Price',
      type: 'currency',
      required: true,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'setupFee',
      source: 'HcnSetupFee',
      payloadKey: 'setupFee',
      label: 'Setup fee',
      type: 'currency',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'region',
      source: 'HcnRegion',
      payloadKey: 'region',
      label: 'Region',
      type: 'search-select',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'regionManual',
      source: 'HcnRegion',
      payloadKey: 'regionManual',
      label: 'Region',
      placeholder: 'default',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'size',
      source: 'HcnSize',
      payloadKey: 'size',
      label: 'Size / Bundle',
      type: 'search-select',
      tab: 'storage',
      span: 2,
      lineFillAfter: 1,
      translateOptions: false,
    },
    {
      key: 'sizeManual',
      source: 'HcnSize',
      payloadKey: 'sizeManual',
      label: 'Size / Bundle',
      placeholder: 'custom-flavor',
      tab: 'storage',
      span: 2,
      lineFillAfter: 1,
    },
    {
      key: 'image',
      source: 'HcnImage',
      payloadKey: 'image',
      label: 'Image',
      type: 'search-select',
      tab: 'storage',
      span: 2,
      lineFillAfter: 1,
      translateOptions: false,
    },
    {
      key: 'imageManual',
      source: 'HcnImage',
      payloadKey: 'imageManual',
      label: 'Image',
      placeholder: 'ubuntu/22.04',
      tab: 'storage',
      span: 2,
      lineFillAfter: 1,
    },
    {
      key: 'cpu',
      source: 'HcnConfig',
      payloadKey: 'cpu',
      label: 'CPU',
      type: 'number',
      tab: 'storage',
      span: 1,
      breakBefore: true,
      fromRecord: (value) => Number(parsePlanConfig(value)?.cpu ?? 0),
    },
    {
      key: 'memoryMb',
      source: 'HcnConfig',
      payloadKey: 'memoryMb',
      label: 'Memory MB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.memoryMb ?? 0),
    },
    {
      key: 'diskGb',
      source: 'HcnConfig',
      payloadKey: 'diskGb',
      label: 'Disk GB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.diskGb ?? 0),
    },
    {
      key: 'transferGb',
      source: 'HcnConfig',
      payloadKey: 'transferGb',
      label: 'Transfer GB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.transferGb ?? 0),
    },
    {
      key: 'profile',
      source: 'HcnConfig',
      payloadKey: 'profile',
      label: 'Profile',
      type: 'search-select',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.profile ?? ''),
    },
    {
      key: 'profileManual',
      source: 'HcnConfig',
      payloadKey: 'profileManual',
      label: 'Profile',
      placeholder: 'default',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.profile ?? ''),
    },
    {
      key: 'storagePool',
      source: 'HcnConfig',
      payloadKey: 'storagePool',
      label: 'Storage pool',
      type: 'search-select',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.storagePool ?? ''),
    },
    {
      key: 'storagePoolManual',
      source: 'HcnConfig',
      payloadKey: 'storagePoolManual',
      label: 'Storage pool',
      placeholder: 'default',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.storagePool ?? ''),
    },
    {
      key: 'network',
      source: 'HcnConfig',
      payloadKey: 'network',
      label: 'Network',
      type: 'search-select',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.network ?? ''),
    },
    {
      key: 'networkManual',
      source: 'HcnConfig',
      payloadKey: 'networkManual',
      label: 'Network',
      placeholder: 'lxdbr0',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.network ?? ''),
    },
    {
      key: 'target',
      source: 'HcnConfig',
      payloadKey: 'target',
      label: 'Target',
      placeholder: 'Incus cluster target',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.target ?? ''),
    },
    {
      key: 'imageServer',
      source: 'HcnConfig',
      payloadKey: 'imageServer',
      label: 'Image server',
      placeholder: 'https://images.linuxcontainers.org',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => String(parsePlanConfig(value)?.imageServer ?? ''),
    },
    {
      key: 'notes',
      source: 'HcnConfig',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      placeholder: 'Internal plan notes',
      fromRecord: (value) => String(parsePlanConfig(value)?.notes ?? ''),
    },
  ],
};

@Component({
  selector: 'app-hosting-vps-container-plans',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsContainerPlansPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerEndpoint = computed(() =>
    this.isMaster()
      ? 'system/hosting/vps-container/providers'
      : 'hosting/vps-container/providers',
  );
  private readonly planEndpoint = computed(() =>
    this.isMaster()
      ? 'system/hosting/vps-container/plans'
      : HOSTING_VPS_CONTAINER_PLAN_CONFIG.endpoint,
  );

  private readonly providers = signal<HostingVpsContainerProvider[]>([]);
  private readonly catalog = signal<VpsContainerProviderCatalog | null>(null);
  private readonly catalogProviderUUID = signal<string | null>(null);
  readonly catalogLoading = signal(false);
  private readonly catalogFetchKey = signal<string | null>(null);
  private catalogRequestId = 0;

  private readonly providerFormOptions = computed<ConfigurableCrudOption[]>(() => {
    const current = normalizeString(this.formValues()['providerUUID']);
    return [...this.providers()]
      .filter((provider) => provider.HcpIsActive === 1 || provider.HcpUUID === current)
      .sort((a, b) =>
        a.HcpName.localeCompare(b.HcpName, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .map((provider) => toProviderOption(provider));
  });

  private readonly providerFilterOptions = computed<ConfigurableCrudOption[]>(() =>
    [...this.providers()]
      .sort((a, b) =>
        a.HcpName.localeCompare(b.HcpName, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .map((provider) => toProviderOption(provider)),
  );

  private readonly regionOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['region']) ??
      normalizeString(this.formValues()['regionManual']) ??
      '';
    return catalogOptionsToCrud(withCurrentOption(this.catalog()?.regions ?? [], current));
  });

  private readonly sizeOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['size']) ??
      normalizeString(this.formValues()['sizeManual']) ??
      '';
    const options = withCurrentOption(this.catalog()?.sizes ?? [], current);
    return catalogOptionsToCrud(sortSizeOptions(options));
  });

  private readonly imageOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['image']) ??
      normalizeString(this.formValues()['imageManual']) ??
      '';
    return catalogOptionsToCrud(withCurrentOption(this.catalog()?.images ?? [], current));
  });

  private readonly profileOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['profile']) ??
      normalizeString(this.formValues()['profileManual']) ??
      '';
    return catalogOptionsToCrud(withCurrentOption(this.catalog()?.profiles ?? [], current));
  });

  private readonly storagePoolOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['storagePool']) ??
      normalizeString(this.formValues()['storagePoolManual']) ??
      '';
    return catalogOptionsToCrud(withCurrentOption(this.catalog()?.storagePools ?? [], current));
  });

  private readonly networkOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['network']) ??
      normalizeString(this.formValues()['networkManual']) ??
      '';
    return catalogOptionsToCrud(withCurrentOption(this.catalog()?.networks ?? [], current));
  });

  private readonly locksCatalogSpecs = computed(() => {
    const size =
      normalizeString(this.formValues()['size']) ??
      normalizeString(this.formValues()['sizeManual']);
    if (!size) return false;
    const option = (this.catalog()?.sizes ?? []).find((item) => item.id === size);
    return Boolean(
      option &&
        (catalogNumber(option.cpu) !== null ||
          catalogNumber(option.memoryMb) !== null ||
          catalogNumber(option.diskGb) !== null),
    );
  });

  constructor() {
    const masterScope =
      (inject(ActivatedRoute).snapshot.data?.['scope'] ?? 'tenant') === 'master';
    super({
      ...HOSTING_VPS_CONTAINER_PLAN_CONFIG,
      canCreate: masterScope,
      canEdit: masterScope,
      canDelete: masterScope,
      fields: HOSTING_VPS_CONTAINER_PLAN_CONFIG.fields.map((field) => {
        if (field.key === 'region') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.regions?.length),
            requiredWhen: () => Boolean(this.catalog()?.regions?.length),
          };
        }
        if (field.key === 'regionManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.regions?.length),
          };
        }
        if (field.key === 'size') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.sizes?.length),
            requiredWhen: () => Boolean(this.catalog()?.sizes?.length),
          };
        }
        if (field.key === 'sizeManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.sizes?.length),
          };
        }
        if (field.key === 'image') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.images?.length),
          };
        }
        if (field.key === 'imageManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.images?.length),
          };
        }
        if (field.key === 'profile') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.profiles?.length),
          };
        }
        if (field.key === 'profileManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.profiles?.length),
          };
        }
        if (field.key === 'storagePool') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.storagePools?.length),
          };
        }
        if (field.key === 'storagePoolManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.storagePools?.length),
          };
        }
        if (field.key === 'network') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.networks?.length),
          };
        }
        if (field.key === 'networkManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.networks?.length),
          };
        }
        if (['cpu', 'memoryMb', 'diskGb', 'transferGb'].includes(field.key)) {
          return {
            ...field,
            disabledWhen: () => this.locksCatalogSpecs(),
          };
        }
        return field;
      }),
    });
    void this.fetchProviders();
  }

  override refreshList(): void {
    void this.fetchProviders();
    super.refreshList();
  }

  protected override listEndpoint(): string {
    return this.planEndpoint();
  }

  protected override createEndpoint(): string {
    return this.planEndpoint();
  }

  protected override updateEndpoint(): string {
    return this.planEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.planEndpoint();
  }

  protected override bulkDeleteEndpoint(): string {
    return `${this.planEndpoint()}/bulk`;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerFilter') return this.providerFilterOptions();
    if (key === 'providerUUID') return this.providerFormOptions();
    if (key === 'region') return this.regionOptions();
    if (key === 'size') return this.sizeOptions();
    if (key === 'image') return this.imageOptions();
    if (key === 'profile') return this.profileOptions();
    if (key === 'storagePool') return this.storagePoolOptions();
    if (key === 'network') return this.networkOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'providerUUID') {
      const option = this.providerFilterOptions().find(
        (item) => String(item.value ?? '') === String(value ?? ''),
      );
      if (option?.label) return option.label;
      const provider = String(
        this.rows().find(
          (row) => String(row['HostingVpsContainerProviderHcpUUID'] ?? '') === String(value ?? ''),
        )?.['HcnProvider'] ?? '',
      );
      return provider ? providerTypeLabel(provider) : '';
    }
    return super.lookupLabel(key, value);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    if (!this.providers().length) await this.fetchProviders();

    const providerUUID = normalizeString(
      filters.extra['providerFilter'] ?? filters.extra['providerUUID'],
    );
    const apiFilters: ConfigurableCrudFilters = {
      ...filters,
      extra: Object.fromEntries(
        Object.entries(filters.extra).filter(
          ([key]) => key !== 'providerFilter' && key !== 'providerUUID',
        ),
      ),
    };

    const rows = await super.fetchItems(apiFilters);
    const parsed: ConfigurableCrudRecord[] = rows.map((row) => ({
      ...row,
      HcnConfig: parsePlanConfig(row['HcnConfig']),
    }));

    if (!providerUUID) return parsed;
    return parsed.filter((item) => {
      const itemProviderUUID = String(item['HostingVpsContainerProviderHcpUUID'] ?? '');
      const itemProvider = String(item['HcnProvider'] ?? '') as VpsContainerProvider;
      return (
        itemProviderUUID === providerUUID ||
        this.resolveProviderUUIDForProvider(itemProvider) === providerUUID
      );
    });
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = super.formValuesFromRecord(row);
    const config = parsePlanConfig(row['HcnConfig']);
    const region = String(row['HcnRegion'] ?? '');
    const size = String(row['HcnSize'] ?? '');
    const image = String(row['HcnImage'] ?? '');
    const providerUUID =
      this.providerById(String(row['HostingVpsContainerProviderHcpUUID'] ?? ''))?.HcpUUID ??
      this.resolveProviderUUIDForProvider(String(row['HcnProvider'] ?? '') as VpsContainerProvider);

    next['providerUUID'] = providerUUID;
    next['region'] = region;
    next['regionManual'] = region;
    next['size'] = size;
    next['sizeManual'] = size;
    next['image'] = image;
    next['imageManual'] = image;
    next['setupFee'] = Number(row['HcnSetupFee'] ?? 0);
    next['cpu'] = Number(config?.cpu ?? 0);
    next['memoryMb'] = Number(config?.memoryMb ?? 0);
    next['diskGb'] = Number(config?.diskGb ?? 0);
    next['transferGb'] = Number(config?.transferGb ?? 0);
    next['profile'] = String(config?.profile ?? '');
    next['profileManual'] = String(config?.profile ?? '');
    next['storagePool'] = String(config?.storagePool ?? '');
    next['storagePoolManual'] = String(config?.storagePool ?? '');
    next['network'] = String(config?.network ?? '');
    next['networkManual'] = String(config?.network ?? '');
    next['target'] = String(config?.target ?? '');
    next['imageServer'] = String(config?.imageServer ?? '');
    next['notes'] = String(config?.notes ?? '');
    next['isActive'] = Number(row['HcnIsActive'] ?? 0) === 1 ? 1 : 0;
    next['price'] = Number(row['HcnPrice'] ?? 0);

    void this.fetchProviderCatalog(providerUUID, { force: true });
    return next;
  }

  override startCreate(): void {
    this.catalog.set(null);
    this.catalogProviderUUID.set(null);
    this.catalogFetchKey.set(null);
    super.startCreate();
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key !== 'copy') return;
    this.startCopy(row);
  }

  private startCopy(row: ConfigurableCrudRecord): void {
    if (!this.canCreate()) return;
    const values = this.formValuesFromRecord(row);
    const sourceName = String(values['name'] ?? row['HcnName'] ?? '').trim();
    values['name'] = sourceName ? `${sourceName} COPY` : 'COPY';
    this.startCreateWithValues(values);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key === 'providerUUID') {
      this.patchFormValues({
        region: '',
        regionManual: '',
        size: '',
        sizeManual: '',
        image: '',
        imageManual: '',
        cpu: 0,
        memoryMb: 0,
        diskGb: 0,
        transferGb: 0,
      });
      void this.fetchProviderCatalog(normalizeString(value), { force: true });
      return;
    }

    if (key === 'region') {
      this.patchFormValues({ regionManual: String(value ?? '') });
      return;
    }
    if (key === 'regionManual') {
      this.patchFormValues({ region: String(value ?? '') });
      return;
    }

    if (key === 'size') {
      const size = String(value ?? '');
      this.patchFormValues({ sizeManual: size });
      void this.applySelectedSizeSpecs(size);
      return;
    }
    if (key === 'sizeManual') {
      const size = String(value ?? '');
      this.patchFormValues({ size });
      void this.applySelectedSizeSpecs(size);
      return;
    }

    if (key === 'image') {
      this.patchFormValues({ imageManual: String(value ?? '') });
      return;
    }
    if (key === 'imageManual') {
      this.patchFormValues({ image: String(value ?? '') });
      return;
    }

    if (key === 'profile') {
      this.patchFormValues({ profileManual: String(value ?? '') });
      return;
    }
    if (key === 'profileManual') {
      this.patchFormValues({ profile: String(value ?? '') });
      return;
    }

    if (key === 'storagePool') {
      this.patchFormValues({ storagePoolManual: String(value ?? '') });
      return;
    }
    if (key === 'storagePoolManual') {
      this.patchFormValues({ storagePool: String(value ?? '') });
      return;
    }

    if (key === 'network') {
      this.patchFormValues({ networkManual: String(value ?? '') });
      return;
    }
    if (key === 'networkManual') {
      this.patchFormValues({ network: String(value ?? '') });
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const providerUUID = normalizeString(payload['providerUUID']);
    const providerRecord = this.providerById(providerUUID);
    const region =
      normalizeString(payload['region']) ?? normalizeString(payload['regionManual']);
    const size = normalizeString(payload['size']) ?? normalizeString(payload['sizeManual']);
    const image = normalizeString(payload['image']) ?? normalizeString(payload['imageManual']);
    const profile =
      normalizeString(payload['profile']) ?? normalizeString(payload['profileManual']);
    const storagePool =
      normalizeString(payload['storagePool']) ?? normalizeString(payload['storagePoolManual']);
    const network =
      normalizeString(payload['network']) ?? normalizeString(payload['networkManual']);
    const target = normalizeString(payload['target']) ?? region;
    const imageServer = normalizeString(payload['imageServer']);
    const notes = normalizeString(payload['notes']);
    const setupFee = Number(
      this.formValues()['setupFee'] ?? this.editingRecord()?.['HcnSetupFee'] ?? 0,
    );
    const currency =
      normalizeString(this.editingRecord()?.['HcnCurrency'] as string | undefined) ??
      this.defaultCurrency() ??
      'BRL';

    return {
      name: String(payload['name'] ?? '').trim(),
      providerUUID: providerRecord?.HcpUUID ?? providerUUID,
      region,
      size,
      image,
      price: Number(payload['price'] ?? 0),
      setupFee: Number.isFinite(setupFee) ? setupFee : 0,
      config: {
        cpu: Number(payload['cpu'] ?? 0) || null,
        memoryMb: Number(payload['memoryMb'] ?? 0) || null,
        diskGb: Number(payload['diskGb'] ?? 0) || null,
        transferGb: Number(payload['transferGb'] ?? 0) || null,
        profile,
        storagePool,
        network,
        target,
        imageServer,
        notes,
      } satisfies HostingVpsContainerPlanConfig,
      isActive: truthyNumber(payload['isActive']) === 1,
      currency,
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    const providerUUID = normalizeString(payload['providerUUID']);
    if (!providerUUID || !this.providerById(providerUUID)) {
      this.snack.warning(this.t('Select a valid VPS Container provider.'));
      return false;
    }
    return super.validatePayload(payload);
  }

  private async fetchProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsContainerProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HcpConfig: parseObjectConfig<VpsContainerProviderConfig>(item.HcpConfig),
        })),
      );
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS Container providers.'));
    }
  }

  private async fetchProviderCatalog(
    providerUUID: string | null | undefined,
    options?: { force?: boolean },
  ) {
    const uuid = normalizeString(providerUUID);
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      this.catalogFetchKey.set(null);
      return;
    }

    const fetchKey = uuid;
    if (!options?.force && this.catalogFetchKey() === fetchKey && this.catalog()) return;

    const requestId = ++this.catalogRequestId;
    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);
    this.catalog.set(null);
    this.catalogFetchKey.set(fetchKey);

    try {
      const result = await this.api.get<{ data?: { catalog?: VpsContainerProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog`,
      );
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(result?.data?.catalog ?? null);
      const size =
        normalizeString(this.formValues()['size']) ??
        normalizeString(this.formValues()['sizeManual']);
      if (size && (result?.data?.catalog?.sizes ?? []).some((item) => item.id === size)) {
        void this.applySelectedSizeSpecs(size);
      }
    } catch (error) {
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(null);
      this.catalogFetchKey.set(null);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider catalog.'));
    } finally {
      if (requestId === this.catalogRequestId) this.catalogLoading.set(false);
    }
  }

  private async applySelectedSizeSpecs(value: string | null | undefined) {
    const selected = normalizeString(value);
    if (!selected) return;
    const option = (this.catalog()?.sizes ?? []).find((item) => item.id === selected);
    if (!option) return;

    const patch: ConfigurableCrudRecord = {};
    const cpu = catalogNumber(option.cpu);
    const memoryMb = catalogNumber(option.memoryMb);
    const diskGb = catalogNumber(option.diskGb);
    const transferGb = catalogNumber(option.transferGb);
    if (cpu !== null) patch['cpu'] = cpu;
    if (memoryMb !== null) patch['memoryMb'] = memoryMb;
    if (diskGb !== null) patch['diskGb'] = diskGb;
    if (transferGb !== null) patch['transferGb'] = transferGb;
    if (!Object.keys(patch).length) return;
    this.patchFormValues(patch);
  }

  private providerById(uuid: string | null | undefined): HostingVpsContainerProvider | null {
    const normalized = normalizeString(uuid);
    if (!normalized) return null;
    return this.providers().find((item) => item.HcpUUID === normalized) ?? null;
  }

  private resolveProviderUUIDForProvider(provider: VpsContainerProvider): string {
    return (
      this.providers().find(
        (acc) => acc.HcpProvider === provider && acc.HcpIsActive === 1 && acc.HcpIsDefault === 1,
      )?.HcpUUID ??
      this.providers().find((acc) => acc.HcpProvider === provider && acc.HcpIsActive === 1)
        ?.HcpUUID ??
      ''
    );
  }
}

function toProviderOption(provider: HostingVpsContainerProvider): ConfigurableCrudOption {
  return {
    value: provider.HcpUUID,
    label: provider.HcpName,
    description: providerTypeLabel(provider.HcpProvider),
    searchText: `${provider.HcpName} ${provider.HcpProvider}`,
  };
}

function providerTypeLabel(provider: VpsContainerProvider | string): string {
  return PROVIDER_TYPE_OPTIONS.find((opt) => opt.value === provider)?.label ?? String(provider);
}

function parsePlanConfig(value: unknown): HostingVpsContainerPlanConfig | null {
  return parseObjectConfig<HostingVpsContainerPlanConfig>(value);
}

function parseObjectConfig<T>(value: unknown): T | null {
  if (!value) return null;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null ? (parsed as T) : null;
  } catch {
    return null;
  }
}

function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function truthyNumber(value: unknown): 0 | 1 {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function catalogNumber(value: unknown): number | null {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function withCurrentOption(
  options: VpsContainerCatalogOption[],
  current: string,
): VpsContainerCatalogOption[] {
  const normalized = normalizeString(current);
  if (!normalized || options.some((opt) => opt.id === normalized)) return options;
  return [{ id: normalized, label: `Custom: ${normalized}` }, ...options];
}

function catalogOptionsToCrud(options: VpsContainerCatalogOption[]): ConfigurableCrudOption[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label || option.id,
    description: sizeOptionMeta(option) || undefined,
    searchText: `${option.id} ${option.label}`,
  }));
}

function sizeOptionParts(option: VpsContainerCatalogOption) {
  return (option.label || option.id)
    .split(' • ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function sizeOptionMeta(option: VpsContainerCatalogOption) {
  const specs: string[] = [];
  const cpu = catalogNumber(option.cpu);
  const memoryMb = catalogNumber(option.memoryMb);
  const diskGb = catalogNumber(option.diskGb);
  const transferGb = catalogNumber(option.transferGb);
  if (cpu !== null) specs.push(`${cpu} vCPU`);
  if (memoryMb !== null) {
    specs.push(
      memoryMb >= 1024 && memoryMb % 1024 === 0
        ? `${memoryMb / 1024} GB RAM`
        : `${memoryMb} MB RAM`,
    );
  }
  if (diskGb !== null) specs.push(`${diskGb} GB disk`);
  if (transferGb !== null) specs.push(`${transferGb} GB transfer`);
  if (specs.length) return specs.join(' · ');
  return sizeOptionParts(option).slice(1).join(' · ') || undefined;
}

function sortSizeOptions(options: VpsContainerCatalogOption[]) {
  return [...options].sort((a, b) => {
    const nameA = sizeOptionParts(a)[0] ?? a.label ?? a.id;
    const nameB = sizeOptionParts(b)[0] ?? b.label ?? b.id;
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
}
