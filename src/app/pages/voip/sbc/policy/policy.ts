import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const POLICY_TYPE_OPTIONS = [
  { value: 'acl', label: 'ACL' },
  { value: 'rate_limit', label: 'Rate limit' },
  { value: 'codec', label: 'Codec' },
  { value: 'nat', label: 'NAT' },
  { value: 'header', label: 'Header' },
  { value: 'routing', label: 'Routing' },
];

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
  endpoint: 'voip/sbc/policies',
  uuidField: 'VpoUUID',
  pageTitle: 'SBC policies',
  pageDescription: 'Manage SBC policy rules for tenant traffic.',
  createTitle: 'New SBC policy',
  editTitle: 'Edit SBC policy',
  dialogDescription: 'Maintain policy type, priority and JSON configuration.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC policies found.',
  deleteTitle: 'Delete SBC policy',
  deleteMessage: 'Are you sure you want to delete this SBC policy?',
  deleteSelectedTitle: 'Delete selected SBC policies',
  deleteSelectedMessage: 'Delete {count} selected SBC policies?',
  savedMessage: 'SBC policy saved successfully.',
  deletedMessage: 'SBC policy deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC policy.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    accountUUID: '',
    status: 1,
    type: 'routing',
    name: '',
    priority: 100,
    config: '',
    codecMode: 'filter',
    allowedCodecs: DEFAULT_ALLOWED_CODECS,
    preferredCodecs: DEFAULT_PREFERRED_CODECS,
    transcodeCodecs: [],
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VpoName', uuidField: 'VpoUUID' },
    {
      id: 'account',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    { id: 'server', label: 'Server', kind: 'text', field: 'ServerName' },
    { id: 'type', label: 'Type', field: 'VpoType' },
    { id: 'priority', label: 'Priority', field: 'VpoPriority' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VpoStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'accountUUID',
      source: 'VoipSbcAccountVsaUUID',
      payloadKey: 'accountUUID',
      label: 'SBC',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'status',
      source: 'VpoStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'type',
      source: 'VpoType',
      payloadKey: 'type',
      label: 'Type',
      type: 'select',
      options: POLICY_TYPE_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'VpoName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'priority',
      source: 'VpoPriority',
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
      source: 'VpoConfig',
      payloadKey: 'config',
      label: 'Config JSON',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
      format: 'json',
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-policy',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcPolicyPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
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
    if (key === 'accountUUID') return this.accountOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = {
      ...payload,
      priority: Number(payload['priority'] || 0),
      status: Number(payload['status']),
    };
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
    this.patchFormValues(codecFormValues(row['VpoConfig']));
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.accountOptions.set(
        await this.fetchPaged('voip/sbc/accounts?status=1', (row) =>
          option(row.VsaUUID, row.VsaName, [row.ServerName, row.ServerEngine, row.ServerPublicIP]),
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
