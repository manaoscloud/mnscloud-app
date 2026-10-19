import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import {
  LINE_TARGET_EXEMPT,
  LINE_TARGET_LOOKUP,
  PHONE_BLOCK_REASONS,
  PHONE_LINE_MODES,
  PHONE_REALMS,
  phoneSessionsConfig,
  YES_NO,
} from '../phone-options';

/** API field that carries the identity of each sign-in realm. */
const IDENTITY_FIELD: Record<string, string> = {
  user: 'MemberUserUsrUUID',
  employee: 'ErpHrEmployeeEmpUUID',
  customer_user: 'ErpCustomerUserEcuUUID',
};

const identityOf = (row: ConfigurableCrudRecord) =>
  row['MemberUserUsrUUID'] ?? row['ErpHrEmployeeEmpUUID'] ?? row['ErpCustomerUserEcuUUID'] ?? '';

const config = defineCrud({
  endpoint: 'voip/phone/users',
  uuidField: 'VhuUUID',
  pageTitle: 'Phone users',
  pageDescription:
    'People of the tenant or of its customers who use PhoneWeb. Each one signs in with an identity they already have (App e-mail, Pulse login or customer portal login); PhoneWeb keeps no password.',
  createTitle: 'New phone user',
  editTitle: 'Edit phone user',
  dialogDescription: 'Choose who signs in to PhoneWeb and with which existing login.',
  emptyLabel: 'No phone users found.',
  deleteTitle: 'Delete phone user',
  deleteMessage: 'Delete this phone user? Every PhoneWeb session of this person ends at once.',
  savedMessage: 'Phone user saved successfully.',
  deletedMessage: 'Phone user deleted successfully.',
  deleteFailedMessage: 'Failed to delete phone user.',
  bulkDelete: false,
  serverSidePagination: true,
  listFilters: [
    {
      key: 'realm',
      paramKey: 'realm',
      label: 'Sign-in',
      type: 'select',
      span: 1,
      options: PHONE_REALMS,
      emptyLabel: 'All',
    },
  ],
  initialValues: {
    status: 1,
    realm: 'user',
    identityUUID: '',
    displayName: '',
    maxSessions: 5,
    revision: null,
  },
  columns: [
    {
      id: 'name',
      label: 'Name',
      uuidField: 'VhuUUID',
      kind: 'identity',
      value: (row) => String(row['VhuDisplayName'] ?? row['IdentityName'] ?? ''),
      detail: (row) => String(row['IdentityLogin'] ?? ''),
    },
    { id: 'realm', label: 'Sign-in', field: 'VhuRealm', options: PHONE_REALMS },
    { id: 'customer', label: 'Customer', field: 'CustomerName', optional: true },
    { id: 'sessions', label: 'Active sessions', field: 'ActiveSessions', kind: 'number' },
    {
      id: 'access',
      label: 'Access',
      value: (row, translate) =>
        translate(
          PHONE_BLOCK_REASONS.find((option) => option.value === (row['BlockReason'] ?? ''))
            ?.label ?? String(row['BlockReason']),
        ),
    },
    { id: 'status', label: 'Status', field: 'VhuStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'VhuStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'realm',
      source: 'VhuRealm',
      label: 'Sign-in',
      type: 'select',
      options: PHONE_REALMS,
      required: true,
      disabledWhen: ({ editing }) => editing,
      help: 'App member: signs in with the MNSCloud e-mail. Employee: signs in with the Pulse login code (HR › Pulse access). Customer: signs in with the customer portal login and only sees lines of that customer.',
      span: 1,
    },
    {
      key: 'identityUUID',
      label: 'Person',
      labelWhen: ({ values }) =>
        values['realm'] === 'employee'
          ? 'Employee'
          : values['realm'] === 'customer_user'
            ? 'Customer'
            : 'Member',
      type: 'search-select',
      required: true,
      fromRecord: (_value, row) => identityOf(row),
      remoteLookup: {
        endpoint: 'voip/phone/identities',
        uuidField: 'IdentityUUID',
        labelField: 'Label',
        descriptionField: 'Detail',
        selectedLabelField: 'IdentityName',
        searchParam: 'search',
        parameters: { realm: 'realm' },
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Polymorphic target: members join by invitation, employees need an HR record with a Pulse access account, customers come from the customer form.',
      disabledWhen: ({ editing }) => editing,
      span: 2,
    },
    {
      key: 'displayName',
      source: 'VhuDisplayName',
      label: 'Display name',
      placeholder: 'Uses the person name when empty',
      span: 2,
    },
    {
      key: 'maxSessions',
      source: 'VhuMaxSessions',
      label: 'Simultaneous sessions',
      type: 'number',
      required: true,
      help: 'Devices signed in at the same time. Over the limit, the oldest session ends.',
      span: 1,
    },
    { key: 'revision', source: 'VhuRevision', label: 'Revision', hidden: true },
  ],
  payload: (values, editing) => ({
    ...(editing
      ? { VhuRevision: Number(values['revision']) }
      : {
          VhuRealm: values['realm'],
          [IDENTITY_FIELD[String(values['realm'])] ?? 'MemberUserUsrUUID']: values['identityUUID'],
        }),
    VhuDisplayName: values['displayName'] || null,
    VhuMaxSessions: Number(values['maxSessions']),
    VhuStatus: Number(values['status']),
  }),
  relatedCollections: [
    {
      key: 'lines',
      label: 'Lines',
      emptyLabel:
        'No lines assigned. Without lines, the person can only use pool lines or manual accounts.',
      addLabel: 'Assign line',
      createTitle: 'Assign line',
      editTitle: 'Edit line',
      dialogDescription: 'Extension or subscriber that this person registers in PhoneWeb.',
      savedMessage: 'Line saved successfully.',
      deletedMessage: 'Line removed.',
      endpoint: (phoneUser) => `voip/phone/users/${phoneUser}/lines`,
      updateEndpoint: (phoneUser) => `voip/phone/users/${phoneUser}/lines`,
      deleteEndpoint: (phoneUser, row) => `voip/phone/users/${phoneUser}/lines/${row['VhlUUID']}`,
      uuidField: 'VhlUUID',
      initialValues: { status: 1, target: '', mode: 'dedicated', primary: 0, revision: null },
      fields: [
        { key: 'status', source: 'VhlStatus', label: 'Status', type: 'status', span: 1 },
        {
          key: 'target',
          source: 'TargetUUID',
          label: 'Line',
          type: 'search-select',
          required: true,
          remoteLookup: LINE_TARGET_LOOKUP,
          quickCreate: false,
          quickCreateExemptReason: LINE_TARGET_EXEMPT,
          disabledWhen: ({ editing }) => editing,
          help: 'PABX extension or Softswitch subscriber. Customer logins only accept lines of their customer.',
          span: 2,
        },
        {
          key: 'mode',
          source: 'VhlMode',
          label: 'Use',
          type: 'select',
          options: PHONE_LINE_MODES,
          required: true,
          span: 2,
        },
        {
          key: 'primary',
          source: 'VhlIsPrimary',
          label: 'Primary line',
          type: 'select',
          options: YES_NO,
          required: true,
          span: 1,
        },
        { key: 'revision', source: 'VhlRevision', label: 'Revision', hidden: true },
      ],
      columns: [
        { id: 'line', label: 'Line', field: 'TargetLabel' },
        {
          id: 'mode',
          label: 'Use',
          value: (row, translate) =>
            translate(
              PHONE_LINE_MODES.find((o) => o.value === row['VhlMode'])?.label ??
                String(row['VhlMode']),
            ),
        },
        {
          id: 'primary',
          label: 'Primary line',
          value: (row, translate) => translate(Number(row['VhlIsPrimary']) === 1 ? 'Yes' : 'No'),
        },
        {
          id: 'webrtc',
          label: 'WebRTC',
          value: (row, translate) =>
            translate(row['WebRtcReady'] === true ? 'Ready' : 'No WebRTC domain'),
        },
        { id: 'status', label: 'Status', field: 'VhlStatus', kind: 'status' },
      ],
      payload: (values) => ({
        ...(values['revision']
          ? { VhlRevision: Number(values['revision']) }
          : { TargetUUID: values['target'] }),
        VhlMode: values['mode'],
        VhlIsPrimary: Number(values['primary']),
        VhlStatus: Number(values['status']),
      }),
    },
  ],
  rowActions: [
    {
      key: 'sessions',
      label: 'Sessions',
      icon: 'devices',
      collection: (row) => phoneSessionsConfig(String(row['VhuUUID'])),
    },
  ],
});

@Component({
  selector: 'app-voip-phone-users',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPhoneUsersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
