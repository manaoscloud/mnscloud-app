import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';

import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
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
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import {
  CyberSecurityProtectedService,
  CyberSecurityServicesService,
} from '../services/cyber-security-services.service';
import {
  CyberSecurityProfile,
  CyberSecurityProfilePayload,
  CyberSecurityProfilesService,
} from './cyber-security-profiles.service';

type CyberSecurityProfilesSnapshot = {
  profiles: CyberSecurityProfile[];
  services: CyberSecurityProtectedService[];
};

@Component({
  selector: 'app-cyber-security-profiles',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
})
export class CyberSecurityProfilesPage {
  private readonly profilesApi = inject(CyberSecurityProfilesService);
  private readonly servicesApi = inject(CyberSecurityServicesService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly listLimit = 1000;

  readonly saving = signal(false);
  private readonly mutating = signal(false);
  readonly editing = signal<CyberSecurityProfile | null>(null);
  readonly serviceSearch = signal('');
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedProfileUUIDs = signal<Set<string>>(new Set());
  private readonly profilesResource = resource({
    params: () => this.search(),
    defaultValue: { profiles: [], services: [] } as CyberSecurityProfilesSnapshot,
    loader: ({ params }) => this.loadProfilesSnapshot(params),
  });

  readonly loading = computed(() => this.profilesResource.isLoading() || this.mutating());
  readonly services = computed(() => this.profilesResource.value().services);

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

  readonly formModel = signal({
    name: '',
    mode: 'monitor',
    level: 'balanced',
    defaultDecisionDuration: '4h',
    serviceUUIDs: [] as string[],
    description: '',
    trustedNetworks: '[]',
    rules: '{}',
    enabled: 1,
  });
  readonly form = createForm(this.formModel, (path) => {
    required(path.name);
    minLength(path.name, 2);
    required(path.mode);
    required(path.level);
    required(path.defaultDecisionDuration);
    required(path.trustedNetworks);
    required(path.rules);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly profileFormDialog = viewChild<TemplateRef<unknown>>('profileFormDialog');

  private profileDialogBinding: CrudDialogBinding | null = null;
  private lastLoadError = '';

  private readonly syncProfiles = effect(() => {
    this.dataSource.data = this.profilesResource.value().profiles;
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadError = effect(() => {
    const error = this.profilesResource.error();
    if (!error) {
      this.lastLoadError = '';
      return;
    }

    const message = this.extractErrorMessage(error, 'Failed to load security profiles.');
    if (message !== this.lastLoadError) {
      this.lastLoadError = message;
      this.snack.error(message);
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
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
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeProfileDialog());
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    if (nextSearch === this.search()) {
      this.profilesResource.reload();
    } else {
      this.search.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    if (this.search()) {
      this.search.set('');
    } else {
      this.profilesResource.reload();
    }
  }

  clearServiceSearch(open: boolean) {
    if (!open) this.serviceSearch.set('');
  }

  refreshList() {
    this.profilesResource.reload();
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set({
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
    if (!this.form().valid()) return;

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

      this.profilesResource.reload();

      if (saveAndNew && createMode) {
        this.formModel.set({
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
    this.formModel.set({
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

    this.mutating.set(true);
    try {
      await this.profilesApi.remove(profile.uuid);
      this.snack.success('Security profile deleted successfully.');
      this.profilesResource.reload();
    } catch (error: any) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to delete security profile.'));
    } finally {
      this.mutating.set(false);
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

    this.mutating.set(true);
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
      this.profilesResource.reload();
    } catch (error: any) {
      this.snack.error(
        this.extractErrorMessage(error, 'Failed to delete selected security profiles.'),
      );
    } finally {
      this.mutating.set(false);
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
    this.formModel.set({
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
    const value = this.formModel();
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

  private async loadProfilesSnapshot(search: string): Promise<CyberSecurityProfilesSnapshot> {
    const [profiles, services] = await Promise.all([
      this.profilesApi.list(search, this.listLimit),
      this.servicesApi.list('', this.listLimit),
    ]);
    const paginator = this.paginator();
    if (paginator) queueMicrotask(() => paginator.firstPage());
    return {
      profiles: profiles.items,
      services: services.items,
    };
  }

  private openProfileDialog() {
    const profileFormDialog = this.profileFormDialog();
    if (!profileFormDialog || this.profileDialogBinding) return;
    this.profileDialogBinding = openCrudTemplateDialog(
      this.dialog,
      profileFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    bindDialogClosed(this.profileDialogBinding.ref, () => {
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
