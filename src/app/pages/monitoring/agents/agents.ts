import { CommonModule } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import {
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type MonitoringAgent = {
  uuid: string;
  id?: string;
  name?: string | null;
  type?: string | null;
  capabilities?: string | null;
  resourceType?: string | null;
  resourceUUID?: string | null;
  resourceLabel?: string | null;
  engine?: string | null;
  hostname?: string | null;
  version?: string | null;
  status?: number | null;
  connectionStatus: 'online' | 'offline';
  lastHeartbeatAt?: string | null;
  uptimeSeconds?: number | null;
};

@Component({
  selector: 'app-monitoring-agents',
  standalone: true,
  imports: [
    CommonModule,
    ClipboardModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
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
    MatTooltipModule,
  ],
  templateUrl: './agents.html',
  styleUrls: ['./agents.scss'],
  animations: [fadeIn],
})
export class MonitoringAgentsPage implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('agentDialog') agentDialog?: TemplateRef<unknown>;
  @ViewChild('tokenDialog') tokenDialog?: TemplateRef<unknown>;
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private dialogBinding: CrudDialogBinding | null = null;
  private loadingStarted = 0;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly agents = signal<MonitoringAgent[]>([]);
  readonly editing = signal<MonitoringAgent | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly generatedToken = signal('');
  readonly dataSource = new MatTableDataSource<MonitoringAgent>([]);

  readonly displayedColumns = [
    'select',
    'status',
    'name',
    'type',
    'resource',
    'hostname',
    'uptime',
    'heartbeat',
    'actions',
  ];

  readonly statusOptions = ['', 'online', 'offline'];
  readonly typeOptions = [
    '',
    'linux.status',
    'security.nftables.manage',
    'security.crowdsec.manage',
    'security.logs.read',
    'voip.asterisk.manage',
    'voip.freeswitch.manage',
    'docker.manage',
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    type: [''],
    status: [''],
  });

  readonly form = this.fb.nonNullable.group({
    agentUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    hostname: [''],
    status: [1],
    capabilitiesText: ['linux.status'],
    resourceType: [''],
    resourceUUID: [''],
  });

  readonly filteredAgents = computed(() => this.sortRows(this.agents()));

  readonly pagedAgents = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredAgents().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.load();
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    void this.load();
  }

  async load() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const response = await this.api.get<any>(`monitoring/agents${this.queryString()}`);
      this.agents.set(response?.data?.items ?? []);
      this.dataSource.data = this.agents();
      this.pageIndex.set(0);
      this.reconcileSelection();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load agents.'));
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  applyFilters() {
    void this.load();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', type: '', status: '' });
    void this.load();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      agentUUID: '',
      name: '',
      hostname: '',
      status: 1,
      capabilitiesText: 'linux.status',
      resourceType: '',
      resourceUUID: '',
    });
    this.form.controls.agentUUID.enable();
    this.openDialog();
  }

  startEdit(row: MonitoringAgent) {
    this.editing.set(row);
    this.form.reset({
      agentUUID: row.uuid,
      name: row.name ?? '',
      hostname: row.hostname ?? '',
      status: row.status === 0 ? 0 : 1,
      capabilitiesText: this.capabilitiesText(row),
      resourceType: row.resourceType ?? '',
      resourceUUID: row.resourceUUID ?? '',
    });
    this.form.controls.agentUUID.disable();
    this.openDialog();
  }

  private openDialog() {
    if (!this.agentDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, this.agentDialog, 'crud-dialog-panel', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding = binding;
    binding.ref.afterClosed().subscribe(() => {
      binding.stop();
      if (this.dialogBinding === binding) this.dialogBinding = null;
    });
  }

  closeDialog() {
    const binding = this.dialogBinding;
    this.dialogBinding = null;
    binding?.ref.close();
    binding?.stop();
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const payload = {
      agentUUID: raw.agentUUID,
      name: raw.name.trim(),
      hostname: raw.hostname.trim() || null,
      status: raw.status,
      capabilities: this.parseCapabilities(raw.capabilitiesText),
      resourceType: raw.resourceType.trim() || null,
      resourceUUID: raw.resourceUUID.trim() || null,
    };
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`monitoring/agents/${editing.uuid}`, payload);
        this.snack.success('Agent updated.');
      } else {
        const response = await this.api.post<any>('monitoring/agents', payload);
        this.generatedToken.set(response?.data?.agentToken ?? '');
        this.snack.success('Agent created. Copy the generated token.');
        this.openTokenDialog();
      }
      await this.load();
      if (keepOpen && !editing) {
        this.startCreate();
      } else {
        this.closeDialog();
      }
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save agent.'));
    } finally {
      this.saving.set(false);
    }
  }

  async generateInstallCommand(row: MonitoringAgent) {
    const ok = await this.confirm(
      'Generate install command',
      `Generate a new install command for agent ${row.name || row.uuid}? This rotates the agent token, so any previous token stops working after you confirm.`,
      'Generate command',
    );
    if (!ok) return;
    try {
      const response = await this.api.post<any>(`monitoring/agents/${row.uuid}/rotate-token`, {});
      this.generatedToken.set(response?.data?.agentToken ?? '');
      this.openTokenDialog();
      this.snack.success('Agent install command generated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to generate install command.'));
    }
  }

  async deleteAgent(row: MonitoringAgent) {
    const ok = await this.confirm(
      'Confirm delete',
      `Delete agent ${row.name || row.uuid}?`,
      'Delete',
    );
    if (!ok) return;
    try {
      await this.api.delete(`monitoring/agents/${row.uuid}`);
      this.snack.success('Agent deleted.');
      await this.load();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete agent.'));
    }
  }

  async deleteSelectedAgents() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(
      'Confirm delete',
      `Delete ${ids.length} selected agent(s)?`,
      'Delete',
    );
    if (!ok) return;
    try {
      const response = await this.api.delete<any>('monitoring/agents/bulk', { ids });
      const failedIds = (response?.data?.failed ?? [])
        .map((item: any) => item.uuid)
        .filter(Boolean);
      this.selectedIds.set(new Set(failedIds));
      failedIds.length
        ? this.snack.warning(
            `${ids.length - failedIds.length} agent(s) deleted; ${failedIds.length} failed.`,
          )
        : this.snack.success('Selected agents deleted.');
      await this.load();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected agents.'));
    }
  }

  openTokenDialog() {
    if (!this.tokenDialog) return;
    this.dialog.open(this.tokenDialog, {
      width: 'min(760px, calc(100vw - 32px))',
      maxWidth: '760px',
      disableClose: false,
    });
  }

  tokenCommand() {
    const token = this.generatedToken();
    return `sudo install -d -m 700 /var/lib/mnscloud/agent && printf '%s\\n' '${token}' | sudo tee /var/lib/mnscloud/agent/agent.token >/dev/null && sudo chmod 600 /var/lib/mnscloud/agent/agent.token && sudo systemctl restart mnscloud-agent`;
  }

  notifyCommandCopied(copied: boolean) {
    copied
      ? this.snack.success('Install command copied.')
      : this.snack.error('Failed to copy install command.');
  }

  isSelected(row: MonitoringAgent) {
    return this.selectedIds().has(row.uuid);
  }

  toggleSelection(row: MonitoringAgent, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(row.uuid) : next.delete(row.uuid);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedAgents()) {
      checked ? next.add(row.uuid) : next.delete(row.uuid);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedAgents();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.uuid));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedAgents();
    return rows.some((row) => this.selectedIds().has(row.uuid)) && !this.isAllVisibleSelected();
  }

  chipClass(value: string | null | undefined) {
    return value === 'online' ? 'chip-success is-active' : 'chip-skipped is-inactive';
  }

  formatUptime(value: number | null | undefined) {
    const seconds = Number(value ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return '-';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  private queryString() {
    const value = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    params.set('limit', '1000');
    if (value.search.trim()) params.set('search', value.search.trim());
    if (value.type) params.set('type', value.type);
    if (value.status) params.set('status', value.status);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  private sortRows(rows: MonitoringAgent[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const av = this.sortValue(a, active);
      const bv = this.sortValue(b, active);
      const result = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(row: MonitoringAgent, column: string) {
    if (column === 'status') return row.connectionStatus ?? '';
    if (column === 'name') return row.name ?? '';
    if (column === 'type') return row.type ?? '';
    if (column === 'resource') return row.resourceLabel ?? '';
    if (column === 'hostname') return row.hostname ?? '';
    if (column === 'uptime') return String(row.uptimeSeconds ?? 0);
    if (column === 'heartbeat') return row.lastHeartbeatAt ?? '';
    return '';
  }

  private capabilitiesText(row: MonitoringAgent) {
    return (row.capabilities ?? row.type ?? 'linux.status')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .join('\n');
  }

  private parseCapabilities(value: string) {
    return [...new Set(
      value
        .split(/[,\n]/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    )];
  }

  private reconcileSelection() {
    const valid = new Set(this.agents().map((row) => row.uuid));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
  }

  private async confirm(title: string, message: string, confirmLabel = 'Confirm') {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string; message?: string }; message?: string };
    return maybe?.error?.message || maybe?.error?.error || maybe?.message || fallback;
  }
}
