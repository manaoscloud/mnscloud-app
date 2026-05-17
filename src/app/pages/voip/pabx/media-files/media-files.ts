import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
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
import { fadeIn } from '../../../../shared/animations/fade.animation';
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
import { VoipPabxMediaFileItem, VoipPabxMediaFilesService } from './media-files.service';

type StorageAccountOption = { value: string; label: string };

@Component({
  selector: 'app-voip-pabx-media-files',
  standalone: true,
  imports: [
    CommonModule,
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
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './media-files.html',
  styleUrls: ['./media-files.scss'],
  animations: [fadeIn],
})
export class VoipPabxMediaFilesPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(VoipPabxMediaFilesService);
  private readonly genericApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly statusFilter = signal('');
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

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    storageMode: ['default' as 'default' | 'filesystem' | 'storage'],
    storageAccountUUID: [''],
    deliveryMode: ['default' as 'default' | 'online' | 'offline'],
    description: [''],
    enabled: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;
  private dialogBinding: CrudDialogBinding | null = null;
  private activeUploadSubscription: Subscription | null = null;
  private activeUploadReject: ((error: Error) => void) | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => void this.loadItems(), 0);
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  refreshList() {
    void this.loadItems();
  }

  applySearchFilters() {
    this.search.set(this.searchInput().trim());
    void this.loadItems();
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.statusFilter.set('');
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    const start = performance.now();
    try {
      await this.loadStorageAccounts();
      const response = await this.api.list({
        search: this.search(),
        status: this.statusFilter(),
        limit: this.listLimit,
      });
      this.dataSource.data = (response?.data?.items ?? []) as VoipPabxMediaFileItem[];
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to load media files.'));
      this.dataSource.data = [];
      this.reconcileSelection();
    } finally {
      const elapsed = performance.now() - start;
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - elapsed));
    }
  }

  startCreate() {
    this.editing.set(null);
    this.selectedFile.set(null);
    this.uploadProgress.set(null);
    this.form.reset({
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
    this.form.reset({
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
    if (value !== 'storage') this.form.patchValue({ storageAccountUUID: '' });
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
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
      await this.loadItems();
      if (saveAndNew && createMode) {
        this.startCreate();
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      if (savedItem?.uuid) {
        this.editing.set(savedItem);
        await this.loadItems();
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
    await this.api.remove(item.uuid);
    this.snack.success('Media file deleted successfully.');
    await this.loadItems();
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
    const response = await this.api.removeMany(ids);
    const deleted = new Set<string>(response?.data?.deleted ?? []);
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      deleted.forEach((id) => next.delete(id));
      return next;
    });
    this.snack.success(`${deleted.size} media file(s) deleted successfully.`);
    await this.loadItems();
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

  private async loadStorageAccounts() {
    const response = await this.genericApi.get<any>('hosting/storage/accounts');
    const rows = Array.isArray(response?.data) ? response.data : (response?.data?.items ?? []);
    this.storageAccountOptions.set(
      rows.map((item: any) => ({
        value: item.HsaUUID,
        label: `${item.HsaName} · ${item.HspProvider ?? item.HspName ?? 'storage'}`,
      })),
    );
  }

  private openDialog() {
    if (!this.formDialog || this.dialogBinding) return;
    const binding = openCrudTemplateDialog(this.dialog, this.formDialog, 'crud-dialog-panel', {
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
    if (column === 'file') return this.fileLabel(row);
    if (column === 'status') return row.enabled;
    return (row as any)[column] ?? '';
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.error || err?.message || fallback;
  }

}
