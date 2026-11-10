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
 * Cyber Security network devices (V9): routers, firewalls and switches of the tenant or of a
 * customer account, read over SNMP GET only by a collector Agent on the same network. The platform
 * matches their firmware with published vulnerabilities (NVD) every day. The SNMP credential is
 * write-only: the API seals it and never returns it.
 */

export const devicesEndpoint = 'cyber-security/network-devices';

const deviceEndpoint = (row: ConfigurableCrudRecord, action = '') =>
  `${devicesEndpoint}/${encodeURIComponent(String(row['deviceUUID']))}${action ? `/${action}` : ''}`;

export const VENDORS = [
  'mikrotik_routeros',
  'fortinet_fortios',
  'cisco_iosxe',
  'cisco_asa',
  'juniper_junos',
  'paloalto_panos',
  'sonicwall_sonicos',
  'other',
] as const;

export const vendorOptions: ConfigurableCrudOption[] = VENDORS.map((value) => ({
  value,
  label: `cyberSecurity.network.vendor.${value}`,
}));

export const snmpVersionOptions: ConfigurableCrudOption[] = [
  { value: 'v2c', label: 'cyberSecurity.network.snmp.v2c' },
  { value: 'v3', label: 'cyberSecurity.network.snmp.v3' },
];

export const authProtocolOptions: ConfigurableCrudOption[] = [
  { value: 'sha256', label: 'SHA-256' },
  { value: 'sha', label: 'SHA-1' },
];

export const privProtocolOptions: ConfigurableCrudOption[] = [
  { value: 'aes', label: 'AES-128' },
  { value: 'none', label: 'cyberSecurity.network.snmp.noPrivacy' },
];

export const collectStatusOptions: ConfigurableCrudOption[] = [
  { value: 'success', label: 'cyberSecurity.network.collectStatus.success' },
  { value: 'failed', label: 'cyberSecurity.network.collectStatus.failed' },
];

export const deviceFindingStatusOptions: ConfigurableCrudOption[] = [
  { value: 'open', label: 'cyberSecurity.exposure.status.open' },
  { value: 'resolved', label: 'cyberSecurity.exposure.status.resolved' },
];

export function collectStatusTone(value: unknown) {
  switch (String(value ?? '')) {
    case 'success':
      return 'chip-success';
    case 'failed':
      return 'chip-failed';
    default:
      return 'chip-skipped';
  }
}

const text = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * SNMP credential of the form: v2c community, or v3 user with authentication and privacy. Empty
 * secrets on an edit keep the stored credential (null); a partial v3 credential is sent as typed so
 * the API names the missing field.
 */
export function credentialPayload(values: ConfigurableCrudRecord, editing: boolean) {
  const version = String(values['snmpVersion'] || 'v2c');
  if (version === 'v2c') {
    const community = text(values['community']);
    return community || !editing ? { community } : null;
  }
  const authPassword = text(values['authPassword']);
  const privPassword = text(values['privPassword']);
  const user = text(values['snmpUser']).trim();
  if (
    editing &&
    !authPassword &&
    !privPassword &&
    values['snmpVersion'] === values['storedSnmpVersion']
  ) {
    return null;
  }
  const privProtocol = String(values['privProtocol'] || 'aes');
  return {
    user,
    authProtocol: String(values['authProtocol'] || 'sha256'),
    authPassword,
    privProtocol,
    ...(privProtocol === 'aes' ? { privPassword } : {}),
  };
}

/** Body of the device form. */
export function devicePayload(values: ConfigurableCrudRecord, row?: ConfigurableCrudRecord) {
  const port = Number(values['port'] || 161);
  const credential = credentialPayload(values, Boolean(row));
  return {
    name: values['name'],
    address: text(values['address']).trim(),
    port: Number.isFinite(port) ? port : 161,
    agentUUID: values['agentUUID'] || null,
    cyberAccountUUID: values['cyberAccountUUID'] || null,
    snmpVersion: values['snmpVersion'] || 'v2c',
    ...(credential ? { credential } : {}),
    ...(row ? { revision: row['revision'] ?? null } : {}),
  };
}

const CYBER_ACCOUNT_LOOKUP = {
  endpoint: 'cyber-security/accounts?status=1',
  uuidField: 'CyaUUID',
  labelField: 'CyaName',
};

