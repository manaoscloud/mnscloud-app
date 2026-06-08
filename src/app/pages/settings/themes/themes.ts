import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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

import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

type ThemeDomain = {
  ThemeUUID: string;
  Domain: string;
  PageTitle: string;
  MetaDescription?: string | null;
  LogoUrl?: string | null;
  FaviconUrl?: string | null;
  PrimaryColor?: string | null;
  BrandingConfig?: string | null;
  ProvisionStatus?: string | null;
  ProvisionMessage?: string | null;
  ProvisionUpdatedAt?: string | null;
  UserUUID?: string | null;
  DateCreated?: string | null;
};

type ThemeListResponse = {
  status: string;
  message: string;
  data?: { items?: ThemeDomain[] };
  duration?: string;
};

type ProcStatusResult = { status: number | string; message: string; [k: string]: unknown };
type ThemeMutationResponse = {
  status: string;
  message: string;
  data?: ProcStatusResult[] | { items?: ProcStatusResult[] };
  duration?: string;
};

type ThemeJob = {
  JobUUID: string;
  ThemeUUID: string;
  Action: 'web' | 'cert';
  Status: string;
  Message?: string | null;
  DateUpdated?: string | null;
};

type ThemeJobListResponse = {
  status: string;
  message: string;
  data?: { items?: ThemeJob[] };
  duration?: string;
};

type ThemeJobQueueResponse = {
  status: string;
  message: string;
  data?: {
    jobUUID?: string;
    action?: 'web' | 'cert';
    status?: string;
    themeUUID?: string;
    domain?: string;
  };
  duration?: string;
};

const DOMAIN_REGEX = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

function domainValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').toString().trim().toLowerCase();
  if (!value) return null;

  if (
    value.includes('://') ||
    value.includes('/') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes(':')
  ) {
    return { domain: true };
  }

  if (/\s/.test(value)) return { domain: true };
  if (!DOMAIN_REGEX.test(value)) return { domain: true };
  return null;
}

function optionalHttpUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').toString().trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? null : { url: true };
  } catch {
    return { url: true };
  }
}

function optionalHexColorValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').toString().trim();
  if (!value) return null;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? null : { color: true };
}

