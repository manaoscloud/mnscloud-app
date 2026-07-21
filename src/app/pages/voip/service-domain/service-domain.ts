import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

type Service = 'pabx' | 'softswitch' | 'sbc';

const statusOptions: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const yesNoOptions: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

const labels: Record<Service, string> = {
  pabx: 'PABX',
  softswitch: 'Softswitch',
  sbc: 'SBC',
};

function config(service: Service): ConfigurableCrudConfig {
  const label = labels[service];
  return {
    endpoint: `voip/${service}/domains`,
    uuidField: 'BindingUUID',
    pageTitle: `${label} Domains`,
    pageDescription: `Manage canonical domains bound to ${label} accounts.`,
    createTitle: `New ${label} domain`,
    editTitle: `Edit ${label} domain`,
    dialogDescription: 'Bind one canonical VoIP domain to the selected service account.',
    searchPlaceholder: 'Search',
    emptyLabel: `No ${label} domains found.`,
    deleteTitle: `Delete ${label} domain`,
    deleteMessage: `Delete this ${label} domain binding?`,
    deleteSelectedTitle: `Delete selected ${label} domains`,
    deleteSelectedMessage: `Delete {count} selected ${label} domain bindings?`,
    savedMessage: `${label} domain saved successfully.`,
    deletedMessage: `${label} domain deleted successfully.`,
    deleteFailedMessage: `Failed to delete ${label} domain.`,
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions,
    initialValues: { accountUUID: '', domainUUID: '', isDefault: 0, status: 1 },
    columns: [
      { id: 'domain', label: 'Domain', kind: 'identity', field: 'DomainName', uuidField: 'BindingUUID' },
      { id: 'account', label: 'Account', kind: 'related', field: 'AccountName', lookupKey: 'accountUUID' },
      { id: 'default', label: 'Default', kind: 'boolean', field: 'isDefault' },
      { id: 'status', label: 'Status', kind: 'status', field: 'status' },
    ],
    fields: [
      { key: 'status', source: 'status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
      {
        key: 'isDefault',
        source: 'isDefault',
        payloadKey: 'isDefault',
        label: 'Default',
        type: 'select',
        options: yesNoOptions,
        span: 1,
      },
      {
        key: 'accountUUID',
        source: 'AccountUUID',
        payloadKey: 'accountUUID',
        label: 'Account',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'domainUUID',
        source: 'VoipDomainVdmUUID',
        payloadKey: 'domainUUID',
        label: 'Domain',
        type: 'search-select',
        required: true,
        span: 1,
      },
    ],
  };
}

abstract class VoipServiceDomainPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  private readonly service: Service;
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly domainOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  protected constructor(service: Service) {
    super(config(service));
    this.service = service;
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['accountUUID', 'domainUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'domainUUID') return this.domainOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      isDefault: Number(payload['isDefault']) === 1,
      status: Number(payload['status']) === 1,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [accounts, domains] = await Promise.all([
        this.fetchPaged(`voip/${this.service}/accounts?status=1`, (row) =>
          option(
            row['VpaUUID'] ?? row['VssUUID'] ?? row['VsaUUID'],
            row['VpaName'] ?? row['VssName'] ?? row['VsaName'],
          ),
        ),
        this.fetchPaged(`voip/domains?status=1&purpose=${this.service}`, (row) =>
          option(row['VdmUUID'], row['VdmName']),
        ),
      ]);
      this.accountOptions.set(accounts);
      this.domainOptions.set(domains);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: ConfigurableCrudRecord) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const items: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<unknown>(`${endpoint}${separator}limit=500&offset=${offset}`);
      const rows = extractItems(response);
      items.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return items.sort((left, right) => left.label.localeCompare(right.label));
  }
}

@Component({
  selector: 'app-voip-pabx-domain',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxDomainPage extends VoipServiceDomainPage {
  constructor() { super('pabx'); }
}

@Component({
  selector: 'app-voip-softswitch-domain',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchDomainPage extends VoipServiceDomainPage {
  constructor() { super('softswitch'); }
}

@Component({
  selector: 'app-voip-sbc-domain',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcDomainPage extends VoipServiceDomainPage {
  constructor() { super('sbc'); }
}

function extractItems(response: unknown): ConfigurableCrudRecord[] {
  const value = response as { data?: { items?: unknown } | unknown; items?: unknown } | null;
  if (value?.data && Array.isArray((value.data as { items?: unknown }).items)) {
    return (value.data as { items: ConfigurableCrudRecord[] }).items;
  }
  if (Array.isArray(value?.data)) return value.data as ConfigurableCrudRecord[];
  if (Array.isArray(value?.items)) return value.items as ConfigurableCrudRecord[];
  return [];
}

function option(value: unknown, label: unknown): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  return { value: normalizedValue, label: normalizedLabel, searchText: `${normalizedLabel} ${normalizedValue}` };
}