const AGENT_LOOKUP = { endpoint: 'monitoring/agents', uuidField: 'uuid', labelField: 'name' };

const isV3 = ({ values }: { values: ConfigurableCrudRecord }) => values['snmpVersion'] === 'v3';
const usesPrivacy = (ctx: { values: ConfigurableCrudRecord }) =>
  isV3(ctx) && ctx.values['privProtocol'] !== 'none';

/** Fields of the device form; on an edit the secrets are empty and kept unless typed again. */
export function deviceFields(editing: boolean): ConfigurableCrudField[] {
  const keep = editing ? 'cyberSecurity.network.keepSecretHelp' : undefined;
  return [
    { key: 'name', label: 'Name', type: 'text', required: true, span: 1 },
    {
      key: 'address',
      label: 'cyberSecurity.network.address',
      type: 'text',
      required: true,
      span: 1,
      help: 'cyberSecurity.network.addressHelp',
    },
    {
      key: 'agentUUID',
      label: 'cyberSecurity.network.agent',
      type: 'search-select',
      remoteLookup: AGENT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason:
        'Agents are enrolled on the server itself (Monitoring › Agents), not created from this form.',
      required: true,
      span: 1,
      help: 'cyberSecurity.network.agentHelp',
    },
    {
      key: 'cyberAccountUUID',
      label: 'cyberSecurity.account',
      type: 'search-select',
      remoteLookup: CYBER_ACCOUNT_LOOKUP,
      quickCreate: false,
      quickCreateExemptReason:
        'Cyber Security accounts are created by account administrators in Customer accounts.',
      span: 1,
      help: 'cyberSecurity.network.accountHelp',
    },
    {
      key: 'snmpVersion',
      label: 'cyberSecurity.network.snmpVersion',
      type: 'select',
      options: snmpVersionOptions,
      required: true,
      span: 1,
      help: 'cyberSecurity.network.snmpVersionHelp',
    },
    { key: 'port', label: 'cyberSecurity.network.port', type: 'number', span: 1 },
    {
      key: 'community',
      label: 'cyberSecurity.network.community',
      type: 'password',
      span: 1,
      hiddenWhen: isV3,
      requiredWhen: (ctx) => !ctx.editing && !isV3(ctx),
      help: keep ?? 'cyberSecurity.network.communityHelp',
    },
    {
      key: 'snmpUser',
      label: 'cyberSecurity.network.snmpUser',
      type: 'text',
      span: 1,
      hiddenWhen: (ctx) => !isV3(ctx),
      requiredWhen: (ctx) => !ctx.editing && isV3(ctx),
      help: keep ?? 'cyberSecurity.network.snmpUserHelp',
    },
    {
      key: 'authProtocol',
      label: 'cyberSecurity.network.authProtocol',
      type: 'select',
      options: authProtocolOptions,
      span: 1,
      hiddenWhen: (ctx) => !isV3(ctx),
    },
    {
      key: 'authPassword',
      label: 'cyberSecurity.network.authPassword',
      type: 'password',
      span: 1,
      hiddenWhen: (ctx) => !isV3(ctx),
      requiredWhen: (ctx) => !ctx.editing && isV3(ctx),
      help: keep ?? 'cyberSecurity.network.passwordHelp',
    },
    {
      key: 'privProtocol',
      label: 'cyberSecurity.network.privProtocol',
      type: 'select',
      options: privProtocolOptions,
      span: 1,
      hiddenWhen: (ctx) => !isV3(ctx),
    },
    {
      key: 'privPassword',
      label: 'cyberSecurity.network.privPassword',
      type: 'password',
      span: 1,
      hiddenWhen: (ctx) => !usesPrivacy(ctx),
      requiredWhen: (ctx) => !ctx.editing && usesPrivacy(ctx),
      help: keep ?? 'cyberSecurity.network.passwordHelp',
    },
  ];
}

export const DEVICE_INITIAL_VALUES: ConfigurableCrudRecord = {
  port: 161,
  snmpVersion: 'v2c',
  authProtocol: 'sha256',
  privProtocol: 'aes',
};

