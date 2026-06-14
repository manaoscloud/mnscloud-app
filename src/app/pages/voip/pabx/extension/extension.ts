import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';

import {
  FormField,
  form as createForm,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';

import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { VoipPabxService, VoipPabxAccount } from '../voip-pabx.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  VoipPabxExtensionGeneratedCredential,
  VoipPabxExtensionItem,
  VoipPabxExtensionService,
} from './extension.service';

type PabxOption = {
  value: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};

type JsonRecord = Record<string, unknown>;
type CreateMode = 'single' | 'range';
type ExtensionFormModel = {
  pabxUUID: string;
  createMode: CreateMode;
  extensionRange: string;
  username: string;
  password: string;
  callerIdName: string;
  callerIdNumber: string;
  context: string;
  vmEnabled: number;
  vmPassword: string;
  recordCalls: number;
  outboundCid: string;
  audioCodecs: string[];
  videoCodecs: string[];
  enabled: number;
  paramsJson: string;
};

type ExtensionFilters = {
  search: string;
  status: number | '';
  pabxUUID: string;
};

const emptyExtensionFilters = (): ExtensionFilters => ({
  search: '',
  status: '',
  pabxUUID: '',
});

@Component({
  selector: 'app-voip-pabx-extension',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  templateUrl: './extension.html',
  styleUrls: ['./extension.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxExtensionPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipPabxExtensionService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly pageTitle = computed(() => 'PABX Extension');
  readonly pageSubtitle = computed(() => 'Manage extensions linked to tenant PABX accounts.');

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipPabxExtensionItem | null>(null);
  readonly generatedCredentials = signal<VoipPabxExtensionGeneratedCredential[]>([]);

  readonly dataSource = new MatTableDataSource<VoipPabxExtensionItem>([]);
  private readonly appliedFilters = signal<ExtensionFilters>(emptyExtensionFilters());
  private readonly extensionsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipPabxExtensionItem[],
    loader: ({ params }) => this.fetchExtensions(params),
  });
  readonly loading = computed(() => this.extensionsResource.isLoading() || this.mutating());
  readonly displayedColumns = [
    'select',
    'username',
    'password',
    'pabx',
    'domain',
    'engine',
    'recording',
    'status',
    'actions',
  ];
  readonly selectedExtensionUUIDs = new Set<string>();
  search = '';
  readonly searchInput = signal('');
  readonly statusFilter = signal<number | ''>('');
  readonly pabxFilter = signal('');

  pabxOptions: PabxOption[] = [];
  private readonly pabxMap = new Map<string, VoipPabxAccount>();
  readonly pabxSearch = signal('');
  readonly audioCodecSearch = signal('');
  readonly videoCodecSearch = signal('');

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  readonly vmOptions = [
    { value: 1, label: 'Enabled' },
    { value: 0, label: 'Disabled' },
  ];

  readonly recordingOptions = [
    { value: 1, label: 'Enabled' },
    { value: 0, label: 'Disabled' },
  ];

  private readonly defaultAudioCodecs = ['OPUS', 'PCMU', 'PCMA', 'G729', 'G722'];
  private readonly defaultVideoCodecs = ['H264'];
  audioCodecOptions: string[] = this.defaultAudioCodecs;
  videoCodecOptions: string[] = this.defaultVideoCodecs;
  codecDefaultHint = '';

  readonly formModel = signal<ExtensionFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.pabxUUID);
    required(schema.context);
    required(schema.username, { when: () => this.editing() !== null || this.isSingleMode() });
    minLength(schema.username, 1, { when: () => this.editing() !== null || this.isSingleMode() });
    required(schema.password, { when: () => this.editing() === null && this.isSingleMode() });
    required(schema.extensionRange, { when: () => this.isRangeMode() });
    pattern(schema.extensionRange, /^\s*\d+\s*-\s*\d+\s*$/, { when: () => this.isRangeMode() });
    pattern(schema.vmPassword, /^\d{6}$/, {
      when: () => this.formModel().vmPassword.trim().length > 0,
    });
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly extensionFormDialog = viewChild<TemplateRef<unknown>>('extensionFormDialog');
  private extensionFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly extensionsEffect = effect(() => {
    this.dataSource.data = this.extensionsResource.value();
    this.reconcileSelection();
    this.dataSource.filter = '';
    this.paginator()?.firstPage();
  });
  private readonly extensionsErrorEffect = effect(() => {
    const error = this.extensionsResource.error();
    if (!error) return;
    this.error.set(null);
    this.snack.error(this.extractApiError(error, 'Failed to load extensions.'));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) =>
      this.sortValue(data, sortHeaderId);
    this.dataSource.filterPredicate = (data) => this.matchesFilters(data);
    this.extensionsResource.reload();
  
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeExtensionDialog();
  
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }

  onPabxFilterChange(value: string) {
    this.pabxFilter.set(value ?? '');
  }

  onFormPabxOpened(opened: boolean) {
    if (!opened) {
      this.pabxSearch.set('');
    }
  }

  onCodecOpened(opened: boolean) {
    if (!opened) {
      this.audioCodecSearch.set('');
      this.videoCodecSearch.set('');
    }
  }

  onStatusFilterChange(value: number | '') {
    this.statusFilter.set(value === '' ? '' : (Number(value) as 0 | 1));
  }

  onFormPabxChange(value: string) {
    this.updateCodecOptions(value);
  }

  get filteredPabxOptions() {
    const search = this.pabxSearch().trim().toLowerCase();
    if (!search) return this.pabxOptions;
    return this.pabxOptions.filter((option) => option.label.toLowerCase().includes(search));
  }

  get filteredAudioCodecOptions() {
    const search = this.audioCodecSearch().trim().toLowerCase();
    if (!search) return this.audioCodecOptions;
    return this.audioCodecOptions.filter((codec) => codec.toLowerCase().includes(search));
  }

  get filteredVideoCodecOptions() {
    const search = this.videoCodecSearch().trim().toLowerCase();
    if (!search) return this.videoCodecOptions;
    return this.videoCodecOptions.filter((codec) => codec.toLowerCase().includes(search));
  }

  applySearchFilters() {
    const nextFilters = this.currentExtensionFilters();
    this.search = nextFilters.search;
    if (this.sameExtensionFilters(nextFilters, this.appliedFilters())) {
      this.extensionsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search = '';
    this.statusFilter.set('');
    this.pabxFilter.set('');
    const nextFilters = emptyExtensionFilters();
    if (this.sameExtensionFilters(nextFilters, this.appliedFilters())) {
      this.extensionsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  refreshList() {
    this.extensionsResource.reload();
  }

  startCreate() {
    this.resetForm();
    this.error.set(null);
    this.formModel.update((value) => ({
      ...value,
      password: this.generateRandomPassword(16),
      vmPassword: this.generateRandomVoicemailPassword(6),
    }));
    this.updateCodecOptions(this.formModel().pabxUUID);
    this.openExtensionDialog();
  }

  startEdit(item: VoipPabxExtensionItem) {
    this.error.set(null);
    this.editing.set(item);
    this.generatedCredentials.set([]);
    this.formModel.set({
      pabxUUID: item.VoipPabxAccountVpaUUID,
      createMode: 'single',
      extensionRange: '',
      username: item.VpeUsername ?? '',
      password: item.VpePassword ?? '',
      callerIdName: item.VpeCallerIdName ?? '',
      callerIdNumber: item.VpeCallerIdNumber ?? '',
      context: item.VpeContext ?? 'default',
      vmEnabled: item.VpeVmEnabled === 1 ? 1 : 0,
      vmPassword: item.VpeVmPassword ?? '',
      recordCalls: item.VpeRecordCalls === 0 ? 0 : 1,
      outboundCid: item.VpeOutboundCid ?? '',
      audioCodecs: this.parseAudioCodecs(item.VpeCodecs),
      videoCodecs: this.parseVideoCodecs(item.VpeCodecs),
      enabled: item.VpeEnabled === 1 ? 1 : 0,
      paramsJson: this.formatParams(item.VpeParamsJson),
    });
    this.updateCodecOptions(item.VoipPabxAccountVpaUUID);
    this.openExtensionDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeExtensionDialog();
  }

  onCreateModeChange(value: CreateMode) {
    this.formModel.update((current) => ({ ...current, createMode: value }));
    this.generatedCredentials.set([]);

    if (value === 'single' && !this.formModel().password.trim().length) {
      this.formModel.update((current) => ({ ...current, password: this.generateRandomPassword(16) }));
    }

    if (value === 'range') {
      // In range mode we let backend generate voicemail passwords per extension.
      this.formModel.update((current) => ({ ...current, vmPassword: '' }));
    }
  }

  isRangeMode() {
    return !this.editing() && this.formModel().createMode === 'range';
  }

  isSingleMode() {
    return !!this.editing() || this.formModel().createMode === 'single';
  }

  regeneratePassword() {
    this.formModel.update((current) => ({ ...current, password: this.generateRandomPassword(16) }));
  }

  regenerateVoicemailPassword() {
    if (this.editing()) return;
    this.formModel.update((current) => ({
      ...current,
      vmPassword: this.generateRandomVoicemailPassword(6),
    }));
  }

  async saveExtension(createAnother = false) {
    if (this.saving()) {
      return;
    }

    if (!this.form().valid()) return;

    const value = this.formModel();
    const selectedPabx = this.pabxMap.get(value.pabxUUID);
    const pabxValidationMessage = this.validatePabxForExtension(selectedPabx);
    if (pabxValidationMessage) {
      this.snack.warning(pabxValidationMessage);
      return;
    }

    const effectiveVmPassword =
      !this.editing() && value.createMode === 'single' && value.vmEnabled === 1
        ? this.generateRandomVoicemailPassword(6)
        : value.vmEnabled === 1 && !String(value.vmPassword ?? '').trim().length
          ? this.generateRandomVoicemailPassword(6)
          : value.vmPassword;
    const normalizedVmPassword = String(effectiveVmPassword ?? '').trim();

    if (effectiveVmPassword !== value.vmPassword) {
      this.formModel.update((current) => ({ ...current, vmPassword: effectiveVmPassword }));
    }

    const payload = {
      pabxUUID: value.pabxUUID,
      username: value.username.trim(),
      password: value.password ? value.password.trim() : undefined,
      callerIdName: value.callerIdName || null,
      callerIdNumber: value.callerIdNumber || null,
      context: value.context || null,
      vmEnabled: value.vmEnabled === 1,
      vmPassword: normalizedVmPassword || undefined,
      recordCalls: value.recordCalls === 1,
      outboundCid: value.outboundCid || null,
      codecs: this.formatCodecs([...value.audioCodecs, ...value.videoCodecs]),
      params: this.parseParams(value.paramsJson),
      enabled: value.enabled === 1,
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VpeUUID, payload);
      } else {
        if (value.createMode === 'range') {
          const parsedRange = this.parseRange(value.extensionRange);
          if (!parsedRange) {
            this.snack.warning('Range must follow the format "1000-1010".');
            return;
          }

          if (parsedRange.total > 100) {
            this.snack.warning('Range exceeds max size of 100 extensions per operation.');
            return;
          }

          const response = await this.api.bulkCreate({
            pabxUUID: payload.pabxUUID,
            rangeStart: parsedRange.start,
            rangeEnd: parsedRange.end,
            callerIdName: payload.callerIdName,
            callerIdNumber: payload.callerIdNumber,
            context: payload.context,
            vmEnabled: payload.vmEnabled,
            vmPassword: undefined,
            recordCalls: payload.recordCalls,
            outboundCid: payload.outboundCid,
            codecs: payload.codecs,
            params: payload.params,
            enabled: payload.enabled,
          });

          this.generatedCredentials.set(response?.data?.credentials ?? []);
          this.formModel.update((current) => ({ ...current, extensionRange: '' }));
          this.extensionsResource.reload();
          const skipped = Array.isArray(response?.data?.skippedExisting)
            ? response.data.skippedExisting.length
            : 0;
          if (skipped === 0) {
            this.snack.success(response?.message || 'Extensions created successfully.');
            this.cancelEdit();
            return;
          }
          this.error.set(null);
          this.snack.warning(
            response?.message || `${skipped} extensions were skipped because they already exist.`,
          );
          return;
        }

        await this.api.create({
          ...payload,
          password: payload.password || this.generateRandomPassword(16),
        });
      }
      this.extensionsResource.reload();
      if (createAnother && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message = this.extractApiError(err, 'Failed to save extension.');
      this.error.set(null);
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewExtension() {
    void this.saveExtension(true);
  }

  async removeExtension(item: VoipPabxExtensionItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Extension',
        message: `Are you sure you want to delete extension "${item.VpeUsername}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.remove(item.VpeUUID);
      this.selectedExtensionUUIDs.delete(item.VpeUUID);
      this.extensionsResource.reload();
      this.snack.success('Extension deleted successfully.');
    } catch (err: any) {
      const message = this.extractApiError(err, 'Failed to delete extension.');
      this.error.set(null);
      this.snack.error(message);
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedExtensionUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipPabxExtensionItem) {
    return this.selectedExtensionUUIDs.has(item.VpeUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleExtensionSelection(item: VoipPabxExtensionItem, checked: boolean) {
    if (checked) {
      this.selectedExtensionUUIDs.add(item.VpeUUID);
    } else {
      this.selectedExtensionUUIDs.delete(item.VpeUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleExtensionSelection(row, checked));
  }

  async removeSelectedExtensions() {
    const ids = Array.from(this.selectedExtensionUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected Extensions',
        message: `Are you sure you want to delete ${ids.length} selected PABX extension(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    this.error.set(null);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VpeUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VpeUUID));
      this.selectedExtensionUUIDs.clear();
      failed.forEach((uuid) => this.selectedExtensionUUIDs.add(uuid));
      if (failed.size)
        this.snack.warning(`${failed.size} selected extension(s) could not be deleted.`);
      this.extensionsResource.reload();
    } catch (err: any) {
      const message = this.extractApiError(err, 'Failed to delete selected extensions.');
      this.snack.error(message);
    } finally {
      this.deletingSelected.set(false);
    }
  }

  pabxLabel(pabxUUID: string) {
    return this.pabxMap.get(pabxUUID)?.VpaName ?? pabxUUID;
  }

  domainLabel(item: VoipPabxExtensionItem) {
    if (item.DomainName) return item.DomainName;
    const pabx = this.pabxMap.get(item.VoipPabxAccountVpaUUID);
    return pabx?.DomainName ?? '-';
  }

  async copyValue(value: string | null | undefined, label: string) {
    const text = String(value ?? '').trim();
    if (!text.length) {
      this.snack.warning(`No ${label.toLowerCase()} available to copy.`);
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.snack.success(`${label} copied.`);
    } catch {
      this.snack.error(`Failed to copy ${label.toLowerCase()}.`);
    }
  }

  private applyFilter() {
    this.dataSource.filter = `${this.search}|${this.statusFilter()}|${this.pabxFilter()}|${Date.now()}`;
    this.paginator()?.firstPage();
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VpeUUID));
    Array.from(this.selectedExtensionUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedExtensionUUIDs.delete(uuid);
    });
  }

  private matchesFilters(item: VoipPabxExtensionItem) {
    const searchValue = this.search.trim().toLowerCase();
    if (searchValue) {
      const fields = [
        item.VpeUsername,
        item.VpeCallerIdName,
        item.VpeCallerIdNumber,
        item.VpeEngine,
        item.PabxName,
        item.DomainName,
        this.pabxLabel(item.VoipPabxAccountVpaUUID),
      ]
        .filter(Boolean)
        .map((value) => String(value).toLowerCase());
      if (!fields.some((value) => value.includes(searchValue))) {
        return false;
      }
    }

    if (this.statusFilter() !== '' && item.VpeEnabled !== this.statusFilter()) {
      return false;
    }

    if (this.pabxFilter() && item.VoipPabxAccountVpaUUID !== this.pabxFilter()) {
      return false;
    }

    return true;
  }

  private sortValue(item: VoipPabxExtensionItem, column: string): string | number {
    switch (column) {
      case 'username':
        return this.normalizeSortText(item.VpeUsername);
      case 'password':
        return this.normalizeSortText(item.VpePassword);
      case 'pabx':
        return this.normalizeSortText(item.PabxName || this.pabxLabel(item.VoipPabxAccountVpaUUID));
      case 'domain':
        return this.normalizeSortText(this.domainLabel(item));
      case 'engine':
        return this.normalizeSortText(item.VpeEngine);
      case 'recording':
        return Number(item.VpeRecordCalls ?? 1);
      case 'status':
        return Number(item.VpeEnabled ?? 0);
      default:
        return this.normalizeSortText((item as Record<string, unknown>)[column]);
    }
  }

  private normalizeSortText(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  private async loadPabxOptions() {
    const response = await this.pabxApi.list({ limit: this.listLimit });
    const accounts: VoipPabxAccount[] = response?.data?.items ?? [];
    this.pabxMap.clear();
    accounts.forEach((item) => this.pabxMap.set(item.VpaUUID, item));
    this.pabxOptions = accounts
      .filter((item) => item.VpaIsActive === 1)
      .map((item) => {
        const validationMessage = this.validatePabxForExtension(item);
        return {
          value: item.VpaUUID,
          label: `${item.VpaName} (${item.DomainName ?? 'no-domain'})`,
          disabled: !!validationMessage,
          disabledReason: validationMessage ?? undefined,
        };
      });
    this.updateCodecOptions(this.formModel().pabxUUID);
  }

  private async fetchExtensions(filters: ExtensionFilters): Promise<VoipPabxExtensionItem[]> {
    this.error.set(null);
    await this.loadPabxOptions();
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== '') params.set('status', String(filters.status));
    if (filters.pabxUUID) params.set('pabxUUID', filters.pabxUUID);
    const response = await this.api.list(params);
    return response?.data?.items ?? [];
  }

  private currentExtensionFilters(): ExtensionFilters {
    return {
      search: this.searchInput().trim(),
      status: this.statusFilter(),
      pabxUUID: this.pabxFilter(),
    };
  }

  private sameExtensionFilters(left: ExtensionFilters, right: ExtensionFilters) {
    return (
      left.search === right.search &&
      left.status === right.status &&
      left.pabxUUID === right.pabxUUID
    );
  }

  private parseParams(params: string): Record<string, unknown> | null {
    const trimmed = params.trim();
    if (!trimmed.length) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatParams(params: unknown) {
    if (!params) return '';
    if (typeof params === 'string') return params;
    try {
      return JSON.stringify(params, null, 2);
    } catch {
      return '';
    }
  }

  private parseCodecs(codecs?: string | null): string[] {
    if (!codecs) return [];
    return codecs
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => item.toUpperCase());
  }

  private formatCodecs(codecs: string[]): string {
    if (!codecs?.length) return '';
    return codecs
      .map((item) => item.trim())
      .filter(Boolean)
      .join(',');
  }

  private updateCodecOptions(pabxUUID: string) {
    const currentSelected = [
      ...(this.formModel().audioCodecs ?? []),
      ...(this.formModel().videoCodecs ?? []),
    ];
    const pabx = this.pabxMap.get(pabxUUID);
    const engine = this.resolveEngine(pabx).toLowerCase();
    const accountDefaults = this.extractAccountDefaultCodecs(pabx);
    const engineDefaults = this.resolveEngineDefaultCodecs(engine);
    const effectiveDefaults = accountDefaults.length ? accountDefaults : engineDefaults;
    const options = this.uniqueCodecs([
      ...effectiveDefaults,
      ...engineDefaults,
      ...currentSelected,
    ]);
    this.audioCodecOptions = options.filter((codec) => !this.defaultVideoCodecs.includes(codec));
    this.videoCodecOptions = this.uniqueCodecs([
      ...options.filter((codec) => this.defaultVideoCodecs.includes(codec)),
      ...this.defaultVideoCodecs,
    ]);
    this.codecDefaultHint = effectiveDefaults.length
      ? effectiveDefaults.join(', ')
      : 'No account default configured.';
  }

  private resolveEngine(pabx?: VoipPabxAccount): string {
    return (pabx?.ServerEngine || 'freeswitch').trim();
  }

  private validatePabxForExtension(pabx?: VoipPabxAccount): string | null {
    if (!pabx) return 'Select a valid PABX before saving the extension.';
    if (this.pabxRequiresDomain(pabx) && !pabx.VoipDomainVdmUUID) {
      return 'Selected PABX requires a domain before creating extensions.';
    }
    return null;
  }

  private pabxRequiresDomain(pabx: VoipPabxAccount): boolean {
    return this.resolveEngine(pabx).toLowerCase() === 'freeswitch';
  }

  private resolveEngineDefaultCodecs(_engine: string): string[] {
    return [...this.defaultAudioCodecs, ...this.defaultVideoCodecs];
  }

  private extractAccountDefaultCodecs(pabx?: VoipPabxAccount): string[] {
    return this.uniqueCodecs([
      ...this.parseCodecs(pabx?.VpaDefaultAudioCodecs),
      ...this.parseCodecs(pabx?.VpaDefaultVideoCodecs),
    ]);
  }

  private parseAudioCodecs(codecs?: string | null): string[] {
    return this.parseCodecs(codecs).filter((codec) => !this.defaultVideoCodecs.includes(codec));
  }

  private parseVideoCodecs(codecs?: string | null): string[] {
    return this.parseCodecs(codecs).filter((codec) => this.defaultVideoCodecs.includes(codec));
  }

  private parseConfigObject(config: unknown): JsonRecord | null {
    if (!config) return null;
    if (typeof config === 'string') {
      try {
        const parsed = JSON.parse(config);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as JsonRecord;
        }
      } catch {
        return null;
      }
      return null;
    }
    if (typeof config === 'object' && !Array.isArray(config)) {
      return config as JsonRecord;
    }
    return null;
  }

  private readObject(config: JsonRecord, key: string): JsonRecord | null {
    const value = config[key];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as JsonRecord;
  }

  private readString(config: JsonRecord | null, key: string): string {
    if (!config) return '';
    const value = config[key];
    return typeof value === 'string' ? value : '';
  }

  private parseCodecList(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return this.uniqueCodecs(value.map((item) => String(item)));
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed.length) return [];
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return this.uniqueCodecs(parsed.map((item) => String(item)));
        } catch {
          return [];
        }
      }
      return this.uniqueCodecs(trimmed.split(',').map((item) => item.trim()));
    }
    return [];
  }

  private uniqueCodecs(codecs: string[]): string[] {
    const uniq = new Set<string>();
    codecs.forEach((codec) => {
      const normalized = String(codec).trim().toUpperCase();
      if (normalized) uniq.add(normalized);
    });
    return Array.from(uniq);
  }

  private resetForm() {
    this.error.set(null);
    this.editing.set(null);
    this.generatedCredentials.set([]);
    this.formModel.set(this.emptyFormModel());
    this.audioCodecOptions = this.defaultAudioCodecs;
    this.videoCodecOptions = this.defaultVideoCodecs;
    this.codecDefaultHint = [...this.defaultAudioCodecs, ...this.defaultVideoCodecs].join(', ');
  }

  private emptyFormModel(): ExtensionFormModel {
    return {
      pabxUUID: '',
      createMode: 'single',
      extensionRange: '',
      username: '',
      password: '',
      callerIdName: '',
      callerIdNumber: '',
      context: 'default',
      vmEnabled: 0,
      vmPassword: '',
      recordCalls: 1,
      outboundCid: '',
      audioCodecs: [],
      videoCodecs: [],
      enabled: 1,
      paramsJson: '',
    };
  }

  private parseRange(rangeText: string): { start: number; end: number; total: number } | null {
    const match = rangeText.trim().match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) return null;

    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return null;

    return { start, end, total: end - start + 1 };
  }

  private extractApiError(err: any, fallback: string): string {
    const apiError = err?.error;
    if (typeof apiError === 'string' && apiError.trim().length) return apiError.trim();

    const direct =
      (typeof apiError?.error === 'string' && apiError.error.trim().length && apiError.error) ||
      (typeof apiError?.message === 'string' &&
        apiError.message.trim().length &&
        apiError.message) ||
      (typeof err?.message === 'string' && err.message.trim().length && err.message);
    if (direct) return direct;

    if (apiError && typeof apiError === 'object') {
      try {
        const serialized = JSON.stringify(apiError);
        if (serialized && serialized !== '{}') return serialized;
      } catch {
        // ignore serialization failure
      }
    }

    return fallback;
  }

  private generateRandomPassword(length = 16): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const all = `${upper}${lower}${digits}`;
    const bytes = new Uint32Array(length + 6);
    crypto.getRandomValues(bytes);

    const passwordChars = [
      upper[bytes[0] % upper.length],
      lower[bytes[1] % lower.length],
      digits[bytes[2] % digits.length],
    ];

    for (let i = 3; i < length; i++) {
      passwordChars.push(all[bytes[i] % all.length]);
    }

    for (let i = passwordChars.length - 1, j = 3; i > 0; i--, j++) {
      const swap = bytes[j] % (i + 1);
      [passwordChars[i], passwordChars[swap]] = [passwordChars[swap], passwordChars[i]];
    }

    return passwordChars.join('');
  }

  private generateRandomVoicemailPassword(length = 6): string {
    const digits = '0123456789';
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    const chars: string[] = [];

    for (let i = 0; i < length; i++) {
      chars.push(digits[bytes[i] % digits.length]);
    }

    return chars.join('');
  }

  private openExtensionDialog() {
    const extensionFormDialog = this.extensionFormDialog();
    if (!extensionFormDialog || this.extensionFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      extensionFormDialog,
      'voip-pabx-extension-form-dialog',
    );
    this.extensionFormDialogRef = this.dialogBinding.ref;
    this.extensionFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.extensionFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
    this.extensionFormDialogRef.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.extensionFormDialogRef = null;
    });
  }

  private closeExtensionDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.extensionFormDialogRef?.close();
    this.extensionFormDialogRef = null;
  }
}
