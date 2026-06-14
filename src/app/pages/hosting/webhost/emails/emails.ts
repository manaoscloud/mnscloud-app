import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, min, minLength, required } from '@angular/forms/signals';
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
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  getWebhostDialogViewportConfig,
  updateWebhostDialogViewport,
} from '../webhost-dialog-viewport';
import type {
  HostingWebhostEmailAccount,
  HostingWebhostHost,
  WebhostEmailConfig,
  WebhostEmailProvisionStatus,
  WebhostEmailStatus,
  WebhostProviderType,
} from '../webhost.types';

type WebhostEmailFilters = {
  search: string;
  hostUUID: string;
  status: string;
  provisionStatus: string;
};

type WebhostEmailFilterFormModel = WebhostEmailFilters & {
  provider: string;
};

type WebhostEmailFormModel = {
  hostUUID: string;
  localPart: string;
  password: string;
  quotaMb: number;
  status: WebhostEmailStatus;
  provisionStatus: WebhostEmailProvisionStatus;
  autoProvision: number;
  notes: string;
  isActive: number;
};

type WebhostEmailPasswordFormModel = {
  password: string;
};

@Component({
  selector: 'app-hosting-webhost-emails',
  standalone: true,
  imports: [
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
  ],
  templateUrl: './emails.html',
  styleUrls: ['./emails.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HostingWebhostEmailsPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly emailFormDialog = viewChild<TemplateRef<unknown>>('emailFormDialog');
  readonly passwordDialog = viewChild<TemplateRef<unknown>>('passwordDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private passwordDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly emailEndpoint = 'hosting/webhost/emails';
  readonly hostEndpoint = 'hosting/webhost/hosts';
  readonly emails = signal<HostingWebhostEmailAccount[]>([]);
  readonly hosts = signal<HostingWebhostHost[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedProvider = signal('');
  readonly appliedHostUUID = signal('');
  readonly appliedStatus = signal('');
  readonly appliedProvisionStatus = signal('');
  readonly hostSearch = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  private readonly emailsResource = resource({
    defaultValue: [] as HostingWebhostEmailAccount[],
    params: (): WebhostEmailFilters => ({
      search: this.appliedSearch().trim(),
      hostUUID: this.appliedHostUUID(),
      status: this.appliedStatus(),
      provisionStatus: this.appliedProvisionStatus(),
    }),
    loader: ({ params }) => this.fetchEmails(params),
  });
  readonly loading = this.emailsResource.isLoading;
  readonly saving = signal(false);
  readonly actionEmailUUID = signal<string | null>(null);
  readonly editing = signal<HostingWebhostEmailAccount | null>(null);
  readonly passwordTarget = signal<HostingWebhostEmailAccount | null>(null);
  readonly passwordAction = signal<'provision' | 'reset-password'>('provision');
  readonly selectedEmailUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedEmailUUIDs().size);
  readonly selectedHost = computed(() => {
    const hostUUID = this.emailFormModel().hostUUID;
    return this.hosts().find((host) => host.HwhUUID === hostUUID) ?? null;
  });

  readonly providerOptions: { value: WebhostProviderType; label: string }[] = [
    { value: 'cpanel_whm', label: 'cPanel/WHM' },
    { value: 'plesk', label: 'Plesk' },
    { value: 'directadmin', label: 'DirectAdmin' },
  ];
  readonly statusOptions: { value: WebhostEmailStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'error', label: 'Error' },
    { value: 'cancelled', label: 'Cancelled' },
  ];
  readonly provisionOptions: { value: WebhostEmailProvisionStatus; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'pending', label: 'Pending' },
    { value: 'provisioning', label: 'Provisioning' },
    { value: 'provisioned', label: 'Provisioned' },
    { value: 'failed', label: 'Failed' },
  ];
  readonly displayedColumns = [
    'select',
    'email',
    'host',
    'provider',
    'quota',
    'status',
    'provision',
    'lastSync',
    'actions',
  ];

  readonly filterFormModel = signal<WebhostEmailFilterFormModel>({
    search: '',
    provider: '',
    hostUUID: '',
    status: '',
    provisionStatus: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly emailFormModel = signal<WebhostEmailFormModel>({
    hostUUID: '',
    localPart: '',
    password: '',
    quotaMb: 0,
    status: 'pending',
    provisionStatus: 'manual',
    autoProvision: 0,
    notes: '',
    isActive: 1,
  });
  readonly emailForm = createForm(this.emailFormModel, (schema) => {
    required(schema.hostUUID);
    required(schema.localPart);
    minLength(schema.localPart, 1);
    min(schema.quotaMb, 0);
    required(schema.status);
    required(schema.provisionStatus);
    required(schema.isActive);
  });

  readonly passwordFormModel = signal<WebhostEmailPasswordFormModel>({
    password: '',
  });
  readonly passwordForm = createForm(this.passwordFormModel, (schema) => {
    required(schema.password);
    minLength(schema.password, 8);
  });

  readonly rows = computed(() => {
    const search = this.appliedSearch().trim().toLowerCase();
    const provider = this.appliedProvider();
    const hostUUID = this.appliedHostUUID();
    const status = this.appliedStatus();
    const provisionStatus = this.appliedProvisionStatus();
    return this.emails().filter((item) => {
      const matchesSearch =
        !search ||
        item.HweEmail.toLowerCase().includes(search) ||
        item.HostName.toLowerCase().includes(search) ||
        item.DomainName.toLowerCase().includes(search) ||
        item.ProviderName.toLowerCase().includes(search);
      const matchesProvider = !provider || item.HostingWebhostProviderHwpUUID === provider;
      const matchesHost = !hostUUID || item.HostingWebhostHostHwhUUID === hostUUID;
      const matchesStatus = !status || item.HweStatus === status;
      const matchesProvision = !provisionStatus || item.HweProvisionStatus === provisionStatus;
      return matchesSearch && matchesProvider && matchesHost && matchesStatus && matchesProvision;
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly filteredHosts = computed(() => {
    const search = this.hostSearch().trim().toLowerCase();
    const items = this.hosts().filter((host) => host.HwhIsActive === 1);
    if (!search) return items;
    return items.filter(
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

  private readonly syncEmails = effect(() => {
    this.emails.set(this.emailsResource.value());
    this.reconcileEmailSelection();
  });

  private readonly reportEmailsError = effect(() => {
    const error = this.emailsResource.error();
    if (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost emails.'));
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.passwordDialogRef?.close();
      this.stopDialogViewportObserver();
    });
    void this.loadHosts();
  }

  refreshList() {
    void this.loadHosts();
    this.emailsResource.reload();
  }

  applyFilters() {
    const values = this.filterFormModel();
    this.appliedSearch.set(values.search);
    this.appliedProvider.set(values.provider);
    this.appliedHostUUID.set(values.hostUUID);
    this.appliedStatus.set(values.status);
    this.appliedProvisionStatus.set(values.provisionStatus);
    this.resetPagination();
    this.emailsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({
      search: '',
      provider: '',
      hostUUID: '',
      status: '',
      provisionStatus: '',
    });
    this.applyFilters();
  }

  onHostOpened(opened: boolean) {
    if (!opened) this.hostSearch.set('');
  }

  providerLabel(provider: WebhostProviderType | string) {
    return this.providerOptions.find((option) => option.value === provider)?.label ?? provider;
  }

  statusLabel(status: WebhostEmailStatus | string) {
    return this.statusOptions.find((option) => option.value === status)?.label ?? status;
  }

  provisionLabel(status: WebhostEmailProvisionStatus | string) {
    return this.provisionOptions.find((option) => option.value === status)?.label ?? status;
  }

  hostLabel(host: HostingWebhostHost) {
    return `${host.HwhName} · ${host.DomainName}`;
  }

  emailHostLabel(item: HostingWebhostEmailAccount) {
    return `${item.HostName} · ${item.DomainName}`;
  }

  quotaLabel(item: HostingWebhostEmailAccount) {
    return item.HweQuotaMb ? `${item.HweQuotaMb} MB` : 'Default';
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.resetPagination();
  }

  async loadHosts() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
        `${this.hostEndpoint}?limit=500&offset=0&isActive=1`,
      );
      this.hosts.set(result?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost hosts.'));
    }
  }

  private async fetchEmails(filters: WebhostEmailFilters): Promise<HostingWebhostEmailAccount[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.hostUUID) params.set('hostUUID', filters.hostUUID);
    if (filters.status) params.set('status', filters.status);
    if (filters.provisionStatus) params.set('provisionStatus', filters.provisionStatus);

    const result = await this.api.get<{ data?: { items?: HostingWebhostEmailAccount[] } }>(
      `${this.emailEndpoint}?${params.toString()}`,
    );
    const items = result?.data?.items ?? [];
    return items.map((item) => ({ ...item, HweConfig: this.parseConfig(item.HweConfig) }));
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  async startEdit(item: HostingWebhostEmailAccount) {
    let email = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingWebhostEmailAccount | null } }>(
        `${this.emailEndpoint}/${item.HweUUID}`,
      );
      if (result?.data?.item) {
        email = { ...result.data.item, HweConfig: this.parseConfig(result.data.item.HweConfig) };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost email.'));
    }

    const config = email.HweConfig ?? {};
    this.editing.set(email);
    this.emailFormModel.set({
      hostUUID: email.HostingWebhostHostHwhUUID,
      localPart: email.HweLocalPart,
      password: '',
      quotaMb: email.HweQuotaMb ?? 0,
      status: email.HweStatus,
      provisionStatus: email.HweProvisionStatus,
      autoProvision: config.autoProvision ? 1 : 0,
      notes: config.notes ?? '',
      isActive: email.HweIsActive === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    const values = this.emailFormModel();
    if (
      !this.emailForm().valid() ||
      (!this.editing() && values.autoProvision === 1 && !values.password.trim())
    ) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    this.saving.set(true);
    const payload = {
      hostUUID: values.hostUUID,
      localPart: values.localPart.trim(),
      password: values.password.trim() || undefined,
      quotaMb: this.numberOrNull(values.quotaMb),
      status: values.status,
      provisionStatus: values.provisionStatus,
      autoProvision: values.autoProvision === 1,
      config: this.buildConfigPayload(),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.emailEndpoint}/${editing.HweUUID}`, payload);
        this.snack.success('Webhost email updated.');
      } else {
        await this.api.post(this.emailEndpoint, payload);
        this.snack.success('Webhost email created.');
      }
      this.emailsResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save Webhost email.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  openPasswordAction(item: HostingWebhostEmailAccount, action: 'provision' | 'reset-password') {
    const passwordDialog = this.passwordDialog();
    if (!passwordDialog) return;
    this.passwordTarget.set(item);
    this.passwordAction.set(action);
    this.passwordFormModel.set({ password: '' });
    this.passwordDialogRef = this.dialog.open(passwordDialog, {
      width: 'min(520px, calc(100vw - 24px))',
      maxWidth: 'calc(100vw - 24px)',
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-webhost-password-dialog',
    });
  }

  closePasswordDialog() {
    this.passwordDialogRef?.close();
    this.passwordDialogRef = null;
    this.passwordTarget.set(null);
    this.passwordFormModel.set({ password: '' });
  }

  async submitPasswordAction() {
    if (!this.passwordForm().valid() || !this.passwordTarget()) {
      return;
    }
    const target = this.passwordTarget();
    if (!target) return;
    const action = this.passwordAction();
    this.actionEmailUUID.set(target.HweUUID);
    try {
      await this.api.post(`${this.emailEndpoint}/${target.HweUUID}/${action}`, {
        password: this.passwordFormModel().password,
      });
      this.snack.success(
        action === 'provision' ? 'Webhost email provisioning queued.' : 'Password reset queued.',
      );
      this.closePasswordDialog();
      this.emailsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to run email action.'));
    } finally {
      this.actionEmailUUID.set(null);
    }
  }

  async runAction(item: HostingWebhostEmailAccount, action: 'sync' | 'suspend' | 'unsuspend') {
    this.actionEmailUUID.set(item.HweUUID);
    try {
      await this.api.post(`${this.emailEndpoint}/${item.HweUUID}/${action}`, {});
      this.snack.success(`Webhost email ${action} queued.`);
      this.emailsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, `Failed to ${action} Webhost email.`));
    } finally {
      this.actionEmailUUID.set(null);
    }
  }

  async deprovision(item: HostingWebhostEmailAccount) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Deprovision Webhost email',
        message: `Remove "${item.HweEmail}" from the provider? The local record will remain for history.`,
        confirmLabel: 'Deprovision',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.actionEmailUUID.set(item.HweUUID);
    try {
      await this.api.post(`${this.emailEndpoint}/${item.HweUUID}/deprovision`, {});
      this.snack.success('Webhost email deprovision queued.');
      this.emailsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to deprovision Webhost email.'));
    } finally {
      this.actionEmailUUID.set(null);
    }
  }

  async remove(item: HostingWebhostEmailAccount) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Webhost email',
        message: `Are you sure you want to delete "${item.HweEmail}" locally?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.emailEndpoint}/${item.HweUUID}`);
      this.snack.success('Webhost email deleted.');
      this.emailsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete Webhost email.'));
    }
  }

  isSelected(item: HostingWebhostEmailAccount) {
    return this.selectedEmailUUIDs().has(item.HweUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleEmailSelection(item: HostingWebhostEmailAccount, checked: boolean) {
    this.selectedEmailUUIDs.update((current) => {
      const next = new Set(current);
      checked ? next.add(item.HweUUID) : next.delete(item.HweUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedEmailUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        checked ? next.add(row.HweUUID) : next.delete(row.HweUUID);
      }
      return next;
    });
  }

  async removeSelectedEmails() {
    const ids = Array.from(this.selectedEmailUUIDs());
    if (!ids.length) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected Webhost emails',
        message: `Are you sure you want to delete ${ids.length} selected Webhost email(s) locally?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const response = await this.api.delete<{
        data?: {
          deleted?: string[];
          failed?: { HostingWebhostEmailAccountUUID: string; message: string }[];
        };
      }>(`${this.emailEndpoint}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingWebhostEmailAccountUUID),
      );
      this.emails.update((rows) => rows.filter((row) => !deleted.has(row.HweUUID)));
      this.selectedEmailUUIDs.set(failed);
      this.emailsResource.reload();
      failed.size
        ? this.snack.error(`${failed.size} Webhost email(s) could not be deleted.`)
        : this.snack.success(`${deleted.size || ids.length} Webhost email(s) deleted.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected Webhost emails.'));
    }
  }

  private resetForm() {
    this.emailFormModel.set({
      hostUUID: '',
      localPart: '',
      password: '',
      quotaMb: 0,
      status: 'pending',
      provisionStatus: 'manual',
      autoProvision: 0,
      notes: '',
      isActive: 1,
    });
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileEmailSelection() {
    const available = new Set(this.emails().map((item) => item.HweUUID));
    this.selectedEmailUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: HostingWebhostEmailAccount[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const compared = this.compareValues(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? compared : -compared;
    });
  }

  private sortValue(item: HostingWebhostEmailAccount, column: string) {
    switch (column) {
      case 'email':
        return item.HweEmail;
      case 'host':
        return this.emailHostLabel(item);
      case 'provider':
        return `${item.ProviderName} ${item.HwlProvider}`;
      case 'quota':
        return item.HweQuotaMb ?? 0;
      case 'status':
        return this.statusLabel(item.HweStatus);
      case 'provision':
        return this.provisionLabel(item.HweProvisionStatus);
      case 'lastSync':
        return item.HweLastSyncAt ?? '';
      default:
        return '';
    }
  }

  private compareValues(
    a: string | number | null | undefined,
    b: string | number | null | undefined,
  ) {
    const left = a ?? '';
    const right = b ?? '';
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private numberOrNull(value: number | null | undefined): number | null {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
  }

  private normalizeString(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private parseConfig(value: unknown): WebhostEmailConfig | null {
    if (!value) return null;
    if (typeof value === 'object') return value as WebhostEmailConfig;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as WebhostEmailConfig) : null;
    } catch {
      return null;
    }
  }

  private buildConfigPayload(): WebhostEmailConfig {
    const values = this.emailFormModel();
    return {
      autoProvision: values.autoProvision === 1,
      notes: this.normalizeString(values.notes),
    };
  }

  private friendlyError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error || error.error?.message;
      return typeof serverMessage === 'string' && serverMessage.trim().length
        ? serverMessage
        : error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  private openDialog() {
    const emailFormDialog = this.emailFormDialog();
    if (!emailFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(emailFormDialog, {
      ...getWebhostDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-webhost-email-dialog',
    });
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntil(this.dialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelForm();
      });
    this.startDialogViewportObserver();
    this.dialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.dialogRef = null;
    });
  }

  private closeDialog() {
    if (!this.dialogRef) return;
    this.stopDialogViewportObserver();
    this.dialogRef.close();
    this.dialogRef = null;
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
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }
}
