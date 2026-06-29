import { Component, inject, signal } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { ApiService } from '../../../../services/api.service';

const CODEC_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'PCMU', label: 'PCMU' },
  { value: 'PCMA', label: 'PCMA' },
  { value: 'G729', label: 'G.729' },
  { value: 'G722', label: 'G.722' },
  { value: 'OPUS', label: 'Opus' },
  { value: 'GSM', label: 'GSM' },
  { value: 'AMR', label: 'AMR' },
  { value: 'AMR-WB', label: 'AMR-WB' },
  { value: 'ILBC', label: 'iLBC' },
  { value: 'SPEEX', label: 'Speex' },
  { value: 'TELEPHONE-EVENT', label: 'Telephone event' },
];

const CODEC_MODE_OPTIONS: ConfigurableCrudOption[] = [
  { value: 'passthrough', label: 'Passthrough' },
  { value: 'filter', label: 'Filter' },
  { value: 'prefer', label: 'Prefer' },
  { value: 'transcode', label: 'Transcode' },
];

const DEFAULT_ALLOWED_CODECS = ['PCMU', 'PCMA', 'G729', 'G722', 'OPUS'];
const DEFAULT_PREFERRED_CODECS = ['PCMU', 'PCMA'];

const POLICY_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/softswitch/policies',
  uuidField: 'uuid',
  pageTitle: 'Softswitch policies',
  pageDescription: 'Register account, subscriber, trunk and route policies.',
  createTitle: 'New policy',
  editTitle: 'Edit policy',
  dialogDescription: 'Maintain policy data for this tenant Softswitch.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No policies found.',
  deleteTitle: 'Delete policy',
  deleteMessage: 'Are you sure you want to delete this policy?',
  deleteSelectedTitle: 'Delete selected policies',
  deleteSelectedMessage: 'Delete {count} selected policies?',
  savedMessage: 'Policy saved successfully.',
  deletedMessage: 'Policy deleted successfully.',
  deleteFailedMessage: 'Failed to delete policy.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
    { id: 'account', label: 'Softswitch', field: 'accountName' },
    { id: 'type', label: 'Type', field: 'type' },
    { id: 'scope', label: 'Scope', field: 'scope' },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  initialValues: {
    accountUUID: '',
    name: '',
    type: 'codec',
    scope: 'account',
    priority: 100,
    config: {
      mode: 'filter',
      allowedCodecs: DEFAULT_ALLOWED_CODECS,
      preferredCodecs: DEFAULT_PREFERRED_CODECS,
      transcodeCodecs: [],
    },
    codecMode: 'filter',
    allowedCodecs: DEFAULT_ALLOWED_CODECS,
    preferredCodecs: DEFAULT_PREFERRED_CODECS,
    transcodeCodecs: [],
    status: 1,
  },
  fields: [
    {
      key: 'accountUUID',
      source: 'accountUUID',
      payloadKey: 'accountUUID',
      label: 'Softswitch',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'status',
      source: 'status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    { key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true, span: 2 },
    {
      key: 'type',
      source: 'type',
      payloadKey: 'type',
      label: 'Type',
      type: 'select',
      required: true,
      span: 1,
      options: [
        { value: 'codec', label: 'Codec' },
        { value: 'routing', label: 'Routing' },
        { value: 'acl', label: 'ACL' },
        { value: 'rate_limit', label: 'Rate limit' },
        { value: 'nat', label: 'NAT' },
        { value: 'header', label: 'Header' },
      ],
    },
    {
      key: 'scope',
      source: 'scope',
      payloadKey: 'scope',
      label: 'Scope',
      type: 'select',
      required: true,
      span: 1,
      options: [
        { value: 'account', label: 'Account' },
        { value: 'subscriber', label: 'Subscriber' },
        { value: 'trunk', label: 'Trunk' },
        { value: 'route', label: 'Route' },
        { value: 'customer', label: 'Customer' },
      ],
    },
    {
      key: 'priority',
      source: 'priority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
    {
      key: 'codecMode',
      label: 'Codec mode',
      type: 'select',
      span: 1,
      options: CODEC_MODE_OPTIONS,
    },
    {
      key: 'allowedCodecs',
      label: 'Allowed codecs',
      type: 'multi-select',
      span: 2,
      options: CODEC_OPTIONS,
    },
    {
      key: 'preferredCodecs',
      label: 'Preferred codecs',
      type: 'multi-select',
      span: 2,
      options: CODEC_OPTIONS,
    },
    {
      key: 'transcodeCodecs',
      label: 'Transcode codecs',
      type: 'multi-select',
      span: 2,
      options: CODEC_OPTIONS,
    },
    {
      key: 'config',
      source: 'config',
      payloadKey: 'config',
      label: 'Config JSON',
      type: 'textarea',
      tab: 'notes',
      format: 'json',
      span: 4,
      rows: 4,
    },
  ],
};

@Component({
  selector: 'app-voip-softswitch-policy',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSoftswitchPolicyPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);

  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(POLICY_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'accountUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accountUUID' ? this.accountOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = { ...payload, status: Number(payload['status']) === 1 };
    if (String(next['type'] ?? '') === 'codec') {
      next['config'] = buildCodecConfig(next);
    }
    delete next['codecMode'];
    delete next['allowedCodecs'];
    delete next['preferredCodecs'];
    delete next['transcodeCodecs'];
    return next;
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    this.patchFormValues(codecFormValues(row['config']));
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const response = await this.rawApi.get<any>(
        'voip/softswitch/accounts?status=1&limit=500&offset=0',
      );
      this.accountOptions.set(
        extractItems(response)
          .map((row) => option(row.VssUUID, row.VssName, [row.CustomerName, row.DomainName]))
          .filter(isOption)
          .sort((left, right) => left.label.localeCompare(right.label)) as ConfigurableCrudOption[],
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

function codecFormValues(value: unknown): ConfigurableCrudRecord {
  const config = parseConfig(value);
  return {
    codecMode: stringValue(config['mode']) || 'filter',
    allowedCodecs: codecArray(config['allowedCodecs'], DEFAULT_ALLOWED_CODECS),
    preferredCodecs: codecArray(config['preferredCodecs'], DEFAULT_PREFERRED_CODECS),
    transcodeCodecs: codecArray(config['transcodeCodecs'], []),
  };
}

function buildCodecConfig(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
  return {
    mode: stringValue(payload['codecMode']) || 'filter',
    allowedCodecs: codecArray(payload['allowedCodecs'], []),
    preferredCodecs: codecArray(payload['preferredCodecs'], []),
    transcodeCodecs: codecArray(payload['transcodeCodecs'], []),
  };
}

function parseConfig(value: unknown): ConfigurableCrudRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as ConfigurableCrudRecord;
  }
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as ConfigurableCrudRecord)
      : {};
  } catch {
    return {};
  }
}

function codecArray(value: unknown, fallback: readonly string[]): string[] {
  const values = Array.isArray(value) ? value : fallback;
  const allowed = new Set(CODEC_OPTIONS.map((option) => String(option.value)));
  return [...new Set(values.map(stringValue).filter((codec) => codec && allowed.has(codec)))];
}

function stringValue(value: unknown): string {
  return String(value ?? '').trim();
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

function isOption(value: ConfigurableCrudOption | null): value is ConfigurableCrudOption {
  return Boolean(value);
}
