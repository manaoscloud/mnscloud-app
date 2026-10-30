import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { ApiService } from '../../../services/api.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilters,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

// Tenant vaults belong to a Cyber Security account (their customer comes from it); platform
// vaults keep the Master server/customer form.
const CYBER_ACCOUNT_FILTER = {
  key: 'cyberAccountUUID',
  label: 'cyberSecurity.account',
  paramKey: 'cyberAccountUUID',
  type: 'search-select',
  span: 1,
  placeholder: 'Search account',
  emptyLabel: 'No accounts found.',
} as const;

const CYBER_ACCOUNT_COLUMN = {
  id: 'cyberAccount',
  label: 'cyberSecurity.account',
  kind: 'related',
  uuidField: 'CyberSecurityAccountCyaUUID',
  lookupKey: 'cyberAccountUUID',
} as const;

const CYBER_ACCOUNT_FIELD: ConfigurableCrudField = {
  key: 'cyberAccountUUID',
  source: 'CyberSecurityAccountCyaUUID',
  payloadKey: 'cyberAccountUUID',
  label: 'cyberSecurity.account',
  type: 'search-select',
  required: true,
  span: 1,
  tab: 'record',
  help: 'cyberSecurity.vaultAccountHelp',
  disabledWhen: ({ editing }) => editing,
  quickCreate: false,
  quickCreateExemptReason:
    'Cyber Security accounts are created by account administrators in Customer accounts.',
};

function accountConfig(master: boolean): ConfigurableCrudConfig {
  if (master) return ACCOUNT_CONFIG;
  return {
    ...ACCOUNT_CONFIG,
    dialogDescription: 'cyberSecurity.vaultDialogDescription',
    listFilters: [
      ACCOUNT_CONFIG.listFilters![0],
      CYBER_ACCOUNT_FILTER,
      ACCOUNT_CONFIG.listFilters![1],
    ],
    initialValues: { ...ACCOUNT_CONFIG.initialValues, cyberAccountUUID: '' },
    columns: [ACCOUNT_CONFIG.columns[0], CYBER_ACCOUNT_COLUMN, ...ACCOUNT_CONFIG.columns.slice(1)],
    fields: ACCOUNT_CONFIG.fields.map((field) =>
      field.key === 'customerUUID' ? CYBER_ACCOUNT_FIELD : field,
    ),
  };
}

const ACCOUNT_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'cyber-security/secret-accounts',
  uuidField: 'CxaUUID',
  pageTitle: 'Secret Accounts',
  pageDescription: 'Bind customers to Master OpenVault servers for Secrets Manager.',
  createTitle: 'New secret account',
  editTitle: 'Edit secret account',
  dialogDescription: 'Configure customer ownership and OpenVault server placement.',
  searchPlaceholder: 'Name, customer or server',
  emptyLabel: 'No secret accounts found.',
  deleteTitle: 'Delete secret account',
  deleteMessage: 'Delete this secret account?',
  deleteSelectedTitle: 'Delete selected secret accounts',
  deleteSelectedMessage: 'Delete {count} selected secret accounts?',
  savedMessage: 'Secret account saved successfully.',
  deletedMessage: 'Secret account deleted successfully.',
  deleteFailedMessage: 'Failed to delete secret account.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusFilter: true,
  tabLabels: {
    record: 'Record',
    notes: 'Notes',
  },
  listFilters: [
    {
      key: 'serverUUID',
      label: 'Server',
      paramKey: 'serverUUID',
      type: 'search-select',
      span: 1,
      placeholder: 'Search server',
      emptyLabel: 'No servers found.',
    },
    {
      key: 'customerUUID',
      label: 'Customer',
      paramKey: 'customerUUID',
      type: 'search-select',
      span: 1,
      placeholder: 'Search customer',
      emptyLabel: 'No customers found.',
    },
  ],
  initialValues: {
    status: 1,
    serverUUID: '',
    customerUUID: '',
    name: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'CxaName', uuidField: 'CxaUUID' },
    {
      id: 'customer',
      label: 'Customer',
      kind: 'related',
      uuidField: 'RegCustomerRcuUUID',
      lookupKey: 'customerUUID',
    },
    {
      id: 'server',
      label: 'Server',
      kind: 'related',
      uuidField: 'CyberSecuritySecretServerCsrUUID',
      lookupKey: 'serverUUID',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'CxaStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'CxaStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
      tab: 'record',
    },
    {
      key: 'serverUUID',
      source: 'CyberSecuritySecretServerCsrUUID',
      payloadKey: 'serverUUID',
      label: 'Server',
      type: 'search-select',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'customerUUID',
      source: 'RegCustomerRcuUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: false,
      span: 1,
      tab: 'record',
    },
    {
      key: 'name',
      source: 'CxaName',
      payloadKey: 'name',
      label: 'Name',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'notes',
      source: 'CxaNotes',
      payloadKey: 'notes',
      label: 'Notes',
      type: 'textarea',
      span: 4,
      rows: 4,
      tab: 'notes',
    },
  ],
};

