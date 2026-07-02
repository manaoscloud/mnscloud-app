import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
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
const PEER_TYPE_OPTIONS = [
  { value: 'carrier', label: 'Carrier' },
  { value: 'pbx', label: 'PABX' },
  { value: 'customer', label: 'Customer' },
  { value: 'internal', label: 'Internal' },
];
const AUTH_MODE_OPTIONS = [
  { value: 'ip', label: 'IP' },
  { value: 'register', label: 'Register' },
  { value: 'ip_digest', label: 'IP + Digest' },
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
  pageDescription: 'Manage SIP interconnections used as pipe input or output peers.',
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
    network: 'Connection',
    monitoring: 'Monitoring',
  },
  initialValues: {
    status: 1,
    accountUUID: '',
    peerType: 'carrier',
    authMode: 'ip',
    signalingProfile: 'sip',
    mediaMode: 'passthrough',
    name: '',
    host: '',
    port: 5060,
    transport: 'udp',
    allowedSourceAddresses: '',
    authUsername: '',
    authPassword: '',
    fromDomain: '',
    outboundProxy: '',
    failoverHost: '',
    registerEnabled: 0,
    registrarHost: '',
    registrarPort: '',
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
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VspName', uuidField: 'VspUUID' },
    {
      id: 'sbc',
      label: 'SBC',
      kind: 'related',
      uuidField: 'VoipSbcAccountVsaUUID',
      lookupKey: 'accountUUID',
    },
    { id: 'host', label: 'Host', field: 'VspHost' },
    { id: 'port', label: 'Port', field: 'VspPort' },
    { id: 'transport', label: 'Transport', field: 'VspTransport' },
    { id: 'authMode', label: 'Auth mode', field: 'VspAuthMode' },
    { id: 'signalingProfile', label: 'Signaling', field: 'VspSignalingProfile' },
    {
      id: 'register',
      label: 'Register',
      kind: 'boolean',
      field: 'VspRegisterEnabled',
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
    {
      key: 'peerType',
      source: 'VspPeerType',
      payloadKey: 'peerType',
      label: 'Peer type',
      type: 'select',
      options: PEER_TYPE_OPTIONS,
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
      key: 'registerEnabled',
      source: 'VspRegisterEnabled',
      payloadKey: 'registerEnabled',
      label: 'Register',
      type: 'select',
      options: YES_NO_OPTIONS,
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'authUsername',
      source: 'VspAuthUsername',
      payloadKey: 'authUsername',
      label: 'Auth username',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'authPassword',
      payloadKey: 'authPassword',
      label: 'Auth password',
      tab: 'authentication',
      span: 1,
      autocomplete: 'new-password',
      hiddenWhen: ({ values }) => !['register', 'ip_digest'].includes(String(values['authMode'])),
    },
    {
      key: 'host',
      source: 'VspHost',
      payloadKey: 'host',
      label: 'Host',
      required: true,
      tab: 'network',
      span: 1,
    },
    {
      key: 'port',
      source: 'VspPort',
      payloadKey: 'port',
      label: 'Port',
      type: 'number',
      tab: 'network',
      span: 1,
    },
    {
      key: 'transport',
      source: 'VspTransport',
      payloadKey: 'transport',
      label: 'Transport',
      type: 'select',
      options: TRANSPORT_OPTIONS,
      tab: 'network',
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
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'ip',
    },
    {
      key: 'fromDomain',
      source: 'VspFromDomain',
      payloadKey: 'fromDomain',
      label: 'From domain',
      tab: 'authentication',
      span: 1,
    },
    {
      key: 'registrarHost',
      source: 'VspRegistrarHost',
      payloadKey: 'registrarHost',
      label: 'Registrar host',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registrarPort',
      source: 'VspRegistrarPort',
      payloadKey: 'registrarPort',
      label: 'Registrar port',
      type: 'number',
      tab: 'authentication',
      span: 1,
      hiddenWhen: ({ values }) => String(values['authMode']) !== 'register',
    },
    {
      key: 'registrarTransport',
      source: 'VspRegistrarTransport',
      payloadKey: 'registrarTransport',
      label: 'Registrar transport',
      type: 'select',
      options: [{ value: '', label: 'Same as peer' }, ...TRANSPORT_OPTIONS],
      tab: 'authentication',
      span: 1,
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
      key: 'signalingProfile',
      source: 'VspSignalingProfile',
      payloadKey: 'signalingProfile',
      label: 'Signaling profile',
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
      type: 'select',
      options: PEER_MEDIA_MODE_OPTIONS,
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
      key: 'outboundProxy',
      source: 'VspOutboundProxy',
      payloadKey: 'outboundProxy',
      label: 'Outbound proxy',
      tab: 'network',
      span: 1,
    },
    {
      key: 'failoverHost',
      source: 'VspFailoverHost',
      payloadKey: 'failoverHost',
      label: 'Failover host',
      tab: 'network',
      span: 1,
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

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      port: Number(payload['port'] || 0),
      registrarPort: Number(payload['registrarPort'] || 0) || null,
      registerEnabled: Number(payload['registerEnabled']) === 1,
      registerExpires: Number(payload['registerExpires'] || 3600),
      registerRetryInterval: Number(payload['registerRetryInterval'] || 60),
      registerMaxRetryInterval: Number(payload['registerMaxRetryInterval'] || 600),
      optionsEnabled: Number(payload['optionsEnabled']) === 1,
      optionsInterval: Number(payload['optionsInterval'] || 30),
      optionsTimeout: Number(payload['optionsTimeout'] || 5),
      optionsFailureThreshold: Number(payload['optionsFailureThreshold'] || 3),
      isupPreserve: Number(payload['isupPreserve']) === 1,
      isupMapCause: Number(payload['isupMapCause']) === 1,
      maxConcurrentCalls: Number(payload['maxConcurrentCalls'] || 0),
      cpsLimit: Number(payload['cpsLimit'] || 0),
      status: Number(payload['status']),
    };
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
