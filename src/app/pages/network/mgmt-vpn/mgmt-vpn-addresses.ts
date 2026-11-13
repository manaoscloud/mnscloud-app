import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { asText, prefixedOptions, textOrNull } from '../network-runtime-install';

/**
 * Rede › Endereços de gerência (master, `/system/network/mgmt-vpn/addresses`): the /32 addresses of
 * the management VPN hubs assigned to a tenant (or kept by the platform) and, optionally, to one of
 * its devices. Rows of kind `gateway_source` are the gateway source address of an owner, created and
 * removed by the API: they are shown read-only.
 */

const ENDPOINT = 'system/network/mgmt-vpn/addresses';

export const MGMT_VPN_KIND_OPTIONS = prefixedOptions('network.mgmtVpn.kind', [
  'device',
  'gateway_source',
]);

/** Gateway source rows are managed by the API and cannot be edited or removed here. */
export function isGatewaySource(row: ConfigurableCrudRecord): boolean {
  return asText(row['NvaKind']) === 'gateway_source';
}

/** Create sends the whole assignment; update changes only the device and the notes. */
export function mgmtVpnAddressPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const common = {
    deviceUuid: textOrNull(values['deviceUuid']),
    notes: textOrNull(values['notes']),
  };
  if (editing) return { ...common, revision: asText(values['revision']) };
  return {
    hubUuid: textOrNull(values['hubUuid']),
    ownerUuid: textOrNull(values['ownerUuid']),
    address: textOrNull(values['address']),
    ...common,
  };
}

const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'NvaUUID',
  pageTitle: 'network.mgmtVpnAddresses.title',
  pageDescription: 'network.mgmtVpnAddresses.description',
  dialogDescription: 'network.mgmtVpnAddresses.dialogDescription',
  createTitle: 'network.mgmtVpnAddresses.new',
  editTitle: 'network.mgmtVpnAddresses.edit',
  searchPlaceholder: 'network.mgmtVpnAddresses.search',
  emptyLabel: 'network.mgmtVpnAddresses.empty',
  savedMessage: 'network.mgmtVpnAddresses.saved',
  deletedMessage: 'network.mgmtVpnAddresses.deleted',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: asText(row['NvaRevision']) }),
  canEditRow: (row) => !isGatewaySource(row),
  canDeleteRow: (row) => !isGatewaySource(row),
  initialValues: {
    hubUuid: '',
    ownerUuid: '',
    address: '',
    deviceUuid: '',
    notes: '',
    revision: '',
  },
  payload: (values, editing) => mgmtVpnAddressPayload(values, editing),
  listFilters: [
    {
      key: 'hub',
      label: 'network.mgmtVpnAddresses.hub',
      paramKey: 'hub',
      type: 'search-select',
      span: 1,
      placeholder: 'Search',
      remoteLookup: {
        endpoint: 'system/network/mgmt-vpn/hubs',
        uuidField: 'NvhUUID',
        labelField: 'NvhName',
      },
    },
    {
      key: 'owner',
      label: 'network.mgmtVpnAddresses.owner',
      paramKey: 'owner',
      type: 'search-select',
      span: 1,
      placeholder: 'Search',
      remoteLookup: {
        endpoint: 'system/billing/tenants',
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
        descriptionField: 'TenantEmail',
      },
    },
  ],
  fields: [
    {
      key: 'hubUuid',
      source: 'NetworkMgmtVpnHubNvhUUID',
      label: 'network.mgmtVpnAddresses.hub',
      type: 'search-select',
      required: true,
      span: 1,
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'system/network/mgmt-vpn/hubs',
        uuidField: 'NvhUUID',
        labelField: 'NvhName',
        selectedLabelField: 'HubName',
        descriptionField: 'NvhMgmtNet',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Hubs are created in Network > Management VPN.',
    },
    {
      key: 'ownerUuid',
      source: 'UserUsrUUID',
      label: 'network.mgmtVpnAddresses.owner',
      type: 'search-select',
      span: 1,
      help: 'network.mgmtVpnAddresses.ownerHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'system/billing/tenants',
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
        selectedLabelField: 'OwnerName',
        descriptionField: 'TenantEmail',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Tenants are provisioned through onboarding; there is no in-place create form.',
    },
    {
      key: 'address',
      source: 'NvaAddress',
      label: 'network.mgmtVpnAddresses.address',
      required: true,
      span: 1,
      placeholder: 'network.mgmtVpnAddresses.addressPlaceholder',
      help: 'network.mgmtVpnAddresses.addressHelp',
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'deviceUuid',
      source: 'NetworkDeviceNwdUUID',
      label: 'network.mgmtVpnAddresses.device',
      span: 1,
      placeholder: 'network.mgmtVpnAddresses.devicePlaceholder',
      help: 'network.mgmtVpnAddresses.deviceHelp',
    },
    { key: 'revision', source: 'NvaRevision', label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: 'NvaNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  columns: [
    {
      id: 'address',
      label: 'network.mgmtVpnAddresses.address',
      field: 'NvaAddress',
      kind: 'identity',
      uuidField: 'NvaUUID',
      detail: (row, t) => (isGatewaySource(row) ? t('network.mgmtVpn.kind.gateway_source') : ''),
    },
    { id: 'hub', label: 'network.mgmtVpnAddresses.hub', field: 'HubName' },
    {
      id: 'owner',
      label: 'network.mgmtVpnAddresses.owner',
      field: 'OwnerName',
      value: (row, t) =>
        asText(row['OwnerName'])
          ? asText(row['OwnerName'])
          : t('network.mgmtVpnAddresses.platform'),
    },
    {
      id: 'kind',
      label: 'network.mgmtVpnAddresses.kind',
      field: 'NvaKind',
      value: (row, t) =>
        t(`network.mgmtVpn.kind.${isGatewaySource(row) ? 'gateway_source' : 'device'}`),
    },
    {
      id: 'device',
      label: 'network.mgmtVpnAddresses.device',
      field: 'DeviceName',
      value: (row) => asText(row['DeviceName']),
      detail: (row) => asText(row['DeviceNetworkPath']),
    },
    { id: 'notes', label: 'Notes', field: 'NvaNotes', optional: true },
  ],
});

@Component({
  selector: 'app-network-mgmt-vpn-addresses',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkMgmtVpnAddressesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
