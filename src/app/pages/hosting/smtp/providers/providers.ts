import {
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
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

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

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

type ProviderFormValue = {
  name: string;
  provider: SmtpProvider;
  isActive: number;
  isDefault: number;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  apiKey: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

@Component({
  selector: 'app-hosting-smtp-providers',
  standalone: true,
  imports: [
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './providers.html',
  styleUrls: ['./providers.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class HostingSmtpProvidersPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly providerDialog = viewChild<TemplateRef<unknown>>('providerDialog');
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);

  private dialogBinding: CrudDialogBinding | null = null;
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
  readonly selectedProvider = signal<SmtpProvider>('smtp');

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
    host: [''],
    port: [587],
    secure: [false],
    username: [''],
    password: [''],
    apiKey: [''],
    region: [''],
    accessKeyId: [''],
    secretAccessKey: [''],
  });

  readonly filteredProviders = computed(() => {
    const { search, provider, status } = this.filterForm.getRawValue();
    const term = search.trim().toLowerCase();
    const rows = this.providers().filter((item) => {
      const matchesTerm =
        !term || `${item.HspName} ${item.HspProvider}`.toLowerCase().includes(term);
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
    this.closeDialog();
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
      host: '',
      port: 587,
      secure: false,
      username: '',
      password: '',
      apiKey: '',
      region: '',
      accessKeyId: '',
      secretAccessKey: '',
    });
    this.selectedProvider.set('smtp');
    this.applyProviderDefaults('smtp', true);
    this.openDialog();
  }

  startEdit(item: HostingSmtpProvider) {
    const config = this.normalizedConfig(item);
    this.editing.set(item);
    this.selectedProvider.set(item.HspProvider);
    this.form.reset({
      name: item.HspName,
      provider: item.HspProvider,
      isActive: item.HspIsActive ? 1 : 0,
      isDefault: item.HspIsDefault ? 1 : 0,
      host: String(config['host'] ?? ''),
      port: Number(config['port'] ?? this.defaultPort(item.HspProvider)),
      secure: this.normalizeSecure(config['secure'] ?? item.HspSecure),
      username: String(config['username'] ?? item.HspUsername ?? ''),
      password: '',
      apiKey: '',
      region: String(config['region'] ?? ''),
      accessKeyId: String(config['accessKeyId'] ?? ''),
      secretAccessKey: '',
    });
    this.applyProviderDefaults(item.HspProvider, false);
    this.openDialog();
  }

  private openDialog() {
    const providerDialog = this.providerDialog();
    if (!providerDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, providerDialog, 'crud-form-dialog', {
      onEscape: () => this.closeDialog(),
    });
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  openCrudTemplateDialog() {
    this.openDialog();
  }

  closeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.ref.close();
    this.dialogBinding.stop();
    this.dialogBinding = null;
    this.editing.set(null);
  }

  async save(keepOpen = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const provider = raw.provider;
    const missing = this.requiredProviderFields(raw);
    if (missing.length) {
      this.snack.error(`Required provider fields: ${missing.join(', ')}.`);
      return;
    }

    const config = this.buildProviderConfig(raw);
    const credentials = this.buildProviderCredentials(raw);
    const payload = {
      name: raw.name,
      provider,
      config,
      credentials,
      isActive: raw.isActive === 1,
      isDefault: Boolean(raw.isDefault),
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
    const ok = await this.confirm(this.bulkDeleteMessage(ids));
    if (!ok) return;
    try {
      const response = await this.api.delete<any>(`${this.endpoint()}/bulk`, { ids });
      const result = this.parseBulkDeleteResult(response, ids);
      this.providers.set(this.providers().filter((row) => !result.deleted.has(row.HspUUID)));
      this.dataSource.data = this.providers();
      this.selectedIds.set(result.failed);
      if (result.failed.size) {
        this.snack.error(`${result.failed.size} selected SMTP provider(s) could not be deleted.`);
      } else {
        this.snack.success(`${result.deleted.size} selected SMTP provider(s) deleted.`);
      }
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

  onProviderChange(provider: SmtpProvider) {
    this.selectedProvider.set(provider);
    this.applyProviderDefaults(provider, true);
  }

  onRegionInput() {
    if (this.selectedProvider() !== 'ses') return;
    const region = this.form.controls.region.value.trim();
    if (!region) return;
    this.form.patchValue({ host: `email-smtp.${region}.amazonaws.com` });
  }

  secretHint(label: string) {
    return this.editing() ? `Leave blank to keep current ${label}.` : `${label} is required.`;
  }

  private applyProviderDefaults(provider: SmtpProvider, force: boolean) {
    const current = this.form.getRawValue();
    const patch: Partial<typeof current> = {};
    if (provider === 'smtp') {
      if (force || !current.port) patch.port = 587;
      if (force) patch.secure = false;
    } else if (provider === 'sendgrid') {
      patch.host = 'smtp.sendgrid.net';
      patch.port = 587;
      patch.secure = false;
      patch.username = 'apikey';
      if (force) patch.password = '';
    } else if (provider === 'ses') {
      patch.port = 587;
      patch.secure = false;
      if (current.region) patch.host = `email-smtp.${current.region.trim()}.amazonaws.com`;
    } else if (provider === 'mailersend') {
      patch.host = 'api.mailersend.com';
      patch.port = 443;
      patch.secure = true;
      if (force) patch.username = '';
    }
    this.form.patchValue(patch);
  }

  private defaultPort(provider: SmtpProvider) {
    if (provider === 'mailersend') return 443;
    return 587;
  }

  private normalizedConfig(item: HostingSmtpProvider) {
    return {
      ...(item.HspConfig ?? {}),
      host: item.HspConfig?.['host'] ?? item.HspHost ?? undefined,
      port: item.HspConfig?.['port'] ?? item.HspPort ?? undefined,
      secure: item.HspConfig?.['secure'] ?? item.HspSecure ?? undefined,
      username: item.HspConfig?.['username'] ?? item.HspUsername ?? undefined,
    } as Record<string, unknown>;
  }

  private normalizeSecure(value: unknown) {
    return value === true || value === 1 || value === '1';
  }

  private requiredProviderFields(raw: ProviderFormValue) {
    const missing: string[] = [];
    const isEdit = !!this.editing();
    if (raw.provider === 'smtp') {
      if (!raw.host.trim()) missing.push('Host');
      if (!Number(raw.port)) missing.push('Port');
      if (!raw.username.trim()) missing.push('Username');
      if (!isEdit && !raw.password.trim()) missing.push('Password');
    } else if (raw.provider === 'sendgrid') {
      if (!isEdit && !raw.apiKey.trim()) missing.push('API key');
    } else if (raw.provider === 'ses') {
      if (!raw.region.trim()) missing.push('Region');
      if (!raw.accessKeyId.trim()) missing.push('Access key ID');
      if (!isEdit && !raw.secretAccessKey.trim()) missing.push('Secret access key');
    } else if (raw.provider === 'mailersend') {
      if (!isEdit && !raw.apiKey.trim()) missing.push('API token');
    }
    return missing;
  }

  private buildProviderConfig(raw: ProviderFormValue) {
    if (raw.provider === 'sendgrid') {
      return { service: 'sendgrid', host: 'smtp.sendgrid.net', port: 587, secure: false };
    }
    if (raw.provider === 'ses') {
      const region = raw.region.trim();
      return {
        region,
        accessKeyId: raw.accessKeyId.trim(),
        host: `email-smtp.${region}.amazonaws.com`,
        port: 587,
        secure: false,
      };
    }
    if (raw.provider === 'mailersend') {
      return { service: 'mailersend', host: 'api.mailersend.com', port: 443, secure: true };
    }
    return {
      host: raw.host.trim(),
      port: Number(raw.port),
      secure: !!raw.secure,
      username: raw.username.trim(),
    };
  }

  private buildProviderCredentials(raw: ProviderFormValue) {
    if (raw.provider === 'sendgrid') {
      return raw.apiKey.trim() ? { apiKey: raw.apiKey.trim() } : {};
    }
    if (raw.provider === 'ses') {
      return raw.secretAccessKey.trim() ? { secretAccessKey: raw.secretAccessKey.trim() } : {};
    }
    if (raw.provider === 'mailersend') {
      return raw.apiKey.trim() ? { apiKey: raw.apiKey.trim() } : {};
    }
    return raw.password.trim() ? { password: raw.password.trim() } : {};
  }

  statusLabel(value: number) {
    return value === 1 ? 'Active' : 'Inactive';
  }

  statusChipClass(value: number) {
    return value === 1 ? 'chip-success' : 'chip-skipped';
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

  private bulkDeleteMessage(ids: string[]) {
    const labels = this.providers()
      .filter((item) => ids.includes(item.HspUUID))
      .slice(0, 3)
      .map((item) => item.HspName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    return `Delete ${ids.length} selected SMTP provider(s)?${suffix}`;
  }

  private parseBulkDeleteResult(response: any, requestedIds: string[]) {
    const payload = response?.data ?? response ?? {};
    const failedItems = Array.isArray(payload.failed) ? payload.failed : [];
    const failed = new Set<string>(
      failedItems
        .map((item: any) => this.extractBulkFailureUUID(item))
        .filter((uuid: string | null): uuid is string => !!uuid),
    );
    const deletedItems = Array.isArray(payload.deleted) ? payload.deleted : [];
    const deleted = new Set<string>(
      deletedItems.length
        ? deletedItems.filter((uuid: unknown): uuid is string => typeof uuid === 'string')
        : requestedIds.filter((uuid) => !failed.has(uuid)),
    );
    return { deleted, failed };
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.HspUUID === 'string') return item.HspUUID;
    if (typeof item.UUID === 'string') return item.UUID;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
