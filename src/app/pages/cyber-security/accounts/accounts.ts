import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import {
  resaleAccountCrud,
  resaleAccountRowActions,
} from '../../../shared/crud/configurable-crud/account-resale-actions';

export const CYBER_SECURITY_ACCOUNTS_CONFIG = resaleAccountCrud({
  endpoint: 'cyber-security/accounts',
  prefix: 'Cya',
  pageTitle: 'cyberSecurity.accounts',
  pageDescription: 'cyberSecurity.accountsDescription',
  createTitle: 'cyberSecurity.newAccount',
  editTitle: 'cyberSecurity.editAccount',
  i18n: 'cyberSecurity',
  extraColumns: [
    { id: 'servers', field: 'ServersCount', label: 'cyberSecurity.protectedServers' },
    { id: 'vaults', field: 'SecretVaultsCount', label: 'cyberSecurity.secretVaults' },
  ],
});

const YES_NO: readonly ConfigurableCrudOption[] = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
];

// Acknowledge and unblock need threats; reveal needs secrets (the database drops them otherwise).
const GRANTS: readonly [string, string][] = [
  ['CpgDashboard', 'cyberSecurity.grantDashboard'],
  ['CpgServers', 'cyberSecurity.grantServers'],
  ['CpgThreats', 'cyberSecurity.grantThreats'],
  ['CpgAlertAck', 'cyberSecurity.grantAlertAck'],
  ['CpgUnblock', 'cyberSecurity.grantUnblock'],
  ['CpgSecrets', 'cyberSecurity.grantSecrets'],
  ['CpgSecretReveal', 'cyberSecurity.grantSecretReveal'],
];

const PORTAL_ROLES = [
  { value: 'CUSTOMER_OWNER', label: 'cyberSecurity.portalRoleOwner' },
  { value: 'CUSTOMER_ADMIN', label: 'cyberSecurity.portalRoleAdmin' },
  { value: 'CUSTOMER_USER', label: 'cyberSecurity.portalRoleUser' },
] as const;

const REQUEST_STATUSES: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'cyberSecurity.unblockPending' },
  { value: 'approved', label: 'cyberSecurity.unblockApproved' },
  { value: 'rejected', label: 'cyberSecurity.unblockRejected' },
];

/** Customer Portal users of the account's customer and the Cyber Security operations of each one. */
function portalAccessConfig(row: ConfigurableCrudRecord) {
  const base = `cyber-security/accounts/${row['CyaUUID']}`;
  return defineCrud({
    endpoint: `${base}/portal-grants`,
    uuidField: 'CpgUUID',
    pageTitle: 'cyberSecurity.portalAccess',
    pageDescription: 'cyberSecurity.portalAccessDescription',
    createTitle: 'cyberSecurity.portalAccessCreate',
    editTitle: 'cyberSecurity.portalAccessEdit',
    emptyLabel: 'cyberSecurity.portalAccessEmpty',
    bulkDelete: false,
    ...revisionDeletePayloads('CpgUUID', 'CpgRevision'),
    // Reading is on by default; actions and the audited secret reveal (CS6) are opt-in.
    initialValues: {
      RegCustomerUserRcsUUID: '',
      CpgDashboard: 1,
      CpgServers: 1,
      CpgThreats: 1,
      CpgAlertAck: 0,
      CpgUnblock: 0,
      CpgSecrets: 0,
      CpgSecretReveal: 0,
      status: 1,
    },
    fields: [
      { key: 'status', source: 'CpgStatus', label: 'Status', type: 'status', span: 1 },
      {
        key: 'RegCustomerUserRcsUUID',
        source: 'RegCustomerUserRcsUUID',
        label: 'cyberSecurity.portalUser',
        type: 'search-select',
        required: true,
        span: 1,
        disabledWhen: ({ editing }) => editing,
        remoteLookup: {
          endpoint: `${base}/portal-users`,
          uuidField: 'RcsUUID',
          labelField: 'RcsUsername',
          descriptionField: 'RcsRole',
          selectedLabelField: 'PortalUsername',
        },
        quickCreate: false,
        quickCreateExemptReason:
          'Portal users are the customer logins managed in Registry > Customers.',
      },
      ...GRANTS.map(([key, label]) => ({
        key,
        source: key,
        label,
        type: 'select' as const,
        span: 1 as const,
        options: YES_NO,
      })),
      {
        key: 'revision',
        source: 'CpgRevision',
        label: 'documents.revision',
        hiddenWhen: () => true,
      },
    ],
    columns: [
      {
        id: 'user',
        field: 'PortalUsername',
        label: 'cyberSecurity.portalUser',
        kind: 'identity',
      },
      {
        id: 'role',
        field: 'PortalRole',
        label: 'cyberSecurity.portalRole',
        options: PORTAL_ROLES,
      },
      ...GRANTS.map(([field, label]) => ({
        id: field,
        field,
        label,
        kind: 'boolean' as const,
      })),
      { id: 'status', field: 'CpgStatus', label: 'Status', kind: 'status' },
    ],
  });
}

