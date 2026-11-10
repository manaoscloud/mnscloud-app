import {
  ConfigurableCrudColumn,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import type { DataViewerDialogData } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { priorities, priorityTone } from './cyber-priority';

/**
 * Cyber Security external exposure (V7): public addresses of the tenant or of a customer account,
 * registered with the owner's authorization, scanned by the platform (open ports, certificates and
 * edge products with known exploited vulnerabilities). Nothing is exploited.
 */

export const targetsEndpoint = 'cyber-security/exposure/targets';

const targetEndpoint = (row: ConfigurableCrudRecord, action = '') =>
  `${targetsEndpoint}/${encodeURIComponent(String(row['targetUUID']))}${action ? `/${action}` : ''}`;

export const frequencyOptions: ConfigurableCrudOption[] = [
  { value: 'weekly', label: 'cyberSecurity.exposure.frequency.weekly' },
  { value: 'monthly', label: 'cyberSecurity.exposure.frequency.monthly' },
];

export const scanStatusOptions: ConfigurableCrudOption[] = [
  { value: 'success', label: 'cyberSecurity.exposure.scanStatus.success' },
  { value: 'partial', label: 'cyberSecurity.exposure.scanStatus.partial' },
  { value: 'failed', label: 'cyberSecurity.exposure.scanStatus.failed' },
];

export const exposureStatusOptions: ConfigurableCrudOption[] = [
  { value: 'open', label: 'cyberSecurity.exposure.status.open' },
  { value: 'resolved', label: 'cyberSecurity.exposure.status.resolved' },
  { value: 'closed', label: 'cyberSecurity.exposure.status.closed' },
];

const authorizationOption: ConfigurableCrudOption[] = [
  { value: 'yes', label: 'cyberSecurity.exposure.authorizationStatement' },
];

export function scanStatusTone(value: unknown) {
  switch (String(value ?? '')) {
    case 'success':
      return 'chip-success';
    case 'partial':
      return 'chip-warning';
    case 'failed':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
}

/** Every check code the worker reports; the App shows its translated title and advice. */
export const CHECK_CODES = [
  'port.ftp',
  'port.telnet',
  'port.rpcbind',
  'port.msrpc',
  'port.netbios',
  'port.smb',
  'port.mssql',
  'port.oracle',
  'port.nfs',
  'port.docker',
  'port.docker-api',
  'port.mysql',
  'port.rdp',
  'port.postgresql',
  'port.vnc',
  'port.winrm',
  'port.redis',
  'port.mikrotik-winbox',
  'port.mikrotik-api',
  'port.elasticsearch',
  'port.webmin',
  'port.memcached',
  'port.mongodb',
  'tls.expired',
  'tls.expiring',
  'tls.self-signed',
  'tls.untrusted',
] as const;

const KEV_SUFFIX = ' exposed to the internet';

/** Translated title of a finding by its check code (KEV products keep the product name). */
export function findingTitle(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  const code = String(row['checkCode'] ?? '');
  const title = String(row['title'] ?? '');
  if (code.startsWith('kev.')) {
    const product = title.endsWith(KEV_SUFFIX) ? title.slice(0, -KEV_SUFFIX.length) : title;
    return `${product}: ${t('cyberSecurity.exposure.kevExposed')}`;
  }
  if (!(CHECK_CODES as readonly string[]).includes(code)) return title;
  return t(`cyberSecurity.exposure.check.${code}`);
}

/** Translated advice of a finding (the worker's English text when the code is unknown). */
export function findingAdvice(row: ConfigurableCrudRecord, t: (key: string) => string): string {
  const code = String(row['checkCode'] ?? '');
  if (code.startsWith('kev.')) return t('cyberSecurity.exposure.kevAdvice');
  if (!(CHECK_CODES as readonly string[]).includes(code)) return String(row['detail'] ?? '');
  return t(`cyberSecurity.exposure.advice.${code}`);
}

/** Body of the target form: authorization as a boolean, address only when creating. */
export function targetPayload(values: ConfigurableCrudRecord, row?: ConfigurableCrudRecord) {
  const authorize = Array.isArray(values['authorize'])
    ? (values['authorize'] as unknown[]).includes('yes')
    : values['authorize'] === true || values['authorize'] === 'yes';
  return {
    ...(row ? { revision: row['revision'] ?? null } : { address: values['address'] }),
    label: values['label'],
    cyberAccountUUID: values['cyberAccountUUID'] || null,
    ownerName: values['ownerName'],
    frequency: values['frequency'] || 'weekly',
    authorize,
  };
}

const CYBER_ACCOUNT_LOOKUP = {
  endpoint: 'cyber-security/accounts?status=1',
  uuidField: 'CyaUUID',
  labelField: 'CyaName',
};

/** Fields of the target form; the address is set once, the authorization is renewed on edit. */
export function targetFields(create: boolean): ConfigurableCrudField[] {
  const address: ConfigurableCrudField = {
    key: 'address',
    label: 'cyberSecurity.exposure.address',
    type: 'text',
    required: true,
    span: 1,
    help: 'cyberSecurity.exposure.addressHelp',
  };
  const fields: ConfigurableCrudField[] = [
    { key: 'label', label: 'Name', type: 'text', required: true, span: 1 },
    {
      key: 'cyberAccountUUID',
      label: 'cyberSecurity.account',
      type: 'search-select',
      remoteLookup: CYBER_ACCOUNT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason:
        'Cyber Security accounts are created by account administrators in Customer accounts.',
      span: 1,
      help: 'cyberSecurity.exposure.accountHelp',
    },
    {
      key: 'frequency',
      label: 'cyberSecurity.exposure.frequency',
      type: 'select',
      options: frequencyOptions,
      required: true,
      span: 1,
    },
    {
      key: 'ownerName',
      label: 'cyberSecurity.exposure.ownerName',
      type: 'text',
      required: true,
      span: 1,
      help: 'cyberSecurity.exposure.ownerNameHelp',
    },
    {
      key: 'authorize',
      label: create
        ? 'cyberSecurity.exposure.authorization'
        : 'cyberSecurity.exposure.renewAuthorization',
      type: 'checkbox-group',
      options: authorizationOption,
      required: create,
      span: 4,
      help: 'cyberSecurity.exposure.authorizationHelp',
    },
  ];
  return create ? [address, ...fields] : fields;
}

/** Change a target (name, account, owner, frequency) or renew its authorization. */
export function exposureTargetForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: targetEndpoint(row),
    uuidField: 'targetUUID',
    pageTitle: 'cyberSecurity.exposure.edit',
    pageDescription: 'cyberSecurity.exposure.editDescription',
    createTitle: 'cyberSecurity.exposure.edit',
    savedMessage: 'cyberSecurity.exposure.saved',
    statusFilter: false,
    initialValues: {
      label: row['label'],
      cyberAccountUUID: row['cyberAccountUUID'] ?? '',
      ownerName: row['ownerName'],
      frequency: row['frequency'] ?? 'weekly',
      authorize: row['authorizationValid'] ? [] : ['yes'],
    },
    payload: (values) => targetPayload(values, row),
    columns: [],
    fields: targetFields(false),
  });
}

