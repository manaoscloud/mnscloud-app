import {
  Component,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { FormField, form as createForm, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import { InstallCommandDialogComponent } from '../../../../shared/install-command-dialog/install-command-dialog';

type ServerPayload = {
  name: string;
  nodeUUID: string;
  engine: string;
  hostname: string;
  publicIP: string;
  privateIP: string;
  baseUrl: string;
  notes: string;
  status: number;
};

@Component({
  selector: 'app-voip-softswitch-server',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    FormField,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    TranslocoPipe,
    MatTooltipModule,
    InstallCommandDialogComponent,
  ],
  templateUrl: './server.html',
  styleUrls: ['./server.scss'],
})
export class VoipSoftswitchServerPage {
  private readonly api = inject(VoipSoftswitchServerService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly dataSource = new MatTableDataSource<VoipSoftswitchServerItem>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'hostname',
    'publicIP',
    'privateIP',
    'engine',
    'status',
    'lastSeen',
    'actions',
  ];
  readonly editing = signal<VoipSoftswitchServerItem | null>(null);
  readonly saving = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly generatedInstall = signal<Record<string, unknown> | null>(null);

  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  private dialogBinding: CrudDialogBinding | null = null;
  private dialogRef: MatDialogRef<unknown> | null = null;
  private installCommandBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';
  private readonly appliedFilters = signal<{ search: string; status: number | '' }>({
    search: '',
    status: '',
  });
  private readonly serversResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipSoftswitchServerItem[],
    loader: ({ params }) => this.fetchServers(params),
  });

  readonly loading = this.serversResource.isLoading;

  readonly formModel = signal<ServerPayload>(this.emptyFormValue());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    required(schema.engine);
    required(schema.status);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');

  constructor() {
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'nodeUUID':
          return row.VsrNodeUUID || '';
        case 'name':
          return row.VsrName || '';
        case 'hostname':
          return row.VsrHostname || '';
        case 'publicIP':
          return row.VsrPublicIP || '';
        case 'privateIP':
          return row.VsrPrivateIP || '';
        case 'engine':
          return this.engineLabel(row.VsrEngine);
        case 'status':
          return this.statusLabel(row);
        case 'lastSeen':
          return row.VsrLastSeenAt || '';
        default:
          return '';
      }
    };
  }

  private readonly syncRows = effect(() => {
    this.dataSource.data = this.serversResource.value();
    this.reconcileSelection();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.serversResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }
    const message = (error as any)?.error?.error || 'Failed to load Softswitch servers.';
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
  });

  private readonly afterViewReady = afterNextRender(() => {
    const sort = this.sort();
    if (sort) this.dataSource.sort = sort;
    const paginator = this.paginator();
    if (paginator) this.dataSource.paginator = paginator;
  });

  get selectedCount() {
    return this.selectedIds().size;
  }

  refreshList() {
    this.serversResource.reload();
  }

  applySearchFilters() {
    const search = this.searchInput().trim();
    this.search.set(search);
    const paginator = this.paginator();
    if (paginator) paginator.firstPage();
    const status = this.statusInput();
    const current = this.appliedFilters();
    if (current.search === search && current.status === status) {
      this.serversResource.reload();
    } else {
      this.appliedFilters.set({ search, status });
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    const paginator = this.paginator();
    if (paginator) paginator.firstPage();
    const current = this.appliedFilters();
    if (current.search === '' && current.status === '') {
      this.serversResource.reload();
    } else {
      this.appliedFilters.set({ search: '', status: '' });
    }
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set(this.emptyFormValue());
    this.openDialog();
  }

  startEdit(row: VoipSoftswitchServerItem) {
    this.editing.set(row);
    this.formModel.set({
      name: row.VsrName || '',
      nodeUUID: row.VsrNodeUUID || '',
      engine: row.VsrEngine || 'kamailio',
      hostname: row.VsrHostname || '',
      publicIP: row.VsrPublicIP || '',
      privateIP: row.VsrPrivateIP || '',
      baseUrl: row.VsrBaseUrl || '',
      notes: row.VsrNotes || '',
      status: Number(row.VsrStatus ?? 1),
    });
    this.openDialog();
  }

  async save(createAnother = false) {
    if (!this.form().valid() || this.saving()) return;
    this.saving.set(true);
    const payload = this.normalizedPayload();
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VsrUUID, payload, true);
        this.snack.success('Softswitch server updated successfully.');
      } else {
        await this.api.create(payload, true);
        this.snack.success('Softswitch server created successfully.');
      }

      this.serversResource.reload();
      if (createAnother && !editing) {
        this.formModel.set(this.emptyFormValue());
        return;
      }
      this.closeDialog();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to save Softswitch server.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: VoipSoftswitchServerItem) {
    const confirmed = await this.confirmDelete(
      'Delete Softswitch server',
      `Delete "${row.VsrName}"? This action will disable the server record.`,
    );
    if (!confirmed) return;

    try {
      await this.api.remove(row.VsrUUID, true);
      this.removeSelection([row.VsrUUID]);
      this.snack.success('Softswitch server deleted successfully.');
      this.serversResource.reload();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete Softswitch server.');
    }
  }

  async generateInstallCommand(row: VoipSoftswitchServerItem) {
    const confirmed = await this.confirmDelete(
      'Generate install command',
      `Generate a new install command for "${row.VsrName}"? The previous Softswitch runtime token will be replaced.`,
      'Generate command',
    );
    if (!confirmed) return;
    await this.openGeneratedInstallCommand(row.VsrUUID, true);
  }

  openInstallCommandDialog() {
    const installCommandDialog = this.installCommandDialog();
    if (!installCommandDialog || this.installCommandBinding) return;
    const binding = openCrudTemplateDialog(
      this.dialog,
      installCommandDialog,
      'install-command-dialog-panel',
    );
    this.installCommandBinding = binding;
    const sub = binding.ref.afterClosed().subscribe(() => {
      sub.unsubscribe();
      binding.stop();
      if (this.installCommandBinding === binding) this.installCommandBinding = null;
    });
  }

  installCommand() {
    const data = this.generatedInstall();
    if (!data) return '';
    const apiBase = window.location.origin;
    const nodeUUID = String(data['nodeUUID'] || '');
    const runtimeToken = String(data['runtimeToken'] || '');
    const repo = 'mnscloud-kamailio-softswitch';
    return [
      'sudo install -d -m 0750 /etc/mnscloud/softswitch',
      `printf %s ${this.shellQuote(apiBase)} | sudo tee /etc/mnscloud/softswitch/api.base >/dev/null`,
      `printf %s ${this.shellQuote(nodeUUID)} | sudo tee /etc/mnscloud/softswitch/node.uuid >/dev/null`,
      `printf %s ${this.shellQuote(runtimeToken)} | sudo tee /etc/mnscloud/softswitch/api.token >/dev/null`,
      'sudo chown root:root /etc/mnscloud/softswitch/api.base /etc/mnscloud/softswitch/node.uuid /etc/mnscloud/softswitch/api.token',
      'sudo chmod 0640 /etc/mnscloud/softswitch/api.base /etc/mnscloud/softswitch/node.uuid /etc/mnscloud/softswitch/api.token',
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      `[ -d ${repo}/.git ] && sudo git -C ${repo} pull || sudo gh repo clone manaoscloud/${repo} || sudo git clone https://github.com/manaoscloud/${repo}.git ${repo}`,
      `sudo bash /opt/mnscloud/${repo}/scripts/install-kamailio-softswitch.sh`,
      `[ -f /opt/mnscloud/${repo}/scripts/validate-kamailio-softswitch.sh ] && sudo bash /opt/mnscloud/${repo}/scripts/validate-kamailio-softswitch.sh || true`,
    ].join(' && ');
  }

  installCommandDetails() {
    const data = this.generatedInstall();
    return [
      { label: 'API base', value: window.location.origin, monospace: true },
      { label: 'Node UUID', value: data?.['nodeUUID'], monospace: true },
      { label: 'Engine', value: data?.['engine'], monospace: true },
      { label: 'Runtime', value: 'mnscloud-kamailio-softswitch', monospace: true },
    ];
  }

  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }

  async removeSelectedServers() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const labels = this.dataSource.data
      .filter((row) => this.selectedIds().has(row.VsrUUID))
      .slice(0, 3)
      .map((row) => row.VsrName)
      .join(', ');
    const confirmed = await this.confirmDelete(
      'Delete selected Softswitch servers',
      `Delete ${ids.length} selected server${ids.length === 1 ? '' : 's'}${
        labels ? ` (${labels}${ids.length > 3 ? ', ...' : ''})` : ''
      }?`,
    );
    if (!confirmed) return;

    try {
      const res = await this.api.removeMany(ids, true);
      const deleted = this.extractDeletedIds(res, ids);
      const failed = this.extractFailedIds(res);
      this.removeSelection(deleted);
      if (failed.length) this.keepSelection(failed);
      this.snack.success(
        failed.length
          ? `${deleted.length} server(s) deleted. ${failed.length} failed.`
          : 'Selected Softswitch servers deleted successfully.',
      );
      this.serversResource.reload();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete selected Softswitch servers.');
    }
  }

  isSelected(row: VoipSoftswitchServerItem) {
    return this.selectedIds().has(row.VsrUUID);
  }

  toggleServerSelection(row: VoipSoftswitchServerItem, checked: boolean) {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(row.VsrUUID);
    } else {
      next.delete(row.VsrUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.VsrUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.selectedIds().has(row.VsrUUID)) && !this.isAllVisibleSelected();
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.visibleRows()) {
      if (checked) {
        next.add(row.VsrUUID);
      } else {
        next.delete(row.VsrUUID);
      }
    }
    this.selectedIds.set(next);
  }

  engineLabel(engine?: string | null) {
    if (engine === 'kamailio') return 'Kamailio';
    if (engine === 'opensips') return 'OpenSIPS';
    return engine || '-';
  }

  statusLabel(row: VoipSoftswitchServerItem) {
    return Number(row.VsrStatus) === 1 ? 'ACTIVE' : 'INACTIVE';
  }

  closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      formDialog,
      'voip-softswitch-server-dialog',
      { onEscape: () => this.closeDialog() },
    );
    this.dialogRef = this.dialogBinding.ref;
  }

  private emptyFormValue(): ServerPayload {
    return {
      name: '',
      nodeUUID: '',
      engine: 'kamailio',
      hostname: '',
      publicIP: '',
      privateIP: '',
      baseUrl: '',
      notes: '',
      status: 1,
    };
  }

  private normalizedPayload(): ServerPayload {
    const value = this.formModel();
    return {
      name: value.name.trim(),
      nodeUUID: value.nodeUUID.trim(),
      engine: value.engine,
      hostname: value.hostname.trim(),
      publicIP: value.publicIP.trim(),
      privateIP: value.privateIP.trim(),
      baseUrl: value.baseUrl.trim(),
      notes: value.notes.trim(),
      status: Number(value.status),
    };
  }

  private visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const paginator = this.paginator();
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  private reconcileSelection() {
    const existing = new Set(this.dataSource.data.map((row) => row.VsrUUID));
    const current = untracked(() => this.selectedIds());
    const next = new Set([...current].filter((id) => existing.has(id)));
    if (next.size === current.size && [...next].every((id) => current.has(id))) return;
    this.selectedIds.set(next);
  }

  private removeSelection(ids: string[]) {
    const next = new Set(this.selectedIds());
    for (const id of ids) next.delete(id);
    this.selectedIds.set(next);
  }

  private keepSelection(ids: string[]) {
    this.selectedIds.set(new Set(ids));
  }

  private async fetchServers(filters: {
    search: string;
    status: number | '';
  }): Promise<VoipSoftswitchServerItem[]> {
    const res = await this.api.list(true, {
      search: filters.search,
      status: filters.status === '' ? undefined : filters.status,
      limit: 5000,
      offset: 0,
    });
    return res?.data?.items ?? [];
  }

  private extractDeletedIds(response: any, fallback: string[]) {
    const deleted = response?.data?.deleted ?? response?.deleted;
    return Array.isArray(deleted) ? deleted : fallback;
  }

  private extractFailedIds(response: any) {
    const failed = response?.data?.failed ?? response?.failed;
    if (!Array.isArray(failed)) return [];
    return failed
      .map((item: any) => item?.VsrUUID || item?.uuid || item?.id)
      .filter((id: unknown): id is string => typeof id === 'string' && !!id);
  }

  private async confirmDelete(title: string, message: string, confirmLabel = 'Delete') {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private async openGeneratedInstallCommand(uuid: string, showSuccess: boolean) {
    try {
      const response = await this.api.generateInstallCommand(uuid, true);
      this.generatedInstall.set(response?.data ?? null);
      this.openInstallCommandDialog();
      if (showSuccess) this.snack.success('Softswitch install command generated.');
      this.serversResource.reload();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to generate install command.');
    }
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}
