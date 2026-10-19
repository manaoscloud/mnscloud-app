import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

const PROFILE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'api', label: 'API node' },
  { value: 'workers', label: 'Workers' },
  { value: 'asterisk-realtime', label: 'Asterisk (PABX)' },
];

/** List labels also cover retirements of accounts that predate per-host accounts. */
const PROFILE_LABELS: readonly ConfigurableCrudOption[] = [
  ...PROFILE_OPTIONS,
  { value: 'legacy', label: 'Old shared account' },
];

const STATE_OPTIONS = [
  { value: 'creating', label: 'Creating account' },
  { value: 'delivering', label: 'Applying on host' },
  { value: 'active', label: 'Active' },
  { value: 'retiring', label: 'Revoking' },
  { value: 'revoked', label: 'Revoked' },
  { value: 'failed', label: 'Failed' },
] as const;

const config = defineCrud({
  endpoint: 'system/database/principals',
  uuidField: 'uuid',
  pageTitle: 'Database access',
  pageDescription:
    'Each module host connects to the database with its own account: random name and password, accepted only from the host address. Rotating keeps the current account until the new one works.',
  createTitle: 'Request database account',
  dialogDescription:
    'The database Agent creates the account and the module Agent applies it, restarts the module and checks the database connection. The previous account of the host is revoked only after that check.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No database accounts found.',
  savedMessage: 'Database account requested.',
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusMode: 'string',
  activeValue: 'active',
  inactiveValue: 'revoked',
  activeStatusValues: ['active'],
  statusOptions: STATE_OPTIONS,
  initialValues: {
    moduleAgentUUID: '',
    databaseAgentUUID: '',
    profile: 'workers',
  },
  columns: [
    { id: 'moduleAgent', label: 'Module host', field: 'moduleAgentName', translateValue: false },
    { id: 'profile', label: 'Module', field: 'profile', options: PROFILE_LABELS },
    { id: 'username', label: 'Account', field: 'username', translateValue: false },
    { id: 'host', label: 'Allowed address', field: 'host', translateValue: false },
    {
      id: 'databaseAgent',
      label: 'Database host',
      field: 'databaseAgentName',
      translateValue: false,
    },
    { id: 'state', label: 'Status', kind: 'status', field: 'state', className: 'status-col' },
    {
      id: 'error',
      label: 'Last error',
      value: (row) => String(row['lastErrorCode'] ?? '-'),
      translateValue: false,
    },
    { id: 'activated', label: 'Active since', kind: 'datetime', field: 'activatedAt' },
  ],
  fields: [
    {
      key: 'moduleAgentUUID',
      payloadKey: 'moduleAgentUUID',
      label: 'Module host',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'system/database/principals/agents?role=module',
        uuidField: 'uuid',
        labelField: 'name',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Agents enroll from the host installer; they cannot be created from a form.',
      span: 1,
    },
    {
      key: 'databaseAgentUUID',
      payloadKey: 'databaseAgentUUID',
      label: 'Database host',
      type: 'search-select',
      required: true,
      autoSelectSingle: true,
      remoteLookup: {
        endpoint: 'system/database/principals/agents?role=database',
        uuidField: 'uuid',
        labelField: 'name',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Agents enroll from the host installer; they cannot be created from a form.',
      span: 1,
    },
    {
      key: 'profile',
      payloadKey: 'profile',
      label: 'Module',
      type: 'select',
      options: PROFILE_OPTIONS,
      required: true,
      span: 1,
    },
  ],
  rowActions: [
    {
      key: 'rotate',
      label: 'Rotate credential',
      icon: 'autorenew',
      tooltip:
        'Create a new account for this host; the current one keeps working until it is replaced.',
      visible: (row) => row['state'] === 'active',
      request: {
        method: 'post',
        endpoint: () => 'system/database/principals',
        body: (row) => ({
          moduleAgentUUID: row['moduleAgentUUID'],
          databaseAgentUUID: row['databaseAgentUUID'],
          profile: row['profile'],
          host: row['host'],
          databaseHost: row['databaseHost'],
          databasePort: row['databasePort'],
          databaseName: row['databaseName'],
        }),
        successMessage: 'Credential rotation requested.',
        confirm: {
          title: 'Rotate credential',
          message:
            'A new account is created and applied on the host. The current account is revoked only after the module works with the new one.',
          confirmLabel: 'Rotate',
        },
      },
    },
    {
      key: 'revoke',
      label: 'Revoke account',
      icon: 'block',
      tooltip: 'Remove this account from the database.',
      visible: (row) => row['state'] === 'active' || row['state'] === 'failed',
      request: {
        method: 'post',
        endpoint: (row) => `system/database/principals/${row['uuid']}/revoke`,
        body: () => ({}),
        successMessage: 'Account revocation requested.',
        confirm: {
          title: 'Revoke account',
          message:
            'If this account is active, the module host loses access to the database until a new account is requested.',
          confirmLabel: 'Revoke',
        },
      },
    },
  ],
  payload: (values: ConfigurableCrudRecord) => ({
    moduleAgentUUID: values['moduleAgentUUID'],
    databaseAgentUUID: values['databaseAgentUUID'],
    profile: values['profile'],
  }),
});

@Component({
  selector: 'app-system-database-principals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemDatabasePrincipalsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
