import { Component, computed, signal } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const PROTOCOL_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'tcp_udp', label: 'TCP and UDP' },
];

const ROUTER_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'pending', label: 'Pending' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'failed', label: 'Failed' },
];

const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

function portsOf(row: ConfigurableCrudRecord): string {
  const start = Number(row['HpwPublicPortStart']);
  const end = Number(row['HpwPublicPortEnd']);
  return start === end ? String(start) : `${start}-${end}`;
}

/** Port forwarding of the public IPs used by the router of the private networks (VPS router N1). */
const config = defineCrud({
  endpoint: 'hosting/vps/router/port-forwards',
  uuidField: 'HpwUUID',
  pageTitle: 'Port forwards',
  pageDescription:
    'Forward ports of a public IP used by the router to servers of your private networks. Restrict the allowed sources whenever you can.',
  createTitle: 'New port forward',
  editTitle: 'Edit port forward',
  dialogDescription:
    'The router applies the rule at once. A range keeps the same ports; a single port may go to another private port.',
  searchPlaceholder: 'Public IP, private IP or description',
  emptyLabel: 'No port forwards found. First use a public IP on the router (Public IPs).',
  deleteTitle: 'Delete port forward',
  deleteMessage: 'Delete this port forward? The router stops forwarding these ports.',
  deleteSelectedTitle: 'Delete selected port forwards',
  deleteSelectedMessage: 'Delete {count} selected port forward(s)?',
  savedMessage: 'Port forward saved.',
  deletedMessage: 'Port forward deleted.',
  deleteFailedMessage: 'Failed to delete port forward.',
  bulkDelete: false,
  statusFilter: false,
  pageSizeOptions: [10, 25, 100],
  initialValues: {
    publicIpUUID: '',
    protocol: 'tcp',
    publicPortStart: '',
    publicPortEnd: '',
    privateAddress: '',
    privatePort: '',
    sourceCidrs: '0.0.0.0/0',
    description: '',
    isActive: 1,
  },
  fields: [
    {
      key: 'publicIpUUID',
      source: 'HostingVpsPublicIpHpiUUID',
      payloadKey: 'publicIpUUID',
      label: 'Public IP',
      type: 'select',
      required: true,
      span: 1,
      help: 'Public IP used by the router. Use one on the router in Public IPs first.',
    },
    {
      key: 'protocol',
      source: 'HpwProtocol',
      payloadKey: 'protocol',
      label: 'Protocol',
      type: 'select',
      options: PROTOCOL_OPTIONS,
      required: true,
      span: 1,
    },
    {
      key: 'publicPortStart',
      source: 'HpwPublicPortStart',
      payloadKey: 'publicPortStart',
      label: 'Public port',
      type: 'number',
      required: true,
      span: 1,
      help: 'First public port (1 to 65535).',
    },
    {
      key: 'publicPortEnd',
      source: 'HpwPublicPortEnd',
      payloadKey: 'publicPortEnd',
      label: 'Last public port',
      type: 'number',
      span: 1,
      help: 'Only for a range (up to 1000 ports). Empty = a single port.',
    },
    {
      key: 'privateAddress',
      source: 'HpwPrivateAddress',
      payloadKey: 'privateAddress',
      label: 'Server private IP',
      placeholder: '10.0.0.10',
      required: true,
      span: 1,
      help: 'Address of the server in one of your private networks.',
    },
    {
      key: 'privatePort',
      source: 'HpwPrivatePort',
      payloadKey: 'privatePort',
      label: 'Private port',
      type: 'number',
      span: 1,
      help: 'Only for a single public port. Empty = the same port.',
    },
    {
      key: 'sourceCidrs',
      source: 'HpwSourceCidrs',
      payloadKey: 'sourceCidrs',
      label: 'Allowed sources',
      placeholder: '203.0.113.0/24, 198.51.100.7/32',
      span: 1,
      help: 'IPv4 addresses or networks allowed to connect, separated by commas (up to 20). 0.0.0.0/0 = anyone.',
    },
    {
      key: 'description',
      source: 'HpwDescription',
      payloadKey: 'description',
      label: 'Description',
      span: 1,
    },
    {
      key: 'isActive',
      source: 'HpwIsActive',
      payloadKey: 'isActive',
      label: 'Active',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
    },
  ],
  columns: [
    {
      id: 'publicIp',
      label: 'Public IP',
      kind: 'identity',
      field: 'HpiAddress',
      uuidField: 'HpwUUID',
      copyable: true,
    },
    {
      id: 'protocol',
      label: 'Protocol',
      kind: 'status',
      field: 'HpwProtocol',
      options: PROTOCOL_OPTIONS,
    },
    {
      id: 'publicPorts',
      label: 'Public ports',
      field: 'HpwPublicPortStart',
      value: (row) => portsOf(row),
    },
    {
      id: 'destination',
      label: 'Destination',
      field: 'HpwPrivateAddress',
      copyable: true,
      value: (row) => {
        const privatePort = row['HpwPrivatePort'];
        const port =
          privatePort !== null && privatePort !== undefined && privatePort !== ''
            ? String(privatePort)
            : portsOf(row);
        return `${String(row['HpwPrivateAddress'] ?? '')}:${port}`;
      },
    },
    { id: 'sources', label: 'Allowed sources', field: 'HpwSourceCidrs' },
    {
      id: 'active',
      label: 'Active',
      kind: 'status',
      field: 'HpwIsActive',
      options: YES_NO_OPTIONS,
    },
    {
      id: 'router',
      label: 'Router',
      kind: 'status',
      field: 'RouterState',
      options: ROUTER_STATE_OPTIONS,
      className: 'status-col',
    },
    { id: 'description', label: 'Description', field: 'HpwDescription' },
  ],
});

@Component({
  selector: 'app-vps-port-forwards',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsPortForwardsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly routerIps = signal<ConfigurableCrudRecord[]>([]);
  private readonly ipOptions = computed<ConfigurableCrudOption[]>(() =>
    this.routerIps().map((ip) => ({
      value: String(ip['HpiUUID']),
      label: String(ip['HpiAddress']),
      description: String(ip['HvrName'] ?? ''),
    })),
  );

  constructor() {
    super(config);
    void this.fetchRouterIps();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'publicIpUUID') return this.ipOptions();
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const number = (value: unknown) =>
      value === null || value === undefined || value === '' ? null : Number(value);
    return {
      publicIpUUID: payload['publicIpUUID'],
      protocol: payload['protocol'] || 'tcp',
      publicPortStart: number(payload['publicPortStart']),
      publicPortEnd: number(payload['publicPortEnd']) ?? number(payload['publicPortStart']),
      privateAddress: String(payload['privateAddress'] ?? '').trim(),
      privatePort: number(payload['privatePort']),
      sourceCidrs: String(payload['sourceCidrs'] ?? '').trim() || '0.0.0.0/0',
      description: String(payload['description'] ?? '').trim() || null,
      isActive: Number(payload['isActive'] ?? 1) !== 0,
    };
  }

  private async fetchRouterIps() {
    const response = await this.api.get<{ data?: { items?: ConfigurableCrudRecord[] } }>(
      'hosting/vps/public-ips?status=allocated&limit=500',
    );
    this.routerIps.set(
      (response?.data?.items ?? []).filter(
        (ip) => !!ip['HostingVpsTenantZoneHtzUUID'] && ip['HpiNetworkState'] !== 'removing',
      ),
    );
  }
}
