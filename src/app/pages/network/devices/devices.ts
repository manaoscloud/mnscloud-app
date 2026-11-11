import { Component, computed, inject, resource } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { injectPlatformScope } from '../../../core/scope/route-scope';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  ACCESS_COLUMNS,
  ACCESS_INITIAL_VALUES,
  DEVICE_CLASS_OPTIONS,
  LIFECYCLE_OPTIONS,
  NETWORK_PATH_OPTIONS,
  NetworkDeviceType,
  NetworkDeviceTypeCatalog,
  YES_NO_OPTIONS,
  accessFieldChange,
  accessFields,
  accessMethodsFor,
  accessPayload,
  crudRights,
  crudTexts,
  formFlag,
  formText,
  formTexts,
  injectNetworkPermission,
  networkBase,
  optionColumn,
  recordState,
  stateFields,
  statusField,
} from '../network-options';
import { credentialCollectionConfig } from '../network-credentials';

type Translate = (key: string) => string;

/** Devices copied from Hosting network devices keep being edited there (the API refuses here). */
function managedByHosting(row: ConfigurableCrudRecord): boolean {
  return Number(row['ManagedByHosting'] ?? 0) === 1;
}

function hostKeyText(row: ConfigurableCrudRecord, translate: Translate): string {
  const fingerprint = formText(row['NwdHostKeyFingerprint']);
  if (!fingerprint) return translate('network.hostKeyNotPinned');
  const algorithm = formText(row['NwdHostKeyAlgorithm']);
  return algorithm ? `${algorithm} ${fingerprint}` : fingerprint;
}

/** Record, network path and the read-only pinned host key (credentials are their own tab). */
function deviceFields(platform: boolean, translate: Translate): ConfigurableCrudField[] {
  const sites = `${networkBase(platform)}/sites?status=1`;
  return [
    statusField('Nwd'),
    {
      key: 'name',
      source: 'NwdName',
      label: 'Name',
      required: true,
      span: 1,
      placeholder: 'network.deviceNamePlaceholder',
    },
    {
      key: 'siteUUID',
      source: 'NetworkSiteNwsUUID',
      label: 'network.site',
      type: 'search-select',
      required: true,
      span: 1,
      help: 'network.deviceSiteHelp',
      remoteLookup: {
        endpoint: sites,
        uuidField: 'NwsUUID',
        labelField: 'NwsName',
        selectedLabelField: 'SiteName',
        descriptionField: 'CustomerName',
      },
    },
    {
      key: 'vendorType',
      source: 'NwdVendorType',
      label: 'network.vendorType',
      type: 'search-select',
      required: true,
      span: 1,
      help: 'network.vendorTypeHelp',
      quickCreate: false,
      quickCreateExemptReason:
        'Device types come from the API adapter catalog, not a CRUD resource.',
    },
    {
      key: 'deviceClass',
      source: 'NwdDeviceClass',
      label: 'network.deviceClassLabel',
      type: 'select',
      options: DEVICE_CLASS_OPTIONS,
      required: true,
      span: 1,
    },
    { key: 'model', source: 'NwdModel', label: 'Model', span: 1 },
    {
      key: 'osVersion',
      source: 'NwdOsVersion',
      label: 'network.osVersion',
      span: 1,
      placeholder: 'network.osVersionPlaceholder',
      help: 'network.osVersionHelp',
    },
    {
      key: 'lifecycle',
      source: 'NwdLifecycle',
      label: 'network.lifecycleLabel',
      type: 'select',
      options: LIFECYCLE_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'supportEndDate',
      source: 'NwdSupportEndDate',
      label: 'network.supportEndDate',
      type: 'date',
      span: 1,
      help: 'network.supportEndDateHelp',
    },
    {
      key: 'managementHost',
      source: 'NwdManagementHost',
      label: 'network.managementHost',
      tab: 'network',
      span: 1,
      help: 'network.managementHostHelp',
    },
    {
      key: 'networkPath',
      source: 'NwdNetworkPath',
      label: 'network.pathLabel',
      type: 'select',
      options: NETWORK_PATH_OPTIONS,
      required: true,
      tab: 'network',
      span: 1,
      help: 'network.pathHelp',
    },
    {
      key: 'apiUrl',
      source: 'NwdApiUrl',
      label: 'network.apiUrl',
      tab: 'network',
      span: 1,
      help: 'network.apiUrlHelp',
    },
    {
      key: 'verifyTls',
      source: 'NwdVerifyTls',
      label: 'network.verifyTls',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'hostKey',
      label: 'network.hostKey',
      tab: 'authentication',
      span: 1,
      fromRecord: (_value, row) => hostKeyText(row, translate),
      hiddenWhen: ({ editing }) => !editing,
      disabledWhen: () => true,
      help: 'network.hostKeyHelp',
    },
    {
      key: 'hostKeyPinnedAt',
      source: 'NwdHostKeyPinnedAt',
      label: 'network.hostKeyPinnedAt',
      type: 'datetime',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => !values['hostKeyPinnedAt'],
      disabledWhen: () => true,
    },
    { key: 'monitoringAgentUUID', source: 'MonitoringAgentMagUUID', label: 'Agent', hidden: true },
    ...stateFields('Nwd'),
  ];
}