@Component({
  selector: 'app-cyber-security-secret-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecuritySecretAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  private readonly isMaster = computed(() => this.scope() === 'master');
  private readonly endpoint = computed(() =>
    this.isMaster() ? 'system/cyber-security/secret-accounts' : ACCOUNT_CONFIG.endpoint,
  );
  private readonly serverLookupEndpoint = computed(() =>
    this.isMaster() ? 'system/cyber-security/secret-servers' : 'cyber-security/secret-servers',
  );

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly cyberAccountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(accountConfig(inject(ActivatedRoute).snapshot.data?.['scope'] === 'master'));
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      ['serverUUID', 'customerUUID', 'cyberAccountUUID'].includes(field.key) &&
      this.lookupsLoading()
    );
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

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'serverUUID') return this.serverOptions();
    if (key === 'customerUUID') return this.customerOptions();
    if (key === 'cyberAccountUUID') return this.cyberAccountOptions();
    return [];
  }

  protected override async fetchItems(filters: ConfigurableCrudFilters) {
    await Promise.all([
      this.serverOptions().length ? Promise.resolve() : this.loadServers(),
      this.customerOptions().length ? Promise.resolve() : this.loadCustomers(),
      this.isMaster() || this.cyberAccountOptions().length
        ? Promise.resolve()
        : this.loadCyberAccounts(),
    ]);
    return super.fetchItems(filters);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const owner = this.isMaster()
      ? { customerUUID: payload['customerUUID'] }
      : { cyberAccountUUID: payload['cyberAccountUUID'] };
    return {
      name: payload['name'],
      serverUUID: payload['serverUUID'],
      ...owner,
      status: payload['status'],
      notes: payload['notes'],
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      await Promise.all([
        this.loadServers(),
        this.loadCustomers(),
        this.isMaster() ? Promise.resolve() : this.loadCyberAccounts(),
      ]);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async loadServers(): Promise<void> {
    const options = await this.fetchPaged(`${this.serverLookupEndpoint()}?status=1`, (row) =>
      option(row.CsrUUID, row.CsrName, [row.CsrEngine, row.CsrClusterMode]),
    );
    this.serverOptions.set(options);
  }

  private async loadCustomers(): Promise<void> {
    const options = await this.fetchPaged('registry/customers?status=1', (row) =>
      option(row.CustomerUUID ?? row.RcuUUID, row.Name ?? row.CustomerName ?? row.RcuName, [
        row.Document,
        row.Email,
      ]),
    );
    this.customerOptions.set(options);
  }

  private async loadCyberAccounts(): Promise<void> {
    const options = await this.fetchPaged('cyber-security/accounts?status=1', (row) =>
      option(row.CyaUUID, row.CyaName, [row.CustomerName]),
    );
    this.cyberAccountOptions.set(options);
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}
