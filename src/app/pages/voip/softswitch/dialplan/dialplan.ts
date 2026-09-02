import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const scopes: ConfigurableCrudOption[] = [
  { value: 'account', label: 'Account' },
  { value: 'customer', label: 'Customer' },
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'domain', label: 'Domain' },
  { value: 'trunk', label: 'Trunk' },
];

const actions: ConfigurableCrudOption[] = [
  { value: 'reject', label: 'Reject' },
  { value: 'allow', label: 'Allow' },
  { value: 'route', label: 'Route' },
];

const CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/dialplans',
  uuidField: 'uuid',
  pageTitle: 'Softswitch dialplans',
  pageDescription: 'Define tenant dialplan scopes and default actions.',
  createTitle: 'New dialplan',
  editTitle: 'Edit dialplan',
  dialogDescription: 'Maintain the dialplan container used by Softswitch routing rules.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No dialplans found.',
  deleteTitle: 'Delete dialplan',
  deleteMessage: 'Are you sure you want to delete this dialplan?',
  deleteSelectedTitle: 'Delete selected dialplans',
  deleteSelectedMessage: 'Delete {count} selected dialplans?',
  savedMessage: 'Dialplan saved successfully.',
  deletedMessage: 'Dialplan deleted successfully.',
  deleteFailedMessage: 'Failed to delete dialplan.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'scope', label: 'Scope', field: 'scope' },
    { id: 'priority', label: 'Priority', field: 'priority' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    scope: 'account',
    targetUUID: '',
    priority: 100,
    defaultAction: 'reject',
    status: 1,
  },
  fields: [
    { key: 'accountUUID', source: 'accountUUID', payloadKey: 'accountUUID', label: 'Softswitch', type: 'search-select', required: true, span: 1 },
    { key: 'status', source: 'status', payloadKey: 'status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    { key: 'scope', source: 'scope', payloadKey: 'scope', label: 'Scope', type: 'select', options: scopes, required: true, span: 1, tab: 'routing' },
    { key: 'defaultAction', source: 'defaultAction', payloadKey: 'defaultAction', label: 'Default action', type: 'select', options: actions, required: true, span: 1, tab: 'routing' },
    { key: 'priority', source: 'priority', payloadKey: 'priority', label: 'Priority', type: 'number', span: 1, tab: 'routing' },
    { key: 'targetUUID', source: 'targetUUID', payloadKey: 'targetUUID', label: 'Scoped target UUID', span: 1, tab: 'routing', hiddenWhen: ({ values }) => String(values['scope']) === 'account' },
  ],
};

@Component({
  selector: 'app-voip-softswitch-dialplan',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchDialplanPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'accountUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accountUUID' ? this.accountOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, targetUUID: payload['targetUUID'] || null, status: Number(payload['status']) === 1 };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>('voip/softswitch/accounts?status=1&limit=5000&offset=0');
      this.accountOptions.set(toOptions(response, (row) => option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName])));
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

function toOptions(response: any, mapItem: (row: any) => ConfigurableCrudOption | null): ConfigurableCrudOption[] {
  return extractItems(response).map(mapItem).filter(isOption).sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  return [];
}

function option(value: unknown, label: unknown, descriptionParts: unknown[] = []): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts.map((item) => String(item ?? '').trim()).filter(Boolean).join(' - ');
  return { value: normalizedValue, label: normalizedLabel, description, searchText: `${normalizedLabel} ${description} ${normalizedValue}` };
}

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
