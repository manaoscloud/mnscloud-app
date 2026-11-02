import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import type { HostingVpsProvider } from '../vps.types';

const ENDPOINT = 'system/hosting/vps/network-devices';

type NetworkDeviceType = { code: string; label: string; access: string; roles: string[] };

const ROLE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'vps_public_ip_route', label: 'Routes VPS public IPs' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

/** Network equipment the platform automates, and what each one does per VPS provider (master). */
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'HndUUID',
  pageTitle: 'Network devices',
  pageDescription:
    'Network equipment the platform configures automatically and what each one does for the VPS providers.',
  createTitle: 'New network device',
  editTitle: 'Edit network device',
  dialogDescription:
    'The platform user and password are written only; leave them blank on edit to keep the stored ones.',
  searchPlaceholder: 'Name or API URL',
  emptyLabel: 'No network devices found.',
  deleteTitle: 'Delete network device',
  deleteMessage: 'Delete this network device? Its responsibilities are removed too.',
  deleteSelectedTitle: 'Delete selected network devices',
  deleteSelectedMessage: 'Delete {count} selected network device(s)?',
  savedMessage: 'Network device saved successfully.',
  deletedMessage: 'Network device deleted.',
  deleteFailedMessage: 'Failed to delete network device.',
  bulkDelete: false,
  pageSizeOptions: [10, 25, 100],
  initialValues: {
    status: 1,
    name: '',
    vendor: 'mikrotik_routeros',
    apiUrl: '',
    verifyTls: 1,
    username: '',
    password: '',
    notes: '',
  },
  fields: [],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'HndName', uuidField: 'HndUUID' },
    { id: 'vendor', label: 'Type', field: 'HndVendor' },
    { id: 'apiUrl', label: 'API URL', field: 'HndApiUrl' },
    { id: 'credential', label: 'Credential', kind: 'boolean', field: 'HasCredentials' },
    { id: 'roles', label: 'Responsibilities', kind: 'number', field: 'RoleCount' },
    { id: 'status', label: 'Status', kind: 'status', field: 'HndIsActive' },
  ],
});

@Component({
  selector: 'app-network-devices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingNetworkDevicesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly providers = signal<HostingVpsProvider[]>([]);
  private readonly types = signal<NetworkDeviceType[]>([]);
  /** Device types of the API catalog; types without roles can be registered but not automated. */
  private readonly typeOptions = computed<ConfigurableCrudOption[]>(() =>
    this.types().map((type) => ({
      value: type.code,
      label: type.label,
      description: type.roles.length
        ? `${type.access} · ${this.t('Routes VPS public IPs')}`
        : `${type.access} · ${this.t('No automation yet')}`,
      searchText: `${type.label} ${type.access}`,
    })),
  );
  private readonly providerOptions = computed<ConfigurableCrudOption[]>(() =>
    this.providers().map((provider) => ({
      value: provider.HvrUUID,
      label: provider.HvrName,
      description: provider.HvrProvider,
      searchText: `${provider.HvrName} ${provider.HvrProvider}`,
    })),
  );

  constructor() {
    super({
      ...config,
      fields: [
        { key: 'status', source: 'HndIsActive', label: 'Status', type: 'status', span: 1 },
        {
          key: 'name',
          source: 'HndName',
          payloadKey: 'name',
          label: 'Name',
          placeholder: 'CORE01',
          required: true,
          span: 1,
        },
        {
          key: 'vendor',
          source: 'HndVendor',
          payloadKey: 'vendor',
          label: 'Type',
          type: 'search-select',
          required: true,
          span: 1,
          quickCreate: false,
          quickCreateExemptReason: 'Device types come from the API catalog, not a CRUD resource.',
        },
        {
          key: 'apiUrl',
          source: 'HndApiUrl',
          payloadKey: 'apiUrl',
          label: 'API URL',
          placeholder: 'https://router.example',
          required: true,
          span: 1,
        },
        {
          key: 'verifyTls',
          source: 'HndVerifyTls',
          payloadKey: 'verifyTls',
          label: 'Verify TLS certificate',
          type: 'select',
          options: YES_NO_OPTIONS,
          span: 1,
        },
        {
          key: 'username',
          payloadKey: 'username',
          label: 'API user',
          span: 1,
          help: 'Written only; never shown again.',
        },
        {
          key: 'password',
          payloadKey: 'password',
          label: 'API password',
          type: 'password',
          span: 1,
          help: 'Written only; never shown again.',
        },
        {
          key: 'notes',
          source: 'HndNotes',
          payloadKey: 'notes',
          label: 'Notes',
          type: 'textarea',
          tab: 'notes',
          span: 4,
          rows: 4,
        },
      ],
      relatedCollections: [
        {
          key: 'roles',
          label: 'Responsibilities',
          emptyLabel: 'No responsibilities',
          addLabel: 'Add',
          createTitle: 'New responsibility',
          savedMessage: 'Responsibility saved.',
          deletedMessage: 'Responsibility removed.',
          endpoint: (uuid) => `${ENDPOINT}/${uuid}/roles`,
          deleteEndpoint: (uuid, row) => `${ENDPOINT}/${uuid}/roles/${row['HdrUUID']}`,
          uuidField: 'HdrUUID',
          initialValues: { providerUUID: '', role: 'vps_public_ip_route' },
          fields: [
            {
              key: 'providerUUID',
              source: 'HostingVpsProviderHvrUUID',
              payloadKey: 'providerUUID',
              label: 'VPS provider',
              type: 'search-select',
              required: true,
            },
            {
              key: 'role',
              source: 'HdrRole',
              payloadKey: 'role',
              label: 'Responsibility',
              type: 'select',
              options: ROLE_OPTIONS,
              translateOptions: true,
              required: true,
            },
          ],
          columns: [
            { id: 'provider', label: 'VPS provider', field: 'HvrName' },
            { id: 'role', label: 'Responsibility', field: 'HdrRole' },
          ],
        },
      ],
    });
    void this.fetchProviders();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'providerUUID') return this.providerOptions();
    if (key === 'vendor') return this.typeOptions();
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    const params = new URLSearchParams({ limit: String(this.listLimit), offset: '0' });
    if (filters.search) params.set('search', filters.search);
    const response = await this.api.get(`${ENDPOINT}?${params.toString()}`);
    return (response as { data?: { items?: ConfigurableCrudRecord[] } })?.data?.items ?? [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: payload['name'],
      vendor: payload['vendor'] || 'mikrotik_routeros',
      apiUrl: String(payload['apiUrl'] ?? '').trim(),
      verifyTls: Number(payload['verifyTls'] ?? 1) === 1,
      username: String(payload['username'] ?? '').trim() || null,
      password: payload['password'] ? String(payload['password']) : null,
      notes: payload['notes'] || null,
      isActive: Number(payload['status'] ?? 1) === 1,
    };
  }

  private async fetchProviders() {
    const [providers, types] = await Promise.all([
      this.api.get<{ data?: { items?: HostingVpsProvider[] } }>(
        'system/hosting/vps/providers?limit=500',
      ),
      this.api.get<{ data?: { items?: NetworkDeviceType[] } }>(
        'system/hosting/vps/network-device-types',
      ),
    ]);
    this.providers.set(providers?.data?.items ?? []);
    this.types.set(types?.data?.items ?? []);
  }
}
