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
  HostingVpsPlanConfig,
  HostingVpsProvider,
  VpsCatalogOption,
  VpsProvider,
  VpsProviderCatalog,
  VpsProviderConfig,
} from '../vps.types';

const PROVIDER_TYPE_OPTIONS: readonly { value: VpsProvider; label: string }[] = [
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'lightsail', label: 'Amazon Lightsail' },
  { value: 'proxmox', label: 'Proxmox VE' },
  { value: 'vmware_vcenter', label: 'VMware vCenter' },
];

const COPY_PLAN_ACTION: ConfigurableCrudRowAction = {
  key: 'copy',
  label: 'Copy',
  icon: 'content_copy',
  tooltip: 'Copy plan',
};
const HOSTING_VPS_PLAN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps/plans',
  uuidField: 'HvpUUID',
  pageTitle: 'VPS Plans',
  pageDescription:
    'Manage the platform VPS plan catalog. Provider and plan administration is master-only.',
  createTitle: 'New VPS plan',
  editTitle: 'Edit VPS plan',
  dialogDescription: 'Create a commercial VPS plan from the platform provider catalog.',
  searchPlaceholder: 'Name, provider, region or size',
  emptyLabel: 'No VPS plans found.',
  deleteTitle: 'Delete VPS plan',
  deleteMessage: 'Are you sure you want to delete this VPS plan?',
  deleteSelectedTitle: 'Delete selected VPS plans',
  deleteSelectedMessage: 'Are you sure you want to delete {count} selected VPS plan(s)?',
  savedMessage: 'VPS plan saved successfully.',
  deletedMessage: 'VPS plan deleted successfully.',
  deleteFailedMessage: 'Failed to delete VPS plan.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  bulkDelete: true,
  statusFilter: true,
  showAsyncOperationStatus: false,
  initialPageSize: 10,
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
    cpu: 0,
    memoryMb: 0,
    diskGb: 0,
    transferGb: 0,
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HvpName', uuidField: 'HvpUUID' },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      lookupKey: 'providerUUID',
      uuidField: 'HostingVpsProviderHvrUUID',
    },
    { id: 'region', label: 'Region', field: 'HvpRegion' },
    { id: 'size', label: 'Size', field: 'HvpSize' },
    {
      id: 'price',
      label: 'Price',
      kind: 'currency',
      field: 'HvpPrice',
      currencyField: 'HvpCurrency',
    },
    {
      id: 'setupFee',
      label: 'Setup fee',
      kind: 'currency',
      field: 'HvpSetupFee',
      currencyField: 'HvpCurrency',
    },
    {
      id: 'status',
      label: 'Status',
      kind: 'status',
      field: 'HvpIsActive',
      className: 'status-col',
    },
  ],
  fields: [
    {
      key: 'isActive',
      source: 'HvpIsActive',
      payloadKey: 'isActive',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'providerUUID',
      source: 'HostingVpsProviderHvrUUID',
      payloadKey: 'providerUUID',
      label: 'Provider',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'name',
      source: 'HvpName',
      payloadKey: 'name',
      label: 'Name',
      placeholder: 'DO Basic 1GB',
      required: true,
      span: 1,
    },
    {
      key: 'price',
      source: 'HvpPrice',
      payloadKey: 'price',
      label: 'Price',
      type: 'currency',
      required: true,
      tab: 'financial',
      span: 1,
    },
    {
      key: 'setupFee',
      source: 'HvpSetupFee',
      payloadKey: 'setupFee',
      label: 'Setup fee',
      type: 'currency',
      tab: 'financial',
      span: 1,
    },
    {
      key: 'region',
      source: 'HvpRegion',
      payloadKey: 'region',
      label: 'Region',
      type: 'search-select',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'regionManual',
      source: 'HvpRegion',
      payloadKey: 'regionManual',
      label: 'Region',
      placeholder: 'us-east-1a',
      tab: 'storage',
      span: 1,
    },
    {
      key: 'size',
      source: 'HvpSize',
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
      source: 'HvpSize',
      payloadKey: 'sizeManual',
      label: 'Size / Bundle',
      placeholder: 's-1vcpu-1gb',
      tab: 'storage',
      span: 2,
      lineFillAfter: 1,
    },
    {
      key: 'cpu',
      source: 'HvpConfig',
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
      source: 'HvpConfig',
      payloadKey: 'memoryMb',
      label: 'Memory MB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.memoryMb ?? 0),
    },
    {
      key: 'diskGb',
      source: 'HvpConfig',
      payloadKey: 'diskGb',
      label: 'Disk GB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.diskGb ?? 0),
    },
    {
      key: 'transferGb',
      source: 'HvpConfig',
      payloadKey: 'transferGb',
      label: 'Transfer GB',
      type: 'number',
      tab: 'storage',
      span: 1,
      fromRecord: (value) => Number(parsePlanConfig(value)?.transferGb ?? 0),
    },
    {
      key: 'notes',
      source: 'HvpConfig',
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
  selector: 'app-hosting-vps-plans',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsPlansPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);

  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly providerEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/providers' : 'hosting/vps/providers',
  );
  private readonly planEndpoint = computed(() =>
    this.isMaster() ? 'system/hosting/vps/plans' : HOSTING_VPS_PLAN_CONFIG.endpoint,
  );

  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly catalog = signal<VpsProviderCatalog | null>(null);
  private readonly catalogProviderUUID = signal<string | null>(null);
  readonly catalogLoading = signal(false);
  private readonly catalogFetchKey = signal<string | null>(null);
  private catalogRequestId = 0;

  private readonly providerFormOptions = computed<ConfigurableCrudOption[]>(() => {
    const current = normalizeString(this.formValues()['providerUUID']);
    return [...this.providers()]
      .filter((provider) => provider.HvrIsActive === 1 || provider.HvrUUID === current)
      .sort((a, b) =>
        a.HvrName.localeCompare(b.HvrName, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .map((provider) => toProviderOption(provider));
  });

  private readonly providerFilterOptions = computed<ConfigurableCrudOption[]>(() =>
    [...this.providers()]
      .sort((a, b) =>
        a.HvrName.localeCompare(b.HvrName, undefined, { numeric: true, sensitivity: 'base' }),
      )
      .map((provider) => toProviderOption(provider)),
  );

  private readonly selectedProvider = computed(() =>
    this.providerById(normalizeString(this.formValues()['providerUUID'])),
  );

  private readonly selectedRegion = computed(
    () =>
      normalizeString(this.formValues()['region']) ??
      normalizeString(this.formValues()['regionManual']) ??
      null,
  );

  private readonly regionScopedSizes = computed(() => {
    const sizes = this.catalog()?.sizes ?? [];
    const region = this.selectedRegion();
    if (!region) return sizes;
    const regionAware = sizes.some((size) => Array.isArray(size.regions) && size.regions.length > 0);
    if (!regionAware) return sizes;
    const parent = lightsailParentRegion(region);
    return sizes.filter((size) => {
      if (!Array.isArray(size.regions) || size.regions.length === 0) return true;
      if (size.regions.includes(region)) return true;
      // Lightsail bundles are parent-region scoped; accept AZ or parent match.
      return Boolean(parent && size.regions.includes(parent));
    });
  });

  private readonly regionOptions = computed<ConfigurableCrudOption[]>(() => {
    const current = this.selectedRegion() ?? '';
    return withCurrentOption(this.catalog()?.regions ?? [], current).map((option) => ({
      value: option.id,
      label: option.label || option.id,
      description: option.id && option.id !== option.label ? option.id : undefined,
      searchText: `${option.id} ${option.label}`,
    }));
  });

  private readonly sizeOptions = computed<ConfigurableCrudOption[]>(() => {
    const current =
      normalizeString(this.formValues()['size']) ??
      normalizeString(this.formValues()['sizeManual']) ??
      '';
    const scoped = this.regionScopedSizes();
    // Never keep a stale size that is unavailable in the selected region.
    const options = scoped.some((item) => item.id === current)
      ? withCurrentOption(scoped, current)
      : scoped;
    return buildGroupedSizeOptions(
      options,
      this.catalog()?.provider ?? this.selectedProvider()?.HvrProvider ?? null,
    );
  });

  private readonly locksCatalogSpecs = computed(() => {
    const provider =
      this.catalog()?.provider ?? this.selectedProvider()?.HvrProvider ?? null;
    if (provider === 'digitalocean' || provider === 'lightsail') return true;
    const size =
      normalizeString(this.formValues()['size']) ??
      normalizeString(this.formValues()['sizeManual']);
    if (!size) return false;
    const option = (this.catalog()?.sizes ?? []).find((item) => item.id === size);
    return Boolean(
      option &&
        (catalogNumber(option.cpu) !== null ||
          catalogNumber(option.memoryMb) !== null ||
          catalogNumber(option.diskGb) !== null ||
          catalogNumber(option.transferGb) !== null),
    );
  });

  constructor() {
    const masterScope =
      (inject(ActivatedRoute).snapshot.data?.['scope'] ?? 'tenant') === 'master';
    super({
      ...HOSTING_VPS_PLAN_CONFIG,
      canCreate: masterScope,
      canEdit: masterScope,
      canDelete: masterScope,
      fields: HOSTING_VPS_PLAN_CONFIG.fields.map((field) => {
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
            requiredWhen: () =>
              Boolean(this.catalog()?.sizes?.length) && !this.catalog()?.regions?.length,
          };
        }
        if (field.key === 'size') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => {
              if (!(this.catalog()?.sizes?.length)) return true;
              if (this.catalog()?.regions?.length && !this.selectedRegion()) return true;
              return false;
            },
            requiredWhen: () => {
              if (!(this.catalog()?.sizes?.length)) return false;
              if (this.catalog()?.regions?.length) return Boolean(this.selectedRegion());
              return true;
            },
          };
        }
        if (field.key === 'sizeManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.sizes?.length),
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
    // Use active(+current) for the form select; column labels fall back via lookupLabel.
    if (key === 'providerUUID') return this.providerFormOptions();
    if (key === 'region') return this.regionOptions();
    if (key === 'size') return this.sizeOptions();
    return [];
  }

  protected override lookupLabel(key: string, value: unknown): string {
    if (key === 'providerUUID') {
      const option = this.providerFilterOptions().find(
        (item) => String(item.value ?? '') === String(value ?? ''),
      );
      if (option?.label) return option.label;
      const provider = String(
        this.rows().find((row) => String(row['HostingVpsProviderHvrUUID'] ?? '') === String(value ?? ''))?.[
          'HvpProvider'
        ] ?? '',
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
      HvpConfig: parsePlanConfig(row['HvpConfig']),
    }));

    if (!providerUUID) return parsed;
    return parsed.filter((item) => {
      const itemProviderUUID = String(item['HostingVpsProviderHvrUUID'] ?? '');
      const itemProvider = String(item['HvpProvider'] ?? '') as VpsProvider;
      return (
        itemProviderUUID === providerUUID ||
        this.resolveProviderUUIDForProvider(itemProvider) === providerUUID
      );
    });
  }

  protected override formValuesFromRecord(row: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next = super.formValuesFromRecord(row);
    const config = parsePlanConfig(row['HvpConfig']);
    const region = String(row['HvpRegion'] ?? '');
    const size = String(row['HvpSize'] ?? '');
    const providerUUID =
      this.providerById(String(row['HostingVpsProviderHvrUUID'] ?? ''))?.HvrUUID ??
      this.resolveProviderUUIDForProvider(String(row['HvpProvider'] ?? '') as VpsProvider);

    next['providerUUID'] = providerUUID;
    next['region'] = region;
    next['regionManual'] = region;
    next['size'] = size;
    next['sizeManual'] = size;
    next['setupFee'] = Number(row['HvpSetupFee'] ?? 0);
    next['cpu'] = Number(config?.cpu ?? 0);
    next['memoryMb'] = Number(config?.memoryMb ?? 0);
    next['diskGb'] = Number(config?.diskGb ?? 0);
    next['transferGb'] = Number(config?.transferGb ?? 0);
    next['notes'] = String(config?.notes ?? '');
    next['isActive'] = Number(row['HvpIsActive'] ?? 0) === 1 ? 1 : 0;
    next['price'] = Number(row['HvpPrice'] ?? 0);

    void this.fetchProviderCatalog(providerUUID, {
      region: normalizeString(next['region']) ?? normalizeString(next['regionManual']),
      force: true,
    });
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
    const sourceName = String(values['name'] ?? row['HvpName'] ?? '').trim();
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
      this.clearSizeSelection('Region/zone changed. Select a size available in this placement.');
      this.refreshCatalogForSelectedRegion(String(value ?? ''));
      return;
    }
    if (key === 'regionManual') {
      this.patchFormValues({ region: String(value ?? '') });
      this.clearSizeSelection('Region/zone changed. Select a size available in this placement.');
      this.refreshCatalogForSelectedRegion(String(value ?? ''));
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
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const providerUUID = normalizeString(payload['providerUUID']);
    const providerRecord = this.providerById(providerUUID);
    const region =
      normalizeString(payload['region']) ?? normalizeString(payload['regionManual']);
    const size = normalizeString(payload['size']) ?? normalizeString(payload['sizeManual']);
    const notes = normalizeString(payload['notes']);
    const setupFee = Number(
      this.formValues()['setupFee'] ?? this.editingRecord()?.['HvpSetupFee'] ?? 0,
    );
    const currency =
      normalizeString(this.editingRecord()?.['HvpCurrency'] as string | undefined) ??
      this.defaultCurrency() ??
      'BRL';
    const sizeOption = (this.catalog()?.sizes ?? []).find((item) => item.id === size);
    const existingConfig = parsePlanConfig(this.editingRecord()?.['HvpConfig']);
    const sizeFamily =
      normalizeString(sizeOption?.family) ?? normalizeString(existingConfig?.sizeFamily);
    const sizeCategory =
      normalizeString(sizeOption?.category) ?? normalizeString(existingConfig?.sizeCategory);
    const provider = providerRecord?.HvrProvider ?? this.catalog()?.provider ?? null;
    const lightsailAz = provider === 'lightsail' ? lightsailAvailabilityZone(region) : null;
    const lightsailAwsRegion = provider === 'lightsail'
      ? lightsailParentRegion(region) || region
      : null;

    return {
      name: String(payload['name'] ?? '').trim(),
      providerUUID: providerRecord?.HvrUUID ?? providerUUID,
      region,
      size,
      price: Number(payload['price'] ?? 0),
      setupFee: Number.isFinite(setupFee) ? setupFee : 0,
      config: {
        cpu: Number(payload['cpu'] ?? 0) || null,
        memoryMb: Number(payload['memoryMb'] ?? 0) || null,
        diskGb: Number(payload['diskGb'] ?? 0) || null,
        transferGb: Number(payload['transferGb'] ?? 0) || null,
        providerRegionId: region,
        availabilityZone: lightsailAz,
        awsRegion: lightsailAwsRegion,
        providerSizeId: size,
        sizeFamily,
        sizeCategory,
        notes,
      } satisfies HostingVpsPlanConfig,
      isActive: truthyNumber(payload['isActive']) === 1,
      currency,
      notes,
    };
  }

  protected override validatePayload(payload: ConfigurableCrudRecord): boolean {
    const providerUUID = normalizeString(payload['providerUUID']);
    if (!providerUUID || !this.providerById(providerUUID)) {
      this.snack.warning(this.t('Select a valid VPS provider.'));
      return false;
    }
    return super.validatePayload(payload);
  }

  private async fetchProviders() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        this.providerEndpoint(),
      );
      const list = Array.isArray(result?.data?.items) ? result.data.items : [];
      this.providers.set(
        list.map((item) => ({
          ...item,
          HvrConfig: parseObjectConfig<VpsProviderConfig>(item.HvrConfig),
        })),
      );
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to load VPS providers.'));
    }
  }

  private refreshCatalogForSelectedRegion(regionValue: string): void {
    const providerUUID =
      normalizeString(this.formValues()['providerUUID']) ?? this.catalogProviderUUID();
    if (!providerUUID) return;
    const provider =
      this.catalog()?.provider ?? this.selectedProvider()?.HvrProvider ?? null;
    // DigitalOcean already returns size.regions[] in one catalog payload.
    if (provider !== 'lightsail') return;
    void this.fetchProviderCatalog(providerUUID, {
      region: normalizeString(regionValue),
      force: true,
    });
  }

  private async fetchProviderCatalog(
    providerUUID: string | null | undefined,
    options?: { region?: string | null; force?: boolean },
  ) {
    const uuid = normalizeString(providerUUID);
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      this.catalogFetchKey.set(null);
      return;
    }

    const region = normalizeString(options?.region) ??
      normalizeString(this.formValues()['region']) ??
      normalizeString(this.formValues()['regionManual']);
    const fetchKey = `${uuid}:${region ?? ''}`;
    if (!options?.force && this.catalogFetchKey() === fetchKey && this.catalog()) return;

    const requestId = ++this.catalogRequestId;
    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);
    // Clear immediately so Proxmox node switches do not keep filtering the prior
    // node's templates (which looks like an empty image list for the new region).
    this.catalog.set(null);
    this.catalogFetchKey.set(fetchKey);

    try {
      const query = region ? `?region=${encodeURIComponent(region)}` : '';
      const result = await this.api.get<{ data?: { catalog?: VpsProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog${query}`,
      );
      if (requestId !== this.catalogRequestId) return;
      this.catalog.set(result?.data?.catalog ?? null);
      const size =
        normalizeString(this.formValues()['size']) ??
        normalizeString(this.formValues()['sizeManual']);
      if (size) {
        const catalogSizes = result?.data?.catalog?.sizes ?? [];
        const provider =
          result?.data?.catalog?.provider ?? this.selectedProvider()?.HvrProvider ?? null;
        // DigitalOcean/Lightsail sizes are catalog-scoped. Private-cloud plans use free-form
        // size labels + explicit CPU/RAM/disk — never wipe those specs when flavors are empty.
        const requiresCatalogSize = provider === 'digitalocean' || provider === 'lightsail';
        if (requiresCatalogSize && catalogSizes.length > 0) {
          const available = catalogSizes.some((item) => item.id === size);
          if (!available) {
            this.clearSizeSelection(
              'Selected size is not available in this region. Choose another plan.',
            );
          } else {
            void this.applySelectedSizeSpecs(size);
          }
        } else if (requiresCatalogSize && catalogSizes.length === 0) {
          this.clearSizeSelection(
            'Selected size is not available in this region. Choose another plan.',
          );
        } else if (catalogSizes.some((item) => item.id === size)) {
          void this.applySelectedSizeSpecs(size);
        }
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

    const region = this.selectedRegion();
    const provider =
      this.catalog()?.provider ?? this.selectedProvider()?.HvrProvider ?? null;
    const requiresCatalogSize = provider === 'digitalocean' || provider === 'lightsail';
    if (
      requiresCatalogSize &&
      region &&
      Array.isArray(option.regions) &&
      option.regions.length > 0 &&
      !option.regions.includes(region) &&
      !option.regions.includes(lightsailParentRegion(region) ?? '')
    ) {
      this.clearSizeSelection(
        'Selected size is not available in this region/zone. Choose another plan.',
      );
      return;
    }

    const patch: ConfigurableCrudRecord = {};
    const cpu = catalogNumber(option.cpu);
    const memoryMb = catalogNumber(option.memoryMb);
    const diskGb = catalogNumber(option.diskGb);
    const transferGb = catalogNumber(option.transferGb);
    if (cpu !== null) patch['cpu'] = cpu;
    if (memoryMb !== null) patch['memoryMb'] = memoryMb;
    if (diskGb !== null) patch['diskGb'] = diskGb;
    if (transferGb !== null) patch['transferGb'] = transferGb;

    const usdMonthly = catalogNumber(option.priceMonthly);
    if (usdMonthly !== null && usdMonthly > 0) {
      const targetCurrency = (this.defaultCurrency() || 'BRL').toUpperCase();
      const convertedMonthly = await convertUsdAmount(usdMonthly, targetCurrency);
      // Mirror provider instance list price into both commercial price and setup.
      // Providers often charge $0 setup; operators can clear setup later if unused.
      patch['price'] = roundMoney(convertedMonthly);
      patch['setupFee'] = roundMoney(convertedMonthly);
    } else if (provider === 'digitalocean' || provider === 'lightsail') {
      // Keep previous zeroing behavior when catalog has no list price.
      patch['setupFee'] = 0;
    }

    if (!Object.keys(patch).length) return;
    this.patchFormValues(patch);
  }

  private clearSizeSelection(message?: string): void {
    const hadSize = Boolean(
      normalizeString(this.formValues()['size']) ??
        normalizeString(this.formValues()['sizeManual']),
    );
    this.patchFormValues({
      size: '',
      sizeManual: '',
      cpu: 0,
      memoryMb: 0,
      diskGb: 0,
      transferGb: 0,
    });
    if (hadSize && message) this.snack.info(this.t(message));
  }

  private providerById(uuid: string | null | undefined): HostingVpsProvider | null {
    const normalized = normalizeString(uuid);
    if (!normalized) return null;
    return this.providers().find((item) => item.HvrUUID === normalized) ?? null;
  }

  private resolveProviderUUIDForProvider(provider: VpsProvider | string): string {
    return (
      this.providers().find(
        (acc) => acc.HvrProvider === provider && acc.HvrIsActive === 1 && acc.HvrIsDefault === 1,
      )?.HvrUUID ??
      this.providers().find((acc) => acc.HvrProvider === provider && acc.HvrIsActive === 1)
        ?.HvrUUID ??
      ''
    );
  }
}

function toProviderOption(provider: HostingVpsProvider): ConfigurableCrudOption {
  return {
    value: provider.HvrUUID,
    label: provider.HvrName,
    description: providerTypeLabel(provider.HvrProvider),
    searchText: `${provider.HvrName} ${provider.HvrProvider}`,
  };
}

function providerTypeLabel(provider: VpsProvider | string): string {
  return PROVIDER_TYPE_OPTIONS.find((opt) => opt.value === provider)?.label ?? String(provider);
}

function parsePlanConfig(value: unknown): HostingVpsPlanConfig | null {
  return parseObjectConfig<HostingVpsPlanConfig>(value);
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

/** `us-east-1a` → `us-east-1`; plain regions pass through. */
function lightsailParentRegion(regionOrAz: string | null | undefined): string | null {
  const value = String(regionOrAz ?? '').trim().toLowerCase();
  if (!value) return null;
  const match = value.match(/^([a-z0-9-]+?)([a-z])$/i);
  if (!match) return String(regionOrAz ?? '').trim() || null;
  const parent = match[1];
  if (/\d$/.test(parent)) return parent;
  return String(regionOrAz ?? '').trim() || null;
}

function lightsailAvailabilityZone(regionOrAz: string | null | undefined): string | null {
  const value = normalizeString(regionOrAz);
  if (!value) return null;
  const parent = lightsailParentRegion(value);
  return parent && parent.toLowerCase() !== value.toLowerCase() ? value : null;
}

function withCurrentOption(options: VpsCatalogOption[], current: string): VpsCatalogOption[] {
  const normalized = normalizeString(current);
  if (!normalized || options.some((opt) => opt.id === normalized)) return options;
  return [{ id: normalized, label: `Custom: ${normalized}` }, ...options];
}

function catalogOptionsToCrud(options: VpsCatalogOption[]): ConfigurableCrudOption[] {
  return options.map((option) => ({
    value: option.id,
    label: option.label || option.id,
    description: sizeOptionMeta(option) || undefined,
    searchText: `${option.id} ${option.label}`,
  }));
}

function sizeOptionParts(option: VpsCatalogOption) {
  return (option.label || option.id)
    .split(' • ')
    .map((part) => part.trim())
    .filter(Boolean);
}

function sizeOptionFamily(option: VpsCatalogOption) {
  if (option.family) return String(option.family);
  const derived = deriveLightsailGrouping(option);
  if (derived) return derived.family;
  const head = sizeOptionParts(option)[0] ?? '';
  const [family] = head.split('/').map((part) => part.trim());
  return family || 'Droplet';
}

function sizeOptionCategory(option: VpsCatalogOption) {
  if (option.category) return String(option.category);
  const derived = deriveLightsailGrouping(option);
  if (derived) return derived.category;
  const head = sizeOptionParts(option)[0] ?? '';
  const parts = head.split('/').map((part) => part.trim());
  return parts[1] || '';
}

/** Client-side fallback when Lightsail catalog omits family/category. */
function deriveLightsailGrouping(
  option: VpsCatalogOption,
): { family: string; category: string } | null {
  const id = String(option.slug ?? option.id ?? '').trim().toLowerCase();
  const name = String(option.name ?? option.label ?? '').trim().toLowerCase();
  const looksLightsail =
    /^(?:\d+xlarge|xlarge|large|medium|small|micro|nano)(?:_win)?(?:_\d+_\d+)?$/i.test(id) ||
    /_(?:win_)?\d+_\d+$/i.test(id);
  if (!looksLightsail && !/linux\/unix|windows/i.test(String(option.family ?? ''))) {
    // Still try when name is a bare Lightsail tier like "12Xlarge".
    if (!/^(?:\d+\s*x\s*large|\d+xlarge|xlarge|large|medium|small|micro|nano)\b/i.test(name)) {
      return null;
    }
  }
  const isWindows = id.includes('_win') || id.includes('-win') || name.includes('windows');
  const family = isWindows ? 'Windows' : 'Linux/Unix';
  const tierMatch =
    id.match(/^(\d+xlarge|xlarge|large|medium|small|micro|nano)/i) ||
    name.match(/(\d+\s*x\s*large|\d+xlarge|xlarge|large|medium|small|micro|nano)/i);
  const rawTier = String(tierMatch?.[1] ?? 'other').replace(/\s+/g, '').toLowerCase();
  let category = 'Other';
  if (/^\d+xlarge$/.test(rawTier)) {
    category = rawTier.replace(/xlarge$/, 'Xlarge');
  } else if (rawTier !== 'other') {
    category = rawTier.charAt(0).toUpperCase() + rawTier.slice(1);
  }
  return { family, category };
}

function sizeOptionName(option: VpsCatalogOption) {
  return sizeOptionParts(option)[0] ?? option.label ?? option.id;
}

function sizeOptionPrice(option: VpsCatalogOption) {
  if (typeof option.priceMonthly === 'number' && option.priceMonthly > 0) {
    return `$${option.priceMonthly.toFixed(2)}/mo`;
  }
  return sizeOptionParts(option).find((part) => /\/mo|\/month|\$\d/i.test(part)) ?? '';
}

function sizeOptionSlug(option: VpsCatalogOption) {
  if (option.slug) return String(option.slug);
  const parts = sizeOptionParts(option);
  return parts[parts.length - 1] !== sizeOptionPrice(option)
    ? (parts[parts.length - 1] ?? option.id)
    : option.id;
}

function sizeOptionMeta(option: VpsCatalogOption) {
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
  if (transferGb !== null) {
    specs.push(
      transferGb >= 1024 && transferGb % 1024 === 0
        ? `${transferGb / 1024} TB transfer`
        : `${transferGb} GB transfer`,
    );
  }
  if (specs.length) return specs.join(' · ');

  const slug = sizeOptionSlug(option);
  return sizeOptionParts(option)
    .slice(1)
    .filter((part) => part !== sizeOptionPrice(option) && part !== slug)
    .join(' · ');
}

function sizeOptionPlanLabel(option: VpsCatalogOption) {
  const name = String(option.name ?? '').trim();
  const category = sizeOptionCategory(option);
  const slug = sizeOptionSlug(option);
  const title = name || category || slug;
  const memoryMb = catalogNumber(option.memoryMb);
  const cpu = catalogNumber(option.cpu);
  const memoryLabel =
    memoryMb === null
      ? ''
      : memoryMb >= 1024 && memoryMb % 1024 === 0
        ? `${memoryMb / 1024} GB`
        : `${memoryMb} MB`;
  const summary = [cpu !== null ? `${cpu} vCPU` : '', memoryLabel].filter(Boolean).join(' · ');
  return summary ? `${title} · ${summary}` : title;
}

function sizeOptionDescription(option: VpsCatalogOption) {
  const parts = [
    sizeOptionMeta(option),
    sizeOptionPrice(option),
  ].filter(Boolean);
  return parts.join(' · ') || undefined;
}

function sizeOptionRank(option: VpsCatalogOption) {
  const family = sizeOptionFamily(option).toLowerCase();
  const category = sizeOptionCategory(option).toLowerCase();
  if (family.includes('linux') || family.includes('unix')) return 10 + lightsailTierRank(category);
  if (family.includes('windows')) return 40 + lightsailTierRank(category);
  if (family.includes('basic')) {
    if (category.includes('regular')) return 10;
    if (category.includes('premium amd')) return 11;
    if (category.includes('premium intel')) return 12;
    if (category.includes('gpu')) return 13;
    return 14;
  }
  if (family.includes('general')) return 20;
  if (family.includes('cpu')) return 30;
  if (family.includes('memory')) return 40;
  if (family.includes('storage')) return 50;
  if (family.includes('custom')) return 90;
  return 80;
}

function lightsailTierRank(category: string) {
  const normalized = category.toLowerCase().replace(/\s+/g, '');
  const order = [
    'nano',
    'micro',
    'small',
    'medium',
    'large',
    'xlarge',
    '2xlarge',
    '4xlarge',
    '8xlarge',
    '12xlarge',
    '16xlarge',
    '24xlarge',
    '32xlarge',
    '48xlarge',
  ];
  const index = order.indexOf(normalized);
  return index >= 0 ? index : 30;
}

function sizeOptionMonthlyPrice(option: VpsCatalogOption) {
  if (typeof option.priceMonthly === 'number' && Number.isFinite(option.priceMonthly)) {
    return option.priceMonthly;
  }
  const price = sizeOptionPrice(option).match(/[\d,.]+/);
  if (!price) return Number.POSITIVE_INFINITY;
  return Number(price[0].replace(/,/g, ''));
}

function sortSizeOptions(options: VpsCatalogOption[]) {
  return [...options].sort((a, b) => {
    const rankDiff = sizeOptionRank(a) - sizeOptionRank(b);
    if (rankDiff !== 0) return rankDiff;

    const familyDiff = sizeOptionFamily(a).localeCompare(sizeOptionFamily(b), undefined, {
      sensitivity: 'base',
    });
    if (familyDiff !== 0) return familyDiff;

    const categoryDiff = sizeOptionCategory(a).localeCompare(sizeOptionCategory(b), undefined, {
      sensitivity: 'base',
    });
    if (categoryDiff !== 0) return categoryDiff;

    const priceDiff = sizeOptionMonthlyPrice(a) - sizeOptionMonthlyPrice(b);
    if (priceDiff !== 0) return priceDiff;

    const nameDiff = sizeOptionName(a).localeCompare(sizeOptionName(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (nameDiff !== 0) return nameDiff;

    return sizeOptionSlug(a).localeCompare(sizeOptionSlug(b), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });
}

function buildGroupedSizeOptions(
  options: VpsCatalogOption[],
  provider: VpsProvider | string | null,
): ConfigurableCrudOption[] {
  const enriched = options.map((option) => {
    if (option.family && option.category) return option;
    if (provider === 'lightsail' || deriveLightsailGrouping(option)) {
      const grouping = deriveLightsailGrouping(option);
      if (!grouping) return option;
      return {
        ...option,
        family: option.family || grouping.family,
        category: option.category || grouping.category,
        slug: option.slug || option.id,
      };
    }
    return option;
  });
  const sorted = sortSizeOptions(enriched);
  const canGroup =
    provider === 'digitalocean' ||
    provider === 'lightsail' ||
    enriched.some((option) => Boolean(option.family || option.category));
  if (!canGroup) {
    return catalogOptionsToCrud(sorted);
  }

  const result: ConfigurableCrudOption[] = [];
  let lastFamily = '';
  let lastCategory = '';

  for (const option of sorted) {
    const family = sizeOptionFamily(option);
    const category = sizeOptionCategory(option);

    if (family !== lastFamily) {
      result.push({
        value: `__family__:${family}`,
        label: family,
        disabled: true,
        optionClass: 'select-group-option',
        searchText: family,
      });
      lastFamily = family;
      lastCategory = '';
    }

    if (category && category !== lastCategory) {
      result.push({
        value: `__category__:${family}:${category}`,
        label: `– ${category}`,
        disabled: true,
        optionClass: 'select-subgroup-option',
        searchText: `${family} ${category}`,
      });
      lastCategory = category;
    }

    result.push({
      value: option.id,
      label: sizeOptionPlanLabel(option),
      description: sizeOptionDescription(option),
      optionClass: 'select-plan-option',
      searchText: `${option.id} ${option.label} ${family} ${category} ${option.name ?? ''}`,
    });
  }

  return result;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const fxRateCache = new Map<string, { rate: number; expiresAt: number }>();

async function convertUsdAmount(amountUsd: number, targetCurrency: string): Promise<number> {
  const target = targetCurrency.trim().toUpperCase();
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return 0;
  if (!target || target === 'USD') return amountUsd;

  const cached = fxRateCache.get(target);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return amountUsd * cached.rate;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${encodeURIComponent(target)}`,
    );
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`);
    const payload = (await response.json()) as { rates?: Record<string, number> };
    const rate = Number(payload.rates?.[target] ?? 0);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('FX rate missing');
    fxRateCache.set(target, { rate, expiresAt: now + 60 * 60 * 1000 });
    return amountUsd * rate;
  } catch {
    // Fallback keeps provider USD amount so the operator can adjust manually.
    return amountUsd;
  }
}
