import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const MEDIA_MODE_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'bypass', label: 'Bypass' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'transcode', label: 'Transcode' },
];

const CODEC_MODE_OPTIONS = [
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'filter', label: 'Filter' },
  { value: 'prefer', label: 'Prefer' },
  { value: 'transcode', label: 'Transcode' },
];
const SIGNALING_PROFILE_OPTIONS = [
  { value: 'inherit', label: 'Inherit from peer' },
  { value: 'sip', label: 'SIP' },
  { value: 'sip_i', label: 'SIP-I' },
  { value: 'sip_t', label: 'SIP-T' },
];
const ISUP_MODE_OPTIONS = [
  { value: 'inherit', label: 'Inherit from peer' },
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'generate', label: 'Generate' },
  { value: 'strip', label: 'Strip' },
  { value: 'interwork', label: 'Interwork' },
];

const CODEC_OPTIONS = [
  'PCMU',
  'PCMA',
  'G729',
  'G722',
  'OPUS',
  'GSM',
  'AMR',
  'AMR-WB',
  'ILBC',
  'SPEEX',
].map((codec) => ({ value: codec, label: codec }));
const YES_NO_OPTIONS = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];
const DIRECTION_OPTIONS = [
  { value: 'bidirectional', label: 'Bidirectional' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
];
const SOURCE_TRANSPORT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const PIPE_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/pipes',
  uuidField: 'VbpUUID',
  pageTitle: 'SBC pipes',
  pageDescription: 'Manage tenant-aware SIP flows between input and output peers.',
  createTitle: 'New SBC pipe',
  editTitle: 'Edit SBC pipe',
  dialogDescription: 'Maintain input peer, output peer, media and codec behavior.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC pipes found.',
  deleteTitle: 'Delete SBC pipe',
  deleteMessage: 'Are you sure you want to delete this SBC pipe?',
  deleteSelectedTitle: 'Delete selected SBC pipes',
  deleteSelectedMessage: 'Delete {count} selected SBC pipes?',
  savedMessage: 'SBC pipe saved successfully.',
  deletedMessage: 'SBC pipe deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC pipe.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  tabLabels: {
    match: 'Input',
    authentication: 'Output',
    network: 'Media',
  },
  initialValues: {
    status: 1,
    accountUUID: '',
    interfaceUUID: '',
    inputPeerUUID: '',
    outputPeerUUID: '',
    name: '',
    direction: 'bidirectional',
    sourceIP: '',
    sourcePort: '',
    sourceTransport: '',
    destinationPattern: '',
    fromPattern: '',
    toPattern: '',
    authUsername: '',
    domain: '',
    priority: 100,
    mediaMode: 'normal',
    signalingProfile: 'inherit',
    isupMode: 'inherit',
    codecMode: 'passthrough',
    allowedCodecs: ['PCMU', 'PCMA', 'G729', 'G722', 'OPUS'],
    preferredCodecs: ['PCMU', 'PCMA'],
    transcodeCodecs: [],
    enableCdr: 1,
    enableHomer: 0,
    fakeRing: 0,
    sendCallerId: 1,
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VbpName', uuidField: 'VbpUUID' },
    {
      id: 'sbc',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    {
      id: 'interface',
      label: 'Interface',
      kind: 'related',
      uuidField: 'VoipSbcInterfaceVsiUUID',
      lookupKey: 'interfaceUUID',
    },
    {
      id: 'inputPeer',
      label: 'Input peer',
      kind: 'related',
      uuidField: 'VoipSbcInputPeerVspUUID',
      lookupKey: 'inputPeerUUID',
    },
    {
      id: 'outputPeer',
      label: 'Output peer',
      kind: 'related',
      uuidField: 'VoipSbcOutputPeerVspUUID',
      lookupKey: 'outputPeerUUID',
    },
    { id: 'direction', label: 'Direction', field: 'VbpDirection' },
    { id: 'destination', label: 'Destination pattern', field: 'VbpDestinationPattern' },
    { id: 'mediaMode', label: 'Media mode', field: 'VbpMediaMode' },
    { id: 'signalingProfile', label: 'Signaling', field: 'VbpSignalingProfile' },
    { id: 'codecMode', label: 'Codec mode', field: 'VbpCodecMode' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VbpStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VbpStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
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
      key: 'interfaceUUID',
      source: 'VoipSbcInterfaceVsiUUID',
      payloadKey: 'interfaceUUID',
      label: 'Input interface',
      type: 'search-select',
      required: true,
      tab: 'match',
      span: 1,
    },
    {
      key: 'inputPeerUUID',
      source: 'VoipSbcInputPeerVspUUID',
      payloadKey: 'inputPeerUUID',
      label: 'Input peer',
      type: 'search-select',
      required: true,
      tab: 'match',
      span: 1,
    },
    {
      key: 'outputPeerUUID',
      source: 'VoipSbcOutputPeerVspUUID',
      payloadKey: 'outputPeerUUID',
      label: 'Output peer',
      type: 'search-select',
      required: true,
      tab: 'authentication',
      span: 1,
    },
    { key: 'name', source: 'VbpName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'direction',
      source: 'VbpDirection',
      payloadKey: 'direction',
      label: 'Direction',
      type: 'select',
      options: DIRECTION_OPTIONS,
      span: 1,
    },
    {
      key: 'priority',
      source: 'VbpPriority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
    {
      key: 'sourceIP',
      source: 'VbpSourceIP',
      payloadKey: 'sourceIP',
      label: 'Source IP',
      tab: 'match',
      span: 1,
    },
    {
      key: 'sourcePort',
      source: 'VbpSourcePort',
      payloadKey: 'sourcePort',
      label: 'Source port',
      type: 'number',
      tab: 'match',
      span: 1,
    },
    {
      key: 'sourceTransport',
      source: 'VbpSourceTransport',
      payloadKey: 'sourceTransport',
      label: 'Source transport',
      type: 'select',
      options: SOURCE_TRANSPORT_OPTIONS,
      tab: 'match',
      span: 1,
    },
    {
      key: 'destinationPattern',
      source: 'VbpDestinationPattern',
      payloadKey: 'destinationPattern',
      label: 'Destination pattern',
      tab: 'match',
      span: 1,
    },
    {
      key: 'fromPattern',
      source: 'VbpFromPattern',
      payloadKey: 'fromPattern',
      label: 'From pattern',
      tab: 'match',
      span: 1,
    },
    {
      key: 'toPattern',
      source: 'VbpToPattern',
      payloadKey: 'toPattern',
      label: 'To pattern',
      tab: 'match',
      span: 1,
    },
    {
      key: 'authUsername',
      source: 'VbpAuthUsername',
      payloadKey: 'authUsername',
      label: 'Auth username',
      tab: 'match',
      span: 1,
    },
    {
      key: 'domain',
      source: 'VbpDomain',
      payloadKey: 'domain',
      label: 'Domain',
      tab: 'match',
      span: 1,
    },
    {
      key: 'mediaMode',
      source: 'VbpMediaMode',
      payloadKey: 'mediaMode',
      label: 'Media mode',
      type: 'select',
      options: MEDIA_MODE_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'enableCdr',
      source: 'VbpEnableCdr',
      payloadKey: 'enableCdr',
      label: 'Enable CDR',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'enableHomer',
      source: 'VbpEnableHomer',
      payloadKey: 'enableHomer',
      label: 'Enable Homer',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'fakeRing',
      source: 'VbpFakeRing',
      payloadKey: 'fakeRing',
      label: 'Fake ring',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'sendCallerId',
      source: 'VbpSendCallerId',
      payloadKey: 'sendCallerId',
      label: 'Send caller ID',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'network',
      span: 1,
    },
    {
      key: 'codecMode',
      source: 'VbpCodecMode',
      payloadKey: 'codecMode',
      label: 'Codec mode',
      type: 'select',
      options: CODEC_MODE_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'signalingProfile',
      source: 'VbpSignalingProfile',
      payloadKey: 'signalingProfile',
      label: 'Signaling profile',
      type: 'select',
      options: SIGNALING_PROFILE_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'isupMode',
      source: 'VbpIsupMode',
      payloadKey: 'isupMode',
      label: 'ISUP mode',
      type: 'select',
      options: ISUP_MODE_OPTIONS,
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'allowedCodecs',
      source: 'VbpAllowedCodecs',
      payloadKey: 'allowedCodecs',
      label: 'Allowed codecs',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'preferredCodecs',
      source: 'VbpPreferredCodecs',
      payloadKey: 'preferredCodecs',
      label: 'Preferred codecs',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'transcodeCodecs',
      source: 'VbpTranscodeCodecs',
      payloadKey: 'transcodeCodecs',
      label: 'Transcode codecs',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-pipe',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcPipePage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly interfaceOptions = signal<ConfigurableCrudOption[]>([]);
  readonly peerOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(PIPE_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return ['accountUUID', 'interfaceUUID', 'inputPeerUUID', 'outputPeerUUID'].includes(field.key)
      ? this.lookupLoading()
      : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'accountUUID') return this.accountOptions();
    if (key === 'interfaceUUID') return this.interfaceOptions();
    if (key === 'inputPeerUUID') return this.peerOptions();
    if (key === 'outputPeerUUID') return this.peerOptions();
    return [];
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    this.patchFormValues({
      allowedCodecs: csvToArray(row['VbpAllowedCodecs']),
      preferredCodecs: csvToArray(row['VbpPreferredCodecs']),
      transcodeCodecs: csvToArray(row['VbpTranscodeCodecs']),
    });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      allowedCodecs: arrayToCsv(payload['allowedCodecs']),
      preferredCodecs: arrayToCsv(payload['preferredCodecs']),
      transcodeCodecs: arrayToCsv(payload['transcodeCodecs']),
      sourcePort: Number(payload['sourcePort'] || 0) || null,
      priority: Number(payload['priority'] || 100),
      enableCdr: Number(payload['enableCdr']) === 1,
      enableHomer: Number(payload['enableHomer']) === 1,
      fakeRing: Number(payload['fakeRing']) === 1,
      sendCallerId: Number(payload['sendCallerId']) === 1,
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      const [accounts, interfaces, peers] = await Promise.all([
        fetchPaged(this.rawApi, 'voip/sbc/accounts?status=1', (row) =>
          option(row.VsaUUID, row.VsaName, [row.ServerName, row.ServerEngine]),
        ),
        fetchPaged(this.rawApi, 'voip/sbc/interfaces?status=1', (row) =>
          option(row.VsiUUID, row.VsiName, [row.AccountName, row.VsiIPAddress, row.VsiPort]),
        ),
        fetchPaged(this.rawApi, 'voip/sbc/peers?status=1', (row) =>
          option(row.VspUUID, row.VspName, [row.AccountName, row.VspHost, row.VspPort]),
        ),
      ]);
      this.accountOptions.set(accounts);
      this.interfaceOptions.set(interfaces);
      this.peerOptions.set(peers);
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

async function fetchPaged(
  api: ApiService,
  endpoint: string,
  mapItem: (row: any) => ConfigurableCrudOption | null,
): Promise<ConfigurableCrudOption[]> {
  const options: ConfigurableCrudOption[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const rows = extractItems(response);
    options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
    if (rows.length < 500) break;
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
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

function csvToArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function arrayToCsv(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value ?? '');
}
