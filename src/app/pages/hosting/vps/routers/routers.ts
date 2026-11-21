import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const SIZE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'S', label: 'S (1 vCPU, 256 MB, up to 3 VPN connections)' },
  { value: 'M', label: 'M (2 vCPU, 512 MB, up to 10 VPN connections)' },
  { value: 'L', label: 'L (4 vCPU, 1 GB, up to 30 VPN connections)' },
];

const ROUTER_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'pending', label: 'Pending' },
  { value: 'applying', label: 'Applying' },
  { value: 'applied', label: 'Applied' },
  { value: 'failed', label: 'Failed' },
];

function sizeAction(size: 'S' | 'M' | 'L', label: string): ConfigurableCrudRowAction {
  return {
    key: `size-${size}`,
    label,
    icon: 'memory',
    visible: (row: ConfigurableCrudRecord) => String(row['size'] ?? 'S') !== size,
    request: {
      method: 'put',
      endpoint: (row: ConfigurableCrudRecord) =>
        `hosting/vps/networks/routers/${row['zoneUUID']}/size`,
      body: () => ({ size }),
      successMessage: 'Router size saved. The router restarts once to take it.',
      confirm: {
        title: 'Change the router size',
        message:
          'The router restarts once (about a minute without traffic in your private networks). Sizes M and L are billed monthly. Change the size?',
        confirmLabel: 'Change size',
      },
    },
  };
}

/** Routers of the VPS private networks: size, state and VPN use (VPS router V1c). */
const config = defineCrud({
  endpoint: 'hosting/vps/networks/routers',
  uuidField: 'zoneUUID',
  pageTitle: 'Routers',
  pageDescription:
    'One router per provider routes your private networks (NAT, routes and VPN). Choose its size by the VPN connections it carries.',
  createTitle: 'Router',
  editTitle: 'Router',
  searchPlaceholder: 'Provider',
  emptyLabel: 'No routers yet: create a private network first.',
  deleteTitle: 'Router',
  deleteMessage: 'Routers go away with their private networks.',
  deleteSelectedTitle: 'Router',
  deleteSelectedMessage: 'Routers go away with their private networks.',
  savedMessage: 'Router size saved. The router restarts once to take it.',
  deletedMessage: 'Router size saved. The router restarts once to take it.',
  deleteFailedMessage: 'Routers go away with their private networks.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  initialValues: {},
  fields: [],
  columns: [
    {
      id: 'provider',
      label: 'Provider',
      kind: 'identity',
      field: 'providerName',
      uuidField: 'zoneUUID',
    },
    { id: 'size', label: 'Size', kind: 'status', field: 'size', options: SIZE_OPTIONS },
    {
      id: 'vpn',
      label: 'VPN connections',
      value: (row) => `${row['vpnConnections'] ?? 0} / ${row['vpnConnectionLimit'] ?? 3}`,
    },
    {
      id: 'state',
      label: 'Router',
      kind: 'status',
      field: 'state',
      options: ROUTER_STATE_OPTIONS,
      className: 'status-col',
    },
    { id: 'revision', label: 'Applied revision', kind: 'number', field: 'appliedRevision' },
  ],
});

@Component({
  selector: 'app-vps-routers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HostingVpsRoutersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super({
      ...config,
      rowActions: [sizeAction('S', 'Size S'), sizeAction('M', 'Size M'), sizeAction('L', 'Size L')],
    });
  }
}
