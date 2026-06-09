import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { AppI18nService } from '../../../services/app-i18n.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  CyberSecurityProtectedService,
  CyberSecurityProtectedServicePayload,
  CyberSecurityServicesService,
} from './cyber-security-services.service';

@Component({
  selector: 'app-cyber-security-services',
  standalone: true,
  imports: [
    FormsModule,
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
  templateUrl: './services.html',
  styleUrls: ['./services.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class CyberSecurityServicesPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(CyberSecurityServicesService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 1000;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<CyberSecurityProtectedService | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedServiceUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<CyberSecurityProtectedService>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'slug',
    'ports',
    'logs',
    'collections',
    'status',
    'actions',
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9][a-z0-9-]*$/)]],
    description: [''],
    defaultPorts: ['[]', [Validators.required]],
    logPaths: ['[]', [Validators.required]],
    crowdsecCollections: ['[]', [Validators.required]],
    enabled: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly serviceFormDialog = viewChild<TemplateRef<unknown>>('serviceFormDialog');

  private serviceDialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name ?? '';
        case 'slug':
          return data.slug ?? '';
        case 'ports':
          return this.formatPorts(data.defaultPorts);
        case 'logs':
          return this.formatList(data.logPaths);
        case 'collections':
          return this.formatList(data.crowdsecCollections);
        case 'status':
          return this.isActive(data) ? 'ACTIVE' : 'INACTIVE';
        default:
          return '';
      }
    };

    setTimeout(() => {
      void this.loadItems();
    }, 0);
  }

  ngOnDestroy() {
    this.closeServiceDialog();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    void this.loadItems();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    void this.loadItems();
  }

  refreshList() {
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    const started = performance.now();
    try {
      const response = await this.api.list(this.search(), this.listLimit);
      this.dataSource.data = response.items;
      const paginator = this.paginator();
      if (paginator) paginator.firstPage();
      this.reconcileSelection();
    } catch (error: any) {
      this.dataSource.data = [];
      this.reconcileSelection();
      this.snack.error(this.extractErrorMessage(error, 'Failed to load protected services.'));
    } finally {
      const elapsed = performance.now() - started;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) setTimeout(() => this.loading.set(false), waitMs);
      else this.loading.set(false);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '',
      slug: '',
      description: '',
      defaultPorts: '[]',
      logPaths: '[]',
      crowdsecCollections: '[]',
      enabled: 1,
    });
    this.openServiceDialog();
  }

  startEdit(service: CyberSecurityProtectedService) {
    this.editing.set(service);
    this.form.reset({
      name: service.name ?? '',
      slug: service.slug ?? '',
      description: service.description ?? '',
      defaultPorts: this.pretty(service.defaultPorts ?? []),
      logPaths: this.pretty(service.logPaths ?? []),
      crowdsecCollections: this.pretty(service.crowdsecCollections ?? []),
      enabled: this.isActive(service) ? 1 : 0,
    });
    this.openServiceDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;

    let payload: CyberSecurityProtectedServicePayload;
    try {
      payload = this.buildPayload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Invalid form data.'));
      return;
    }

    const createMode = !this.editing();
    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing?.uuid) {
        await this.api.update(editing.uuid, payload);
        this.snack.success('Protected service updated successfully.');
      } else {
        await this.api.create(payload);
        this.snack.success('Protected service created successfully.');
      }

      await this.loadItems();

      if (saveAndNew && createMode) {
        this.form.reset({
          name: '',
          slug: '',
          description: '',
          defaultPorts: '[]',
          logPaths: '[]',
          crowdsecCollections: '[]',
          enabled: 1,
        });
        this.editing.set(null);
        return;
      }

      this.cancelForm();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to save protected service.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeServiceDialog();
    this.form.reset({
      name: '',
      slug: '',
      description: '',
      defaultPorts: '[]',
      logPaths: '[]',
      crowdsecCollections: '[]',
      enabled: 1,
    });
    this.editing.set(null);
  }

  async deleteItem(service: CyberSecurityProtectedService) {
    if (!service.uuid) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete protected service'),
        message: `${this.t('Are you sure you want to delete')} "${service.name || service.slug}"?`,
        confirmLabel: this.t('Delete'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      await this.api.remove(service.uuid);
      this.snack.success('Protected service deleted successfully.');
      await this.loadItems();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to delete protected service.'));
    } finally {
      this.loading.set(false);
    }
  }

  get selectedCount() {
    return this.selectedServiceUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(service: CyberSecurityProtectedService) {
    return !!service.uuid && this.selectedServiceUUIDs().has(service.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleServiceSelection(service: CyberSecurityProtectedService, checked: boolean) {
    if (!service.uuid) return;
    this.selectedServiceUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(service.uuid as string);
      else next.delete(service.uuid as string);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedServiceUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (!row.uuid) continue;
        if (checked) next.add(row.uuid);
        else next.delete(row.uuid);
      }
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedServiceUUIDs());
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.uuid))
      .slice(0, 3)
      .map((item) => item.name || item.slug);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete selected protected services'),
        message: `${this.t('Are you sure you want to delete selected protected service(s)?')} ${ids.length}${suffix}`,
        confirmLabel: this.t('Delete selected'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedServiceUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(
          `${failed.size} ${this.t('selected protected service(s) could not be deleted.')}`,
        );
      } else {
        this.snack.success(
          `${deleted.size || ids.length} ${this.t('selected protected service(s) deleted.')}`,
        );
      }
      await this.loadItems();
    } catch (error: any) {
      this.snack.error(
        this.extractErrorMessage(error, 'Failed to delete selected protected services.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  isActive(service: CyberSecurityProtectedService) {
    const value = String(service.enabled ?? '').toLowerCase();
    return value === '1' || value === 'true' || value === 'active';
  }

  formatList(value: unknown) {
    if (!value) return '-';
    if (Array.isArray(value)) return value.map((item) => String(item)).join(', ') || '-';
    return String(value);
  }

  formatPorts(value: unknown) {
    if (!Array.isArray(value)) return this.formatList(value);
    const ports = value.map((item) => {
      if (!item || typeof item !== 'object') return String(item);
      const entry = item as Record<string, unknown>;
      const protocol = String(entry['protocol'] ?? '').toUpperCase();
      const port = entry['port'] ?? entry['range'] ?? '';
      return [protocol, port].filter(Boolean).join(' ');
    });
    return ports.join(', ') || '-';
  }

  private buildPayload(): CyberSecurityProtectedServicePayload {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      slug: value.slug.trim().toLowerCase(),
      description: value.description.trim() || null,
      defaultPorts: this.parseJson(value.defaultPorts, 'Default ports'),
      logPaths: this.parseJson(value.logPaths, 'Log paths'),
      crowdsecCollections: this.parseJson(value.crowdsecCollections, 'CrowdSec collections'),
      enabled: Number(value.enabled) ? 1 : 0,
    };
  }

  private parseJson(value: string, label: string) {
    try {
      return JSON.parse(value || 'null');
    } catch {
      throw new Error(`${this.t(label)} ${this.t('must be valid JSON.')}`);
    }
  }

  private t(value: string) {
    return this.i18n.t(value);
  }

  private pretty(value: unknown) {
    return JSON.stringify(value ?? null, null, 2);
  }

  private openServiceDialog() {
    const serviceFormDialog = this.serviceFormDialog();
    if (!serviceFormDialog || this.serviceDialogBinding) return;
    this.serviceDialogBinding = openCrudTemplateDialog(
      this.dialog,
      serviceFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.serviceDialogBinding.ref.afterClosed().subscribe(() => {
      this.serviceDialogBinding?.stop();
      this.serviceDialogBinding = null;
    });
  }

  private closeServiceDialog() {
    if (!this.serviceDialogBinding) return;
    this.serviceDialogBinding.ref.close();
    this.serviceDialogBinding.stop();
    this.serviceDialogBinding = null;
  }

  private extractErrorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.CyberSecurityServiceUUID === 'string') return item.CyberSecurityServiceUUID;
    if (typeof item.uuid === 'string') return item.uuid;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.uuid));
    this.selectedServiceUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
