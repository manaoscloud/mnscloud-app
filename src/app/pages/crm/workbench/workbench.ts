import { SystemParameterService } from '../../../services/system-parameter.service';
import { zonedDayBounds } from '../../../shared/date-time/zoned-day-bounds';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { crmWorkspaceFilter } from '../crm-workspace-fields';
import { CRM_OPTIONS } from '../crm-options';
import { completeFollowUp } from '../prospecting-forms';

export function workbenchConfig(
  router: Router,
  parameters: SystemParameterService,
  canWrite = false,
) {
  return defineCrud({
    endpoint: 'crm/workbench',
    uuidField: 'key',
    pageTitle: 'crm.prospect.queue',
    pageDescription: 'crm.prospect.queueHelp',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    statusFilter: false,
    fields: [],
    serverSidePagination: true,
    serverSideFiltering: true,
    initialPageSize: 25,
    pageSizeOptions: [25, 50, 100, 200],
    listQuery: async () => zonedDayBounds(await parameters.resolveDefaultTimezone()),
    listFilters: [
      { ...crmWorkspaceFilter, key: 'workspaceUUID', paramKey: 'workspaceUUID' },
      {
        key: 'ownerUUID',
        label: 'crm.field.AssignedUserUsrUUID',
        type: 'search-select',
        span: 1,
        remoteLookup: { endpoint: 'crm/members', uuidField: 'UsrUUID', labelField: 'UsrName' },
      },
      {
        key: 'view',
        label: 'crm.prospect.view',
        type: 'select',
        span: 1,
        translateOptions: true,
        options: ['all', 'today', 'overdue', 'no-next-action'].map((value) => ({
          value,
          label: `crm.prospect.${value}`,
        })),
      },
    ],
    columns: [
      {
        id: 'name',
        field: 'name',
        label: 'Name',
        kind: 'identity',
        uuidField: 'uuid',
        rowAction: 'relationship',
      },
      {
        id: 'resource',
        field: 'resource',
        label: 'crm.prospect.resource',
        options: ['leads', 'opportunities', 'activities'].map((value) => ({
          value,
          label: `crm.title.${value}`,
        })),
      },
      { id: 'workspace', field: 'workspaceName', label: 'crm.field.Workspace' },
      { id: 'owner', field: 'ownerName', label: 'crm.field.AssignedUserUsrUUID' },
      { id: 'due', field: 'dueAt', label: 'crm.field.NextContactAt', kind: 'datetime' },
      {
        id: 'state',
        field: 'state',
        label: 'crm.field.State',
        options: [
          ...CRM_OPTIONS.leadStates,
          ...CRM_OPTIONS.stageKinds,
          ...CRM_OPTIONS.activityStates,
        ],
      },
      { id: 'kind', field: 'kind', label: 'crm.field.Kind', options: CRM_OPTIONS.activityKinds },
    ],
    rowActions: [
      {
        key: 'relationship',
        label: 'crm.prospect.relationship',
        icon: 'person',
        visible: (row) => row['resource'] !== 'activities' || Boolean(row['parentUUID']),
        run: (row) => {
          void router.navigate([
            '/crm/relationships',
            row['resource'] === 'activities' ? row['parentResource'] : row['resource'],
            row['resource'] === 'activities' ? row['parentUUID'] : row['uuid'],
          ]);
        },
      },
      {
        key: 'complete',
        label: 'crm.prospect.complete',
        icon: 'done',
        visible: (r) => canWrite && r['resource'] === 'activities' && r['state'] === 'planned',
        form: (r) => completeFollowUp(r, false),
      },
      {
        key: 'follow-up',
        label: 'crm.prospect.completeFollowUp',
        icon: 'event',
        visible: (r) =>
          canWrite &&
          r['resource'] === 'activities' &&
          r['state'] === 'planned' &&
          r['parentRevision'] != null,
        form: (r) => completeFollowUp(r, true),
      },
    ],
  });
}
@Component({
  selector: 'app-crm-workbench',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class CrmWorkbenchPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  constructor() {
    super(
      workbenchConfig(
        inject(Router),
        inject(SystemParameterService),
        hasEffectivePermission(inject(AuthService).user()?.permissions ?? [], 'tenant.crm.write'),
      ),
    );
  }
  override filterActions() {
    return hasEffectivePermission(
      this.auth.user()?.permissions ?? [],
      'tenant.automation.flows.read',
    )
      ? [{ key: 'automation', label: 'crm.prospect.automations', icon: 'account_tree' }]
      : [];
  }
  override handleFilterAction() {
    void this.router.navigate(['/automation/flows']);
  }
}
