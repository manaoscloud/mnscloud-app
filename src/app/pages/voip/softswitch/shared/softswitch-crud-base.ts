import { inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipSoftswitchServerService } from '../server/server.service';

type LookupKind = 'serverUUID' | 'accountUUID' | 'customerUUID' | 'domainUUID' | 'subscriberUUID';

export abstract class SoftswitchCrudPageBase<
  T extends ConfigurableCrudRecord,
> extends ConfigurableCrudPageBase<T> {
  private readonly rawApi = inject(ApiService);
  private readonly serverApi = inject(VoipSoftswitchServerService);

  readonly serverOptions = signal<ConfigurableCrudOption[]>([]);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly domainOptions = signal<ConfigurableCrudOption[]>([]);
  readonly subscriberOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  protected constructor(config: ConfigurableCrudConfig) {
    super(config);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return this.isLookupKey(field.key) ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    switch (key as LookupKind) {
      case 'serverUUID':
        return this.serverOptions();
      case 'accountUUID':
        return this.accountOptions();
      case 'customerUUID':
        return this.customerOptions();
      case 'domainUUID':
        return this.domainOptions();
      case 'subscriberUUID':
        return this.subscriberOptions();
      default:
        return [];
    }
  }

  protected async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [servers, accounts, customers, domains, subscribers] = await Promise.all([
        this.fetchServers(),
        this.fetchPaged('voip/softswitch/accounts?status=1', (row) =>
          option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('erp/customers?status=1', (row) =>
          option(row.CustomerUUID ?? row.customerUUID, row.Name ?? row.CustomerName, [
            row.Document,
            row.Email,
          ]),
        ),
        this.fetchPaged('voip/domains?status=1', (row) =>
          option(row.VdmUUID ?? row.VoipDomainUUID ?? row.uuid, row.VdmName ?? row.Name, [
            row.VdmDomain,
            row.Domain,
          ]),
        ),
        this.fetchPaged('voip/softswitch/subscribers?status=1', (row) =>
          option(row.VsuUUID, row.VsuUsername, [row.CustomerName, row.DomainName]),
        ),
      ]);
      this.serverOptions.set(servers);
      this.accountOptions.set(accounts);
      this.customerOptions.set(customers);
      this.domainOptions.set(domains);
      this.subscriberOptions.set(subscribers);
    } finally {
      this.lookupLoading.set(false);
    }
  }

  private async fetchServers(): Promise<ConfigurableCrudOption[]> {
    const response = await this.serverApi.listActive({ limit: 5000 });
    return extractItems(response)
      .map((row) =>
        option(row.VsrUUID, row.VsrName, [row.VsrEngine, row.VsrHostname, row.VsrPublicIP]),
      )
      .filter(Boolean) as ConfigurableCrudOption[];
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

  private isLookupKey(key: string): boolean {
    return ['serverUUID', 'accountUUID', 'customerUUID', 'domainUUID', 'subscriberUUID'].includes(
      key,
    );
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
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
