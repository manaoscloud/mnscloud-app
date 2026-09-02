import { Component, inject, signal } from '@angular/core';

import { runRuntimeDiagnostic } from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';
import type { RuntimeDiagnosticResult } from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudFilterAction,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const TRANSPORT_OPTIONS = [
  { value: 'udp', label: 'UDP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'tls', label: 'TLS' },
];

const YES_NO_OPTIONS = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];
const DIAGNOSTIC_CAPTURE_MODE_OPTIONS = [
  { value: 'sip_capture', label: 'SIP capture' },
  { value: 'pcapng', label: 'PCAPNG' },
];
const AUTH_MODE_OPTIONS = [
  { value: 'ip', label: 'IP' },
  { value: 'register', label: 'Register' },
  { value: 'none', label: 'None' },
];
const SIGNALING_PROFILE_OPTIONS = [
  { value: 'sip', label: 'SIP' },
  { value: 'sip_i', label: 'SIP-I' },
  { value: 'sip_t', label: 'SIP-T' },
];
const PEER_MEDIA_MODE_OPTIONS = [
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'anchor', label: 'Anchor' },
  { value: 'transcode', label: 'Transcode' },
];
const CODEC_MODE_OPTIONS = [
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'filter', label: 'Filter' },
  { value: 'prefer', label: 'Prefer' },
  { value: 'transcode', label: 'Transcode' },
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
const ISUP_VARIANT_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'itu', label: 'ITU' },
  { value: 'ansi', label: 'ANSI' },
  { value: 'etsi', label: 'ETSI' },
  { value: 'br_custom', label: 'Brazil custom' },
];
const ISUP_MODE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'passthrough', label: 'Pass-through' },
  { value: 'generate', label: 'Generate' },
  { value: 'strip', label: 'Strip' },
  { value: 'interwork', label: 'Interwork' },
];

