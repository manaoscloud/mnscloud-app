import { CommonModule } from '@angular/common';
import { Component, OnDestroy, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
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
import { MatPaginator, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type SmtpProvider = 'smtp' | 'sendgrid' | 'ses' | 'mailersend';

type HostingSmtpProvider = {
  HspUUID: string;
  HspName: string;
  HspProvider: SmtpProvider;
  HspHost?: string | null;
  HspPort?: number | null;
  HspSecure?: number | null;
  HspUsername?: string | null;
  HspConfig?: Record<string, unknown> | null;
  HspIsActive: number;
  HspIsDefault: number;
};

@Component({
  selector: 'app-hosting-smtp-providers',
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
    MatTooltipModule,
  ],
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
  animations: [fadeIn],
})
export class HostingSmtpProvidersPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('providerDialog') providerDialog?: TemplateRef<unknown>;
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  private dialogRef: MatDialogRef<unknown> | null = null;
  private loadingStarted = 0;
  readonly dataSource = new MatTableDataSource<HostingSmtpProvider>([]);

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly endpoint = computed(() =>
    this.isMaster() ? 'system/hosting/smtp/providers' : 'hosting/smtp/providers',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly providers = signal<HostingSmtpProvider[]>([]);
  readonly editing = signal<HostingSmtpProvider | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly validatingId = signal<string | null>(null);

  readonly displayedColumns = ['select', 'name', 'provider', 'default', 'status', 'actions'];

  readonly providerOptions: { value: SmtpProvider; label: string }[] = [
    { value: 'smtp', label: 'SMTP' },
    { value: 'sendgrid', label: 'Twilio SendGrid' },
    { value: 'ses', label: 'Amazon SES' },
    { value: 'mailersend', label: 'MailerSend' },
  ];

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    provider: [''],
    status: [''],
  });

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['smtp' as SmtpProvider, [Validators.required]],
    isActive: [1],
    isDefault: [0],
    configJson: [''],
    credentialsJson: [''],
  });

  readonly filteredProviders = computed(() => {
    const { search, provider, status } = this.filterForm.getRawValue();
    const term = search.trim().toLowerCase();
    const rows = this.providers().filter((item) => {
      const matchesTerm = !term || `${item.HspName} ${item.HspProvider}`.toLowerCase().includes(term);
      const matchesProvider = !provider || item.HspProvider === provider;
      const matchesStatus = status === '' || String(item.HspIsActive) === status;
      return matchesTerm && matchesProvider && matchesStatus;
    });
    return this.sortRows(rows);
  });

  readonly pagedProviders = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredProviders().slice(start, start + this.pageSize());
  });

  ngOnInit() {
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.loadItems();
  }

  ngOnDestroy() {
    this.dialogRef?.close();
  }

  refreshList() {
    void this.loadItems();
  }

  async loadItems() {
    this.loadingStarted = performance.now();
    this.loading.set(true);
    try {
      const result = await this.api.get<HostingSmtpProvider[]>(this.endpoint());
      this.providers.set(Array.isArray(result) ? result : []);
      this.dataSource.data = this.providers();
      this.pageIndex.set(0);
      this.reconcileSelection();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to load SMTP providers.'));
    } finally {
      const elapsed = performance.now() - this.loadingStarted;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  applyFilters() {
    this.pageIndex.set(0);
    this.reconcileSelection();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', provider: '', status: '' });
    this.pageIndex.set(0);
    this.reconcileSelection();
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
      name: '',
      provider: 'smtp',
      isActive: 1,
      isDefault: 0,
      configJson: '',
      credentialsJson: '',
    });
    this.openDialog();
  }

  startEdit(item: HostingSmtpProvider) {
    this.editing.set(item);
    this.form.reset({
      name: item.HspName,
      provider: item.HspProvider,
      isActive: item.HspIsActive ? 1 : 0,
      isDefault: item.HspIsDefault ? 1 : 0,
      configJson: item.HspConfig ? JSON.stringify(item.HspConfig, null, 2) : '',
      credentialsJson: '',
    });
    this.openDialog();
  }

  private openDialog() {
    if (!this.providerDialog) return;
    this.dialogRef = this.dialog.open(this.providerDialog, {
      width: 'min(960px, calc(100vw - 32px))',
      maxWidth: '960px',
      height: 'min(92vh, 780px)',
      maxHeight: '92vh',
      disableClose: true,
      panelClass: 'crud-dialog-panel',
    });
    this.dialogRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.closeDialog();
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    this.dialogRef?.close();
    this.dialogRef = null;
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    let config: Record<string, unknown> = {};
    let credentials: Record<string, unknown> = {};
    try {
      config = raw.configJson.trim() ? JSON.parse(raw.configJson) : {};
      credentials = raw.credentialsJson.trim() ? JSON.parse(raw.credentialsJson) : {};
    } catch {
      this.snack.error('Config and credentials must be valid JSON.');
      return;
    }

    const payload = {
      name: raw.name,
      provider: raw.provider,
      config,
      credentials,
      isActive: raw.isActive === 1,
      isDefault: raw.isDefault === 1,
    };

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.endpoint()}/${editing.HspUUID}`, payload);
        this.snack.success('SMTP provider updated.');
      } else {
        await this.api.post(this.endpoint(), payload);
        this.snack.success('SMTP provider created.');
      }
      await this.loadItems();
      if (keepOpen && !editing) this.startCreate();
      else this.closeDialog();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to save SMTP provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  async validateProvider(item: HostingSmtpProvider) {
    this.validatingId.set(item.HspUUID);
    try {
      await this.api.post(`${this.endpoint()}/${item.HspUUID}/validate`, {});
      this.snack.success('SMTP provider validated.');
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to validate SMTP provider.'));
    } finally {
      this.validatingId.set(null);
    }
  }

  async deleteProvider(item: HostingSmtpProvider) {
    const ok = await this.confirm(`Delete SMTP provider ${item.HspName}?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/${item.HspUUID}`);
      this.snack.success('SMTP provider deleted.');
      await this.loadItems();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete SMTP provider.'));
    }
  }

  async deleteSelectedProviders() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    const ok = await this.confirm(`Delete ${ids.length} selected SMTP provider(s)?`);
    if (!ok) return;
    try {
      await this.api.delete(`${this.endpoint()}/bulk`, { ids });
      this.selectedIds.set(new Set());
      this.snack.success('Selected SMTP providers deleted.');
      await this.loadItems();
    } catch (error) {
      this.snack.error(this.errorMessage(error, 'Failed to delete selected SMTP providers.'));
    }
  }

  isSelected(row: HostingSmtpProvider) {
    return this.selectedIds().has(row.HspUUID);
  }

  toggleSelection(row: HostingSmtpProvider, checked: boolean) {
    const next = new Set(this.selectedIds());
    checked ? next.add(row.HspUUID) : next.delete(row.HspUUID);
    this.selectedIds.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const next = new Set(this.selectedIds());
    for (const row of this.pagedProviders()) {
      checked ? next.add(row.HspUUID) : next.delete(row.HspUUID);
    }
    this.selectedIds.set(next);
  }

  isAllVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.length > 0 && rows.every((row) => this.selectedIds().has(row.HspUUID));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedProviders();
    return rows.some((row) => this.selectedIds().has(row.HspUUID)) && !this.isAllVisibleSelected();
  }

  providerLabel(value: string) {
    return this.providerOptions.find((item) => item.value === value)?.label ?? value;
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  private sortRows(rows: HostingSmtpProvider[]) {
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

  private sortValue(row: HostingSmtpProvider, column: string) {
    if (column === 'name') return row.HspName ?? '';
    if (column === 'provider') return this.providerLabel(row.HspProvider);
    if (column === 'default') return String(row.HspIsDefault ?? 0);
    if (column === 'status') return this.statusLabel(row.HspIsActive);
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.providers().map((row) => row.HspUUID));
    this.selectedIds.set(new Set([...this.selectedIds()].filter((id) => valid.has(id))));
  }

  private async confirm(message: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title: 'Confirm delete', message, confirmText: 'Delete', color: 'warn' },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return !!(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
