import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
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

const HOSTING_VPS_PLAN_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'hosting/vps/plans',
  uuidField: 'HvpUUID',
  pageTitle: 'VPS Plans',
  pageDescription: 'Define commercial prices and technical defaults for provider instance sizes.',
  createTitle: 'New VPS plan',
  editTitle: 'Edit VPS plan',
  dialogDescription: 'Create a commercial VPS plan from provider catalog data.',
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
  tabLabels: {
    storage: 'Config',
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
      placeholder: 'nyc3',
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
    },
    {
      key: 'sizeManual',
      source: 'HvpSize',
      payloadKey: 'sizeManual',
      label: 'Size / Bundle',
      placeholder: 's-1vcpu-1gb',
      tab: 'storage',
      span: 2,
    },
    {
      key: 'cpu',
      source: 'HvpConfig',
      payloadKey: 'cpu',
      label: 'CPU',
      type: 'number',
      tab: 'storage',
      span: 1,
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
      rows: 6,
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
    return catalogOptionsToCrud(
      sortSizeOptions(withCurrentOption(this.catalog()?.sizes ?? [], current)),
    );
  });

  constructor() {
    super({
      ...HOSTING_VPS_PLAN_CONFIG,
      fields: HOSTING_VPS_PLAN_CONFIG.fields.map((field) => {
        if (field.key === 'region') {
          return {
            ...field,
            loading: () => this.catalogLoading(),
            hiddenWhen: () => !(this.catalog()?.regions?.length),
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
          };
        }
        if (field.key === 'sizeManual') {
          return {
            ...field,
            hiddenWhen: () => Boolean(this.catalog()?.sizes?.length),
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

    void this.fetchProviderCatalog(providerUUID);
    return next;
  }

  override startCreate(): void {
    this.catalog.set(null);
    this.catalogProviderUUID.set(null);
    super.startCreate();
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
      void this.fetchProviderCatalog(normalizeString(value));
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
      this.applySelectedSizeSpecs(size);
      return;
    }
    if (key === 'sizeManual') {
      const size = String(value ?? '');
      this.patchFormValues({ size });
      this.applySelectedSizeSpecs(size);
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
        providerSizeId: size,
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

  private async fetchProviderCatalog(providerUUID: string | null | undefined) {
    const uuid = normalizeString(providerUUID);
    if (!uuid) {
      this.catalog.set(null);
      this.catalogProviderUUID.set(null);
      return;
    }
    if (this.catalogProviderUUID() === uuid && this.catalog()) return;
    if (this.catalogLoading()) return;

    this.catalogLoading.set(true);
    this.catalogProviderUUID.set(uuid);

    try {
      const result = await this.api.get<{ data?: { catalog?: VpsProviderCatalog } }>(
        `${this.providerEndpoint()}/${uuid}/catalog`,
      );
      this.catalog.set(result?.data?.catalog ?? null);
      const size =
        normalizeString(this.formValues()['size']) ??
        normalizeString(this.formValues()['sizeManual']);
      if (size) this.applySelectedSizeSpecs(size);
    } catch (error) {
      this.catalog.set(null);
      this.snack.error(this.errorMessage(error) || this.t('Failed to load provider catalog.'));
    } finally {
      this.catalogLoading.set(false);
    }
  }

  private applySelectedSizeSpecs(value: string | null | undefined) {
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

function sizeOptionName(option: VpsCatalogOption) {
  return sizeOptionParts(option)[0] ?? option.label ?? option.id;
}

function sizeOptionPrice(option: VpsCatalogOption) {
  return sizeOptionParts(option).find((part) => /\/mo|\/month|\$\d/i.test(part)) ?? '';
}

function sizeOptionSlug(option: VpsCatalogOption) {
  const parts = sizeOptionParts(option);
  return parts[parts.length - 1] !== sizeOptionPrice(option)
    ? (parts[parts.length - 1] ?? option.id)
    : option.id;
}

function sizeOptionMeta(option: VpsCatalogOption) {
  const slug = sizeOptionSlug(option);
  return sizeOptionParts(option)
    .slice(1)
    .filter((part) => part !== sizeOptionPrice(option) && part !== slug)
    .join(' · ');
}

function sizeOptionRank(option: VpsCatalogOption) {
  const name = sizeOptionName(option).toLowerCase();
  if (name.includes('basic') && !name.includes('premium')) return 10;
  if (name.includes('basic') && name.includes('premium')) return 15;
  if (name.includes('general purpose')) return 20;
  if (name.includes('cpu')) return 30;
  if (name.includes('memory')) return 40;
  if (name.includes('storage')) return 50;
  if (name.includes('custom')) return 90;
  return 80;
}

function sizeOptionMonthlyPrice(option: VpsCatalogOption) {
  const price = sizeOptionPrice(option).match(/[\d,.]+/);
  if (!price) return Number.POSITIVE_INFINITY;
  return Number(price[0].replace(/,/g, ''));
}

function sortSizeOptions(options: VpsCatalogOption[]) {
  return [...options].sort((a, b) => {
    const rankDiff = sizeOptionRank(a) - sizeOptionRank(b);
    if (rankDiff !== 0) return rankDiff;

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