/** PUT replaces the text fields: the whole form is sent; credentials never are. */
function devicePayload(values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  return {
    ...formTexts(values, [
      'siteUUID',
      'name',
      'deviceClass',
      'vendorType',
      'model',
      'osVersion',
      'managementHost',
      'apiUrl',
      'networkPath',
      'lifecycle',
      'supportEndDate',
      'monitoringAgentUUID',
    ]),
    verifyTls: formFlag(values['verifyTls'], 1),
    ...recordState(values),
  };
}

/**
 * Credentials of the device (stored in the vault, never shown): their own table component owns
 * the queued value flow (`device-credentials.ts`).
 */
function credentialCollection(base: string, canWrite: boolean): ConfigurableCrudRelatedCollection {
  const endpoint = (device: string) => `${base}/devices/${device}/credentials`;
  return {
    key: 'credentials',
    label: 'network.credentials',
    emptyLabel: 'network.noCredentials',
    endpoint,
    deleteEndpoint: (device, row) =>
      `${endpoint(device)}/${row['NwcUUID']}?revision=${encodeURIComponent(String(row['NwcRevision'] ?? ''))}`,
    uuidField: 'NwcUUID',
    initialValues: {},
    fields: [],
    columns: [],
    config: (device) => credentialCollectionConfig(endpoint(device), canWrite),
    component: () =>
      import('./device-credentials').then((module) => module.NetworkDeviceCredentialsCollection),
  };
}

function accessCollection(base: string): ConfigurableCrudRelatedCollection {
  return {
    key: 'access',
    label: 'network.accessMethods',
    emptyLabel: 'network.noAccessMethods',
    addLabel: 'network.newAccessMethod',
    createTitle: 'network.newAccessMethod',
    editTitle: 'network.editAccessMethod',
    dialogDescription: 'network.accessDialogDescription',
    savedMessage: 'network.accessSaved',
    deletedMessage: 'network.accessDeleted',
    endpoint: (device) => `${base}/devices/${device}/access`,
    updateEndpoint: (device) => `${base}/devices/${device}/access`,
    deleteEndpoint: (device, row) =>
      `${base}/devices/${device}/access/${row['NweUUID']}?revision=${encodeURIComponent(String(row['NweRevision'] ?? ''))}`,
    uuidField: 'NweUUID',
    initialValues: ACCESS_INITIAL_VALUES,
    fields: accessFields(),
    columns: ACCESS_COLUMNS,
    payload: accessPayload,
  };
}

/**
 * Access methods of a device managed in Hosting (its form does not open here): the same fields in
 * the collection dialog, with the methods of the device type.
 */
function accessDialogConfig(
  base: string,
  row: ConfigurableCrudRecord,
  methods: readonly ConfigurableCrudOption[],
  canWrite: boolean,
): ConfigurableCrudConfig {
  const device = String(row['NwdUUID'] ?? '');
  return defineCrud({
    endpoint: `${base}/devices/${device}/access`,
    uuidField: 'NweUUID',
    pageTitle: 'network.accessMethods',
    pageDescription: 'network.accessDialogDescription',
    createTitle: 'network.newAccessMethod',
    editTitle: 'network.editAccessMethod',
    createLabel: 'network.newAccessMethod',
    emptyLabel: 'network.noAccessMethods',
    savedMessage: 'network.accessSaved',
    deletedMessage: 'network.accessDeleted',
    // Each deletion carries its own revision; there is no bulk endpoint.
    bulkDelete: false,
    deletePayload: (access) => ({ revision: access['NweRevision'] }),
    canCreate: canWrite,
    canEdit: canWrite,
    canDelete: canWrite,
    initialValues: ACCESS_INITIAL_VALUES,
    fields: accessFields(methods),
    columns: ACCESS_COLUMNS,
    payload: (values) => accessPayload(values),
    fieldChange: (key, value, current) => accessFieldChange(key, value, current),
  });
}