const PEER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/peers',
  uuidField: 'VspUUID',
  pageTitle: 'SBC peers',
  pageDescription: 'Manage SIP interconnection identity, authentication and monitoring.',
  createTitle: 'New SBC peer',
  editTitle: 'Edit SBC peer',
  dialogDescription: 'Maintain interconnection, authentication and monitoring data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC peers found.',
  deleteTitle: 'Delete SBC peer',
  deleteMessage: 'Are you sure you want to delete this SBC peer?',
  deleteSelectedTitle: 'Delete selected SBC peers',
  deleteSelectedMessage: 'Delete {count} selected SBC peers?',
  savedMessage: 'SBC peer saved successfully.',
  deletedMessage: 'SBC peer deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC peer.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  tabLabels: {
    monitoring: 'Monitoring',
    diagnostics: 'Diagnostics',
  },
  filterActionMenu: {
    label: 'Status',
    icon: 'monitor_heart',
    actions: [
      {
        key: 'runtime-status-all',
        label: 'Peers',
        tooltip: 'Inspect SBC peer statuses for the selected account',
        icon: 'hub',
      },
    ],
  },
  rowActions: [
    {
      key: 'runtime-status',
      label: 'Runtime status',
      tooltip: 'Inspect SBC peer runtime status',
      icon: 'terminal',
    },
  ],
  initialValues: {
    status: 1,
    accountUUID: '',
    authMode: 'ip',
    signalingProfile: 'sip',
    mediaMode: 'passthrough',
    codecMode: 'passthrough',
    allowedCodecs: ['PCMU', 'PCMA', 'G729', 'G722', 'OPUS'],
    name: '',
    allowedSourceAddresses: '',
    authUsername: '',
    authPassword: '',
    host: '',
    port: 5060,
    transport: 'udp',
    registerEnabled: 0,
    registrarHost: '',
    registrarPort: 5060,
    registrarTransport: '',
    aor: '',
    contactUser: '',
    contactDomain: '',
    registerExpires: 3600,
    registerRetryInterval: 60,
    registerMaxRetryInterval: 600,
    optionsEnabled: 1,
    optionsInterval: 30,
    optionsTimeout: 5,
    optionsFailureThreshold: 3,
    enableCdr: 0,
    diagnosticCaptureEnabled: 0,
    diagnosticCaptureMode: 'sip_capture',
    diagnosticCaptureSeconds: 60,
    isupVariant: '',
    isupMode: '',
    isupPreserve: 1,
    isupMapCause: 1,
    natureOfAddress: '',
    numberingPlan: '',
    presentationIndicator: '',
    screeningIndicator: '',
    maxConcurrentCalls: 0,
    cpsLimit: 0,
  },
  listFilters: [
    {
      key: 'accountUUID',
      label: 'SBC',
      type: 'search-select',
      paramKey: 'accountUUID',
      span: 1,
      placeholder: 'Search SBC',
      emptyLabel: 'No SBC accounts found.',
    },
  ],
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VspName', uuidField: 'VspUUID' },
    {
      id: 'sbc',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    { id: 'authMode', label: 'Auth mode', field: 'VspAuthMode' },
    { id: 'host', label: 'Host', field: 'VspHost' },
    { id: 'port', label: 'Port', field: 'VspPort' },
    { id: 'signalingProfile', label: 'Signaling', field: 'VspSignalingProfile' },
    { id: 'codecMode', label: 'Codec mode', field: 'VspCodecMode' },
    {
      id: 'cdr',
      label: 'CDR',
      kind: 'boolean',
      field: 'VspEnableCdr',
      className: 'status-col',
    },
    { id: 'status', label: 'Status', kind: 'status', field: 'VspStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VspStatus',
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
    { key: 'name', source: 'VspName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'authMode',
      source: 'VspAuthMode',
      payloadKey: 'authMode',
      label: 'Auth mode',
      type: 'select',
      options: AUTH_MODE_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'authUsername',
      source: 'VspAuthUsername',
      payloadKey: 'authUsername',
      label: 'Username',
      tab: 'authentication',
      span: 1,
      breakBefore: true,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'authPassword',
      payloadKey: 'authPassword',
      label: 'Auth password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registrarHost',
      source: 'VspRegistrarHost',
      payloadKey: 'registrarHost',
      label: 'Host',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registrarPort',
      source: 'VspRegistrarPort',
      payloadKey: 'registrarPort',
      label: 'Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'host',
      source: 'VspHost',
      payloadKey: 'host',
      label: 'Host',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'port',
      source: 'VspPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'transport',
      source: 'VspTransport',
      payloadKey: 'transport',
      label: 'Transport',
      type: 'select',
      options: TRANSPORT_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'allowedSourceAddresses',
      source: 'VspAllowedSourceAddresses',
      payloadKey: 'allowedSourceAddresses',
      label: 'Allowed source addresses',
      type: 'textarea',
      tab: 'authentication',
      span: 4,
      rows: 4,
      breakBefore: true,
      placeholder:
        'One address per line. Example: 200.215.239.234, 200.215.239.0/24, 2804:8094::/48',
      hiddenWhen: ({ values }) => !['ip', 'register'].includes(String(values['authMode'])),
    },
    {
      key: 'registrarTransport',
      source: 'VspRegistrarTransport',
      payloadKey: 'registrarTransport',
      label: 'Register transport',
      type: 'select',
      options: [{ value: '', label: 'Automatic' }, ...TRANSPORT_OPTIONS],
      tab: 'authentication',
      span: 1,
      breakBefore: true,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'aor',
      source: 'VspAor',
      payloadKey: 'aor',
      label: 'AOR',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'contactUser',
      source: 'VspContactUser',
      payloadKey: 'contactUser',
      label: 'Contact user',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'contactDomain',
      source: 'VspContactDomain',
      payloadKey: 'contactDomain',
      label: 'Contact domain',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registerExpires',
      source: 'VspRegisterExpires',
      payloadKey: 'registerExpires',
      label: 'Register expires',
      type: 'number',
      tab: 'authentication',
      span: 1,
      breakBefore: true,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registerRetryInterval',
      source: 'VspRegisterRetryInterval',
      payloadKey: 'registerRetryInterval',
      label: 'Register retry interval',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registerMaxRetryInterval',
      source: 'VspRegisterMaxRetryInterval',
      payloadKey: 'registerMaxRetryInterval',
      label: 'Register max retry',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'optionsEnabled',
      source: 'VspOptionsEnabled',
      payloadKey: 'optionsEnabled',
      label: 'OPTIONS keepalive',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'monitoring',
      span: 1,
    },
    {
      key: 'optionsInterval',
      source: 'VspOptionsInterval',
      payloadKey: 'optionsInterval',
      label: 'OPTIONS interval',
      type: 'number',
      tab: 'monitoring',
      span: 1,
    },
    {
      key: 'optionsTimeout',
      source: 'VspOptionsTimeout',
      payloadKey: 'optionsTimeout',
      label: 'OPTIONS timeout',
      type: 'number',
      tab: 'monitoring',
      span: 1,
    },
    {
      key: 'optionsFailureThreshold',
      source: 'VspOptionsFailureThreshold',
      payloadKey: 'optionsFailureThreshold',
      label: 'OPTIONS failure threshold',
      type: 'number',
      tab: 'monitoring',
      span: 1,
    },
    {
      key: 'enableCdr',
      source: 'VspEnableCdr',
      payloadKey: 'enableCdr',
      label: 'Save CDR',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'monitoring',
      span: 1,
    },
    {
      key: 'diagnosticCaptureEnabled',
      source: 'VspDiagnosticCaptureEnabled',
      payloadKey: 'diagnosticCaptureEnabled',
      label: 'Diagnostic capture',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'diagnostics',
      span: 1,
    },
    {
      key: 'diagnosticCaptureMode',
      source: 'VspDiagnosticCaptureMode',
      payloadKey: 'diagnosticCaptureMode',
      label: 'Capture mode',
      type: 'select',
      options: DIAGNOSTIC_CAPTURE_MODE_OPTIONS,
      tab: 'diagnostics',
      span: 1,
      hiddenWhen: ({ values }) => Number(values['diagnosticCaptureEnabled']) !== 1,
    },
    {
      key: 'diagnosticCaptureSeconds',
      source: 'VspDiagnosticCaptureSeconds',
      payloadKey: 'diagnosticCaptureSeconds',
      label: 'Capture duration (seconds)',
      type: 'number',
      tab: 'diagnostics',
      span: 1,
      hiddenWhen: ({ values }) => Number(values['diagnosticCaptureEnabled']) !== 1,
    },
    {
      key: 'signalingProfile',
      source: 'VspSignalingProfile',
      payloadKey: 'signalingProfile',
      label: 'Signaling profile',
      translateLabel: false,
      translateOptions: false,
      type: 'select',
      options: SIGNALING_PROFILE_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'mediaMode',
      source: 'VspMediaMode',
      payloadKey: 'mediaMode',
      label: 'Media mode',
      translateLabel: false,
      type: 'select',
      options: PEER_MEDIA_MODE_OPTIONS,
      translateOptions: false,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'codecMode',
      source: 'VspCodecMode',
      payloadKey: 'codecMode',
      label: 'Codec mode',
      translateLabel: false,
      type: 'select',
      options: CODEC_MODE_OPTIONS,
      translateOptions: false,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'allowedCodecs',
      source: 'VspAllowedCodecs',
      payloadKey: 'allowedCodecs',
      label: 'Allowed codecs',
      type: 'multi-select',
      options: CODEC_OPTIONS,
      tab: 'codecs',
      span: 1,
    },
    {
      key: 'isupVariant',
      source: 'VspIsupVariant',
      payloadKey: 'isupVariant',
      label: 'ISUP variant',
      type: 'select',
      options: ISUP_VARIANT_OPTIONS,
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'isupMode',
      source: 'VspIsupMode',
      payloadKey: 'isupMode',
      label: 'ISUP mode',
      translateLabel: false,
      translateOptions: false,
      type: 'select',
      options: ISUP_MODE_OPTIONS,
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'isupPreserve',
      source: 'VspIsupPreserve',
      payloadKey: 'isupPreserve',
      label: 'Preserve ISUP',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'isupMapCause',
      source: 'VspIsupMapCause',
      payloadKey: 'isupMapCause',
      label: 'Map ISUP cause',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'natureOfAddress',
      source: 'VspNatureOfAddress',
      payloadKey: 'natureOfAddress',
      label: 'Nature of address',
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'numberingPlan',
      source: 'VspNumberingPlan',
      payloadKey: 'numberingPlan',
      label: 'Numbering plan',
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'presentationIndicator',
      source: 'VspPresentationIndicator',
      payloadKey: 'presentationIndicator',
      label: 'Presentation indicator',
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'screeningIndicator',
      source: 'VspScreeningIndicator',
      payloadKey: 'screeningIndicator',
      label: 'Screening indicator',
      tab: 'codecs',
      span: 1,
      hiddenWhen: ({ values }) => String(values['signalingProfile']) === 'sip',
    },
    {
      key: 'maxConcurrentCalls',
      source: 'VspMaxConcurrentCalls',
      payloadKey: 'maxConcurrentCalls',
      label: 'Max concurrent calls',
      type: 'number',
      tab: 'limits',
      span: 1,
    },
    {
      key: 'cpsLimit',
      source: 'VspCpsLimit',
      payloadKey: 'cpsLimit',
      label: 'CPS limit',
      type: 'number',
      tab: 'limits',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-peer',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcPeerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly accountOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(PEER_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'accountUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'accountUUID' ? this.accountOptions() : [];
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    this.patchFormValues({
      allowedCodecs: csvToArray(row['VspAllowedCodecs']),
    });
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const authMode = String(payload['authMode'] || 'ip');
    return {
      ...payload,
      allowedCodecs: arrayToCsv(payload['allowedCodecs']),
      authUsername: authMode === 'register' ? payload['authUsername'] : null,
      authPassword: authMode === 'register' ? payload['authPassword'] : null,
      fromDomain: null,
      port: Number(payload['port'] || 0),
      registrarPort: Number(payload['registrarPort'] || 0) || null,
      registerEnabled: String(payload['authMode']) === 'register',
      registerExpires: Number(payload['registerExpires'] || 3600),
      registerRetryInterval: Number(payload['registerRetryInterval'] || 60),
      registerMaxRetryInterval: Number(payload['registerMaxRetryInterval'] || 600),
      optionsEnabled: Number(payload['optionsEnabled']) === 1,
      optionsInterval: Number(payload['optionsInterval'] || 30),
      optionsTimeout: Number(payload['optionsTimeout'] || 5),
      optionsFailureThreshold: Number(payload['optionsFailureThreshold'] || 3),
      enableCdr: Number(payload['enableCdr']) === 1,
      diagnosticCaptureEnabled: Number(payload['diagnosticCaptureEnabled']) === 1,
      diagnosticCaptureMode: String(payload['diagnosticCaptureMode'] || 'sip_capture'),
      diagnosticCaptureSeconds: Number(payload['diagnosticCaptureSeconds'] || 60),
      isupPreserve: Number(payload['isupPreserve']) === 1,
      isupMapCause: Number(payload['isupMapCause']) === 1,
      maxConcurrentCalls: Number(payload['maxConcurrentCalls'] || 0),
      cpsLimit: Number(payload['cpsLimit'] || 0),
      status: Number(payload['status']),
    };
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord): void {
    if (action.key !== 'runtime-status') return;
    const uuid = String(row['VspUUID'] ?? '').trim();
    if (!uuid) return;
    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'SBC peer runtime status',
      description: 'Reads the latest runtime registration and health reported by the SBC edge.',
      startEndpoint: `voip/sbc/peers/${uuid}/runtime-status`,
      statusEndpoint: () => `voip/sbc/peers/${uuid}/runtime-status`,
      sections: peerStatusSections,
    });
  }

  override isFilterActionDisabled(action: ConfigurableCrudFilterAction): boolean {
    return action.key === 'runtime-status-all' && !this.selectedAccountUUID();
  }

  override handleFilterAction(action: ConfigurableCrudFilterAction): void {
    if (action.key !== 'runtime-status-all') return;
    const accountUUID = this.selectedAccountUUID();
    if (!accountUUID) {
      this.snack.warning(this.t('Select an SBC account before inspecting its runtime status.'));
      return;
    }
    const query = encodeURIComponent(accountUUID);
    void runRuntimeDiagnostic(this.dialog, this.api, this.snack, {
      title: 'SBC peers runtime status',
      description: 'Reads the latest runtime registration and health reported by the SBC edge.',
      startEndpoint: `voip/sbc/peers/runtime-status?accountUUID=${query}`,
      statusEndpoint: () => `voip/sbc/peers/runtime-status?accountUUID=${query}`,
      sections: peerStatusSections,
    });
  }

  private selectedAccountUUID(): string {
    return String(
      this.listFilterValue({
        key: 'accountUUID',
        label: 'SBC',
        type: 'search-select',
      }) ?? '',
    ).trim();
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.accountOptions.set(
        await fetchPaged(this.rawApi, 'voip/sbc/accounts?status=1', (row) =>
          option(row.VsaUUID, row.VsaName, [row.ServerName, row.ServerEngine]),
        ),
      );
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

function peerStatusSections(result: RuntimeDiagnosticResult) {
  const peers = Array.isArray(result.result?.['peers']) ? result.result['peers'] : [];
  return [
    {
      title: 'Peer statuses',
      table: {
        columns: [
          { key: 'peer', label: 'Peer' },
          { key: 'sbc', label: 'SBC' },
          { key: 'registration', label: 'Registration', translate: true },
          { key: 'health', label: 'Health', translate: true },
          { key: 'code', label: 'Code' },
          { key: 'message', label: 'Message' },
          { key: 'retry', label: 'Next retry' },
        ],
        rows: peers.map((item) => ({
          peer: item['name'] ?? '-',
          sbc: item['accountName'] ?? item['serverName'] ?? '-',
          registration: peerRegistrationLabel(item['registrationStatus']),
          health: peerHealthLabel(item['healthStatus']),
          code: item['registrationLastCode'] ?? item['healthLastCode'] ?? '-',
          message: item['registrationLastMessage'] ?? item['healthLastMessage'] ?? '-',
          retry: item['registrationNextRetryAt'] ?? '-',
        })),
        emptyLabel: 'No peer statuses were returned.',
      },
    },
  ];
}

function peerRegistrationLabel(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  if (status === 'registered') return 'Registered';
  if (status === 'registering') return 'Registering';
  if (status === 'pending') return 'Pending';
  if (status === 'failed') return 'Failed';
  if (status === 'expired') return 'Expired';
  if (status === 'disabled') return 'Disabled';
  return 'Unknown';
}

function peerHealthLabel(value: unknown): string {
  const status = String(value ?? '').toLowerCase();
  if (status === 'reachable') return 'Reachable';
  if (status === 'unreachable') return 'Unreachable';
  if (status === 'degraded') return 'Degraded';
  return 'Unknown';
}
