import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  getWebhostDialogViewportConfig,
  updateWebhostDialogViewport,
} from '../webhost-dialog-viewport';
import type { HostingWebhostHost, WebhostProviderType } from '../webhost.types';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

type ToolKind = 'databases' | 'mailing-lists' | 'zone-records';

type ToolConfig = {
  kind: ToolKind;
  title: string;
  description: string;
  endpoint: string;
  idField: string;
  primaryColumn: string;
  primaryLabel: string;
  requiresPassword: boolean;
  zone: boolean;
};

type WebhostToolRow = Record<string, any> & {
  HostingWebhostHostHwhUUID?: string;
  HostName?: string;
  HostUsername?: string;
  DomainName?: string;
  HostingWebhostProviderHwpUUID?: string;
  ProviderName?: string;
  HwlProvider?: string;
  HwdName?: string;
  HwdUsername?: string | null;
  HwdPrivileges?: string | null;
  HwdStatus?: string;
  HwdProvisionStatus?: string;
  HwdLastSyncAt?: string | null;
  HwdIsActive?: number;
  HwmName?: string;
  HwmEmail?: string;
  HwmAdminEmail?: string | null;
  HwmAccessType?: string;
  HwmAdvertised?: number;
  HwmStatus?: string;
  HwmProvisionStatus?: string;
  HwmLastSyncAt?: string | null;
  HwmIsActive?: number;
  HwzName?: string;
  HwzType?: string;
  HwzValue?: string;
  HwzPriority?: number | null;
  HwzWeight?: number | null;
  HwzPort?: number | null;
  HwzTtl?: number;
  HwzLine?: number | null;
  HwzStatus?: string;
  HwzProvisionStatus?: string;
  HwzLastSyncAt?: string | null;
  HwzIsActive?: number;
};

const TOOL_CONFIGS: Record<ToolKind, ToolConfig> = {
  databases: {
    kind: 'databases',
    title: 'Webhost Databases',
    description: 'Manage databases created inside Webhost hosts.',
    endpoint: 'hosting/webhost/databases',
    idField: 'HwdUUID',
    primaryColumn: 'HwdName',
    primaryLabel: 'Database',
    requiresPassword: true,
    zone: false,
  },
  'mailing-lists': {
    kind: 'mailing-lists',
    title: 'Webhost Mailing Lists',
    description: 'Manage mailing lists created inside Webhost hosts.',
    endpoint: 'hosting/webhost/mailing-lists',
    idField: 'HwmUUID',
    primaryColumn: 'HwmEmail',
    primaryLabel: 'Mailing List',
    requiresPassword: true,
    zone: false,
  },
  'zone-records': {
    kind: 'zone-records',
    title: 'Webhost Zone Editor',
    description: 'Manage DNS records created inside Webhost hosts.',
    endpoint: 'hosting/webhost/zone-records',
    idField: 'HwzUUID',
    primaryColumn: 'HwzName',
    primaryLabel: 'Record',
    requiresPassword: false,
    zone: true,
  },
};

