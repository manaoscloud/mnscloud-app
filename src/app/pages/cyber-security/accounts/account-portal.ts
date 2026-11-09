import {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { portalGrantCrud } from '../../../shared/crud/configurable-crud/portal-grant-crud';

// Dialogs opened from the rows of customer Cyber Security accounts (Customer Portal, resale R4).

// Acknowledge and unblock need threats, reveal needs secrets, accepting a vulnerability risk needs
// vulnerabilities (the database drops them otherwise).
const GRANTS: readonly [string, string][] = [
  ['CpgDashboard', 'cyberSecurity.grantDashboard'],
  ['CpgServers', 'cyberSecurity.grantServers'],
  ['CpgThreats', 'cyberSecurity.grantThreats'],
  ['CpgAlertAck', 'cyberSecurity.grantAlertAck'],
  ['CpgUnblock', 'cyberSecurity.grantUnblock'],
  ['CpgSecrets', 'cyberSecurity.grantSecrets'],
  ['CpgSecretReveal', 'cyberSecurity.grantSecretReveal'],
  ['CpgVulnerabilities', 'cyberSecurity.grantVulnerabilities'],
  ['CpgVulnAccept', 'cyberSecurity.grantVulnAccept'],
];

const REQUEST_STATUSES: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'cyberSecurity.unblockPending' },
  { value: 'approved', label: 'cyberSecurity.unblockApproved' },
  { value: 'rejected', label: 'cyberSecurity.unblockRejected' },
];

/** Customer Portal users of the account's customer and the Cyber Security operations of each one. */
export function portalAccessConfig(row: ConfigurableCrudRecord) {
  return portalGrantCrud({
    base: `cyber-security/accounts/${row['CyaUUID']}`,
    uuidField: 'CpgUUID',
    statusField: 'CpgStatus',
    revisionField: 'CpgRevision',
    labels: {
      pageTitle: 'cyberSecurity.portalAccess',
      pageDescription: 'cyberSecurity.portalAccessDescription',
      createTitle: 'cyberSecurity.portalAccessCreate',
      editTitle: 'cyberSecurity.portalAccessEdit',
      emptyLabel: 'cyberSecurity.portalAccessEmpty',
      portalUser: 'cyberSecurity.portalUser',
      portalRole: 'cyberSecurity.portalRole',
      roleOwner: 'cyberSecurity.portalRoleOwner',
      roleAdmin: 'cyberSecurity.portalRoleAdmin',
      roleUser: 'cyberSecurity.portalRoleUser',
    },
    grants: GRANTS,
    // Reading is on by default; actions and the audited secret reveal (CS6) are opt-in.
    initialValues: {
      CpgDashboard: 1,
      CpgServers: 1,
      CpgThreats: 1,
      CpgAlertAck: 0,
      CpgUnblock: 0,
      CpgSecrets: 0,
      CpgSecretReveal: 0,
      CpgVulnerabilities: 1,
      CpgVulnAccept: 0,
    },
  });
}

/** IP unblock requests sent by the customer from the Portal; each one is answered once. */
export function unblockRequestsConfig() {
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
