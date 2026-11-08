import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilters,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { openTemplatePickerDialog } from '../../../../shared/template-picker-dialog/template-picker-dialog';
import type { HostingVpsInstance, HostingVpsProvider } from '../vps.types';

const IP_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Contracted' },
  { value: 'disabled', label: 'Disabled' },
];

const NETWORK_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'idle', label: 'Not associated' },
  { value: 'applying', label: 'Associating' },
  { value: 'applied', label: 'Associated' },
  { value: 'removing', label: 'Dissociating' },
  { value: 'failed', label: 'Failed' },
];

const ACTIONS = {
  reserve: {
    key: 'reserve',
    label: 'Reserve for platform',
    icon: 'add_circle',
    tooltip: 'Reserve this IP for an internal VPS',
  },
  contract: {
    key: 'contract',
    label: 'Contract',
    icon: 'add_shopping_cart',
    tooltip: 'Contract this public IP',
  },
  assign: { key: 'assign', label: 'Associate', icon: 'link', tooltip: 'Associate with a VPS' },
  unassign: {
    key: 'unassign',
    label: 'Dissociate',
    icon: 'link_off',
    tooltip: 'Dissociate from the VPS',
  },
  retry: { key: 'retry', label: 'Retry', icon: 'replay', tooltip: 'Retry the network change' },
  release: {
    key: 'release',
    label: 'Release',
    icon: 'remove_shopping_cart',
    tooltip: 'Release this public IP',
  },
} satisfies Record<string, ConfigurableCrudRowAction>;

const config = defineCrud({
  endpoint: 'hosting/vps/public-ips',
  uuidField: 'HpiUUID',
  pageTitle: 'VPS public IPs',
  pageDescription:
    'Public IPv4 addresses for VPS on the isolated network: contract one, associate it with a VPS and reach it from the internet.',
  createTitle: 'New public IP',
  editTitle: 'Edit public IP',
  dialogDescription: 'Register a public IPv4 address of the provider pool.',
  searchPlaceholder: 'Address or VPS',
  emptyLabel: 'No public IPs found.',
  deleteTitle: 'Delete public IP',
  deleteMessage: 'Remove this public IP from the pool?',
  deleteSelectedTitle: 'Delete selected public IPs',
  deleteSelectedMessage: 'Remove {count} selected public IP(s) from the pool?',
  savedMessage: 'Public IP saved successfully.',
  deletedMessage: 'Public IP removed.',
  deleteFailedMessage: 'Failed to remove public IP.',
  bulkDelete: false,
  statusFilter: false,
  pageSizeOptions: [10, 25, 100],
  rowActions: Object.values(ACTIONS),
  listFilters: [
    {
      key: 'providerUUID',
      label: 'Provider',
      paramKey: 'providerUUID',
      type: 'search-select',
      placeholder: 'Search providers',
      emptyLabel: 'No records found.',
      span: 1,
    },
    {
      key: 'ipStatus',
      label: 'Situation',
      paramKey: 'status',
      type: 'select',
      options: IP_STATUS_OPTIONS,
      translateOptions: true,
      span: 1,
    },
  ],
  initialValues: { providerUUID: '', address: '', ipStatus: 'available', ptrName: '', notes: '' },
  fields: [],
  columns: [
    {
      id: 'address',
      label: 'Address',
      kind: 'identity',
      field: 'HpiAddress',
      uuidField: 'HpiUUID',
      copyable: true,
    },
    {
      id: 'provider',
      label: 'Provider',
      kind: 'related',
      field: 'HvrName',
      uuidField: 'HostingVpsProviderHvrUUID',
    },
    {
      id: 'ipStatus',
      label: 'Situation',
      kind: 'status',
      field: 'HpiStatus',
      options: IP_STATUS_OPTIONS,
      className: 'status-col',
    },
    { id: 'vps', label: 'VPS', field: 'HviName' },
    { id: 'privateAddress', label: 'Private IP', field: 'HpiPrivateAddress', copyable: true },
    {
      id: 'networkState',
      label: 'Association',
      kind: 'status',
      field: 'HpiNetworkState',
      options: NETWORK_STATE_OPTIONS,
      className: 'status-col',
    },
    { id: 'ptr', label: 'Reverse DNS', field: 'HpiPtrName', copyable: true },
    { id: 'tenant', label: 'Tenant', field: 'TenantName' },
    { id: 'lastError', label: 'Last error', field: 'HpiLastError' },
  ],
});

