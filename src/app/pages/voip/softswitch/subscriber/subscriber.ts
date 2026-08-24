import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';
import {
  runRuntimeDiagnostic,
  RuntimeDiagnosticResult,
} from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';
import { VoipSoftswitchSubscriberItem } from './subscriber.service';

const codecs: ConfigurableCrudOption[] = [
  { value: 'OPUS', label: 'OPUS' },
  { value: 'PCMU', label: 'PCMU' },
  { value: 'PCMA', label: 'PCMA' },
  { value: 'G729', label: 'G729' },
  { value: 'G722', label: 'G722' },
  { value: 'H264', label: 'H264' },
];

function codecList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

const SUBSCRIBER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/subscribers',
  uuidField: 'VsuUUID',
  pageTitle: 'Softswitch subscribers',
  pageDescription: 'Manage SIP subscribers linked to tenant Softswitch accounts.',
  createTitle: 'New subscriber',
  editTitle: 'Edit subscriber',
  dialogDescription: 'Maintain SIP credentials, caller ID and registration policy.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No subscribers found.',
  deleteTitle: 'Delete subscriber',
  deleteMessage: 'Are you sure you want to delete this subscriber?',
  deleteSelectedTitle: 'Delete selected subscribers',
  deleteSelectedMessage: 'Delete {count} selected subscribers?',
  savedMessage: 'Subscriber saved successfully.',
  deletedMessage: 'Subscriber deleted successfully.',
  deleteFailedMessage: 'Failed to delete subscriber.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  tabLabels: {
    record: 'Record',
    authentication: 'Authentication',
    routing: 'Routing',
    limits: 'Limits',
    codecs: 'Codecs',
    monitoring: 'Call recording',
  },
  authenticationTabAfterRecord: true,
  listFilters: [
    {
      key: 'accountUUID',
      label: 'Softswitch',
      paramKey: 'accountUUID',
      type: 'search-select',
      span: 1,
      placeholder: 'Search Softswitch',
      emptyLabel: 'No Softswitch accounts found.',
    },
  ],
  filterActionMenu: {
    label: 'Status',
    icon: 'monitor_heart',
    actions: [
      {
        key: 'runtime-status-all',
        label: 'Subscribers',
        tooltip: 'Inspect all Softswitch subscriber statuses',
        icon: 'group',
      },
    ],
  },
  rowActions: [
    {
      key: 'runtime-status',
      label: 'Runtime status',
      tooltip: 'Inspect subscriber runtime status',
      icon: 'terminal',
    },
  ],
  initialValues: {
    accountUUID: '',
    customerUUID: '',
    username: '',
    password: '',
    callerIdName: '',
    callerIdNumber: '',
    context: 'default',
    maxContacts: 1,
    maxConcurrentCalls: 1,
    outboundCid: '',
    codecs: [],
    registerEnabled: 1,
    recordCalls: 0,
    enabled: 1,
  },
  columns: [
    {
      id: 'username',
      label: 'Username',
      kind: 'identity',
      field: 'VsuUsername',
      uuidField: 'VsuUUID',
    },
    { id: 'softswitch', label: 'Softswitch', field: 'SoftswitchName' },
    { id: 'customer', label: 'Customer', field: 'CustomerName' },
    { id: 'domain', label: 'Domain', field: 'DomainName' },
    { id: 'callerId', label: 'Caller ID', field: 'VsuCallerIdNumber' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsuEnabled', className: 'status-col' },
  ],
  fields: [
    {
      key: 'enabled',
      source: 'VsuEnabled',
      payloadKey: 'enabled',
      label: 'Status',
      type: 'status',
      span: 1,
      tab: 'record',
    },
    {
      key: 'accountUUID',
      source: 'VoipSoftswitchAccountVssUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'customerUUID',
      source: 'CustomerCusUUID',
      payloadKey: 'customerUUID',
      label: 'Customer',
      type: 'search-select',
      required: true,
      span: 1,
      tab: 'record',
    },
    {
      key: 'registerEnabled',
      source: 'VsuRegisterEnabled',
      payloadKey: 'registerEnabled',
      label: 'Registration',
      type: 'select',
      span: 1,
      tab: 'authentication',
      options: [
        { value: 1, label: 'Enabled' },
        { value: 0, label: 'Disabled' },
      ],
    },
    {
      key: 'username',
      source: 'VsuUsername',
      payloadKey: 'username',
      label: 'SIP username',
      span: 1,
      tab: 'authentication',
    },
    {
      key: 'password',
      source: 'VsuPassword',
      payloadKey: 'password',
      label: 'SIP password',
      type: 'password',
      span: 1,
      tab: 'authentication',
    },
    {
      key: 'callerIdName',
      source: 'VsuCallerIdName',
      payloadKey: 'callerIdName',
      label: 'Caller ID name',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'callerIdNumber',
      source: 'VsuCallerIdNumber',
      payloadKey: 'callerIdNumber',
      label: 'Caller ID number',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'context',
      source: 'VsuContext',
      payloadKey: 'context',
      label: 'Context',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'maxContacts',
      source: 'VsuMaxContacts',
      payloadKey: 'maxContacts',
      label: 'Max contacts',
      type: 'number',
      span: 1,
      tab: 'limits',
    },
    {
      key: 'maxConcurrentCalls',
      source: 'VsuMaxConcurrentCalls',
      payloadKey: 'maxConcurrentCalls',
      label: 'Max concurrent calls',
      type: 'number',
      span: 1,
      tab: 'limits',
    },
    {
      key: 'outboundCid',
      source: 'VsuOutboundCid',
      payloadKey: 'outboundCid',
      label: 'Outbound CID',
      span: 1,
      tab: 'routing',
    },
    {
      key: 'codecs',
      source: 'VsuCodecs',
      payloadKey: 'codecs',
      label: 'Codecs',
      type: 'multi-select',
      options: codecs,
      span: 1,
      tab: 'codecs',
      fromRecord: (value) => codecList(value),
    },
    {
      key: 'recordCalls',
      source: 'VsuRecordCalls',
      payloadKey: 'recordCalls',
      label: 'Record calls',
      type: 'select',
      span: 1,
      tab: 'monitoring',
      options: [
        { value: 1, label: 'Yes' },
        { value: 0, label: 'No' },
      ],
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-subscriber',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchSubscriberPage extends ConfigurableCrudPageBase<VoipSoftswitchSubscriberItem> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly customerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(SUBSCRIBER_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'accountUUID' || field.key === 'customerUUID'
      ? this.lookupLoading()
      : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'customerUUID') return this.customerOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      maxContacts: Number(payload['maxContacts'] ?? 1),
      maxConcurrentCalls: Number(payload['maxConcurrentCalls'] ?? 1),
      registerEnabled: Number(payload['registerEnabled']) === 1,
      recordCalls: Number(payload['recordCalls']) === 1,
      enabled: Number(payload['enabled']) === 1,
      codecs: codecList(payload['codecs']),
    };
  }

  override isFilterActionDisabled(action: ConfigurableCrudFilterAction): boolean {
    return action.key === 'runtime-status-all' && !this.selectedAccountUUID();
  }

  override handleFilterAction(action: ConfigurableCrudFilterAction): void {
    if (action.key !== 'runtime-status-all') return;
    const accountUUID = this.selectedAccountUUID();
    if (!accountUUID) {
      this.snack.warning(this.t('Select a Softswitch account to inspect subscriber statuses.'));
      return;
    }

    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'Softswitch subscriber runtime status',
      description:
        'Read-only registration and contact status of subscribers assigned to the selected Softswitch.',
      startEndpoint: `voip/softswitch/accounts/${accountUUID}/subscribers/runtime-status`,
      statusEndpoint: (jobUUID) =>
        `voip/softswitch/accounts/${accountUUID}/subscribers/runtime-status/${jobUUID}`,
      sections: subscriberStatusSections,
    });
  }

  override handleRowAction(
    action: ConfigurableCrudRowAction,
    row: VoipSoftswitchSubscriberItem,
  ): void {
    if (action.key !== 'runtime-status') return;
    const subscriberUUID = String(row.VsuUUID ?? '').trim();
    if (!subscriberUUID) return;

    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'Softswitch subscriber runtime status',
      description:
        'Read-only registration and contact status of the selected Softswitch subscriber.',
      startEndpoint: `voip/softswitch/subscribers/${subscriberUUID}/runtime-status`,
      statusEndpoint: (jobUUID) =>
        `voip/softswitch/subscribers/${subscriberUUID}/runtime-status/${jobUUID}`,
      sections: subscriberStatusSections,
    });
  }

  private selectedAccountUUID(): string {
    return String(
      this.listFilterValue({ key: 'accountUUID', label: 'Softswitch', type: 'search-select' }),
    ).trim();
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.accountOptions.set(
        await this.fetchPaged('voip/softswitch/accounts?status=1', (row) =>
          option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]),
        ),
      );
      this.customerOptions.set(
        await this.fetchPaged('erp/customers?status=1', (row) =>
          option(
            row.CustomerUUID ?? row.CusUUID ?? row.CustomerCusUUID,
            row.CusName ?? row.Name ?? row.CustomerName,
            [row.CusDocument ?? row.Document, row.CusEmail ?? row.Email],
          ),
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    const pageSize = 200;
    for (let offset = 0; offset < 5000; offset += pageSize) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=${pageSize}&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < pageSize) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function subscriberStatusSections(result: RuntimeDiagnosticResult) {
  const subscribers = Array.isArray(result.result?.['subscribers'])
    ? result.result['subscribers'].filter(
        (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object',
      )
    : [];

  return [
    {
      title: 'Subscriber registrations',
      table: {
        columns: [
          { key: 'subscriber', label: 'Subscriber', monospace: true },
          { key: 'domain', label: 'Domain' },
          { key: 'registration', label: 'Registration', translate: true },
          { key: 'contact', label: 'Contact', monospace: true },
        ],
        rows: subscribers.map((item) => ({
          subscriber: item['username'] ?? '-',
          domain: item['domain'] ?? '-',
          registration: subscriberRegistrationLabel(item['registrationStatus'] ?? 'unknown'),
          contact: item['contact'] ?? '-',
        })),
        emptyLabel: 'No subscriber statuses were returned.',
      },
    },
  ];
}

function subscriberRegistrationLabel(value: unknown): string {
  switch (String(value ?? '').toLowerCase()) {
    case 'registered':
      return 'Registered';
    case 'not_registered':
      return 'Not registered';
    default:
      return 'Unknown';
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
