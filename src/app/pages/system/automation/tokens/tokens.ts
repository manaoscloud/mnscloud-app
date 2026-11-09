import { Component } from '@angular/core';

import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';

/** Workspace automation tokens are issued by the workspace ceremony, never from the App. */
const PROFILE_LABELS: readonly ConfigurableCrudOption[] = [
  { value: 'master', label: 'Master (DEV only)' },
  { value: 'read', label: 'Read only' },
];

const STATUS_OPTIONS = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Revoked' },
] as const;

const config = defineCrud({
  endpoint: 'system/automation/tokens',
  uuidField: 'uuid',
  pageTitle: 'Automation access',
  pageDescription:
    'Tokens the workspace delivery scripts use instead of a person signing in. Each works only from its allowed addresses, expires and renews itself. Revoke one to cut that access at once.',
  createTitle: 'Automation token',
  dialogDescription:
    'Tokens are issued by the workspace ceremony so the secret never appears on screen.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No automation tokens found.',
  savedMessage: 'Automation token saved.',
  canCreate: false,
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  statusOptions: STATUS_OPTIONS,
  initialValues: {},
  columns: [
    { id: 'profile', label: 'Profile', field: 'profile', options: PROFILE_LABELS },
    { id: 'prefix', label: 'Prefix', field: 'prefix', translateValue: false },
    {
      id: 'allowedIps',
      label: 'Allowed addresses',
      value: (row) => (Array.isArray(row['allowedIps']) ? row['allowedIps'].join(', ') : '-'),
      translateValue: false,
    },
    { id: 'lastUsed', label: 'Last used', kind: 'datetime', field: 'lastUsedAt' },
    { id: 'lastUsedIp', label: 'Last address', field: 'lastUsedIp', translateValue: false },
    { id: 'expires', label: 'Expires', kind: 'datetime', field: 'expiresAt' },
    { id: 'issuedBy', label: 'Issued by', field: 'createdByEmail', translateValue: false },
    { id: 'status', label: 'Status', kind: 'status', field: 'status', className: 'status-col' },
  ],
  fields: [],
  rowActions: [
    {
      key: 'revoke',
      label: 'Revoke token',
      icon: 'block',
      tooltip: 'Cut this automation access now.',
      visible: (row) => Number(row['status']) === 1,
      request: {
        method: 'post',
        endpoint: (row) => `system/automation/tokens/${row['uuid']}/revoke`,
        body: () => ({}),
        successMessage: 'Automation token revoked.',
        confirm: {
          title: 'Revoke token',
          message:
            'The workspace loses this access at once, including open sessions. A new token needs the workspace ceremony again.',
          confirmLabel: 'Revoke',
        },
      },
    },
  ],
  payload: () => ({}),
});

@Component({
  selector: 'app-system-automation-tokens',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SystemAutomationTokensPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