const findingColumns: ConfigurableCrudColumn[] = [
  {
    id: 'priority',
    label: 'cyberSecurity.vuln.priority',
    field: 'priority',
    kind: 'status',
    options: priorities,
    chipClass: priorityTone,
  },
  {
    id: 'finding',
    label: 'cyberSecurity.exposure.finding',
    field: 'title',
    uuidField: 'findingUUID',
    value: (row, t) => findingTitle(row, t),
    translateValue: false,
  },
  {
    id: 'address',
    label: 'cyberSecurity.exposure.address',
    field: 'address',
    translateValue: false,
  },
  { id: 'port', label: 'cyberSecurity.exposure.port', field: 'port', kind: 'number' },
  {
    id: 'status',
    label: 'Status',
    field: 'status',
    kind: 'status',
    options: exposureStatusOptions,
  },
  {
    id: 'firstSeen',
    label: 'cyberSecurity.exposure.firstSeen',
    field: 'firstSeenAt',
    kind: 'datetime',
  },
  {
    id: 'lastSeen',
    label: 'cyberSecurity.exposure.lastSeen',
    field: 'lastSeenAt',
    kind: 'datetime',
  },
];

/** External findings, open first by priority; of one target when the row is given. */
export function exposureFindingsCollection(
  showFinding: (finding: ConfigurableCrudRecord) => void,
  target?: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const query = target ? `?targetUUID=${encodeURIComponent(String(target['targetUUID']))}` : '';
  return defineCrud({
    endpoint: `cyber-security/exposure/findings${query}`,
    uuidField: 'findingUUID',
    pageTitle: target
      ? String(target['label'] ?? target['address'])
      : 'cyberSecurity.exposure.findings',
    pageDescription: 'cyberSecurity.exposure.findingsDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: target
      ? findingColumns
      : [
          findingColumns[0],
          findingColumns[1],
          {
            id: 'target',
            label: 'cyberSecurity.exposure.target',
            field: 'targetLabel',
            translateValue: false,
          },
          ...findingColumns.slice(2),
        ],
    rowActions: [
      {
        key: 'exposureFindingDetail',
        label: 'cyberSecurity.exposure.findingDetail',
        icon: 'info',
        inline: true,
        run: (row) => showFinding(row),
      },
    ],
  });
}