@Component({
  selector: 'app-hosting-webhost-tools',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    TranslatePipe,
    MatTooltipModule,
  ],
  templateUrl: './tools.html',
  styleUrls: ['./tools.scss'],
  animations: [fadeIn],
})
export class HostingWebhostToolsPage implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;
  @ViewChild('passwordDialog') passwordDialog?: TemplateRef<unknown>;

  private dialogRef: MatDialogRef<unknown> | null = null;
  passwordDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly config = TOOL_CONFIGS[(this.route.snapshot.data['tool'] as ToolKind) ?? 'databases'];
  readonly hostEndpoint = 'hosting/webhost/hosts';
  readonly hosts = signal<HostingWebhostHost[]>([]);
  readonly items = signal<WebhostToolRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<WebhostToolRow | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly hostSearch = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly passwordTarget = signal<WebhostToolRow | null>(null);

  readonly displayedColumns = computed(() => {
    const columns = ['select', 'primary', 'host', 'provider'];
    if (this.config.kind === 'databases') columns.push('username');
    if (this.config.kind === 'mailing-lists') columns.push('access');
    if (this.config.kind === 'zone-records') columns.push('type', 'value', 'ttl');
    columns.push('status', 'provision', 'lastSync', 'actions');
    return columns;
  });

  readonly providerOptions: { value: WebhostProviderType; label: string }[] = [
    { value: 'cpanel_whm', label: 'cPanel/WHM' },
    { value: 'plesk', label: 'Plesk' },
    { value: 'directadmin', label: 'DirectAdmin' },
  ];
  readonly statusOptions = this.config.zone
    ? [
        { value: 'pending', label: 'Pending' },
        { value: 'active', label: 'Active' },
        { value: 'error', label: 'Error' },
        { value: 'deleted', label: 'Deleted' },
      ]
    : [
        { value: 'pending', label: 'Pending' },
        { value: 'active', label: 'Active' },
        { value: 'error', label: 'Error' },
        { value: 'cancelled', label: 'Cancelled' },
      ];
  readonly provisionOptions = [
    { value: 'manual', label: 'Manual' },
    { value: 'pending', label: 'Pending' },
    { value: 'provisioning', label: 'Provisioning' },
    { value: 'provisioned', label: 'Provisioned' },
    { value: 'failed', label: 'Failed' },
  ];
  readonly zoneTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'CAA'];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    provider: [''],
    hostUUID: [''],
    type: [''],
    status: [''],
    provisionStatus: [''],
  });

  readonly form = this.fb.nonNullable.group({
    hostUUID: ['', [Validators.required]],
    name: ['', [Validators.required]],
    username: [''],
    privileges: ['ALL PRIVILEGES'],
    adminEmail: [''],
    accessType: ['private'],
    advertised: [0],
    type: ['A'],
    value: [''],
    priority: [0],
    weight: [0],
    port: [0],
    ttl: [14400],
    line: [0],
    status: ['pending', [Validators.required]],
    provisionStatus: ['manual', [Validators.required]],
    notes: [''],
    isActive: [1, [Validators.required]],
  });

  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  readonly filteredHosts = computed(() => {
    const search = this.hostSearch().trim().toLowerCase();
    const hosts = this.hosts().filter((host) => host.HwhIsActive === 1);
    if (!search) return hosts;
    return hosts.filter(
      (host) =>
        host.HwhName.toLowerCase().includes(search) ||
        host.DomainName.toLowerCase().includes(search) ||
        host.HwhUsername.toLowerCase().includes(search) ||
        host.ProviderName.toLowerCase().includes(search),
    );
  });
  readonly providerFilterOptions = computed(() => {
    const providers = new Map<
      string,
      { uuid: string; name: string; platform: WebhostProviderType | string }
    >();
    for (const host of this.hosts()) {
      if (!host.HostingWebhostProviderHwpUUID) continue;
      providers.set(host.HostingWebhostProviderHwpUUID, {
        uuid: host.HostingWebhostProviderHwpUUID,
        name: host.ProviderName || '-',
        platform: host.HwlProvider,
      });
    }
    return Array.from(providers.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });
  readonly sortedRows = computed(() => this.sortRows(this.items()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });

  constructor() {
    this.refreshList();
  }

  ngOnDestroy() {
    this.closeDialog();
    this.passwordDialogRef?.close();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    void this.loadHosts();
    void this.loadItems();
  }

  async loadHosts() {
    try {
      const response = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
        `${this.hostEndpoint}?limit=500&offset=0&isActive=1`,
      );
      this.hosts.set(response?.data?.items ?? []);
    } catch (error) {
      this.notifyError(error, 'Failed to load Webhost hosts.');
    }
  }

  async loadItems() {
    const params = new URLSearchParams();
    params.set('limit', '1000');
    params.set('offset', '0');
    params.set('isActive', '1');
    const providerUUID = String(this.filterForm.controls.provider.value ?? '').trim();
    for (const key of ['search', 'provider', 'hostUUID', 'status', 'provisionStatus', 'type']) {
      const value = String(this.filterForm.get(key)?.value ?? '').trim();
      if (key === 'provider') continue;
      if (value && (key !== 'type' || this.config.zone)) params.set(key, value);
    }
    this.loading.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: WebhostToolRow[] } }>(
        `${this.config.endpoint}?${params.toString()}`,
      );
      const items = response?.data?.items ?? [];
      this.items.set(
        providerUUID
          ? items.filter((item) => item.HostingWebhostProviderHwpUUID === providerUUID)
          : items,
      );
      this.pageIndex.set(0);
      this.selectedIds.set(new Set());
    } catch (error) {
      this.notifyError(error, `Failed to load ${this.config.title}.`);
    } finally {
      setTimeout(() => this.loading.set(false), 600);
    }
  }

  applyFilters() {
    void this.loadItems();
  }

  clearFilters() {
    this.filterForm.reset({
      search: '',
      provider: '',
      hostUUID: '',
      type: '',
      status: '',
      provisionStatus: '',
    });
    this.applyFilters();
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      hostUUID: '',
      name: '',
      username: '',
      privileges: 'ALL PRIVILEGES',
      adminEmail: '',
      accessType: 'private',
      advertised: 0,
      type: 'A',
      value: '',
      priority: 0,
      weight: 0,
      port: 0,
      ttl: 14400,
      line: 0,
      status: 'pending',
      provisionStatus: 'manual',
      notes: '',
      isActive: 1,
    });
    this.openDialog();
  }

  startEdit(row: WebhostToolRow) {
    this.editing.set(row);
    this.form.reset({
      hostUUID: row.HostingWebhostHostHwhUUID ?? '',
      name: row.HwdName ?? row.HwmName ?? row.HwzName ?? '',
      username: row.HwdUsername ?? '',
      privileges: row.HwdPrivileges ?? 'ALL PRIVILEGES',
      adminEmail: row.HwmAdminEmail ?? '',
      accessType: row.HwmAccessType ?? 'private',
      advertised: Number(row.HwmAdvertised ?? 0),
      type: row.HwzType ?? 'A',
      value: row.HwzValue ?? '',
      priority: Number(row.HwzPriority ?? 0),
      weight: Number(row.HwzWeight ?? 0),
      port: Number(row.HwzPort ?? 0),
      ttl: Number(row.HwzTtl ?? 14400),
      line: Number(row.HwzLine ?? 0),
      status: row.HwdStatus ?? row.HwmStatus ?? row.HwzStatus ?? 'pending',
      provisionStatus:
        row.HwdProvisionStatus ?? row.HwmProvisionStatus ?? row.HwzProvisionStatus ?? 'manual',
      notes: '',
      isActive: Number(row.HwdIsActive ?? row.HwmIsActive ?? row.HwzIsActive ?? 1),
    });
    this.openDialog();
  }

  async save(closeAfterSave = true) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.buildPayload();
    const editing = this.editing();
    this.saving.set(true);
    try {
      if (editing) {
        await this.api.put(`${this.config.endpoint}/${this.rowId(editing)}`, payload);
        this.snack.success(`${this.config.primaryLabel} updated.`);
      } else {
        await this.api.post(this.config.endpoint, payload);
        this.snack.success(`${this.config.primaryLabel} created.`);
      }
      await this.loadItems();
      if (closeAfterSave) this.closeDialog();
      if (!editing && !closeAfterSave) this.startCreate();
    } catch (error) {
      this.notifyError(error, `Failed to save ${this.config.primaryLabel}.`);
    } finally {
      this.saving.set(false);
    }
  }

  openPasswordAction(row: WebhostToolRow) {
    if (!this.config.requiresPassword) {
      void this.runAction(row, 'provision');
      return;
    }
    this.passwordTarget.set(row);
    this.passwordForm.reset({ password: '' });
    this.passwordDialogRef = this.dialog.open(this.passwordDialog!, {
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'webhost-password-dialog',
    });
  }

  async submitPasswordAction() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const target = this.passwordTarget();
    if (!target) return;
    await this.runAction(target, 'provision', {
      password: this.passwordForm.controls.password.value,
    });
    this.passwordDialogRef?.close();
    this.passwordTarget.set(null);
  }

  async runAction(row: WebhostToolRow, action: 'provision' | 'sync' | 'deprovision', body = {}) {
    this.saving.set(true);
    try {
      await this.api.post(`${this.config.endpoint}/${this.rowId(row)}/${action}`, body);
      this.snack.success(`${this.config.primaryLabel} ${action} queued.`);
      await this.loadItems();
    } catch (error) {
      this.notifyError(error, `Failed to run ${action}.`);
    } finally {
      this.saving.set(false);
    }
  }

  async remove(row: WebhostToolRow) {
    const ok = await this.confirmDelete(`Delete ${this.primaryValue(row)}?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.config.endpoint}/${this.rowId(row)}`);
      this.snack.success(`${this.config.primaryLabel} deleted.`);
      await this.loadItems();
    } catch (error) {
      this.notifyError(error, `Failed to delete ${this.config.primaryLabel}.`);
    }
  }

  async removeSelected() {
    const ids = Array.from(this.selectedIds());
    if (!ids.length) return;
    const ok = await this.confirmDelete(`Delete ${ids.length} selected records?`);
    if (!ok) return;
    try {
      const response = await this.api.delete<{ data?: { deleted?: string[]; failed?: any[] } }>(
        `${this.config.endpoint}/bulk`,
        { ids },
      );
      const failedIds = new Set(
        (response?.data?.failed ?? []).map((item: any) => Object.values(item)[0] as string),
      );
      await this.loadItems();
      this.selectedIds.set(failedIds);
      if (failedIds.size) {
        this.snack.error(`${failedIds.size} record(s) could not be deleted.`);
      } else {
        this.snack.success(`${response?.data?.deleted?.length ?? ids.length} records deleted.`);
      }
    } catch (error) {
      this.notifyError(error, `Failed to delete selected records.`);
    }
  }

  onHostOpened(open: boolean) {
    if (!open) this.hostSearch.set('');
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

  rowId(row: WebhostToolRow) {
    return String(row[this.config.idField] ?? '');
  }

  primaryValue(row: WebhostToolRow) {
    return String(row[this.config.primaryColumn] ?? '');
  }

  rowStatus(row: WebhostToolRow) {
    return String(row.HwdStatus ?? row.HwmStatus ?? row.HwzStatus ?? '');
  }

  rowProvision(row: WebhostToolRow) {
    return String(row.HwdProvisionStatus ?? row.HwmProvisionStatus ?? row.HwzProvisionStatus ?? '');
  }

  hostLabel(host: HostingWebhostHost | WebhostToolRow) {
    const row = host as HostingWebhostHost & WebhostToolRow;
    return `${row.HwhName ?? row.HostName} · ${row.DomainName} · ${
      row.HwhUsername ?? row.HostUsername
    }`;
  }

  providerLabel(value: string) {
    return this.providerOptions.find((opt) => opt.value === value)?.label ?? value;
  }

  isSelected(row: WebhostToolRow) {
    return this.selectedIds().has(this.rowId(row));
  }

  toggleSelection(row: WebhostToolRow, checked: boolean) {
    const next = new Set(this.selectedIds());
    const id = this.rowId(row);
    if (checked) next.add(id);
    else next.delete(id);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedRows()) {
      const id = this.rowId(row);
      if (checked) next.add(id);
      else next.delete(id);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(this.rowId(row)));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return (
      rows.some((row) => this.selectedIds().has(this.rowId(row))) && !this.isAllVisibleSelected()
    );
  }

  closeDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.stopDialogViewportObserver();
  }

  private buildPayload() {
    const value = this.form.getRawValue();
    const payload: any = {
      hostUUID: value.hostUUID,
      name: value.name,
      status: value.status,
      provisionStatus: value.provisionStatus,
      config: value.notes ? { notes: value.notes } : null,
      isActive: Boolean(value.isActive),
    };
    if (this.config.kind === 'databases') {
      payload.username = value.username || null;
      payload.privileges = value.privileges || null;
    }
    if (this.config.kind === 'mailing-lists') {
      payload.adminEmail = value.adminEmail || null;
      payload.accessType = value.accessType;
      payload.advertised = Boolean(value.advertised);
    }
    if (this.config.kind === 'zone-records') {
      Object.assign(payload, {
        type: value.type,
        value: value.value,
        priority: Number(value.priority) || null,
        weight: Number(value.weight) || null,
        port: Number(value.port) || null,
        ttl: Number(value.ttl) || 14400,
        line: Number(value.line) || null,
      });
    }
    return payload;
  }

  private openDialog() {
    const config = getWebhostDialogViewportConfig();
    this.dialogRef = this.dialog.open(this.formDialog!, {
      ...config,
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'webhost-tool-dialog',
    });
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.closeDialog();
    });
    this.startDialogViewportObserver();
    this.dialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.dialogRef = null;
    });
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.dialogRef) return;
    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;
    this.dialogViewportObserver = new ResizeObserver(() => {
      if (this.dialogRef) updateWebhostDialogViewport(this.dialogRef);
    });
    this.dialogViewportObserver.observe(pageContent);
    updateWebhostDialogViewport(this.dialogRef);
  }

  private stopDialogViewportObserver() {
    this.dialogViewportObserver?.disconnect();
    this.dialogViewportObserver = null;
  }

  private sortRows(rows: WebhostToolRow[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const av = String(this.sortValue(a, active)).toLowerCase();
      const bv = String(this.sortValue(b, active)).toLowerCase();
      return (av < bv ? -1 : av > bv ? 1 : 0) * (direction === 'asc' ? 1 : -1);
    });
  }

  private sortValue(row: WebhostToolRow, column: string) {
    if (column === 'primary') return this.primaryValue(row);
    if (column === 'host') return `${row.HostName} ${row.DomainName} ${row.HostUsername}`;
    if (column === 'provider') return `${row.ProviderName} ${row.HwlProvider}`;
    if (column === 'status') return this.rowStatus(row);
    if (column === 'provision') return this.rowProvision(row);
    return row[column] ?? '';
  }

  private async confirmDelete(message: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '420px',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      panelClass: 'slow-confirm-dialog',
      data: { title: 'Confirm delete', message, confirmLabel: 'Delete' },
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private notifyError(error: unknown, fallback: string) {
    const message =
      error instanceof HttpErrorResponse ? error.error?.error || error.message : fallback;
    this.snack.error(message || fallback);
  }
}
