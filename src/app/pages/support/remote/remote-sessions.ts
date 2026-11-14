import { Component, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { SupportRemoteSettingsDialogComponent } from './remote-assistant-dialogs';
import { REMOTE_BASE, REMOTE_LEVELS, REMOTE_STATES, stateChipClass, text } from './remote-session';

export const REMOTE_STATE_OPTIONS: readonly ConfigurableCrudOption[] = REMOTE_STATES.map(
  (value) => ({ value, label: `support.remote.state.${value}` }),
);
export const REMOTE_LEVEL_OPTIONS: readonly ConfigurableCrudOption[] = REMOTE_LEVELS.map(
  (value) => ({ value, label: `support.remote.level.${value}` }),
);

/** Filter values of the list: `open` means every state but closed (API contract). */
const STATE_FILTER_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'open', label: 'support.remote.filter.notClosed' },
  { value: 'closed', label: 'support.remote.state.closed' },
  ...REMOTE_STATE_OPTIONS.filter((option) => option.value !== 'closed'),
];

export function remoteConsoleLink(uuid: unknown): { path: string; query: { session: string } } {
  return { path: '/support/remote/console', query: { session: text(uuid) } };
}

export function remoteSessionsConfig(
  open: (row: ConfigurableCrudRecord) => void,
  canSupervise: () => boolean,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${REMOTE_BASE}/sessions`,
    uuidField: 'SrsUUID',
    pageTitle: 'support.remote.sessions.title',
    pageDescription: 'support.remote.sessions.description',
    emptyLabel: 'support.remote.sessions.empty',
    searchPlaceholder: 'support.remote.sessions.search',
    serverSidePagination: true,
    initialPageSize: 50,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    fields: [],
    // Comment prefix of the AI copilot (tenant.support.remote.sessions.supervise).
    filterActions: canSupervise()
      ? [{ key: 'settings', label: 'support.remote.settings.action', icon: 'settings' }]
      : [],
    listFilters: [
      {
        key: 'state',
        label: 'Status',
        paramKey: 'state',
        type: 'select',
        span: 1,
        options: STATE_FILTER_OPTIONS,
        translateOptions: true,
        emptyLabel: 'All',
      },
      {
        key: 'scope',
        label: 'support.remote.filter.scope',
        paramKey: 'scope',
        type: 'select',
        span: 1,
        options: [{ value: 'all', label: 'support.remote.scope.all' }],
        translateOptions: true,
        emptyLabel: 'support.remote.scope.mine',
        hiddenWhen: () => !canSupervise(),
      },
      {
        key: 'device',
        label: 'support.remote.field.device',
        paramKey: 'deviceUUID',
        type: 'search-select',
        span: 1,
        remoteLookup: { endpoint: 'network/devices', uuidField: 'NwdUUID', labelField: 'NwdName' },
        emptyLabel: 'All',
      },
    ],
    columns: [
      {
        id: 'title',
        label: 'support.remote.field.title',
        field: 'SrsTitle',
        kind: 'identity',
        uuidField: 'SrsUUID',
      },
      {
        id: 'state',
        label: 'Status',
        field: 'SrsState',
        kind: 'status',
        options: REMOTE_STATE_OPTIONS,
        chipClass: (value) => stateChipClass(value),
      },
      {
        id: 'level',
        label: 'support.remote.field.level',
        field: 'SrsLevel',
        options: REMOTE_LEVEL_OPTIONS,
      },
      { id: 'technician', label: 'support.remote.field.technician', field: 'TechnicianName' },
      {
        id: 'customer',
        label: 'support.remote.field.customer',
        field: 'CustomerName',
        optional: true,
      },
      {
        id: 'ticket',
        label: 'support.remote.field.ticket',
        field: 'TicketSubject',
        optional: true,
      },
      {
        id: 'devices',
        label: 'support.remote.field.devices',
        field: 'DeviceCount',
        kind: 'number',
      },
      { id: 'created', label: 'Date', field: 'SrsDateCreated', kind: 'datetime' },
      {
        id: 'closed',
        label: 'support.remote.field.closedAt',
        field: 'SrsClosedAt',
        kind: 'datetime',
        optional: true,
      },
    ],
    rowActions: [
      {
        key: 'open',
        label: 'support.remote.sessions.open',
        icon: 'terminal',
        inline: true,
        run: (row) => open(row),
      },
    ],
  });
}

/** Support sessions that used a Network device (Rede › Equipamentos › Sessões de suporte). */
export function deviceSupportSessionsConfig(deviceUUID: string): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `network/devices/${deviceUUID}/support-sessions`,
    uuidField: 'SrsUUID',
    pageTitle: 'support.remote.deviceSessions.title',
    pageDescription: 'support.remote.deviceSessions.description',
    emptyLabel: 'support.remote.sessions.empty',
    serverSidePagination: true,
    initialPageSize: 50,
    readOnly: true,
    statusFilter: false,
    fields: [],
    columns: [
      { id: 'title', label: 'support.remote.field.title', field: 'SrsTitle' },
      {
        id: 'state',
        label: 'Status',
        field: 'SrsState',
        kind: 'status',
        options: REMOTE_STATE_OPTIONS,
        chipClass: (value) => stateChipClass(value),
      },
      { id: 'technician', label: 'support.remote.field.technician', field: 'TechnicianName' },
      {
        id: 'customer',
        label: 'support.remote.field.customer',
        field: 'CustomerName',
        optional: true,
      },
      { id: 'created', label: 'Date', field: 'SrsDateCreated', kind: 'datetime' },
    ],
  });
}

/** Suporte › Remoto › Sessões: every session I can see; a row opens the console on that session. */
@Component({
  selector: 'app-support-remote-sessions',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportRemoteSessionsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly matDialog = inject(MatDialog);

  override async handleFilterAction(action: { key: string }) {
    if (action.key !== 'settings') return;
    const binding = openCrudComponentDialog(
      this.matDialog,
      SupportRemoteSettingsDialogComponent,
      'crud-form-dialog',
    );
    try {
      await firstValueFrom(binding.ref.afterClosed());
    } finally {
      binding.stop();
    }
  }

  constructor() {
    const router = inject(Router);
    const auth = inject(AuthService);
    super(
      remoteSessionsConfig(
        (row) => {
          const link = remoteConsoleLink(row['SrsUUID']);
          void router.navigate([link.path], { queryParams: link.query });
        },
        () =>
          hasEffectivePermission(
            auth.user()?.permissions ?? [],
            'tenant.support.remote.sessions.supervise',
          ),
      ),
    );
  }
}