/** Change a device; the stored credential stays unless a new one is typed. */
export function deviceForm(row: ConfigurableCrudRecord): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: deviceEndpoint(row),
    uuidField: 'deviceUUID',
    pageTitle: 'cyberSecurity.network.edit',
    pageDescription: 'cyberSecurity.network.editDescription',
    createTitle: 'cyberSecurity.network.edit',
    savedMessage: 'cyberSecurity.network.saved',
    statusFilter: false,
    initialValues: {
      ...DEVICE_INITIAL_VALUES,
      name: row['name'],
      address: row['address'],
      port: row['port'] ?? 161,
      agentUUID: row['agentUUID'] ?? '',
      cyberAccountUUID: row['cyberAccountUUID'] ?? '',
      snmpVersion: row['snmpVersion'] ?? 'v2c',
      storedSnmpVersion: row['snmpVersion'] ?? 'v2c',
    },
    payload: (values) => devicePayload(values, row),
    columns: [],
    fields: deviceFields(true),
  });
}

/** Device columns of the page. */
export const deviceColumns: ConfigurableCrudColumn[] = [
  { id: 'name', label: 'Name', field: 'name', uuidField: 'deviceUUID', kind: 'identity' },
  {
    id: 'address',
    label: 'cyberSecurity.network.address',
    field: 'address',
    translateValue: false,
  },
  {
    id: 'vendor',
    label: 'cyberSecurity.network.system',
    field: 'vendor',
    kind: 'status',
    options: vendorOptions,
  },
  { id: 'model', label: 'cyberSecurity.network.model', field: 'model', translateValue: false },
  {
    id: 'firmware',
    label: 'cyberSecurity.network.firmware',
    field: 'firmwareVersion',
    translateValue: false,
  },
  { id: 'agent', label: 'cyberSecurity.network.agent', field: 'agentName', translateValue: false },
  { id: 'account', label: 'cyberSecurity.account', field: 'cyberAccountName' },
  {
    id: 'lastCollected',
    label: 'cyberSecurity.network.lastCollected',
    field: 'lastCollectedAt',
    kind: 'datetime',
  },
  {
    id: 'lastCollectStatus',
    label: 'cyberSecurity.network.lastCollectStatus',
    field: 'lastCollectStatus',
    kind: 'status',
    options: collectStatusOptions,
    chipClass: collectStatusTone,
  },
  {
    id: 'findings',
    label: 'cyberSecurity.network.openFindings',
    field: 'openFindings',
    kind: 'number',
  },
  {
    id: 'urgent',
    label: 'cyberSecurity.network.urgentFindings',
    field: 'urgentFindings',
    kind: 'number',
  },
  { id: 'kev', label: 'cyberSecurity.network.kevFindings', field: 'kevFindings', kind: 'number' },
];

const findingColumns: ConfigurableCrudColumn[] = [
  {
    id: 'priority',
    label: 'cyberSecurity.vuln.priority',
    field: 'priority',
    kind: 'status',
    options: priorities,
    chipClass: priorityTone,
  },
  { id: 'code', label: 'CVE', field: 'code', uuidField: 'findingUUID', translateValue: false },
  {
    id: 'summary',
    label: 'cyberSecurity.network.summary',
    field: 'summary',
    translateValue: false,
  },
  {
    id: 'firmware',
    label: 'cyberSecurity.network.firmware',
    field: 'firmwareVersion',
    translateValue: false,
  },
  {
    id: 'fixed',
    label: 'cyberSecurity.network.fixedVersion',
    field: 'fixedVersion',
    translateValue: false,
  },
  { id: 'cvss', label: 'CVSS', field: 'cvssScore', kind: 'number' },
  { id: 'kev', label: 'KEV', field: 'kev', kind: 'boolean' },
  {
    id: 'status',
    label: 'Status',
    field: 'status',
    kind: 'status',
    options: deviceFindingStatusOptions,
  },
  { id: 'due', label: 'cyberSecurity.network.dueAt', field: 'dueAt', kind: 'datetime' },
  {
    id: 'firstSeen',
    label: 'cyberSecurity.exposure.firstSeen',
    field: 'firstSeenAt',
    kind: 'datetime',
  },
];

