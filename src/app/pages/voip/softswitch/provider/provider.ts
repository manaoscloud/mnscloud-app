import {
  AfterViewInit,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
  TemplateRef,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { VoipSoftswitchProviderItem, VoipSoftswitchProviderService } from './provider.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';

type SoftswitchEngine = 'kamailio' | 'opensips' | 'sippulse' | 'vsc' | 'custom';

@Component({
  selector: 'app-voip-softswitch-provider',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
  ],
  templateUrl: './provider.html',
  styleUrls: ['./provider.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipSoftswitchProviderPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipSoftswitchProviderService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly pageTitle = computed(() => 'Softswitch Provider');
  readonly pageSubtitle = computed(() =>
    this.isMaster()
      ? 'Manage provider catalog used by all tenants.'
      : 'Manage provider catalog used by your Softswitch accounts.',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipSoftswitchProviderItem | null>(null);

  readonly dataSource = new MatTableDataSource<VoipSoftswitchProviderItem>([]);
  readonly displayedColumns = ['select', 'name', 'engine', 'status', 'actions'];
  readonly selectedProviderUUIDs = new Set<string>();
  search = '';
  searchInput = '';

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly engineOptions: Array<{ value: SoftswitchEngine; label: string }> = [
    { value: 'kamailio', label: 'Kamailio' },
    { value: 'opensips', label: 'OpenSIPS' },
    { value: 'sippulse', label: 'SipPulse' },
    { value: 'vsc', label: 'VSC' },
    { value: 'custom', label: 'Custom' },
  ];

  private readonly engineDefaultCodecs: Record<SoftswitchEngine, string[]> = {
    kamailio: ['OPUS', 'PCMU', 'PCMA', 'G729', 'GSM', 'G722', 'ILBC', 'SPEEX'],
    opensips: ['OPUS', 'ULAW', 'ALAW', 'G722', 'G729', 'GSM'],
    sippulse: ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'],
    vsc: ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'],
    custom: ['OPUS', 'PCMU', 'PCMA'],
  };

  codecOptions: string[] = this.engineDefaultCodecs['kamailio'];
  readonly defaultCodecSearch = signal('');

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    engine: ['kamailio' as SoftswitchEngine, [Validators.required]],
    baseUrl: [''],
    defaultCodecs: [[] as string[]],
    apiKey: [''],
    apiSecret: [''],
    status: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly providerFormDialog = viewChild<TemplateRef<unknown>>('providerFormDialog');
  private providerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.VspName ?? '';
        case 'engine':
          return this.engineLabel(data.VspEngine);
        case 'status':
          return data.VspStatus === 1 ? 'active' : 'inactive';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const statusLabel = data.VspStatus === 1 ? 'active' : 'inactive';
      return [data.VspName, data.VspEngine, this.engineLabel(data.VspEngine), statusLabel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => void this.loadProviders(), 0);
  }

  ngOnDestroy() {
    this.closeProviderDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadProviders();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadProviders();
  }

  async loadProviders() {
    this.loading.set(true);
    const start = performance.now();

    try {
      const response = await this.api.list(this.isMaster(), {
        search: this.search || undefined,
        limit: this.listLimit,
      });
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
      this.dataSource.filter = '';
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to load providers.'));
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  refreshList() {
    void this.loadProviders();
  }

  startCreate() {
    this.resetForm();
    this.updateCodecOptions(this.form.controls.engine.value);
    this.openProviderDialog();
  }

  startEdit(item: VoipSoftswitchProviderItem) {
    const config = this.parseProviderConfig(item.VspConfig);
    const baseUrl = typeof config?.['baseUrl'] === 'string' ? (config['baseUrl'] as string) : '';
    this.editing.set(item);
    this.form.patchValue({
      name: item.VspName,
      engine: this.normalizeEngine(item.VspEngine),
      baseUrl,
      defaultCodecs: this.parseCodecs(this.readDefaultCodecs(config)),
      apiKey: '',
      apiSecret: '',
      status: item.VspStatus,
    });
    this.updateCodecOptions(item.VspEngine);
    this.openProviderDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeProviderDialog();
  }

  async saveProvider(createAnother = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, engine, baseUrl, defaultCodecs, apiKey, apiSecret, status } =
      this.form.getRawValue();
    const payload = {
      name: name.trim(),
      engine: this.normalizeEngine(engine),
      config: {
        baseUrl: baseUrl || null,
        defaultCodecs: this.formatCodecs(defaultCodecs),
      },
      credentials: {
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
      },
      status,
    };

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VspUUID, payload, this.isMaster());
        this.snack.success('Softswitch provider updated successfully.');
      } else {
        await this.api.create(payload, this.isMaster());
        this.snack.success('Softswitch provider created successfully.');
      }

      await this.loadProviders();
      if (createAnother && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to save provider.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewProvider() {
    void this.saveProvider(true);
  }

  engineLabel(engine: string) {
    const normalized = this.normalizeEngine(engine);
    return this.engineOptions.find((option) => option.value === normalized)?.label ?? engine;
  }

  async removeProvider(item: VoipSoftswitchProviderItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Provider',
        message: `Are you sure you want to delete "${item.VspName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VspUUID, this.isMaster());
      this.snack.success('Softswitch provider deleted successfully.');
      this.selectedProviderUUIDs.delete(item.VspUUID);
      await this.loadProviders();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete provider.'));
    }
  }

  get selectedCount() {
    return this.selectedProviderUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipSoftswitchProviderItem) {
    return this.selectedProviderUUIDs.has(item.VspUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleProviderSelection(item: VoipSoftswitchProviderItem, checked: boolean) {
    if (checked) {
      this.selectedProviderUUIDs.add(item.VspUUID);
    } else {
      this.selectedProviderUUIDs.delete(item.VspUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleProviderSelection(row, checked));
  }

  async removeSelectedProviders() {
    const ids = Array.from(this.selectedProviderUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected Providers',
        message: `Are you sure you want to delete ${ids.length} selected Softswitch provider(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids, this.isMaster());
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VspUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VspUUID));
      this.selectedProviderUUIDs.clear();
      failed.forEach((uuid) => this.selectedProviderUUIDs.add(uuid));
      if (failed.size) {
        this.snack.warning(`${failed.size} selected provider(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size} selected provider(s) deleted successfully.`);
      }
      this.dataSource.filter = this.search.trim().toLowerCase();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected providers.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  private resetForm() {
    this.form.reset({
      name: '',
      engine: 'kamailio',
      baseUrl: '',
      defaultCodecs: [],
      apiKey: '',
      apiSecret: '',
      status: 1,
    });
    this.codecOptions = this.engineDefaultCodecs['kamailio'];
    this.editing.set(null);
  }

  onEngineChange(value: string) {
    this.updateCodecOptions(value);
  }

  onDefaultCodecsOpened(opened: boolean) {
    if (!opened) {
      this.defaultCodecSearch.set('');
    }
  }

  get filteredCodecOptions() {
    const search = this.defaultCodecSearch().trim().toLowerCase();
    if (!search) return this.codecOptions;
    return this.codecOptions.filter((codec) => codec.toLowerCase().includes(search));
  }

  private parseProviderConfig(config: unknown): Record<string, unknown> | null {
    if (!config) return null;
    if (typeof config === 'object' && !Array.isArray(config)) {
      return config as Record<string, unknown>;
    }
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  private readDefaultCodecs(config: Record<string, unknown> | null): string {
    if (!config) return '';
    const direct = config['defaultCodecs'];
    if (typeof direct === 'string') return direct;

    const capabilities = config['capabilities'];
    if (capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)) {
      const value = (capabilities as Record<string, unknown>)['defaultCodecs'];
      if (typeof value === 'string') return value;
    }

    return '';
  }

  private updateCodecOptions(engineInput: string) {
    const selected = this.form.controls.defaultCodecs.value ?? [];
    const engine = this.normalizeEngine(engineInput);
    const defaults = this.engineDefaultCodecs[engine];
    this.codecOptions = this.uniqueCodecs([...defaults, ...selected]);
  }

  private normalizeEngine(engine: string): SoftswitchEngine {
    const normalized = engine?.trim().toLowerCase();
    if (normalized === 'opensips') return 'opensips';
    if (normalized === 'sippulse') return 'sippulse';
    if (normalized === 'vsc') return 'vsc';
    if (normalized === 'custom') return 'custom';
    return 'kamailio';
  }

  private parseCodecs(codecs: string): string[] {
    if (!codecs) return [];
    return this.uniqueCodecs(codecs.split(',').map((item) => item.trim()));
  }

  private formatCodecs(codecs: string[]): string | null {
    if (!codecs?.length) return null;
    const normalized = this.uniqueCodecs(codecs);
    return normalized.length ? normalized.join(',') : null;
  }

  private uniqueCodecs(codecs: string[]): string[] {
    const uniq = new Set<string>();
    codecs.forEach((codec) => {
      const normalized = String(codec).trim().toUpperCase();
      if (normalized) uniq.add(normalized);
    });
    return Array.from(uniq);
  }

  private applyFilter() {
    this.dataSource.filter = this.search.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VspUUID));
    Array.from(this.selectedProviderUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedProviderUUIDs.delete(uuid);
    });
  }

  private openProviderDialog() {
    const providerFormDialog = this.providerFormDialog();
    if (!providerFormDialog || this.providerFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      providerFormDialog,
      'voip-softswitch-provider-form-dialog',
    );
    this.providerFormDialogRef = this.dialogBinding.ref;
    this.providerFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeProviderDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.providerFormDialogRef?.close();
    this.providerFormDialogRef = null;
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