@Component({
  selector: 'app-settings-themes',
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './themes.html',
  styleUrls: ['./themes.scss'],
  animations: [fadeIn],
})
export class SettingsThemesPage implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('domainFormDialog') domainFormDialog?: TemplateRef<unknown>;

  private dialogBinding: CrudDialogBinding | null = null;

  readonly domains = signal<ThemeDomain[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<ThemeDomain | null>(null);
  readonly actionLoading = signal<Record<string, { web?: boolean; cert?: boolean }>>({});
  readonly jobs = signal<Record<string, { web?: ThemeJob; cert?: ThemeJob }>>({});
  readonly selectedThemeUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedThemeUUIDs().size);
  readonly dataSource = new MatTableDataSource<ThemeDomain>([]);

  readonly displayedColumns = ['select', 'domain', 'title', 'web', 'certificate', 'actions'];
  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
    status: [''],
  });
  readonly domainForm = this.fb.nonNullable.group({
    domain: ['', [Validators.required, domainValidator]],
    pageTitle: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    metaDescription: ['', [Validators.maxLength(255)]],
    logoUrl: ['', [optionalHttpUrlValidator, Validators.maxLength(500)]],
    faviconUrl: ['', [optionalHttpUrlValidator, Validators.maxLength(500)]],
    primaryColor: ['', [optionalHexColorValidator]],
  });

  constructor() {
    this.dataSource.filterPredicate = (data, filter) => {
      const parsed = this.parseFilter(filter);
      const search = parsed.search.trim().toLowerCase();
      const status = parsed.status;
      const matchesSearch =
        !search ||
        data.Domain.toLowerCase().includes(search) ||
        data.PageTitle.toLowerCase().includes(search);
      const matchesStatus =
        !status ||
        this.getJobStatus(data, 'web') === status ||
        this.getJobStatus(data, 'cert') === status;
      return matchesSearch && matchesStatus;
    };
    this.dataSource.sortingDataAccessor = (item, column) => this.sortValue(item, column);
    this.refreshList();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    void this.loadDomains();
  }

  applyFilters() {
    const values = this.filterForm.getRawValue();
    this.dataSource.filter = JSON.stringify(values);
    this.paginator?.firstPage();
    this.reconcileThemeSelection();
  }

  clearFilters() {
    this.filterForm.reset({ search: '', status: '' });
    this.applyFilters();
  }

  async loadDomains() {
    this.loading.set(true);
    const start = performance.now();

    try {
      const resp = await this.api.get<ThemeListResponse>('settings/themes');
      const items = resp?.data?.items ?? [];
      this.domains.set(items);
      this.dataSource.data = items;
      this.applyFilters();
      await this.loadJobs();
    } catch (error: unknown) {
      this.snack.error(this.friendlyError(error, 'Failed to load domains.'));
    } finally {
      this.finishLoading(start);
    }
  }

  async loadJobs() {
    try {
      const resp = await this.api.get<ThemeJobListResponse>('settings/themes/jobs');
      const items = resp?.data?.items ?? [];
      const next: Record<string, { web?: ThemeJob; cert?: ThemeJob }> = {};
      for (const job of items) {
        const action = job.Action;
        if (!action) continue;
        next[job.ThemeUUID] = {
          ...next[job.ThemeUUID],
          [action]: job,
        };
      }
      this.jobs.set(next);
      this.dataSource._updateChangeSubscription();
    } catch {
      // Job status is optional for the list.
    }
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  startEdit(item: ThemeDomain) {
    this.editing.set(item);
    this.domainForm.reset({
      domain: item.Domain,
      pageTitle: item.PageTitle,
      metaDescription: item.MetaDescription ?? '',
      logoUrl: item.LogoUrl ?? '',
      faviconUrl: item.FaviconUrl ?? '',
      primaryColor: item.PrimaryColor ?? '',
    });
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    this.domainForm.markAllAsTouched();
    if (this.domainForm.invalid) return;

    const values = this.domainForm.getRawValue();
    const domain = this.normalizeDomain(values.domain);
    const pageTitle = values.pageTitle?.trim();

    if (!domain || !pageTitle) {
      this.snack.warning('Please provide a valid domain and page title.');
      return;
    }

    if (!this.auth.getToken()) {
      this.snack.error('Session expired. Please sign in again.');
      return;
    }

    this.saving.set(true);

    try {
      const editingItem = this.editing();
      const payload = {
        domain,
        pageTitle,
        metaDescription: this.emptyToNull(values.metaDescription),
        logoUrl: this.emptyToNull(values.logoUrl),
        faviconUrl: this.emptyToNull(values.faviconUrl),
        primaryColor: this.emptyToNull(values.primaryColor)?.toLowerCase() ?? null,
      };

      if (editingItem) {
        await this.api.put<ThemeMutationResponse>(
          `settings/themes/${editingItem.ThemeUUID}`,
          payload,
        );
        this.snack.success('Domain updated successfully.');
      } else {
        await this.api.post<ThemeMutationResponse>('settings/themes', payload);
        this.snack.success('Domain created successfully.');
      }

      await this.loadDomains();
      if (closeAfterSave || editingItem) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error: unknown) {
      this.snack.error(this.friendlyError(error, 'Failed to save domain.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async delete(item: ThemeDomain) {
    if (this.saving()) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete theme domain',
        message: `Delete domain "${item.Domain}" and queue provider cleanup?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.saving.set(true);
    try {
      await this.api.delete<ThemeMutationResponse>(`settings/themes/${item.ThemeUUID}`);
      this.domains.update((rows) => rows.filter((row) => row.ThemeUUID !== item.ThemeUUID));
      this.dataSource.data = this.domains();
      this.selectedThemeUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(item.ThemeUUID);
        return next;
      });
      await this.loadDomains();
      if (this.editing()?.ThemeUUID === item.ThemeUUID) this.cancelForm();
      this.snack.success('Domain deleted successfully.');
    } catch (error: unknown) {
      this.snack.error(this.friendlyError(error, 'Failed to delete domain.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedThemeUUIDs());
    if (!ids.length || this.saving()) return;
    const labels = this.domains()
      .filter((item) => ids.includes(item.ThemeUUID))
      .slice(0, 3)
      .map((item) => item.Domain);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected theme domains',
        message: `Delete ${ids.length} selected theme domain(s) and queue provider cleanup?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.saving.set(true);

    try {
      const response = await this.api.delete<{
        data?: { deleted?: string[]; failed?: { ThemeUUID: string; message: string }[] };
      }>('settings/themes/bulk', { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set((response?.data?.failed ?? []).map((item) => item.ThemeUUID));
      this.domains.update((rows) => rows.filter((row) => !deleted.has(row.ThemeUUID)));
      this.dataSource.data = this.domains();
      this.selectedThemeUUIDs.set(failed);
      await this.loadDomains();
      failed.size
        ? this.snack.error(`${failed.size} theme domain(s) could not be deleted.`)
        : this.snack.success(`${deleted.size || ids.length} theme domain(s) deleted.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected theme domains.'));
    } finally {
      this.saving.set(false);
    }
  }

  isSelected(item: ThemeDomain) {
    return this.selectedThemeUUIDs().has(item.ThemeUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleThemeSelection(item: ThemeDomain, checked: boolean) {
    this.selectedThemeUUIDs.update((current) => {
      const next = new Set(current);
      checked ? next.add(item.ThemeUUID) : next.delete(item.ThemeUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedThemeUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        checked ? next.add(row.ThemeUUID) : next.delete(row.ThemeUUID);
      }
      return next;
    });
  }

  isActionBusy(item: ThemeDomain, key: 'web' | 'cert') {
    return this.actionLoading()[item.ThemeUUID]?.[key] ?? false;
  }

  async sendWeb(item: ThemeDomain) {
    await this.queueAction(item, 'web');
  }

  async sendCertificate(item: ThemeDomain) {
    await this.queueAction(item, 'cert');
  }

  getJobStatus(item: ThemeDomain, action: 'web' | 'cert') {
    const job = this.jobs()[item.ThemeUUID]?.[action];
    return job?.Status ?? 'idle';
  }

  statusClass(status: string) {
    switch (status) {
      case 'queued':
        return 'is-queued';
      case 'running':
      case 'provisioning':
        return 'is-running';
      case 'done':
      case 'active':
        return 'is-active';
      case 'failed':
        return 'is-failed';
      default:
        return 'is-inactive';
    }
  }

  statusLabel(status: string) {
    return status.trim().toUpperCase();
  }

  private setActionBusy(themeUUID: string, key: 'web' | 'cert', value: boolean) {
    this.actionLoading.update((current) => ({
      ...current,
      [themeUUID]: { ...current[themeUUID], [key]: value },
    }));
  }

  private async queueAction(item: ThemeDomain, action: 'web' | 'cert') {
    if (this.isActionBusy(item, action) || this.saving()) return;

    if (!this.auth.getToken()) {
      this.snack.error('Session expired. Please sign in again.');
      return;
    }

    this.setActionBusy(item.ThemeUUID, action, true);

    const endpoint =
      action === 'web'
        ? `settings/themes/${item.ThemeUUID}/web`
        : `settings/themes/${item.ThemeUUID}/certificate`;

    try {
      const resp = await this.api.post<ThemeJobQueueResponse>(endpoint, {});
      const jobData = resp?.data;
      if (jobData?.jobUUID && jobData?.action && jobData?.themeUUID) {
        const job: ThemeJob = {
          JobUUID: jobData.jobUUID,
          ThemeUUID: jobData.themeUUID,
          Action: jobData.action,
          Status: jobData.status ?? 'queued',
          Message: null,
          DateUpdated: new Date().toISOString(),
        };
        this.jobs.update((current) => ({
          ...current,
          [job.ThemeUUID]: { ...current[job.ThemeUUID], [job.Action]: job },
        }));
        this.dataSource._updateChangeSubscription();
      }
      this.snack.success(
        action === 'web'
          ? `Web event queued for ${item.Domain}.`
          : `Certificate event queued for ${item.Domain}.`,
      );
    } catch (error: unknown) {
      this.snack.error(this.friendlyError(error, 'Failed to queue action.'));
    } finally {
      this.setActionBusy(item.ThemeUUID, action, false);
    }
  }

  private normalizeDomain(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const value = raw.trim().toLowerCase();
    if (
      value.includes('://') ||
      value.includes('/') ||
      value.includes('?') ||
      value.includes('#') ||
      value.includes(':')
    ) {
      return null;
    }
    if (/\s/.test(value)) return null;
    if (!DOMAIN_REGEX.test(value)) return null;
    return value;
  }

  private resetForm() {
    this.domainForm.reset({
      domain: '',
      pageTitle: '',
      metaDescription: '',
      logoUrl: '',
      faviconUrl: '',
      primaryColor: '',
    });
  }

  private emptyToNull(value: string | null | undefined) {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : null;
  }

  private visibleRows() {
    const pageIndex = this.paginator?.pageIndex ?? 0;
    const pageSize = this.paginator?.pageSize ?? this.dataSource.filteredData.length;
    const rows = this.sortFilteredRows(this.dataSource.filteredData);
    return rows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);
  }

  private sortFilteredRows(rows: ThemeDomain[]) {
    const active = this.sort?.active;
    const direction = this.sort?.direction;
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const compared = this.compareValues(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? compared : -compared;
    });
  }

  private reconcileThemeSelection() {
    const available = new Set(this.dataSource.filteredData.map((item) => item.ThemeUUID));
    this.selectedThemeUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortValue(item: ThemeDomain, column: string) {
    switch (column) {
      case 'domain':
        return item.Domain;
      case 'title':
        return item.PageTitle;
      case 'web':
        return this.getJobStatus(item, 'web');
      case 'certificate':
        return this.getJobStatus(item, 'cert');
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

  private parseFilter(filter: string) {
    try {
      const parsed = JSON.parse(filter || '{}') as { search?: string; status?: string };
      return {
        search: typeof parsed.search === 'string' ? parsed.search : '',
        status: typeof parsed.status === 'string' ? parsed.status : '',
      };
    } catch {
      return { search: '', status: '' };
    }
  }

  private finishLoading(start: number) {
    const elapsed = performance.now() - start;
    const waitMs = Math.max(0, 600 - elapsed);
    if (waitMs) {
      setTimeout(() => this.loading.set(false), waitMs);
      return;
    }
    this.loading.set(false);
  }

  private friendlyError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error || error.error?.message;
      return typeof serverMessage === 'string' && serverMessage.trim().length
        ? serverMessage
        : error.message || fallback;
    }
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }

  private openDialog() {
    if (!this.domainFormDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.domainFormDialog,
      'settings-theme-domain-dialog',
    );
    this.dialogBinding.ref.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelForm();
    });
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  private closeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.stop();
    this.dialogBinding.ref.close();
    this.dialogBinding = null;
  }
}