@Component({
  selector: 'app-vps-public-ips',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsPublicIpsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly route = inject(ActivatedRoute);
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly instances = signal<HostingVpsInstance[]>([]);
  private readonly platformScope = computed(
    () => (this.route.snapshot.data?.['scope'] ?? 'tenant') === 'master',
  );
  private readonly base = computed(() =>
    this.platformScope() ? 'system/hosting/vps' : 'hosting/vps',
  );
  private readonly ipEndpoint = computed(() => `${this.base()}/public-ips`);

  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers()
      .filter((provider) => provider.HvrProvider === 'proxmox')
      .map((provider) => ({
        value: provider.HvrUUID,
        label: provider.HvrName,
        description: provider.HvrProvider,
        searchText: `${provider.HvrName} ${provider.HvrProvider}`,
      })),
  );

  constructor() {
    super({
      ...config,
      // The master registers, edits or removes pool IPs; a tenant's "New" contracts the next free
      // IP (it never browses the pool, which may hold thousands of addresses).
      canCreate: true,
      // A tenant edits only the reverse DNS name (PTR) of an IP it contracted (PD5b).
      canEditRow: (row) =>
        this.platformScope() || (Number(row['IsMine']) === 1 && row['HpiStatus'] === 'allocated'),
      canDeleteRow: (row) => this.platformScope() && row['HpiStatus'] !== 'allocated',
      fields: [
        {
          key: 'providerUUID',
          source: 'HostingVpsProviderHvrUUID',
          payloadKey: 'providerUUID',
          label: 'Provider',
          type: 'search-select',
          span: 1,
          disabledWhen: ({ editing }) => editing,
          // A tenant with a single provider does not choose it.
          requiredWhen: () => this.platformScope() || this.providerOptions().length > 1,
          hiddenWhen: () => !this.platformScope() && this.providerOptions().length <= 1,
        },
        {
          key: 'address',
          source: 'HpiAddress',
          payloadKey: 'address',
          label: 'Address',
          placeholder: '203.0.113.10',
          span: 1,
          disabledWhen: ({ editing }) => editing,
          requiredWhen: () => this.platformScope(),
          hiddenWhen: () => !this.platformScope(),
        },
        {
          key: 'ipStatus',
          source: 'HpiStatus',
          payloadKey: 'status',
          label: 'Situation',
          type: 'select',
          options: IP_STATUS_OPTIONS.filter((option) => option.value !== 'allocated'),
          translateOptions: true,
          span: 1,
          hiddenWhen: ({ editing }) => !editing,
        },
        {
          key: 'ptrName',
          source: 'HpiPtrName',
          payloadKey: 'ptrName',
          label: 'Reverse DNS (PTR)',
          placeholder: 'mail.example.com',
          help: 'Host name the reverse DNS of this IP returns. Empty = generated name. For e-mail, the name must also resolve to this IP.',
          span: 1,
          hiddenWhen: () => this.platformScope(),
        },
        {
          key: 'notes',
          source: 'HpiNotes',
          payloadKey: 'notes',
          label: 'Notes',
          type: 'textarea',
          tab: 'notes',
          span: 4,
          rows: 4,
          hiddenWhen: () => !this.platformScope(),
        },
      ],
    });
    void this.fetchCatalog();
    if (!this.platformScope()) {
      this.config.createTitle = 'Contract public IP';
      this.config.dialogDescription =
        'A free public IPv4 address is contracted automatically and billed monthly from your prepaid credit until you release it.';
      this.config.savedMessage = 'Public IP contracted.';
    }
  }

  protected override listEndpoint(): string {
    return this.ipEndpoint();
  }

  protected override createEndpoint(): string {
    return this.platformScope() ? this.ipEndpoint() : `${this.ipEndpoint()}/allocate`;
  }

  protected override updateEndpoint(): string {
    return this.ipEndpoint();
  }

  protected override deleteEndpointFor(_row: ConfigurableCrudRecord): string {
    return this.ipEndpoint();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerUUID') return this.providerOptions();
    return [];
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    if (filter.key === 'providerUUID') return this.providerOptions();
    return super.listFilterOptions(filter);
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const params = new URLSearchParams({ limit: String(this.listLimit), offset: '0' });
    if (filters.search) params.set('search', filters.search);
    for (const filter of this.listFilters()) {
      const value = filters.extra[filter.key];
      if (value === null || value === undefined || value === '') continue;
      params.set(filter.paramKey ?? filter.key, String(value));
    }
    const response = await this.api.get(`${this.listEndpoint()}?${params.toString()}`);
    return (response as { data?: { items?: ConfigurableCrudRecord[] } })?.data?.items ?? [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    if (this.editingRecord() && !this.platformScope()) {
      return { ptrName: String(payload['ptrName'] ?? '').trim() };
    }
    if (this.editingRecord()) {
      return { status: payload['status'] || null, notes: payload['notes'] || null };
    }
    if (!this.platformScope()) {
      const options = this.providerOptions();
      return {
        providerUUID:
          payload['providerUUID'] || (options.length === 1 ? String(options[0].value) : null),
      };
    }
    return {
      providerUUID: payload['providerUUID'],
      address: String(payload['address'] ?? '').trim(),
      notes: payload['notes'] || null,
    };
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const mine = Number(row['IsMine']) === 1;
    const associated = !!row['HostingVpsInstanceHviUUID'];
    const state = String(row['HpiNetworkState'] ?? '');
    const actions: ConfigurableCrudRowAction[] = [];
    if (!this.platformScope() && row['HpiStatus'] === 'available') actions.push(ACTIONS.contract);
    if (this.platformScope() && row['HpiStatus'] === 'available') actions.push(ACTIONS.reserve);
    if ((mine || this.platformScope()) && row['HpiStatus'] === 'allocated' && !associated)
      actions.push(ACTIONS.assign);
    if ((mine || this.platformScope()) && row['HpiStatus'] === 'allocated' && !associated)
      actions.push(ACTIONS.release);
    if ((mine || this.platformScope()) && associated && state !== 'removing')
      actions.push(ACTIONS.unassign);
    if ((mine || this.platformScope()) && associated && state === 'failed')
      actions.push(ACTIONS.retry);
    return actions;
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    const uuid = String(row['HpiUUID'] ?? '');
    const address = String(row['HpiAddress'] ?? '');
    if (action.key === 'reserve') {
      const ok = await this.confirmAction(
        'Reserve public IP for platform',
        `Reserve ${address} for an internal VPS? The address leaves the available pool without a commercial subscription.`,
        'Reserve for platform',
      );
      if (ok) await this.post(`${uuid}/allocate`, {}, 'Public IP reserved for platform.');
      return;
    }
    if (action.key === 'contract') {
      const ok = await this.confirmAction(
        'Contract public IP',
        `Contract the public IP ${address}? It is billed monthly from your prepaid credit until you release it.`,
        'Contract',
      );
      if (ok) await this.post(`${uuid}/allocate`, {}, 'Public IP contracted.');
      return;
    }
    if (action.key === 'assign') {
      const instanceUUID = await this.pickInstance(row);
      if (instanceUUID)
        await this.post(`${uuid}/assign`, { instanceUUID }, 'Public IP associated with the VPS.');
      return;
    }
    if (action.key === 'unassign') {
      const ok = await this.confirmAction(
        'Dissociate public IP',
        `Dissociate ${address} from ${String(row['HviName'] ?? 'the VPS')}? The VPS stops receiving traffic on it; the IP stays contracted.`,
        'Dissociate',
      );
      if (ok) await this.post(`${uuid}/unassign`, {}, 'Public IP dissociated from the VPS.');
      return;
    }
    if (action.key === 'retry') {
      await this.post(`${uuid}/retry`, {}, 'Public IP network applied.');
      return;
    }
    if (action.key === 'release') {
      const ok = await this.confirmAction(
        'Release public IP',
        this.platformScope() && !row['UserUsrUUID']
          ? `Release ${address}? The address returns to the available pool.`
          : `Release ${address}? Its monthly charge ends and the address returns to the pool.`,
        'Release',
      );
      if (ok) await this.post(`${uuid}/release`, {}, 'Public IP released.');
    }
  }

  private async post(path: string, body: unknown, message: string) {
    this.mutating.set(true);
    try {
      await this.api.post(`${this.ipEndpoint()}/${path}`, body);
      this.snack.success(this.t(message));
    } catch {
      // The API error toast already explains the refusal.
    } finally {
      this.mutating.set(false);
      this.refreshList();
    }
  }

  private async pickInstance(row: ConfigurableCrudRecord): Promise<string | undefined> {
    await this.fetchCatalog();
    const providerUUID = String(row['HostingVpsProviderHvrUUID'] ?? '');
    const candidates = this.instances().filter((instance) => {
      const config =
        typeof instance.HviConfig === 'string'
          ? (() => {
              try {
                return JSON.parse(instance.HviConfig as unknown as string);
              } catch {
                return {};
              }
            })()
          : (instance.HviConfig ?? {});
      return (
        instance.HostingVpsProviderHvrUUID === providerUUID &&
        (!this.platformScope() ||
          (instance.UserUsrUUID ?? null) === (row['UserUsrUUID'] ?? null)) &&
        !!instance.HviExternalId &&
        !!(config as Record<string, unknown>)['privateIpv4']
      );
    });
    if (!candidates.length) {
      this.snack.warning(
        this.t('No VPS on the isolated network of this provider can receive the IP.'),
      );
      return undefined;
    }
    return await openTemplatePickerDialog(this.dialog, {
      title: 'Associate public IP',
      description: 'Choose the VPS that receives this public IP.',
      useLabel: 'Associate',
      items: candidates.map((instance) => ({
        id: instance.HviUUID,
        name: instance.HviName,
        description: instance.HviStatus ?? '',
      })),
    });
  }

  private async fetchCatalog() {
    const base = this.base();
    const [providers, instances] = await Promise.all([
      this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(`${base}/providers?limit=500`),
      this.api.get<{ data?: { items?: HostingVpsInstance[] } }>(`${base}/instances?limit=1000`),
    ]);
    this.providers.set(providers?.data?.items ?? []);
    this.instances.set(instances?.data?.items ?? []);
  }
}
