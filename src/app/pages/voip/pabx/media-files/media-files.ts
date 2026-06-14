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
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, Subscription } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  buildFileUploadViewModel,
  createCancelledFileUploadProgress,
  createFailedFileUploadProgress,
  createInitialFileUploadProgress,
  UploadCancelledError,
} from '../../../../shared/upload/file-upload-progress';
import type { FileUploadProgress } from '../../../../shared/upload/file-upload-progress';
import { VoipPabxCdrRecordingDialogComponent } from '../cdr/recording-dialog/recording-dialog';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxMediaFileItem, VoipPabxMediaFilesService } from './media-files.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type StorageAccountOption = { value: string; label: string };
type PabxOption = { value: string; label: string };
type MediaFileFormModel = {
  pabxUUID: string;
  name: string;
  storageMode: 'default' | 'filesystem' | 'storage';
  storageAccountUUID: string;
  deliveryMode: 'default' | 'online' | 'offline';
  description: string;
  enabled: number;
};

type MediaFileFilters = {
  search: string;
  status: string;
};

const emptyMediaFileFilters = (): MediaFileFilters => ({
  search: '',
  status: '',
});

@Component({
  selector: 'app-voip-pabx-media-files',
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
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    TranslocoPipe,
    MatTooltipModule,
  ],
  templateUrl: './media-files.html',
  styleUrls: ['./media-files.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxMediaFilesPage {
  private readonly api = inject(VoipPabxMediaFilesService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly genericApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly mutating = signal(false);
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
  private readonly appliedFilters = signal<MediaFileFilters>(emptyMediaFileFilters());
  private readonly itemsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipPabxMediaFileItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  readonly editing = signal<VoipPabxMediaFileItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly selectedFile = signal<File | null>(null);
  readonly uploadProgress = signal<FileUploadProgress<any> | null>(null);
  readonly uploadViewModel = computed(() =>
    buildFileUploadViewModel(this.uploadProgress(), this.uploading()),
  );
  readonly saveActionLabel = computed(() => {
    const phase = this.uploadProgress()?.phase;
    if (this.uploading() && phase === 'processing') return 'Processing';
    if (this.uploading()) return 'Uploading';
    if (this.saving()) return 'Saving';
    return 'Save';
  });
  readonly storageMode = signal<'default' | 'filesystem' | 'storage'>('default');
  readonly pabxSearch = signal('');
  readonly pabxOptions = signal<PabxOption[]>([]);
  readonly filteredPabxOptions = computed(() => {
    const search = this.pabxSearch().trim().toLowerCase();
    if (!search) return this.pabxOptions();
    return this.pabxOptions().filter((item) => item.label.toLowerCase().includes(search));
  });
  readonly dataSource = new MatTableDataSource<VoipPabxMediaFileItem>([]);
  readonly displayedColumns = [
    'select',
    'name',
    'storage',
    'delivery',
    'file',
    'status',
    'actions',
  ];

  readonly storageAccountOptions = signal<StorageAccountOption[]>([]);

  readonly formModel = signal<MediaFileFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.pabxUUID);
    required(schema.name);
    minLength(schema.name, 2);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private activeUploadSubscription: Subscription | null = null;
  private activeUploadReject: ((error: Error) => void) | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load media files.'));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    void this.bootstrap();
  
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  
  });

  async bootstrap() {
    await this.fetchLookups();
    this.itemsResource.reload();
  }

  refreshList() {
    void this.bootstrap();
  }

  applySearchFilters() {
    const nextFilters = this.currentMediaFileFilters();
    this.search.set(nextFilters.search);
    if (this.sameMediaFileFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set('');
    const nextFilters = emptyMediaFileFilters();
    if (this.sameMediaFileFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  private async fetchItems(filters: MediaFileFilters): Promise<VoipPabxMediaFileItem[]> {
    const response = await this.api.list({
      search: filters.search,
      status: filters.status,
      limit: this.listLimit,
    });
    return (response?.data?.items ?? []) as VoipPabxMediaFileItem[];
  }

  private currentMediaFileFilters(): MediaFileFilters {
    return {
      search: this.searchInput().trim(),
      status: this.statusFilter(),
    };
  }

  private sameMediaFileFilters(left: MediaFileFilters, right: MediaFileFilters) {
    return left.search === right.search && left.status === right.status;
  }

  startCreate() {
    this.editing.set(null);
    this.selectedFile.set(null);
    this.uploadProgress.set(null);
    this.formModel.set({
      pabxUUID: this.pabxOptions()[0]?.value ?? '',
      name: '',
      storageMode: 'default',
      storageAccountUUID: '',
      deliveryMode: 'default',
      description: '',
      enabled: 1,
    });
    this.storageMode.set('default');
    this.openDialog();
  }

  startEdit(item: VoipPabxMediaFileItem) {
    this.editing.set(item);
    this.selectedFile.set(null);
    this.uploadProgress.set(null);
    this.formModel.set({
      pabxUUID: item.pabxUUID ?? '',
      name: item.name,
      storageMode: item.storageMode ?? 'default',
      storageAccountUUID: item.storageAccountUUID ?? '',
      deliveryMode: item.deliveryMode ?? 'default',
      description: item.description ?? '',
      enabled: item.enabled === 1 ? 1 : 0,
    });
    this.storageMode.set(item.storageMode ?? 'default');
    this.openDialog();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  onStorageModeChange(value: 'default' | 'filesystem' | 'storage') {
    this.storageMode.set(value);
    this.formModel.update((current) => ({
      ...current,
      storageMode: value,
      storageAccountUUID: value === 'storage' ? current.storageAccountUUID : '',
    }));
  }

  clearPabxSearch(open: boolean) {
    if (!open) this.pabxSearch.set('');
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;
    const value = this.formModel();
    const payload = {
      pabxUUID: value.pabxUUID,
      name: value.name.trim(),
      storageMode: value.storageMode,
      storageAccountUUID: value.storageMode === 'storage' ? value.storageAccountUUID || '' : '',
      deliveryMode: value.deliveryMode,
      description: value.description.trim() || null,
      enabled: value.enabled === 1,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    let savedItem: VoipPabxMediaFileItem | null = null;
    try {
      const response = this.editing()
        ? await this.api.update(this.editing()!.uuid, payload)
        : await this.api.create(payload);
      const item = response?.data?.item as VoipPabxMediaFileItem | null;
      savedItem = item;
      const file = this.selectedFile();
      if (file && item?.uuid) {
        this.uploading.set(true);
        try {
          await this.uploadFileWithProgress(item.uuid, file);
        } finally {
          this.uploading.set(false);
        }
      }
      this.snack.success(
        createMode ? 'Media file created successfully.' : 'Media file updated successfully.',
      );
      this.itemsResource.reload();
      if (saveAndNew && createMode) {
        this.startCreate();
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      if (savedItem?.uuid) {
        this.editing.set(savedItem);
        this.itemsResource.reload();
        if (err instanceof UploadCancelledError) {
          this.snack.warning('Upload cancelled. Media file metadata was saved without audio.');
        } else {
          this.snack.error(
            `Media file metadata was saved, but the audio upload failed: ${this.messageFromError(
              err,
              'Failed to upload media file.',
            )}`,
          );
        }
        return;
      }
      this.snack.error(this.messageFromError(err, 'Failed to save media file.'));
    } finally {
      this.uploading.set(false);
      this.saving.set(false);
    }
  }

  saveAndNew() {
    if (!this.editing()) void this.saveItem(true);
  }

  cancelForm() {
    if (this.uploading() && this.activeUploadSubscription) {
      this.cancelActiveUpload();
      return;
    }
    this.closeDialog();
    this.editing.set(null);
    this.selectedFile.set(null);
    this.uploadProgress.set(null);
  }

  async deleteItem(item: VoipPabxMediaFileItem) {
    const confirmed = await this.confirmDelete(
      'Delete media file',
      `Delete media file "${item.name}"?`,
      'Delete',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.api.remove(item.uuid);
      this.snack.success('Media file deleted successfully.');
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete media file.'));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    return filtered.slice(
      paginator.pageIndex * paginator.pageSize,
      (paginator.pageIndex + 1) * paginator.pageSize,
    );
  }

  isSelected(item: VoipPabxMediaFileItem) {
    return this.selectedUUIDs().has(item.uuid);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleEntitySelection(item: VoipPabxMediaFileItem, checked: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      checked ? next.add(item.uuid) : next.delete(item.uuid);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) checked ? next.add(row.uuid) : next.delete(row.uuid);
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete selected media files',
      `Delete ${ids.length} selected media file(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      this.selectedUUIDs.update((current) => {
        const next = new Set(current);
        deleted.forEach((id) => next.delete(id));
        return next;
      });
      this.snack.success(`${deleted.size} media file(s) deleted successfully.`);
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected media files.'));
    } finally {
      this.mutating.set(false);
    }
  }

  fileLabel(item: VoipPabxMediaFileItem) {
    return item.originalFilename || item.storedFilename || '-';
  }

  canPlay(item: VoipPabxMediaFileItem) {
    const status = `${item.storageStatus ?? ''}`.toLowerCase();
    return Boolean(item.storageObjectKey) && !['', 'empty', 'failed'].includes(status);
  }

  playTooltip(item: VoipPabxMediaFileItem) {
    if (this.canPlay(item)) return 'Listen audio';
    if (item.storageStatus) return `Audio ${item.storageStatus}`;
    return 'No uploaded audio';
  }

  async openAudio(item: VoipPabxMediaFileItem) {
    if (!this.canPlay(item)) return;
    try {
      const response = await this.api.playbackUrl(item.uuid);
      const url = response?.data?.url;
      if (!url) throw new Error('Media file playback URL was not returned.');
      this.dialog.open(VoipPabxCdrRecordingDialogComponent, {
        width: 'min(640px, calc(100vw - 32px))',
        maxWidth: '640px',
        maxHeight: '92vh',
        disableClose: false,
        panelClass: 'voip-pabx-recording-dialog-panel',
        data: {
          url,
          filename:
            response?.data?.filename ||
            item.originalFilename ||
            item.storedFilename ||
            'media-file',
          title: 'Media File',
          subtitle: item.name,
          showCallSummary: false,
        },
      });
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to open media file audio.'));
    }
  }

  private async fetchLookups() {
    const [storageResponse, pabxResponse] = await Promise.all([
      this.genericApi.get<any>('hosting/storage/accounts'),
      this.pabxApi.list({ limit: this.listLimit }),
    ]);
    const rows = Array.isArray(storageResponse?.data)
      ? storageResponse.data
      : (storageResponse?.data?.items ?? []);
    this.storageAccountOptions.set(
      rows.map((item: any) => ({
        value: item.HsaUUID,
        label: `${item.HsaName} · ${item.HspProvider ?? item.HspName ?? 'storage'}`,
      })),
    );
    this.pabxOptions.set(
      (pabxResponse?.data?.items ?? []).map((item: VoipPabxAccount) => ({
        value: item.VpaUUID,
        label: item.VpaName,
      })),
    );
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, formDialog, 'crud-dialog-panel', {
      onEscape: () => this.cancelForm(),
    });
    this.dialogBinding = binding;
    binding.ref.afterClosed().subscribe(() => {
      binding.stop();
      if (this.dialogBinding === binding) {
        this.dialogBinding = null;
      }
    });
  }

  private closeDialog() {
    const binding = this.dialogBinding;
    this.dialogBinding = null;
    binding?.ref.close();
    binding?.stop();
  }

  private uploadFileWithProgress(uuid: string, file: File) {
    return new Promise<void>((resolve, reject) => {
      this.uploadProgress.set(createInitialFileUploadProgress(file.size || null));

      let settled = false;
      const cleanup = () => {
        this.activeUploadSubscription = null;
        this.activeUploadReject = null;
      };

      this.activeUploadReject = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      this.activeUploadSubscription = this.api.uploadWithProgress(uuid, file).subscribe({
        next: (progress) => {
          this.uploadProgress.set(progress);
          if (progress.phase === 'completed' && !settled) {
            settled = true;
            cleanup();
            resolve();
          }
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          this.uploadProgress.set(
            createFailedFileUploadProgress(
              this.uploadProgress(),
              this.messageFromError(error, 'Failed to upload media file.'),
              file.size || null,
            ),
          );
          cleanup();
          reject(error);
        },
        complete: () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        },
      });
    });
  }

  private cancelActiveUpload() {
    const reject = this.activeUploadReject;
    this.activeUploadSubscription?.unsubscribe();
    this.activeUploadSubscription = null;
    this.activeUploadReject = null;
    this.uploading.set(false);
    this.uploadProgress.set(createCancelledFileUploadProgress(this.uploadProgress()));
    reject?.(new UploadCancelledError());
  }

  private async confirmDelete(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.uuid));
    this.selectedUUIDs.update((current) => new Set([...current].filter((id) => valid.has(id))));
  }

  private sortValue(row: VoipPabxMediaFileItem, column: string) {
    if (column === 'storage') return `${row.storageMode} ${row.storageAccountName ?? ''}`;
    if (column === 'name') return `${row.name} ${row.pabxName ?? ''}`;
    if (column === 'file') return this.fileLabel(row);
    if (column === 'status') return row.enabled;
    return (row as any)[column] ?? '';
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.error || err?.message || fallback;
  }

  private emptyFormModel(): MediaFileFormModel {
    return {
      pabxUUID: '',
      name: '',
      storageMode: 'default',
      storageAccountUUID: '',
      deliveryMode: 'default',
      description: '',
      enabled: 1,
    };
  }
}
