import { Component, inject } from '@angular/core';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';
import { ispChildCollection, ispStateChipClass } from '../isp-child-crud';
import { subscriptionRowActions } from './subscription-actions';

const OPERATIONAL_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const EFFECTIVE_STATES = [
  { value: 'active', label: 'Active' },
  { value: 'reduced', label: 'Reduced' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'cancelled', label: 'Cancelled' },
];

const YES_NO = [
  { value: '1', label: 'Yes' },
  { value: '0', label: 'No' },
];

const EVENT_KINDS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'activated', label: 'Activated' },
  { value: 'plan_changed', label: 'Plan changed' },
  { value: 'plan_change_scheduled', label: 'Plan change scheduled' },
  { value: 'plan_change_dropped', label: 'Plan change dropped' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'resumed', label: 'Resumed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'state_changed', label: 'Service state changed' },
  { value: 'trust_unlock', label: 'Trust unlock' },
  { value: 'ip_assigned', label: 'IP assigned' },
  { value: 'ip_released', label: 'IP released' },
  { value: 'projection_error', label: 'Network update failed' },
];

const FAMILIES = [
  { value: '4', label: 'IPv4' },
  { value: '6', label: 'IPv6' },
];

const addressField = (
  key: string,
  label: string,
  extra: Partial<ConfigurableCrudField> = {},
): ConfigurableCrudField => ({
  key,
  source: `Isb${key.charAt(0).toUpperCase()}${key.slice(1)}`,
  label,
  tab: 'address',
  span: 1,
  ...extra,
});

