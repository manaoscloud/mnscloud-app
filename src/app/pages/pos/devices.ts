import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'suspect', label: 'Suspended for review' },
  { value: 'revoked', label: 'Revoked' },
];
const GRANT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'superseded', label: 'Superseded' },
  { value: 'revoked', label: 'Revoked' },
];

const tomorrow = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

// Devices are provisioned from the installed POS app (the key never leaves the device); here the
// manager issues and revokes offline grants and revokes devices.
const config = defineCrud({
  endpoint: 'pos/devices',
  uuidField: 'SdvUUID',
  pageTitle: 'POS devices',
  pageDescription:
    'Installed POS apps that sell offline: terminal, status, last contact and the offline authorization in force.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'terminalUUID',
      label: 'Terminal',
      paramKey: 'terminalUUID',
      type: 'search-select',
      span: 1,
      remoteLookup: { endpoint: 'pos/terminals', uuidField: 'PtmUUID', labelField: 'PtmName' },
    },
    {
      key: 'status',
      label: 'Status',
      paramKey: 'status',
      type: 'select',
      span: 1,
      options: STATUSES,
      emptyLabel: 'All',
    },
  ],
  columns: [
    { id: 'name', label: 'Device', field: 'SdvName', uuidField: 'SdvUUID', kind: 'identity' },
    { id: 'terminal', label: 'Terminal', field: 'TerminalName' },
    { id: 'platform', label: 'Platform', field: 'SdvPlatform' },
    { id: 'status', label: 'Status', field: 'SdvStatus', options: STATUSES },
    { id: 'version', label: 'App version', field: 'SdvAppVersion' },
    { id: 'seen', label: 'Last contact', field: 'SdvLastSeenAt', kind: 'datetime' },
    { id: 'grant', label: 'Offline until', field: 'ActiveGrantValidUntil', kind: 'datetime' },
    { id: 'conflicts', label: 'Open conflicts', field: 'OpenConflicts', kind: 'number' },
  ],
  fields: [],
  rowActions: [
    {
      key: 'grant',
      label: 'Issue offline grant',
      icon: 'verified_user',
      disabledReason: (row) =>
        row['SdvStatus'] === 'active' ? null : 'Only an active device receives a grant.',
      form: (row) =>
        defineCrud({
          endpoint: `pos/devices/${row['SdvUUID']}/grants`,
          uuidField: 'SogUUID',
          pageTitle: 'Issue offline grant',
          pageDescription:
            'Who may sell offline on this device, the limits and until when. It replaces the grant in force.',
          createTitle: 'Issue offline grant',
          dialogDescription:
            'Revocation reaches an offline device only when it reconnects, so keep the limits and the validity small.',
          savedMessage: 'Offline grant issued.',
          statusFilter: false,
          columns: [],
          initialValuesFactory: () => ({
            operators: [],
            maxSaleValue: 500,
            maxTotalValue: 5000,
            maxItems: 100,
            maxDiscountPercent: 0,
            validUntil: tomorrow(),
          }),
          initialValues: {},
          fields: [
            {
              key: 'operators',
              payloadKey: 'operators',
              label: 'Operators',
              type: 'search-select',
              multiple: true,
              required: true,
              remoteLookup: {
                endpoint: 'pos/operators',
                searchParam: 'q',
                uuidField: 'UserUUID',
                labelField: 'Name',
                descriptionField: 'Email',
              },
              quickCreate: false,
              quickCreateExemptReason: 'Operators are existing users of the environment.',
              span: 4,
            },
            {
              key: 'maxSaleValue',
              label: 'Maximum value per sale',
              type: 'currency',
              required: true,
              span: 2,
            },
            {
              key: 'maxTotalValue',
              label: 'Maximum total sold offline',
              type: 'currency',
              required: true,
              span: 2,
            },
            { key: 'maxItems', label: 'Maximum items per sale', type: 'number', span: 2 },
            {
              key: 'maxDiscountPercent',
              label: 'Maximum discount (%)',
              type: 'number',
              help: 'Up to the terminal maximum discount.',
              span: 2,
            },
            {
              key: 'validUntil',
              label: 'Valid until',
              type: 'datetime',
              required: true,
              help: 'At most 31 days from now.',
              span: 2,
            },
          ],
          payload: (values) => ({
            operators: values['operators'],
            maxSaleValue: Number(values['maxSaleValue']),
            maxTotalValue: Number(values['maxTotalValue']),
            maxItems: values['maxItems'] === '' ? null : Number(values['maxItems']),
            maxDiscountPercent: Number(values['maxDiscountPercent'] ?? 0),
            validUntil: new Date(String(values['validUntil'])).toISOString(),
          }),
        }),
    },
    {
      key: 'grants',
      label: 'Offline grants',
      icon: 'history',
      collection: (row) =>
        defineCrud({
          endpoint: `pos/devices/${row['SdvUUID']}/grants`,
          uuidField: 'SogUUID',
          pageTitle: 'Offline grants',
          pageDescription:
            'Grants issued for this device and how much was sold offline under each.',
          canCreate: false,
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          statusFilter: false,
          serverSidePagination: true,
          columns: [
            { id: 'id', label: 'ID', field: 'SogID', uuidField: 'SogUUID', kind: 'identity' },
            { id: 'status', label: 'Status', field: 'SogStatus', options: GRANT_STATUSES },
            { id: 'from', label: 'Valid from', field: 'SogValidFrom', kind: 'datetime' },
            { id: 'until', label: 'Valid until', field: 'SogValidUntil', kind: 'datetime' },
            { id: 'sale', label: 'Per sale', field: 'SogMaxSaleValue', kind: 'currency' },
            { id: 'total', label: 'Total', field: 'SogMaxTotalValue', kind: 'currency' },
            { id: 'consumed', label: 'Sold offline', field: 'SogConsumedValue', kind: 'currency' },
          ],
          fields: [],
          rowActions: [
            {
              key: 'revoke-grant',
              label: 'Revoke',
              icon: 'block',
              visible: (grant) => grant['SogStatus'] === 'active',
              request: {
                method: 'post',
                endpoint: (grant) => `pos/grants/${grant['SogUUID']}/revoke`,
                successMessage: 'Offline grant revoked.',
                confirm: {
                  title: 'Revoke offline grant',
                  message:
                    'Operations done after the revocation become conflicts when the device reconnects.',
                  confirmLabel: 'Revoke',
                },
              },
            },
          ],
        }),
    },
    {
      key: 'revoke',
      label: 'Revoke device',
      icon: 'phonelink_erase',
      visible: (row) => row['SdvStatus'] !== 'revoked',
      request: {
        method: 'post',
        endpoint: (row) => `pos/devices/${row['SdvUUID']}/revoke`,
        body: () => ({ reason: 'Revoked by the manager' }),
        successMessage: 'Device revoked.',
        confirm: {
          title: 'Revoke device',
          message:
            'The device stops synchronizing and must be provisioned again; its pending operations stay on it until then.',
          confirmLabel: 'Revoke',
        },
      },
    },
  ],
});

@Component({
  selector: 'app-pos-devices',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class PosDevicesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
