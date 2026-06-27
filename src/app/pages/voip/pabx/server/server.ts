import {
  Component,
  computed,
  DestroyRef,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
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
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipPabxServerItem, VoipPabxServerService } from './server.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../../../shared/date-time/date-time.pipe';
import { bindDialogClosed } from '../../../../shared/dialog/dialog-events.util';
import { InstallCommandDialogComponent } from '../../../../shared/install-command-dialog/install-command-dialog';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';

type ServerPayload = {
  name: string;
  nodeUUID: string;
  engine: string;
  hostname: string;
  publicIPv4: string;
  publicIPv6: string;
  privateIPv4: string;
  privateIPv6: string;
  baseUrl: string;
  controlHost: string;
  controlPort: number | null;
  controlUsername: string;
  controlSecret: string;
  controlAllowedIps: string;
  remoteCommandExecutor: string;
  notes: string;
  status: number;
};

@Component({
  selector: 'app-voip-pabx-server',
  standalone: true,
  imports: [
    MnsDateTimePipe,
    RefreshButtonComponent,
    InstallCommandDialogComponent,
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
  ],
  templateUrl: './server.html',
  styleUrls: ['./server.scss'],
})
export class VoipPabxServerPage {
  private readonly api = inject(VoipPabxServerService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  readonly rows = computed(() => this.serversResource.value());
  readonly table = createSignalCrudTable<VoipPabxServerItem>(this.rows, (row, column) =>
    this.sortValue(row, column),
  );
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  readonly displayedColumns = [
    'select',
    'name',
    'hostname',
    'publicIPs',
    'privateIPs',
    'control',
    'engine',
    'status',
    'lastSeen',
    'actions',
  ];
  readonly editing = signal<VoipPabxServerItem | null>(null);
  readonly saving = signal(false);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly validatingIds = signal<Set<string>>(new Set());
  readonly generatedInstall = signal<Record<string, unknown> | null>(null);

  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  private dialogBinding: CrudDialogBinding | null = null;
  private dialogRef: MatDialogRef<unknown> | null = null;
  private installCommandBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  private readonly serversResource = resource({
    params: () => ({ search: this.appliedSearch(), status: this.appliedStatus() }),
    defaultValue: [] as VoipPabxServerItem[],
    loader: ({ params }) => this.fetchServers(params),
  });

  readonly loading = this.serversResource.isLoading;

  readonly formModel = signal<ServerPayload>(this.emptyFormValue());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    required(schema.engine);
    required(schema.status);
  });
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  readonly installCommandDialog = viewChild<TemplateRef<unknown>>('installCommandDialog');
  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  private readonly cleanupOnDestroy = this.destroyRef.onDestroy(() => {
    this.closeDialog();
    this.closeInstallCommandDialog();
  });

  private readonly syncRows = effect(() => {
    this.rows();
    this.reconcileSelection();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.serversResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }
    const message = (error as any)?.error?.error || 'Failed to load PABX servers.';
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
  });

  get selectedCount() {
    return this.selectedIds().size;
  }
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  refreshList() {
    this.serversResource.reload();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    this.table.setPage({
      pageIndex: 0,
      pageSize: this.pageSize(),
      length: this.sortedRows().length,
    });
    if (this.appliedSearch() === this.search() && this.appliedStatus() === this.statusInput()) {
      this.serversResource.reload();
    } else {
      this.appliedSearch.set(this.search());
      this.appliedStatus.set(this.statusInput());
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    this.table.setPage({
      pageIndex: 0,
      pageSize: this.pageSize(),
      length: this.sortedRows().length,
    });
    if (this.appliedSearch() === '' && this.appliedStatus() === '') {
      this.serversResource.reload();
    } else {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    }
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set(this.emptyFormValue());
    this.openDialog();
  }

  startEdit(row: VoipPabxServerItem) {
    this.editing.set(row);
    this.formModel.set({
      name: row.VpsName || '',
      nodeUUID: row.VpsNodeUUID || '',
      engine: row.VpsEngine || 'freeswitch',
      hostname: row.VpsHostname || '',
      publicIPv4: this.publicIPv4(row),
      publicIPv6: this.publicIPv6(row),
      privateIPv4: this.privateIPv4(row),
      privateIPv6: this.privateIPv6(row),
      baseUrl: row.VpsBaseUrl || '',
      controlHost: row.VpsControlHost || '',
      controlPort: row.VpsControlPort ? Number(row.VpsControlPort) : null,
      controlUsername: row.VpsControlUsername || '',
      controlSecret: '',
      controlAllowedIps: row.VpsControlAllowedIps || '',
      remoteCommandExecutor: row.VpsRemoteCommandExecutor || '',
      notes: row.VpsNotes || '',
      status: Number(row.VpsStatus ?? 1),
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
        await this.api.update(editing.VpsUUID, payload, true);
        this.snack.success('PABX server updated successfully.');
      } else {
        const response = await this.api.create(payload, true);
        const created = response?.data?.item as VoipPabxServerItem | null | undefined;
        this.snack.success('PABX server created successfully.');
        if (created?.VpsUUID) {
          await this.openGeneratedInstallCommand(created.VpsUUID, false);
        }
      }

      this.serversResource.reload();
      if (createAnother && !editing) {
        this.formModel.set(this.emptyFormValue());
        return;
      }
      this.closeDialog();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to save PABX server.');
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: VoipPabxServerItem) {
    const confirmed = await this.confirmDelete(
      'Delete PABX server',
      `Delete "${row.VpsName}"? This action will disable the server record.`,
    );
    if (!confirmed) return;

    try {
      await this.api.remove(row.VpsUUID, true);
      this.removeSelection([row.VpsUUID]);
      this.snack.success('PABX server deleted successfully.');
      this.serversResource.reload();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete PABX server.');
    }
  }

  async validateControl(row: VoipPabxServerItem) {
    if (this.isValidating(row)) return;
    const next = new Set(this.validatingIds());
    next.add(row.VpsUUID);
    this.validatingIds.set(next);
    try {
      const response = await this.api.validateControl(row.VpsUUID, true);
      const correlationID = response?.data?.correlationID;
      this.snack.success(
        correlationID
          ? `Control validation queued. Correlation: ${correlationID}`
          : 'Control validation queued. Check Activity Logs for the result.',
      );
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to queue control validation.');
    } finally {
      const done = new Set(this.validatingIds());
      done.delete(row.VpsUUID);
      this.validatingIds.set(done);
    }
  }

  async generateInstallCommand(row: VoipPabxServerItem) {
    const confirmed = await this.confirmDelete(
      'Generate install command',
      `Generate a new install command for "${row.VpsName}"? The previous PABX runtime token will be replaced.`,
      'Generate command',
    );
    if (!confirmed) return;
    await this.openGeneratedInstallCommand(row.VpsUUID, true);
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
    bindDialogClosed(binding.ref, () => {
      binding.stop();
      if (this.installCommandBinding === binding) this.installCommandBinding = null;
    });
  }

  closeInstallCommandDialog() {
    const binding = this.installCommandBinding;
    this.installCommandBinding = null;
    binding?.stop();
    binding?.ref.close();
  }

  installCommand() {
    const data = this.generatedInstall();
    if (!data) return '';
    const engine = String(data['engine'] || '').toLowerCase();
    const repo = engine === 'asterisk' ? 'mnscloud-asterisk' : 'mnscloud-freeswitch';
    const script = engine === 'asterisk' ? 'install-asterisk.sh' : 'install-freeswitch.sh';
    const validateScript =
      engine === 'asterisk' ? 'validate-asterisk.sh' : 'validate-freeswitch.sh';
    const apiBase = window.location.origin;
    const installLine = `sudo bash /opt/mnscloud/${repo}/scripts/${script} --api-base ${this.shellQuote(
      apiBase,
    )} --node-uuid ${this.shellQuote(String(data['nodeUUID'] || ''))} --runtime-token ${this.shellQuote(
      String(data['runtimeToken'] || ''),
    )}`;
    const postValidate = `[ -f /opt/mnscloud/${repo}/scripts/${validateScript} ] && sudo bash /opt/mnscloud/${repo}/scripts/${validateScript} || true`;
    return [
      'sudo install -d -m 0755 /opt/mnscloud',
      'cd /opt/mnscloud',
      `[ -d ${repo}/.git ] && sudo git -C ${repo} pull || sudo gh repo clone manaoscloud/${repo} || sudo git clone https://github.com/manaoscloud/${repo}.git ${repo}`,
      installLine,
      postValidate,
    ].join(' && ');
  }

  installCommandDetails() {
    const data = this.generatedInstall();
    const engine = String(data?.['engine'] || '').toLowerCase();
    return [
      { label: 'API base', value: window.location.origin, monospace: true },
      { label: 'Node UUID', value: data?.['nodeUUID'], monospace: true },
      { label: 'Engine', value: engine || null, monospace: true },
      {
        label: 'Runtime',
        value: engine === 'asterisk' ? 'mnscloud-asterisk' : 'mnscloud-freeswitch',
        monospace: true,
      },
    ];
  }

  async removeSelectedServers() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const labels = this.rows()
      .filter((row) => this.selectedIds().has(row.VpsUUID))
      .slice(0, 3)
      .map((row) => row.VpsName)
      .join(', ');
    const confirmed = await this.confirmDelete(
      'Delete selected PABX servers',
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
          : 'Selected PABX servers deleted successfully.',
      );
      this.serversResource.reload();
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to delete selected PABX servers.');
    }
  }

  isSelected(row: VoipPabxServerItem) {
    return this.selectedIds().has(row.VpsUUID);
  }

  toggleServerSelection(row: VoipPabxServerItem, checked: boolean) {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(row.VpsUUID);
    } else {
      next.delete(row.VpsUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.VpsUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.selectedIds().has(row.VpsUUID)) && !this.isAllVisibleSelected();
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.visibleRows()) {
      if (checked) {
        next.add(row.VpsUUID);
      } else {
        next.delete(row.VpsUUID);
      }
    }
    this.selectedIds.set(next);
  }

  engineLabel(engine?: string | null) {
    if (engine === 'freeswitch') return 'FreeSWITCH';
    if (engine === 'asterisk') return 'Asterisk';
    return engine || '-';
  }

  statusLabel(row: VoipPabxServerItem) {
    return Number(row.VpsStatus) === 1 ? 'ACTIVE' : 'INACTIVE';
  }

  publicIPv4(row: VoipPabxServerItem) {
    return row.VpsPublicIPv4 || '';
  }

  publicIPv6(row: VoipPabxServerItem) {
    return row.VpsPublicIPv6 || '';
  }

  privateIPv4(row: VoipPabxServerItem) {
    return row.VpsPrivateIPv4 || '';
  }

  privateIPv6(row: VoipPabxServerItem) {
    return row.VpsPrivateIPv6 || '';
  }

  controlTarget(row: VoipPabxServerItem) {
    const host = row.VpsControlHost || '';
    const port = row.VpsControlPort ? String(row.VpsControlPort) : '';
    return host && port ? `${host}:${port}` : host || port || '-';
  }

  controlSecretTooltip(row: VoipPabxServerItem) {
    return row.VpsControlSecretSet ? 'Control secret is configured' : 'Control secret is missing';
  }

  canValidateControl(row: VoipPabxServerItem) {
    if (row.VpsRemoteCommandExecutor !== 'esl_ami') return true;
    if (!row.VpsControlSecretSet) return false;
    if (!this.controlTarget(row) || this.controlTarget(row) === '-') return false;
    if (row.VpsEngine === 'asterisk' && !row.VpsControlUsername) return false;
    return true;
  }

  isValidating(row: VoipPabxServerItem) {
    return this.validatingIds().has(row.VpsUUID);
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
      'voip-pabx-server-dialog',
      { onEscape: () => this.closeDialog() },
    );
    this.dialogRef = this.dialogBinding.ref;
  }

  private emptyFormValue(): ServerPayload {
    return {
      name: '',
      nodeUUID: '',
      engine: 'freeswitch',
      hostname: '',
      publicIPv4: '',
      publicIPv6: '',
      privateIPv4: '',
      privateIPv6: '',
      baseUrl: '',
      controlHost: '',
      controlPort: null,
      controlUsername: '',
      controlSecret: '',
      controlAllowedIps: '',
      remoteCommandExecutor: '',
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
      publicIPv4: value.publicIPv4.trim(),
      publicIPv6: value.publicIPv6.trim(),
      privateIPv4: value.privateIPv4.trim(),
      privateIPv6: value.privateIPv6.trim(),
      baseUrl: value.baseUrl.trim(),
      controlHost: value.controlHost.trim(),
      controlPort:
        value.controlPort === null || value.controlPort === undefined
          ? null
          : Number(value.controlPort),
      controlUsername: value.controlUsername.trim(),
      controlSecret: value.controlSecret.trim(),
      controlAllowedIps: value.controlAllowedIps.trim(),
      remoteCommandExecutor: value.remoteCommandExecutor.trim(),
      notes: value.notes.trim(),
      status: Number(value.status),
    };
  }

  private reconcileSelection() {
    const existing = new Set(this.rows().map((row) => row.VpsUUID));
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
  }): Promise<VoipPabxServerItem[]> {
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
      .map((item: any) => item?.VpsUUID || item?.uuid || item?.id)
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
      if (showSuccess) this.snack.success('PABX install command generated.');
    } catch (error: any) {
      this.snack.error(error?.error?.error || 'Failed to generate install command.');
    }
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  private sortValue(row: VoipPabxServerItem, column: string): string | number {
    const value = (row as Record<string, unknown>)[column];
    if (typeof value === 'number') return value;
    return String(value ?? '');
  }
}