const ipAssignments = ispChildCollection({
  key: 'ipAssignments',
  label: 'IP addresses',
  emptyLabel: 'No fixed IP addresses assigned.',
  description:
    'Fixed IPv4 addresses and IPv6 prefixes of this subscription, taken from your fixed blocks.',
  addLabel: 'Assign',
  createTitle: 'Assign IP address',
  savedMessage: 'IP address assigned.',
  deletedMessage: 'IP address released.',
  endpoint: (subscription) => `isp/subscriptions/${subscription}/ip-assignments`,
  itemEndpoint: (row) => `isp/subscriptions/ip-assignments/${row['IiaUUID']}`,
  uuidField: 'IiaUUID',
  revisionField: 'IiaRevision',
  initialValues: {
    family: '4',
    blockUUID: '',
    blockUUID6: '',
    address: '',
    prefixLength: '',
    notes: '',
  },
  fields: [
    {
      key: 'family',
      label: 'Family',
      type: 'select',
      options: FAMILIES,
      translateOptions: false,
      required: true,
      span: 1,
    },
    {
      key: 'blockUUID',
      label: 'isp.fixedIpv4Block',
      type: 'search-select',
      help: 'isp.assignmentBlockHelp',
      hiddenWhen: ({ values }) => String(values['family']) !== '4',
      remoteLookup: {
        endpoint: 'isp/fixed-ipv4-addresses?status=1',
        uuidField: 'If4UUID',
        labelField: 'If4Cidr',
        descriptionField: 'If4Name',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Fixed blocks are managed in ISP › Fixed IPv4.',
      span: 1,
    },
    {
      key: 'blockUUID6',
      label: 'isp.fixedIpv6Block',
      type: 'search-select',
      help: 'isp.assignmentBlockHelp',
      hiddenWhen: ({ values }) => String(values['family']) !== '6',
      remoteLookup: {
        endpoint: 'isp/fixed-ipv6-addresses?status=1',
        uuidField: 'If6UUID',
        labelField: 'If6Cidr',
        descriptionField: 'If6Name',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Fixed blocks are managed in ISP › Fixed IPv6.',
      span: 1,
    },
    {
      key: 'address',
      label: 'IP address',
      required: true,
      help: 'isp.assignmentAddressHelp',
      span: 1,
      suffixButtons: [
        {
          icon: 'auto_fix_high',
          tooltip: 'isp.nextFreeAddress',
          visibleWhen: ({ values }) => String(values['family']) === '4',
          disabledWhen: ({ values }) => !values['blockUUID'],
          onClick: async ({ values }, host) => {
            try {
              const response = await host.api.get<{
                data?: { item?: { NextFreeAddress?: string | null } };
              }>(`isp/fixed-ipv4-addresses/${values['blockUUID']}/next-free`);
              const address = response?.data?.item?.NextFreeAddress;
              if (address) host.setFieldValue('address', address);
              else host.snack.warning('isp.noFreeAddress');
            } catch {
              host.snack.warning('isp.noFreeAddress');
            }
          },
        },
      ],
    },
    {
      key: 'prefixLength',
      label: 'Prefix length',
      type: 'number',
      hiddenWhen: ({ values }) => String(values['family']) !== '6',
      requiredWhen: ({ values }) => String(values['family']) === '6',
      span: 1,
    },
    { key: 'notes', label: 'Notes', type: 'textarea', span: 4, rows: 4 },
  ],
  columns: [
    { id: 'family', label: 'Family', field: 'IiaFamily', options: FAMILIES },
    { id: 'cidr', label: 'IP address', field: 'IiaCidr', kind: 'identity', uuidField: 'IiaUUID' },
    { id: 'block', label: 'Block', field: 'IiaBlockName' },
    { id: 'created', label: 'Assigned at', field: 'IiaDateCreated', kind: 'datetime' },
  ],
  payload: (values) => {
    const family = Number(values['family']);
    return {
      family,
      address: values['address'],
      prefixLength: family === 6 ? Number(values['prefixLength']) : null,
      blockUUID: (family === 6 ? values['blockUUID6'] : values['blockUUID']) || null,
      notes: values['notes'] || null,
    };
  },
});

const events = ispChildCollection({
  key: 'events',
  label: 'History',
  emptyLabel: 'No events yet.',
  description: 'Every state change of the subscription, with who made it.',
  readOnly: true,
  endpoint: (subscription) => `isp/subscriptions/${subscription}/events`,
  uuidField: 'IseUUID',
  fields: [],
  columns: [
    { id: 'when', label: 'When', field: 'IseDateCreated', kind: 'datetime' },
    { id: 'kind', label: 'Event', field: 'IseKind', options: EVENT_KINDS },
    { id: 'from', label: 'From', field: 'IseFromState' },
    { id: 'to', label: 'To', field: 'IseToState' },
    { id: 'detail', label: 'Detail', field: 'IseDetail' },
    { id: 'actor', label: 'By', field: 'IseActorName' },
  ],
});

/** Subscriptions page; `canTrustUnlock` reads the effective permission of the signed-in user. */
function subscriptionsConfig(canTrustUnlock: () => boolean) {
  return defineCrud({
    endpoint: 'isp/subscriptions',
    uuidField: 'IsbUUID',
    serverSidePagination: true,
    serverSideSorting: true,
    initialPageSize: 50,
    deletePayload: (row) => ({ revision: Number(row['IsbRevision']) }),
    pageTitle: 'Subscriptions',
    pageDescription:
      'Internet subscriptions of your customers: plan, access, billing contract and the service state applied to the network.',
    createTitle: 'New subscription',
    editTitle: 'Edit subscription',
    bulkDelete: false,
    statusFilter: false,
    canDeleteRow: (row) => row['IsbStatus'] !== 'active',
    listFilters: [
      {
        key: 'customerUUID',
        label: 'Customer',
        paramKey: 'customerUUID',
        type: 'search-select',
        span: 1,
        remoteLookup: {
          endpoint: 'registry/customers?status=1',
          searchParam: 'q',
          uuidField: 'CustomerUUID',
          labelField: 'Name',
        },
      },
      {
        key: 'planUUID',
        label: 'Plan',
        paramKey: 'planUUID',
        type: 'search-select',
        span: 1,
        remoteLookup: { endpoint: 'isp/plans', uuidField: 'IpnUUID', labelField: 'IpnName' },
      },
      {
        key: 'operationalStatus',
        label: 'Status',
        paramKey: 'operationalStatus',
        type: 'select',
        span: 1,
        options: OPERATIONAL_STATUSES,
        emptyLabel: 'All',
      },
      {
        key: 'effectiveState',
        label: 'Service state',
        paramKey: 'effectiveState',
        type: 'select',
        span: 1,
        options: EFFECTIVE_STATES,
        emptyLabel: 'All',
      },
    ],
    initialValues: {
      customerUUID: '',
      planUUID: '',
      accessUUID: '',
      portalEnabled: '1',
      addressStreet: '',
      addressNumber: '',
      addressDistrict: '',
      addressComplement: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      addressMunicipalityCode: '',
      lat: '',
      lng: '',
      notes: '',
    },
    columns: [
      { id: 'id', label: 'Subscription', field: 'IsbID', uuidField: 'IsbUUID', kind: 'identity' },
      { id: 'customer', label: 'Customer', field: 'CustomerName' },
      { id: 'plan', label: 'Plan', field: 'IpnName' },
      { id: 'login', label: 'Login', field: 'AaxLoginName', copyable: true },
      {
        id: 'state',
        label: 'Service state',
        field: 'EffectiveState',
        kind: 'status',
        options: EFFECTIVE_STATES,
        chipClass: ispStateChipClass,
      },
      {
        id: 'status',
        label: 'Status',
        field: 'IsbStatus',
        kind: 'status',
        options: OPERATIONAL_STATUSES,
        chipClass: ispStateChipClass,
      },
      { id: 'contract', label: 'Contract', field: 'BctID', optional: true },
      { id: 'pending', label: 'Next plan', field: 'IsbPendingPlanName', optional: true },
      { id: 'activation', label: 'Activated on', field: 'IsbActivationDate', kind: 'date' },
      { id: 'city', label: 'City', field: 'IsbAddressCity', optional: true },
      {
        id: 'applied',
        label: 'Applied to network',
        field: 'IsbAppliedAt',
        kind: 'datetime',
        optional: true,
      },
    ],
    fields: [
      { key: 'revision', source: 'IsbRevision', label: 'Revision', type: 'number', hidden: true },
      { key: 'appliedState', source: 'IsbAppliedState', label: 'Applied state', hidden: true },
      {
        key: 'customerUUID',
        source: 'RegCustomerRcuUUID',
        label: 'Customer',
        type: 'search-select',
        required: true,
        remoteLookup: {
          endpoint: 'registry/customers?status=1',
          searchParam: 'q',
          uuidField: 'CustomerUUID',
          labelField: 'Name',
          selectedLabelField: 'CustomerName',
        },
        disabledWhen: ({ editing }) => editing,
        help: 'isp.subscriptionCustomerHelp',
        span: 1,
      },
      {
        key: 'planUUID',
        source: 'IspPlanIpnUUID',
        label: 'Plan',
        type: 'search-select',
        required: true,
        remoteLookup: {
          endpoint: 'isp/plans?status=1',
          uuidField: 'IpnUUID',
          labelField: 'IpnName',
          selectedLabelField: 'IpnName',
        },
        disabledWhen: ({ editing }) => editing,
        help: 'isp.subscriptionPlanHelp',
        span: 1,
      },
      {
        key: 'accessUUID',
        source: 'AuthenticationAccessAaxUUID',
        label: 'isp.subscriptionAccess',
        type: 'search-select',
        help: 'isp.subscriptionAccessHelp',
        remoteLookup: {
          endpoint: 'authentication/accesses?status=1',
          uuidField: 'AaxUUID',
          labelField: 'AaxLoginName',
          selectedLabelField: 'AaxLoginName',
          parameters: { customerUUID: 'customerUUID' },
        },
        quickCreate: quickCreateFor('AuthenticationAccessAaxUUID', {
          initialValues: ({ values }) => ({ RegCustomerRcuUUID: values['customerUUID'] }),
        }),
        disabledWhen: ({ editing, values }) =>
          editing && !['', 'none'].includes(String(values['appliedState'] ?? '')),
        span: 1,
      },
      {
        key: 'portalEnabled',
        source: 'IsbPortalEnabled',
        label: 'Published in the portal',
        type: 'select',
        options: YES_NO,
        fromRecord: (value) => String(Number(value ?? 1)),
        span: 1,
      },
      addressField('addressZip', 'Zip', {
        breakBefore: true,
        postalLookup: {
          streetKey: 'addressStreet',
          districtKey: 'addressDistrict',
          complementKey: 'addressComplement',
          cityKey: 'addressCity',
          stateKey: 'addressState',
          municipalityCodeKey: 'addressMunicipalityCode',
          numberKey: 'addressNumber',
        },
        help: 'isp.subscriptionAddressHelp',
      }),
      addressField('addressStreet', 'Street', { span: 2 }),
      addressField('addressNumber', 'Number'),
      addressField('addressComplement', 'Complement'),
      addressField('addressDistrict', 'District'),
      addressField('addressCity', 'City'),
      addressField('addressState', 'State'),
      addressField('addressMunicipalityCode', 'IBGE municipality code', {
        help: 'isp.municipalityCodeHelp',
      }),
      addressField('lat', 'Latitude', { type: 'number' }),
      addressField('lng', 'Longitude', { type: 'number' }),
      {
        key: 'notes',
        source: 'IsbNotes',
        label: 'Notes',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
    payload: (values, editing) => {
      const text = (key: string) => String(values[key] ?? '').trim() || null;
      const coordinate = (key: string) => (values[key] === '' ? null : Number(values[key]));
      return {
        ...(editing
          ? { revision: Number(values['revision']) }
          : { customerUUID: values['customerUUID'], planUUID: values['planUUID'] }),
        accessUUID: values['accessUUID'] || null,
        portalEnabled: Number(values['portalEnabled'] ?? 1),
        addressStreet: text('addressStreet'),
        addressNumber: text('addressNumber'),
        addressDistrict: text('addressDistrict'),
        addressComplement: text('addressComplement'),
        addressCity: text('addressCity'),
        addressState: text('addressState'),
        addressZip: text('addressZip'),
        addressMunicipalityCode: text('addressMunicipalityCode'),
        lat: coordinate('lat'),
        lng: coordinate('lng'),
        notes: text('notes'),
      };
    },
    rowActions: subscriptionRowActions(canTrustUnlock),
    relatedCollections: [ipAssignments, events],
  });
}

@Component({
  selector: 'app-isp-subscriptions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspSubscriptionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    super(
      subscriptionsConfig(() =>
        hasEffectivePermission(
          auth.user()?.permissions ?? [],
          'tenant.isp.subscriptions.trust-unlock',
        ),
      ),
    );
  }
}
