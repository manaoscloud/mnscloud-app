import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
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
  CyberSecurityServicesService,
} from '../services/cyber-security-services.service';
import {
  CyberSecurityProfile,
  CyberSecurityProfilePayload,
  CyberSecurityProfilesService,
} from './cyber-security-profiles.service';

@Component({
  selector: 'app-cyber-security-profiles',
  standalone: true,
  imports: [
    FormsModule,
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
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './profiles.html',
  styleUrls: ['./profiles.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class CyberSecurityProfilesPage implements AfterViewInit, OnDestroy {
  private readonly profilesApi = inject(CyberSecurityProfilesService);
  private readonly servicesApi = inject(CyberSecurityServicesService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 1000;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<CyberSecurityProfile | null>(null);
  readonly services = signal<CyberSecurityProtectedService[]>([]);
  readonly serviceSearch = signal('');
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedProfileUUIDs = signal<Set<string>>(new Set());

  readonly filteredServices = computed(() => {
    const search = this.serviceSearch().trim().toLowerCase();
    if (!search) return this.services();
    return this.services().filter((service) =>
      `${service.name ?? ''} ${service.slug ?? ''} ${service.description ?? ''}`
        .toLowerCase()
        .includes(search),
    );
  });

  readonly dataSource = new MatTableDataSource<CyberSecurityProfile>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'mode',
    'level',
    'services',
    'duration',
    'status',
    'actions',
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    mode: ['monitor', [Validators.required]],
    level: ['balanced', [Validators.required]],
    defaultDecisionDuration: ['4h', [Validators.required]],
    serviceUUIDs: [[] as string[]],
    description: [''],
    trustedNetworks: ['[]', [Validators.required]],
    rules: ['{}', [Validators.required]],
    enabled: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('profileFormDialog') profileFormDialog?: TemplateRef<unknown>;

  private profileDialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.name ?? '';
        case 'mode':
          return data.mode ?? '';
        case 'level':
          return data.level ?? '';
        case 'services':
          return data.serviceSlugs ?? '';
        case 'duration':
          return data.defaultDecisionDuration ?? '';
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
    this.closeProfileDialog();
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

  clearServiceSearch(open: boolean) {
    if (!open) this.serviceSearch.set('');
  }

  refreshList() {
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    const started = performance.now();
    try {
      const [profiles, services] = await Promise.all([
        this.profilesApi.list(this.search(), this.listLimit),
        this.servicesApi.list('', this.listLimit),
      ]);
      this.dataSource.data = profiles.items;
      this.services.set(services.items);
      if (this.paginator) this.paginator.firstPage();
      this.reconcileSelection();
    } catch (error: any) {
      this.dataSource.data = [];
      this.services.set([]);
      this.reconcileSelection();
      this.snack.error(this.extractErrorMessage(error, 'Failed to load security profiles.'));
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
      mode: 'monitor',
      level: 'balanced',
      defaultDecisionDuration: '4h',
      serviceUUIDs: [],
      description: '',
      trustedNetworks: '[]',
      rules: '{}',
      enabled: 1,
    });
    this.openProfileDialog();
  }

  startEdit(profile: CyberSecurityProfile) {
    this.editing.set(profile);
    this.fillForm(profile, profile.name ?? '');
    this.openProfileDialog();
  }

  duplicateProfile(profile: CyberSecurityProfile) {
    this.editing.set(null);
    this.fillForm(profile, this.nextProfileCopyName(profile.name ?? this.t('Security Profile')));
    this.openProfileDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;

    let payload: CyberSecurityProfilePayload;
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
        await this.profilesApi.update(editing.uuid, payload);
        this.snack.success('Security profile updated successfully.');
      } else {
        await this.profilesApi.create(payload);
        this.snack.success('Security profile created successfully.');
      }

      await this.loadItems();

      if (saveAndNew && createMode) {
        this.form.reset({
          name: '',
          mode: 'monitor',
          level: 'balanced',
          defaultDecisionDuration: '4h',
          serviceUUIDs: [],
          description: '',
          trustedNetworks: '[]',
          rules: '{}',
          enabled: 1,
        });
        this.editing.set(null);
        return;
      }

      this.cancelForm();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to save security profile.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeProfileDialog();
    this.form.reset({
      name: '',
      mode: 'monitor',
      level: 'balanced',
      defaultDecisionDuration: '4h',
      serviceUUIDs: [],
      description: '',
      trustedNetworks: '[]',
      rules: '{}',
      enabled: 1,
    });
    this.editing.set(null);
  }

  async deleteItem(profile: CyberSecurityProfile) {
    if (!profile.uuid) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete security profile'),
        message: `${this.t('Are you sure you want to delete')} "${profile.name}"?`,
        confirmLabel: this.t('Delete'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      await this.profilesApi.remove(profile.uuid);
      this.snack.success('Security profile deleted successfully.');
      await this.loadItems();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to delete security profile.'));
    } finally {
      this.loading.set(false);
    }
  }

  get selectedCount() {
    return this.selectedProfileUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(profile: CyberSecurityProfile) {
    return !!profile.uuid && this.selectedProfileUUIDs().has(profile.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProfileSelection(profile: CyberSecurityProfile, checked: boolean) {
    if (!profile.uuid) return;
    this.selectedProfileUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) next.add(profile.uuid as string);
      else next.delete(profile.uuid as string);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedProfileUUIDs.update((current) => {
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
    const ids = Array.from(this.selectedProfileUUIDs());
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.uuid))
      .slice(0, 3)
      .map((item) => item.name);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: this.t('Delete selected security profiles'),
        message: `${this.t('Are you sure you want to delete selected security profile(s)?')} ${ids.length}${suffix}`,
        confirmLabel: this.t('Delete selected'),
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const response = await this.profilesApi.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
      this.selectedProfileUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(
          `${failed.size} ${this.t('selected security profile(s) could not be deleted.')}`,
        );
      } else {
        this.snack.success(
          `${deleted.size || ids.length} ${this.t('selected security profile(s) deleted.')}`,
        );
      }
      await this.loadItems();
    } catch (error: any) {
      this.snack.error(
        this.extractErrorMessage(error, 'Failed to delete selected security profiles.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  isActive(profile: CyberSecurityProfile) {
    const value = String(profile.enabled ?? '').toLowerCase();
    return value === '1' || value === 'true' || value === 'active';
  }

  serviceLabel(uuid: string) {
    const service = this.services().find((item) => item.uuid === uuid);
    return service?.slug || service?.name || uuid;
  }

  private fillForm(profile: CyberSecurityProfile, name: string) {
    this.form.reset({
      name,
      mode: profile.mode ?? 'monitor',
      level: profile.level ?? 'balanced',
      defaultDecisionDuration: profile.defaultDecisionDuration ?? '4h',
      serviceUUIDs: this.serviceUUIDsFromSlugs(profile.serviceSlugs),
      description: profile.description ?? '',
      trustedNetworks: this.pretty(profile.trustedNetworks ?? []),
      rules: this.pretty(profile.rules ?? {}),
      enabled: this.isActive(profile) ? 1 : 0,
    });
  }

  private buildPayload(): CyberSecurityProfilePayload {
    const value = this.form.getRawValue();
    return {
      name: value.name.trim(),
      description: value.description.trim() || null,
      mode: value.mode,
      level: value.level,
      defaultDecisionDuration: value.defaultDecisionDuration.trim() || '4h',
      serviceUUIDs: value.serviceUUIDs,
      trustedNetworks: this.parseJson(value.trustedNetworks, 'Trusted networks'),
      rules: this.parseJson(value.rules, 'Rules'),
      enabled: Number(value.enabled) ? 1 : 0,
    };
  }

  private serviceUUIDsFromSlugs(serviceSlugs: string | null | undefined) {
    const slugs = String(serviceSlugs ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);
    return slugs
      .map((slug) => this.services().find((service) => service.slug === slug)?.uuid)
      .filter((uuid): uuid is string => !!uuid);
  }

  private nextProfileCopyName(baseName: string) {
    const names = new Set(
      this.dataSource.data
        .map((profile) =>
          String(profile.name ?? '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const base = `${baseName} ${this.t('Copy')}`;
    if (!names.has(base.toLowerCase())) return base;
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base} ${index}`;
      if (!names.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${Date.now()}`;
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

  private openProfileDialog() {
    if (!this.profileFormDialog || this.profileDialogBinding) return;
    this.profileDialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.profileFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.profileDialogBinding.ref.afterClosed().subscribe(() => {
      this.profileDialogBinding?.stop();
      this.profileDialogBinding = null;
    });
  }

  private closeProfileDialog() {
    if (!this.profileDialogBinding) return;
    this.profileDialogBinding.ref.close();
    this.profileDialogBinding.stop();
    this.profileDialogBinding = null;
  }

  private extractErrorMessage(error: any, fallback: string) {
    return error?.error?.error || error?.error?.message || error?.message || fallback;
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.CyberSecurityProfileUUID === 'string') return item.CyberSecurityProfileUUID;
    if (typeof item.uuid === 'string') return item.uuid;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.uuid));
    this.selectedProfileUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
