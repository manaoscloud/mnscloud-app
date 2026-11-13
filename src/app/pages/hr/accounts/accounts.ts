import { Component, inject } from '@angular/core';
import { ApiService } from '../../../services/api.service';
import { accountLocationScopeField } from '../../../shared/crud/configurable-crud/location-scope';
import { Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { revisionDeletePayloads } from '../../../shared/crud/configurable-crud/revision-delete';
import { portalGrantCrud } from '../../../shared/crud/configurable-crud/portal-grant-crud';
import { resaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';

// One HR account per Registry workspace: the internal account keeps the reseller's own HR; each
// customer account serves the employees of that customer's workspace. Opening a page carries the
// account (and its workspace for Registry quick-create) in the address of the HR page.
const config = defineCrud({
  endpoint: 'hr/accounts',
  uuidField: 'HraUUID',
  pageTitle: 'hrAccount.title',
  pageDescription: 'hrAccount.description',
  createTitle: 'hrAccount.create',
  editTitle: 'hrAccount.edit',
  serverSidePagination: true,
  ...revisionDeletePayloads('HraUUID', 'HraRevision'),
  canDeleteRow: (row) => Number(row['HraIsInternal']) !== 1,
  initialValues: { name: '', notes: '', workspaceUUID: null, status: 1 },
  fields: [
    {
      key: 'status',
      source: 'HraStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      disabledWhen: ({ editing, values }) => editing && Number(values['HraIsInternal']) === 1,
    },
    { key: 'name', source: 'HraName', label: 'Name', required: true, span: 1 },
    {
      key: 'workspaceUUID',
      source: 'RegWorkspaceRwkUUID',
      label: 'hrAccount.workspace',
      type: 'search-select',
      span: 1,
      help: 'hrAccount.workspaceHelp',
      requiredWhen: ({ editing }) => !editing,
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/workspaces?status=1',
        uuidField: 'RwkUUID',
        labelField: 'RwkName',
        descriptionField: 'CustomerName',
        selectedLabelField: 'WorkspaceName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Customer workspaces are managed in Registry > Workspaces.',
    },
    {
      key: 'notes',
      source: 'HraNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
    },
    {
      key: 'HraIsInternal',
      source: 'HraIsInternal',
      label: 'hrAccount.internal',
      hiddenWhen: () => true,
    },
    { key: 'revision', source: 'HraRevision', label: 'documents.revision', hiddenWhen: () => true },
  ],
  columns: [
    { id: 'name', field: 'HraName', label: 'Name', kind: 'identity' },
    { id: 'customer', field: 'CustomerName', label: 'Customer' },
    { id: 'workspace', field: 'WorkspaceName', label: 'hrAccount.workspace' },
    { id: 'employees', field: 'EmployeesCount', label: 'hrAccount.employees', kind: 'number' },
    {
      id: 'clocks',
      field: 'TimeClockAccountsCount',
      label: 'nav.hr.time-clock-accounts',
      kind: 'number',
    },
    { id: 'service', field: 'ServiceAvailable', label: 'hrAccount.inService', kind: 'boolean' },
    {
      id: 'publication',
      field: 'HraPortalEnabled',
      label: 'hrAccount.portalEnabled',
      kind: 'boolean',
    },
    { id: 'status', field: 'HraStatus', label: 'Status', kind: 'status' },
  ],
});

const GRANTS: readonly [string, string][] = [
  ['HpgDashboard', 'hrAccount.grantDashboard'],
  ['HpgEmployees', 'hrAccount.grantEmployees'],
  ['HpgSchedules', 'hrAccount.grantSchedules'],
  ['HpgTimesheets', 'hrAccount.grantTimesheets'],
  ['HpgRequests', 'hrAccount.grantRequests'],
  ['HpgKiosks', 'hrAccount.grantKiosks'],
];

/** Customer Portal users of the account's customer and the HR operations each one may read. */
function portalAccessConfig(api: ApiService, row: ConfigurableCrudRecord) {
  return portalGrantCrud({
    base: `hr/accounts/${row['HraUUID']}`,
    uuidField: 'HpgUUID',
    statusField: 'HpgStatus',
    revisionField: 'HpgRevision',
    labels: {
      pageTitle: 'hrAccount.portalAccess',
      pageDescription: 'hrAccount.portalAccessDescription',
      createTitle: 'hrAccount.portalAccessCreate',
      editTitle: 'hrAccount.portalAccessEdit',
      emptyLabel: 'hrAccount.portalAccessEmpty',
      portalUser: 'hrAccount.portalUser',
      portalRole: 'hrAccount.portalRole',
      roleOwner: 'hrAccount.portalRoleOwner',
      roleAdmin: 'hrAccount.portalRoleAdmin',
      roleUser: 'hrAccount.portalRoleUser',
    },
    grants: GRANTS,
    locationScope: accountLocationScopeField(
      api,
      String(row['HraUUID']),
      row['RegWorkspaceRwkUUID'] ? String(row['RegWorkspaceRwkUUID']) : null,
    ),
    initialValues: {
      HpgDashboard: 1,
      HpgEmployees: 1,
      HpgSchedules: 0,
      HpgTimesheets: 0,
      HpgRequests: 0,
      HpgKiosks: 0,
    },
  });
}

const PAGES: readonly [string, string, string, string][] = [
  ['dashboard', 'nav.hr.dashboard', 'dashboard', 'tenant.hr.timesheets.read'],
  [
    'time-clock-accounts',
    'nav.hr.time-clock-accounts',
    'badge',
    'tenant.hr.time-clock-accounts.read',
  ],
  [
    'work-schedules',
    'nav.hr.work-schedules',
    'calendar_view_week',
    'tenant.hr.work-schedules.read',
  ],
  [
    'work-schedule-assignments',
    'nav.hr.work-schedule-assignments',
    'assignment_ind',
    'tenant.hr.work-schedule-assignments.read',
  ],
  ['employments', 'nav.hr.employments', 'work_history', 'tenant.hr.employments.read'],
  ['holidays', 'nav.hr.holidays', 'celebration', 'tenant.hr.holidays.read'],
  ['time-policies', 'nav.hr.time-policies', 'rule', 'tenant.hr.time-policies.read'],
  ['time-punches', 'nav.hr.time-punches', 'schedule', 'tenant.hr.time-punches.read'],
  ['timesheets', 'nav.hr.timesheets', 'event_note', 'tenant.hr.timesheets.read'],
  ['time-requests', 'nav.hr.time-requests', 'pending_actions', 'tenant.hr.time-requests.read'],
  ['absences', 'nav.hr.absences', 'event_busy', 'tenant.hr.absences.read'],
  [
    'employee-documents',
    'nav.hr.employee-documents',
    'folder_shared',
    'tenant.hr.employee-documents.read',
  ],
  ['notices', 'nav.hr.notices', 'campaign', 'tenant.hr.notices.read'],
  [
    'vacation-balances',
    'nav.hr.vacation-balances',
    'beach_access',
    'tenant.hr.vacation-balances.read',
  ],
  [
    'time-adjustments',
    'nav.hr.time-adjustments',
    'edit_calendar',
    'tenant.hr.time-adjustments.read',
  ],
  [
    'department-approvers',
    'nav.hr.department-approvers',
    'how_to_reg',
    'tenant.hr.department-approvers.read',
  ],
];

@Component({
  selector: 'app-hr-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HrAccountsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    const api = inject(ApiService);
    const allowed = (permission: string) =>
      hasEffectivePermission(auth.user()?.permissions ?? [], permission);
    const canManage = () => allowed('tenant.hr.accounts.all');
    const open: ConfigurableCrudRowAction[] = PAGES.map(([path, label, icon, permission]) => ({
      key: path,
      label,
      icon,
      visible: () => allowed(permission),
      run: async (row) => {
        // The internal account is the default scope of every HR page: no selection needed.
        const queryParams =
          Number(row['HraIsInternal']) === 1
            ? {}
            : { hrAccountUUID: row['HraUUID'], workspaceUUID: row['RegWorkspaceRwkUUID'] };
        await router.navigate(['/hr', path], { queryParams });
      },
    }));
    super({
      ...config,
      canCreate: canManage() && allowed('tenant.hr.accounts.write'),
      canEdit: allowed('tenant.hr.accounts.write'),
      canDelete: canManage() && allowed('tenant.hr.accounts.delete'),
      rowActions: [
        ...open,
        ...resaleAccountRowActions({
          module: 'hr',
          uuidField: 'HraUUID',
          revisionField: 'HraRevision',
          portalField: 'HraPortalEnabled',
          kindField: 'HraKind',
          memberUuidField: 'HamUUID',
          memberStatusField: 'HamStatus',
          publicationLabel: 'hrAccount.publication',
          publicationTitle: 'hrAccount.publication',
          publicationDescription: 'hrAccount.publicationDescription',
          portalEnabledLabel: 'hrAccount.portalEnabled',
          assignLabel: 'hrAccount.assignOperator',
          assignTitle: 'hrAccount.assignOperator',
          operatorsLabel: 'hrAccount.operators',
          operatorsTitle: 'hrAccount.operators',
          operatorsDescription: 'hrAccount.operatorsDescription',
          canManage,
          locationScope: (row) =>
            accountLocationScopeField(
              api,
              String(row['HraUUID']),
              row['RegWorkspaceRwkUUID'] ? String(row['RegWorkspaceRwkUUID']) : null,
            ),
        }),
        {
          key: 'portalAccess',
          label: 'hrAccount.portalAccess',
          icon: 'badge',
          visible: (row) => canManage() && row['HraKind'] === 'customer',
          collection: (row) => portalAccessConfig(api, row),
        },
      ],
    });
  }
}