/** Open services (and those closed in the last 30 days) of one target. */
export function exposureServicesCollection(target: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `cyber-security/exposure/services?targetUUID=${encodeURIComponent(String(target['targetUUID']))}`,
    uuidField: 'serviceUUID',
    pageTitle: String(target['label'] ?? target['address']),
    pageDescription: 'cyberSecurity.exposure.servicesDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: [
      {
        id: 'address',
        label: 'cyberSecurity.exposure.address',
        field: 'address',
        uuidField: 'serviceUUID',
        translateValue: false,
      },
      { id: 'port', label: 'cyberSecurity.exposure.port', field: 'port', kind: 'number' },
      {
        id: 'service',
        label: 'cyberSecurity.exposure.service',
        field: 'service',
        translateValue: false,
      },
      {
        id: 'product',
        label: 'cyberSecurity.exposure.product',
        field: 'product',
        translateValue: false,
      },
      {
        id: 'title',
        label: 'cyberSecurity.exposure.httpTitle',
        field: 'httpTitle',
        translateValue: false,
      },
      {
        id: 'tlsNotAfter',
        label: 'cyberSecurity.exposure.certificateExpires',
        field: 'tlsNotAfter',
        kind: 'date',
      },
      {
        id: 'tlsTrusted',
        label: 'cyberSecurity.exposure.certificateTrusted',
        field: 'tlsTrusted',
        kind: 'boolean',
      },
      {
        id: 'status',
        label: 'Status',
        field: 'status',
        kind: 'status',
        options: exposureStatusOptions,
      },
      {
        id: 'lastSeen',
        label: 'cyberSecurity.exposure.lastSeen',
        field: 'lastSeenAt',
        kind: 'datetime',
      },
    ],
  });
}

/** Row actions of the target page. */
export function exposureTargetActions(
  showFinding: (finding: ConfigurableCrudRecord) => void = () => undefined,
): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'exposureFindings',
      label: 'cyberSecurity.exposure.findings',
      icon: 'report',
      inline: true,
      visible: (row) => Boolean(row['lastScanAt']),
      collection: (row) => exposureFindingsCollection(showFinding, row),
    },
    {
      key: 'exposureServices',
      label: 'cyberSecurity.exposure.services',
      icon: 'lan',
      visible: (row) => Boolean(row['lastScanAt']),
      collection: (row) => exposureServicesCollection(row),
    },
    {
      key: 'exposureScan',
      label: 'cyberSecurity.exposure.scanNow',
      icon: 'radar',
      visible: (row) => !row['scanPending'],
      disabledReason: (row) =>
        row['authorizationValid'] ? null : 'cyberSecurity.exposure.authorizationExpired',
      request: {
        method: 'post',
        endpoint: (row) => targetEndpoint(row, 'scan'),
        body: () => ({}),
        successMessage: 'cyberSecurity.exposure.scanRequested',
      },
    },
    {
      key: 'exposureEdit',
      label: 'cyberSecurity.exposure.edit',
      icon: 'edit',
      form: (row) => exposureTargetForm(row),
    },
    {
      key: 'exposureDelete',
      label: 'cyberSecurity.exposure.delete',
      icon: 'delete',
      request: {
        method: 'post',
        endpoint: (row) => targetEndpoint(row, 'delete'),
        body: (row) => ({ revision: row['revision'] }),
        successMessage: 'cyberSecurity.exposure.deleted',
        confirm: {
          title: 'cyberSecurity.exposure.delete',
          message: 'cyberSecurity.exposure.deleteConfirm',
          confirmLabel: 'cyberSecurity.exposure.delete',
        },
      },
    },
  ];
}

/** One finding: what was seen, where, why it matters and the KEV vulnerabilities of the product. */
export function exposureFindingView(
  finding: ConfigurableCrudRecord,
  t: (key: string) => string,
): DataViewerDialogData {
  const codes = Array.isArray(finding['vulnerabilityCodes'])
    ? (finding['vulnerabilityCodes'] as string[])
    : [];
  const where = [finding['address'], finding['port']]
    .filter((v) => v !== null && v !== undefined && v !== '')
    .join(':');
  return {
    title: findingTitle(finding, t),
    description: String(finding['targetLabel'] ?? ''),
    sections: [
      {
        title: t('cyberSecurity.exposure.summary'),
        message: [
          `${t('cyberSecurity.vuln.priority')}: ${t(`cyberSecurity.vuln.priority.${finding['priority']}`)}`,
          `${t('cyberSecurity.exposure.address')}: ${where}`,
          `${t('Status')}: ${t(`cyberSecurity.exposure.status.${finding['status']}`)}`,
        ].join('\n'),
      },
      { title: t('cyberSecurity.exposure.advice'), message: findingAdvice(finding, t) },
      ...(codes.length
        ? [{ title: t('cyberSecurity.exposure.kevCodes'), message: codes.join(', ') }]
        : []),
    ],
  };
}