/** Firmware findings, most urgent first; of one device when the row is given. */
export function deviceFindingsCollection(
  showFinding: (finding: ConfigurableCrudRecord) => void,
  device?: ConfigurableCrudRecord,
): ConfigurableCrudConfig {
  const query = device
    ? `?status=all&deviceUUID=${encodeURIComponent(String(device['deviceUUID']))}`
    : '';
  return defineCrud({
    endpoint: `${devicesEndpoint}/findings${query}`,
    uuidField: 'findingUUID',
    pageTitle: device
      ? String(device['name'] ?? device['address'])
      : 'cyberSecurity.network.findings',
    pageDescription: 'cyberSecurity.network.findingsDescription',
    statusFilter: false,
    readOnly: true,
    initialValues: {},
    fields: [],
    columns: device
      ? findingColumns
      : [
          findingColumns[0],
          findingColumns[1],
          {
            id: 'device',
            label: 'cyberSecurity.network.device',
            field: 'deviceName',
            translateValue: false,
          },
          ...findingColumns.slice(2),
        ],
    rowActions: [
      {
        key: 'networkFindingDetail',
        label: 'cyberSecurity.network.findingDetail',
        icon: 'info',
        inline: true,
        run: (row) => showFinding(row),
      },
    ],
  });
}

/** Row actions of the device page. */
export function deviceActions(
  showFinding: (finding: ConfigurableCrudRecord) => void = () => undefined,
): ConfigurableCrudRowAction[] {
  return [
    {
      key: 'networkFindings',
      label: 'cyberSecurity.network.findings',
      icon: 'report',
      inline: true,
      visible: (row) => Boolean(row['lastCollectedAt']),
      collection: (row) => deviceFindingsCollection(showFinding, row),
    },
    {
      key: 'networkCollect',
      label: 'cyberSecurity.network.collectNow',
      icon: 'sync',
      visible: (row) => !row['collectPending'],
      disabledReason: (row) =>
        row['agentSupported'] ? null : 'cyberSecurity.network.agentOutdated',
      request: {
        method: 'post',
        endpoint: (row) => deviceEndpoint(row, 'collect'),
        body: () => ({}),
        successMessage: 'cyberSecurity.network.collectRequested',
      },
    },
    {
      key: 'networkEdit',
      label: 'cyberSecurity.network.edit',
      icon: 'edit',
      form: (row) => deviceForm(row),
    },
    {
      key: 'networkDelete',
      label: 'cyberSecurity.network.delete',
      icon: 'delete',
      request: {
        method: 'post',
        endpoint: (row) => deviceEndpoint(row, 'delete'),
        body: (row) => ({ revision: row['revision'] }),
        successMessage: 'cyberSecurity.network.deleted',
        confirm: {
          title: 'cyberSecurity.network.delete',
          message: 'cyberSecurity.network.deleteConfirm',
          confirmLabel: 'cyberSecurity.network.delete',
        },
      },
    },
  ];
}

/** One finding: the CVE, the firmware, the first fixed release and what to do. */
export function deviceFindingView(
  finding: ConfigurableCrudRecord,
  t: (key: string) => string,
): DataViewerDialogData {
  const fixed = finding['fixedVersion'] ? String(finding['fixedVersion']) : '';
  const lines = [
    `${t('cyberSecurity.vuln.priority')}: ${t(`cyberSecurity.vuln.priority.${finding['priority']}`)}`,
    `${t('cyberSecurity.network.firmware')}: ${finding['firmwareVersion'] ?? ''}`,
    `${t('cyberSecurity.network.fixedVersion')}: ${fixed ? fixed : t('cyberSecurity.network.fixedUnknown')}`,
    ...(finding['cvssScore'] !== null && finding['cvssScore'] !== undefined
      ? [`CVSS: ${finding['cvssScore']}`]
      : []),
    ...(finding['kev'] ? [t('cyberSecurity.network.kevNotice')] : []),
  ];
  return {
    title: String(finding['code'] ?? ''),
    description: String(finding['deviceName'] ?? ''),
    sections: [
      { title: t('cyberSecurity.network.summary'), message: String(finding['summary'] ?? '') },
      { title: t('cyberSecurity.exposure.summary'), message: lines.join('\n') },
      {
        title: t('cyberSecurity.exposure.advice'),
        message: fixed
          ? t('cyberSecurity.network.adviceFixed').replace('{version}', fixed)
          : t('cyberSecurity.network.adviceUnknown'),
      },
    ],
  };
}