/** Network devices (Rede › Equipamentos): what they are, where they live and how to reach them. */
function deviceConfig(
  platform: boolean,
  can: (permission: string) => boolean,
  translate: Translate,
  typeOf: (code: unknown) => NetworkDeviceType | undefined,
): ConfigurableCrudConfig {
  const base = networkBase(platform);
  const canWrite = can('tenant.network.devices.write');
  const canClearHostKey = can('tenant.network.devices.hostkey');
  return defineCrud({
    endpoint: `${base}/devices`,
    uuidField: 'NwdUUID',
    pageTitle: platform ? 'network.platformDevices' : 'network.devices',
    pageDescription: platform ? 'network.platformDevicesDescription' : 'network.devicesDescription',
    ...crudTexts('Device'),
    // The API has no bulk endpoint: each deletion carries its own revision, and devices managed
    // in Hosting or with an active role are refused.
    bulkDelete: false,
    ...crudRights(can, 'devices', 'NwdRevision'),
    canEditRow: (row) => !managedByHosting(row),
    canDeleteRow: (row) => !managedByHosting(row),
    tabLabels: { network: 'network.networkTab', authentication: 'network.accessTab' },
    listFilters: [
      {
        key: 'siteUUID',
        label: 'network.site',
        paramKey: 'siteUUID',
        type: 'search-select',
        span: 1,
        placeholder: 'Search',
        emptyLabel: 'network.noSites',
        remoteLookup: {
          endpoint: `${base}/sites`,
          uuidField: 'NwsUUID',
          labelField: 'NwsName',
        },
      },
      {
        key: 'deviceClass',
        label: 'network.deviceClassLabel',
        paramKey: 'deviceClass',
        type: 'select',
        span: 1,
        options: [{ value: '', label: 'All' }, ...DEVICE_CLASS_OPTIONS],
        translateOptions: true,
      },
    ],
    initialValues: {
      status: 1,
      name: '',
      siteUUID: '',
      vendorType: 'mikrotik_routeros',
      deviceClass: 'router',
      model: '',
      osVersion: '',
      lifecycle: 'active',
      supportEndDate: '',
      managementHost: '',
      networkPath: 'public',
      apiUrl: '',
      verifyTls: 1,
      hostKey: '',
      hostKeyPinnedAt: '',
      monitoringAgentUUID: '',
      revision: null,
      notes: '',
    },
    fields: deviceFields(platform, translate),
    columns: [
      {
        id: 'name',
        label: 'Name',
        kind: 'identity',
        field: 'NwdName',
        uuidField: 'NwdUUID',
        detail: (row, t) => (managedByHosting(row) ? t('network.managedByHostingHint') : ''),
      },
      {
        id: 'site',
        label: 'network.site',
        field: 'SiteName',
        kind: 'related',
        uuidField: 'NetworkSiteNwsUUID',
      },
      ...(platform
        ? []
        : [{ id: 'customer', label: 'Customer', field: 'CustomerName', optional: true }]),
      optionColumn(
        { id: 'class', label: 'network.deviceClassLabel', field: 'NwdDeviceClass' },
        DEVICE_CLASS_OPTIONS,
      ),
      {
        id: 'vendorType',
        label: 'network.vendorType',
        field: 'NwdVendorType',
        // The catalog label (MikroTik RouterOS), not the stored code; the code until it loads.
        value: (row: ConfigurableCrudRecord) =>
          typeOf(row['NwdVendorType'])?.label ?? String(row['NwdVendorType'] ?? ''),
      },
      { id: 'model', label: 'Model', field: 'NwdModel', optional: true },
      { id: 'osVersion', label: 'network.osVersion', field: 'NwdOsVersion', optional: true },
      { id: 'managementHost', label: 'network.managementHost', field: 'NwdManagementHost' },
      optionColumn(
        { id: 'path', label: 'network.pathLabel', field: 'NwdNetworkPath', optional: true },
        NETWORK_PATH_OPTIONS,
      ),
      optionColumn(
        { id: 'lifecycle', label: 'network.lifecycleLabel', field: 'NwdLifecycle', optional: true },
        LIFECYCLE_OPTIONS,
      ),
      { id: 'access', label: 'network.accessMethods', field: 'AccessCount', kind: 'number' },
      { id: 'credentials', label: 'network.credentials', field: 'CredentialCount', kind: 'number' },
      {
        id: 'hostKey',
        label: 'network.hostKey',
        field: 'NwdHostKeyFingerprint',
        optional: true,
        value: (row, t) => hostKeyText(row, t),
      },
      { id: 'status', label: 'Status', field: 'NwdStatus', kind: 'status' },
    ],
    payload: (values) => devicePayload(values),
    relatedCollections: [
      accessCollection(base),
      credentialCollection(base, can('tenant.network.devices.credentials')),
    ],
    rowActions: [
      {
        key: 'managed-access',
        label: 'network.accessMethods',
        icon: 'settings_ethernet',
        tooltip: 'network.managedAccessTooltip',
        visible: (row) => managedByHosting(row),
        collection: (row) =>
          accessDialogConfig(
            base,
            row,
            accessMethodsFor(typeOf(row['NwdVendorType']), row['NwdOsVersion']),
            canWrite,
          ),
      },
      {
        key: 'clear-host-key',
        label: 'network.clearHostKey',
        icon: 'key_off',
        tooltip: 'network.clearHostKeyTooltip',
        visible: (row) => canClearHostKey && Boolean(formText(row['NwdHostKeyFingerprint'])),
        request: {
          method: 'delete',
          endpoint: (row) =>
            `${base}/devices/${String(row['NwdUUID'])}/host-key?revision=${encodeURIComponent(String(row['NwdRevision'] ?? ''))}`,
          successMessage: 'network.hostKeyCleared',
          confirm: {
            title: 'network.clearHostKey',
            message: 'network.clearHostKeyMessage',
            confirmLabel: 'network.clearHostKey',
          },
        },
      },
    ],
  });
}

