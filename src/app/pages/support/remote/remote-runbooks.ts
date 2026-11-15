import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { SupportRemoteRunbookDialogComponent } from './remote-runbook-dialogs';
import {
  RUNBOOK_BASE,
  RUNBOOK_DIALECTS,
  RUNBOOK_HISTORY_REQUIRED,
  RUNBOOK_STATUSES,
  autonomyBlockReason,
  autonomyState,
  runbookStatusChip,
} from './remote-runbook';
import { text } from './remote-session';

export const RUNBOOK_DIALECT_OPTIONS: readonly ConfigurableCrudOption[] = RUNBOOK_DIALECTS.map(
  (value) => ({ value, label: `support.remote.runbooks.dialect.${value}` }),
);
export const RUNBOOK_STATUS_OPTIONS: readonly ConfigurableCrudOption[] = RUNBOOK_STATUSES.map(
  (value) => ({ value, label: `support.remote.runbooks.status.${value}` }),
);

function rowEndpoint(row: ConfigurableCrudRecord, suffix = ''): string {
  return `${RUNBOOK_BASE}/${text(row['SrbUUID'])}${suffix}`;
}

/** Suporte › Remoto › Runbooks: tenant procedures the technician runs on a session device. */
export function remoteRunbooksConfig(canWrite: () => boolean, canAutonomy: () => boolean): ConfigurableCrudConfig {
  const autonomyRow = (row: ConfigurableCrudRecord) => canAutonomy() && !autonomyState(row).enabled;
  return defineCrud({
    endpoint: RUNBOOK_BASE,
    uuidField: 'SrbUUID',
    pageTitle: 'support.remote.runbooks.title',
    pageDescription: 'support.remote.runbooks.description',
    emptyLabel: 'support.remote.runbooks.empty',
    searchPlaceholder: 'support.remote.runbooks.search',
    serverSidePagination: true,
    initialPageSize: 50,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    fields: [],
    filterActions: canWrite()
      ? [{ key: 'new', label: 'support.remote.runbooks.new', icon: 'add' }]
      : [],
    listFilters: [
      {
        key: 'dialect',
        label: 'support.remote.runbooks.field.dialect',
        paramKey: 'dialect',
        type: 'select',
        span: 1,
        options: RUNBOOK_DIALECT_OPTIONS,
        translateOptions: true,
        emptyLabel: 'All',
      },
      {
        key: 'status',
        label: 'Status',
        paramKey: 'status',
        type: 'select',
        span: 1,
        options: RUNBOOK_STATUS_OPTIONS,
        translateOptions: true,
        emptyLabel: 'All',
      },
    ],
    columns: [
      {
        id: 'name',
        label: 'support.remote.runbooks.field.name',
        field: 'SrbName',
        kind: 'identity',
        uuidField: 'SrbUUID',
      },
      {
        id: 'dialect',
        label: 'support.remote.runbooks.field.dialect',
        field: 'SrbDialect',
        options: RUNBOOK_DIALECT_OPTIONS,
      },
      { id: 'version', label: 'Version', field: 'SrbVersion', kind: 'number' },
      {
        id: 'status',
        label: 'Status',
        field: 'SrbStatus',
        kind: 'status',
        options: RUNBOOK_STATUS_OPTIONS,
        chipClass: (value) => runbookStatusChip(value),
      },
      {
        id: 'autonomous',
        label: 'support.remote.runbooks.field.autonomous',
        field: 'SrbAutonomous',
        kind: 'boolean',
      },
      {
        id: 'successes',
        label: 'support.remote.runbooks.field.successes',
        field: 'SrbSupervisedSuccess',
        value: (row) =>
          `${Math.min(Number(row['SrbSupervisedSuccess']) || 0, RUNBOOK_HISTORY_REQUIRED)}/${RUNBOOK_HISTORY_REQUIRED}`,
      },
      {
        id: 'steps',
        label: 'support.remote.runbooks.field.steps',
        field: 'StepCount',
        kind: 'number',
        optional: true,
      },
      {
        id: 'updatedBy',
        label: 'support.remote.runbooks.field.updatedBy',
        field: 'UpdatedByName',
        optional: true,
      },
      { id: 'updated', label: 'Updated', field: 'SrbDateUpdated', kind: 'datetime' },
    ],
    rowActions: [
      {
        key: 'edit',
        label: 'Edit',
        icon: 'edit',
        inline: true,
        visible: () => canWrite(),
      },
      {
        key: 'autonomyOn',
        label: 'support.remote.runbooks.autonomy.enable',
        icon: 'smart_toy',
        visible: autonomyRow,
        disabledReason: (row) => autonomyBlockReason(row),
        request: {
          method: 'put',
          endpoint: (row) => rowEndpoint(row, '/autonomy'),
          body: (row) => ({ enabled: true, revision: Number(row['SrbRevision']) }),
          successMessage: 'support.remote.runbooks.autonomy.enabled',
          confirm: {
            title: 'support.remote.runbooks.autonomy.enableTitle',
            message: 'support.remote.runbooks.autonomy.enableMessage',
            confirmLabel: 'support.remote.runbooks.autonomy.enable',
          },
        },
      },
      {
        key: 'autonomyOff',
        label: 'support.remote.runbooks.autonomy.disable',
        icon: 'person',
        visible: (row) => canAutonomy() && autonomyState(row).enabled,
        request: {
          method: 'put',
          endpoint: (row) => rowEndpoint(row, '/autonomy'),
          body: (row) => ({ enabled: false, revision: Number(row['SrbRevision']) }),
          successMessage: 'support.remote.runbooks.autonomy.disabled',
        },
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: 'delete',
        visible: () => canWrite(),
        request: {
          method: 'delete',
          endpoint: (row) => `${rowEndpoint(row)}?revision=${Number(row['SrbRevision'])}`,
          successMessage: 'support.remote.runbooks.deleted',
          confirm: {
            title: 'support.remote.runbooks.deleteTitle',
            message: 'support.remote.runbooks.deleteMessage',
            confirmLabel: 'Delete',
          },
        },
      },
    ],
  });
}

@Component({
  selector: 'app-support-remote-runbooks',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportRemoteRunbooksPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly matDialog = inject(MatDialog);

  constructor() {
    const auth = inject(AuthService);
    const can = (permission: string) =>
      hasEffectivePermission(auth.user()?.permissions ?? [], permission);
    super(
      remoteRunbooksConfig(
        () => can('tenant.support.remote.runbooks.write'),
        () =>
          can('tenant.support.remote.runbooks.autonomous') &&
          can('tenant.support.remote.sessions.supervise'),
      ),
    );
  }

  override handleFilterAction(action: ConfigurableCrudFilterAction) {
    if (action.key === 'new') return this.openEditor(null);
    return undefined;
  }

  override handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key === 'edit') return this.openEditor(row);
    return undefined;
  }

  private async openEditor(record: ConfigurableCrudRecord | null) {
    const binding = openCrudComponentDialog(
      this.matDialog,
      SupportRemoteRunbookDialogComponent,
      'crud-form-dialog',
      { data: { record } },
    );
    try {
      const saved = await firstValueFrom(binding.ref.afterClosed());
      if (saved) this.refreshList();
    } finally {
      binding.stop();
    }
  }
}
