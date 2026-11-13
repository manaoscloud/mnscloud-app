import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { asText, prefixedOptions, textOrNull } from '../network-runtime-install';

/**
 * Rede › VPN de gerência (master, `/system/network/mgmt-vpn`): the WireGuard hubs of the management
 * network (`/system/network/mgmt-vpn/hubs`, platform.master.access). The /32 addresses assigned to
 * tenants are the sibling page `mgmt-vpn-addresses.ts`.
 */

const ENDPOINT = 'system/network/mgmt-vpn/hubs';

export const MGMT_VPN_HUB_STATUS_OPTIONS = prefixedOptions('network.mgmtVpn.status', [
  'active',
  'disabled',
]);

/** Gateway key state shown in the list: the key the gateway reported, or still waiting for it. */
export function gatewayKeyState(row: ConfigurableCrudRecord): 'reported' | 'pending' | 'none' {
  if (!asText(row['AccessGatewayAgwUUID'])) return 'none';
  return asText(row['GatewayKeyReportedAt']) || asText(row['GatewayPublicKey'])
    ? 'reported'
    : 'pending';
}

/** Create and update send the same fields; update also carries the revision (partial PUT). */
export function mgmtVpnHubPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const body: ConfigurableCrudRecord = {
    name: textOrNull(values['name']),
    endpoint: textOrNull(values['endpoint']),
    publicKey: textOrNull(values['publicKey']),
    mgmtNet: textOrNull(values['mgmtNet']),
    gatewayNet: textOrNull(values['gatewayNet']),
    gatewayUuid: textOrNull(values['gatewayUuid']),
    status: values['status'] === 'disabled' ? 'disabled' : 'active',
    notes: textOrNull(values['notes']),
  };
  return editing ? { ...body, revision: asText(values['revision']) } : body;
}

const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'NvhUUID',
  pageTitle: 'network.mgmtVpn.title',
  pageDescription: 'network.mgmtVpn.description',
  dialogDescription: 'network.mgmtVpn.dialogDescription',
  createTitle: 'network.mgmtVpn.new',
  editTitle: 'network.mgmtVpn.edit',
  searchPlaceholder: 'network.mgmtVpn.search',
  emptyLabel: 'network.mgmtVpn.empty',
  savedMessage: 'network.mgmtVpn.saved',
  deletedMessage: 'network.mgmtVpn.deleted',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; a hub with live addresses is refused by the API.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: asText(row['NvhRevision']) }),
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'disabled',
  statusOptions: MGMT_VPN_HUB_STATUS_OPTIONS,
  initialStatus: '',
  initialValues: {
    status: 'active',
    name: '',
    endpoint: '',
    publicKey: '',
    mgmtNet: '',
    gatewayNet: '',
    gatewayUuid: '',
    notes: '',
    revision: '',
  },
  payload: (values, editing) => mgmtVpnHubPayload(values, editing),
  fields: [
    {
      key: 'name',
      source: 'NvhName',
      label: 'Name',
      required: true,
      span: 1,
      placeholder: 'network.mgmtVpn.namePlaceholder',
    },
    {
      key: 'endpoint',
      source: 'NvhEndpoint',
      label: 'network.mgmtVpn.endpoint',
      required: true,
      span: 1,
      placeholder: 'network.mgmtVpn.endpointPlaceholder',
      help: 'network.mgmtVpn.endpointHelp',
    },
    {
      key: 'publicKey',
      source: 'NvhPublicKey',
      label: 'network.mgmtVpn.publicKey',
      span: 1,
      help: 'network.mgmtVpn.publicKeyHelp',
    },
    {
      key: 'mgmtNet',
      source: 'NvhMgmtNet',
      label: 'network.mgmtVpn.mgmtNet',
      required: true,
      span: 1,
      placeholder: 'network.mgmtVpn.mgmtNetPlaceholder',
      help: 'network.mgmtVpn.mgmtNetHelp',
    },
    {
      key: 'gatewayNet',
      source: 'NvhGatewayNet',
      label: 'network.mgmtVpn.gatewayNet',
      required: true,
      span: 1,
      placeholder: 'network.mgmtVpn.gatewayNetPlaceholder',
      help: 'network.mgmtVpn.gatewayNetHelp',
    },
    {
      key: 'gatewayUuid',
      source: 'AccessGatewayAgwUUID',
      label: 'network.mgmtVpn.gateway',
      type: 'search-select',
      span: 1,
      help: 'network.mgmtVpn.gatewayHelp',
      remoteLookup: {
        endpoint: 'system/access-gateways',
        uuidField: 'AgwUUID',
        labelField: 'AgwName',
        selectedLabelField: 'AccessGatewayName',
        descriptionField: 'AgwKey',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Access gateways are installed from Network > Gateways; create it there.',
    },
    { key: 'revision', source: 'NvhRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'NvhNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    {
      id: 'name',
      label: 'Name',
      field: 'NvhName',
      kind: 'identity',
      uuidField: 'NvhUUID',
      detail: (row) => asText(row['NvhEndpoint']),
    },
    { id: 'mgmtNet', label: 'network.mgmtVpn.mgmtNet', field: 'NvhMgmtNet' },
    { id: 'gatewayNet', label: 'network.mgmtVpn.gatewayNet', field: 'NvhGatewayNet' },
    {
      id: 'gateway',
      label: 'network.mgmtVpn.gateway',
      field: 'AccessGatewayName',
      value: (row, t) =>
        asText(row['AccessGatewayName'])
          ? asText(row['AccessGatewayName'])
          : t('network.mgmtVpn.noGateway'),
    },
    {
      id: 'gatewayKey',
      label: 'network.mgmtVpn.gatewayKey',
      field: 'GatewayKeyReportedAt',
      value: (row, t) => t(`network.mgmtVpn.gatewayKeyState.${gatewayKeyState(row)}`),
    },
    { id: 'addresses', label: 'network.mgmtVpn.addresses', field: 'AddressCount', kind: 'number' },
    { id: 'owners', label: 'network.mgmtVpn.owners', field: 'OwnerCount', kind: 'number' },
    {
      id: 'status',
      label: 'Status',
      field: 'NvhStatus',
      kind: 'status',
      options: MGMT_VPN_HUB_STATUS_OPTIONS,
      chipClass: (value) => (value === 'active' ? 'chip-success' : 'chip-skipped'),
    },
  ],
});

@Component({
  selector: 'app-network-mgmt-vpn-hubs',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkMgmtVpnHubsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