@Component({
  selector: 'app-network-devices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkDevicesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly base: string;
  /** Device type catalog of the API (codes, versions and access methods per type). */
  private readonly typeCatalog = resource({
    params: () => this.base,
    loader: async ({ params }) => {
      const response = await this.api.get<{ data?: NetworkDeviceTypeCatalog }>(
        `${params}/device-types`,
      );
      return response?.data?.items ?? [];
    },
    defaultValue: [] as NetworkDeviceType[],
  });
  private readonly typeOptions = computed<ConfigurableCrudOption[]>(() =>
    this.types().map((type) => ({
      value: type.code,
      label: type.label,
      description: type.versions.length
        ? `${type.automation} · ${type.versions.map((version) => `v${version}`).join(', ')}`
        : type.automation,
      searchText: `${type.label} ${type.code} ${type.automation}`,
    })),
  );

  constructor() {
    const platform = injectPlatformScope();
    const transloco = inject(TranslocoService);
    // Row actions are built before the catalog exists: they read it through this page.
    let page: NetworkDevicesPage | undefined;
    const typeOf = (code: unknown) => page?.typeOf(code);
    super(
      deviceConfig(
        platform,
        injectNetworkPermission(platform),
        (key) => transloco.translate(key),
        typeOf,
      ),
    );
    this.base = networkBase(platform);
    page = this;
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'vendorType' ? this.typeCatalog.isLoading() : super.fieldLoading(field);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'vendorType') return this.typeOptions();
    // Access methods of the device being edited (its type and major OS version).
    if (key === 'method') {
      const values = this.formValues();
      return accessMethodsFor(this.typeOf(values['vendorType']), values['osVersion']);
    }
    return [];
  }

  protected override relatedCollectionFieldChange(
    _collection: ConfigurableCrudRelatedCollection,
    key: string,
    value: unknown,
    current: ConfigurableCrudRecord,
  ): ConfigurableCrudRecord {
    return accessFieldChange(key, value, current);
  }

  private types(): NetworkDeviceType[] {
    return this.typeCatalog.hasValue() ? this.typeCatalog.value() : [];
  }

  private typeOf(code: unknown): NetworkDeviceType | undefined {
    return this.types().find((type) => type.code === String(code ?? ''));
  }
}