/** IP unblock requests sent by the customer from the Portal; each one is answered once. */
function unblockRequestsConfig() {
  return (row: ConfigurableCrudRecord) =>
    defineCrud({
      endpoint: `cyber-security/accounts/${row['CyaUUID']}/unblock-requests`,
      uuidField: 'CurUUID',
      pageTitle: 'cyberSecurity.unblockRequests',
      pageDescription: 'cyberSecurity.unblockRequestsDescription',
      createTitle: 'cyberSecurity.unblockAnswer',
      editTitle: 'cyberSecurity.unblockAnswer',
      emptyLabel: 'cyberSecurity.unblockRequestsEmpty',
      canCreate: false,
      canDelete: false,
      bulkDelete: false,
      statusFilter: false,
      canEditRow: (request) => request['CurStatus'] === 'pending',
      initialValues: { answer: 'approved', note: '' },
      payload: (values) => ({
        status: values['answer'],
        note: values['note'] || null,
        revision: values['revision'],
      }),
      fields: [
        {
          key: 'value',
          source: 'CurValue',
          label: 'cyberSecurity.unblockValue',
          span: 1,
          disabledWhen: () => true,
        },
        {
          key: 'requestedBy',
          source: 'PortalUsername',
          label: 'cyberSecurity.portalUser',
          span: 1,
          disabledWhen: () => true,
        },
        {
          key: 'answer',
          label: 'cyberSecurity.unblockAnswer',
          type: 'select',
          options: REQUEST_STATUSES.filter((option) => option.value !== 'pending'),
          required: true,
          span: 1,
          help: 'cyberSecurity.unblockAnswerHelp',
        },
        {
          key: 'reason',
          source: 'CurReason',
          label: 'cyberSecurity.unblockReason',
          type: 'textarea',
          span: 4,
          rows: 4,
          disabledWhen: () => true,
        },
        {
          key: 'note',
          source: 'CurResolutionNote',
          label: 'cyberSecurity.unblockNote',
          type: 'textarea',
          span: 4,
          rows: 4,
          requiredWhen: ({ values }) => values['answer'] === 'rejected',
          help: 'cyberSecurity.unblockNoteHelp',
        },
        {
          key: 'revision',
          source: 'CurRevision',
          label: 'documents.revision',
          hiddenWhen: () => true,
        },
      ],
      columns: [
        { id: 'value', field: 'CurValue', label: 'cyberSecurity.unblockValue', kind: 'identity' },
        { id: 'server', field: 'ServerName', label: 'cyberSecurity.unblockServer' },
        { id: 'user', field: 'PortalUsername', label: 'cyberSecurity.portalUser' },
        { id: 'reason', field: 'CurReason', label: 'cyberSecurity.unblockReason' },
        {
          id: 'status',
          field: 'CurStatus',
          label: 'cyberSecurity.unblockStatus',
          options: REQUEST_STATUSES,
        },
        {
          id: 'created',
          field: 'CurDateCreated',
          label: 'cyberSecurity.unblockCreated',
          kind: 'datetime',
        },
        {
          id: 'expires',
          field: 'DecisionExpiresAt',
          label: 'cyberSecurity.unblockExpires',
          kind: 'datetime',
        },
      ],
    });
}

@Component({
  selector: 'app-cyber-security-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CyberSecurityAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    const router = inject(Router);
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.cyber-security.accounts.all');
    const isCustomer = (row: ConfigurableCrudRecord) => row['CyaKind'] === 'customer';
    super({
      ...CYBER_SECURITY_ACCOUNTS_CONFIG,
      canCreate: canManage(),
      rowActions: [
        {
          key: 'dashboard',
          label: 'cyberSecurity.accountDashboard',
          icon: 'space_dashboard',
          run: (row) =>
            void router.navigate(['/cyber-security/dashboard'], {
              queryParams: { cyberAccountUUID: row['CyaUUID'] },
            }),
        },
        ...resaleAccountRowActions({
          module: 'cyber-security',
          uuidField: 'CyaUUID',
          revisionField: 'CyaRevision',
          portalField: 'CyaPortalEnabled',
          kindField: 'CyaKind',
          memberUuidField: 'CymUUID',
          memberStatusField: 'CymStatus',
          publicationLabel: 'cyberSecurity.publication',
          publicationTitle: 'cyberSecurity.publication',
          publicationDescription: 'cyberSecurity.publicationDescription',
          portalEnabledLabel: 'cyberSecurity.portalEnabled',
          assignLabel: 'cyberSecurity.assignOperator',
          assignTitle: 'cyberSecurity.assignOperator',
          operatorsLabel: 'cyberSecurity.operators',
          operatorsTitle: 'cyberSecurity.operators',
          operatorsDescription: 'cyberSecurity.operatorsDescription',
          canManage,
        }),
        {
          key: 'portalAccess',
          label: 'cyberSecurity.portalAccess',
          icon: 'badge',
          visible: (row) => canManage() && isCustomer(row),
          collection: (row) => portalAccessConfig(row),
        },
        {
          key: 'unblockRequests',
          label: 'cyberSecurity.unblockRequests',
          icon: 'lock_open',
          visible: isCustomer,
          collection: unblockRequestsConfig(),
        },
      ],
    });
  }
}
