import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { FormField, form as createForm, min, minLength, required } from '@angular/forms/signals';
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

import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipPabxAccount, VoipPabxService } from '../voip-pabx.service';
import { VoipPabxExtensionItem, VoipPabxExtensionService } from '../extension/extension.service';
import {
  VoipPabxMediaFileItem,
  VoipPabxMediaFilesService,
} from '../media-files/media-files.service';
import { VoipPabxQueueItem, VoipPabxQueueMemberItem, VoipPabxQueueService } from './queue.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type Option = { value: string; label: string; pabxUUID?: string | null };
type QueueFormModel = {
  pabxUUID: string;
  name: string;
  strategy: string;
  timeoutSeconds: number;
  retrySeconds: number;
  maxWaitSeconds: number;
  mediaFileUUID: string;
  enabled: boolean;
};
type QueueMemberFormModel = {
  extensionUUID: string;
  priority: number;
  penalty: number;
  enabled: boolean;
};

@Component({
  selector: 'app-voip-pabx-queue',
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
  templateUrl: './queue.html',
  styleUrls: ['./queue.scss'],
})
export class VoipPabxQueuePage {
  private readonly api = inject(VoipPabxQueueService);
  private readonly pabxApi = inject(VoipPabxService);
  private readonly extensionApi = inject(VoipPabxExtensionService);
  private readonly mediaFileApi = inject(VoipPabxMediaFilesService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly membersLoading = signal(false);
  readonly memberSaving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  private readonly appliedSearch = signal('');
  readonly pabxSearch = signal('');
  readonly mediaFileSearch = signal('');
  readonly memberExtensionSearch = signal('');
  readonly editing = signal<VoipPabxQueueItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly pabxOptions = signal<Option[]>([]);
  readonly extensionOptions = signal<Option[]>([]);
  readonly mediaFileOptions = signal<Option[]>([]);
  readonly memberRows = signal<VoipPabxQueueMemberItem[]>([]);
  readonly dataSource = new MatTableDataSource<VoipPabxQueueItem>([]);
  private readonly itemsResource = resource({
    params: () => this.appliedSearch(),
    defaultValue: [] as VoipPabxQueueItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly displayedColumns = [
    'select',
    'name',
    'pabx',
    'engine',
    'strategy',
    'timeout',
    'status',
    'actions',
  ];

  readonly filteredPabxOptions = computed(() =>
    this.filterOptions(this.pabxOptions(), this.pabxSearch()),
  );

  readonly filteredMediaFileOptions = computed(() => {
    const pabxUUID = this.formModel().pabxUUID;
    return this.filterOptions(
      this.mediaFileOptions().filter((option) => !pabxUUID || option.pabxUUID === pabxUUID),
      this.mediaFileSearch(),
    );
  });

  readonly filteredMemberExtensionOptions = computed(() => {
    const pabxUUID = this.formModel().pabxUUID;
    const linked = new Set(
      this.memberRows()
        .map((row) => row.VoipPabxExtensionVpeUUID)
        .filter(Boolean),
    );
    return this.filterOptions(
      this.extensionOptions().filter(
        (option) => (!pabxUUID || option.pabxUUID === pabxUUID) && !linked.has(option.value),
      ),
      this.memberExtensionSearch(),
    );
  });

  readonly formModel = signal<QueueFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.pabxUUID);
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.strategy);
    required(schema.timeoutSeconds);
    min(schema.timeoutSeconds, 1);
    required(schema.retrySeconds);
    min(schema.retrySeconds, 0);
    required(schema.maxWaitSeconds);
    min(schema.maxWaitSeconds, 1);
  });

  readonly memberFormModel = signal<QueueMemberFormModel>(this.emptyMemberFormModel());
  readonly memberForm = createForm(this.memberFormModel, (schema) => {
    required(schema.extensionUUID);
    required(schema.priority);
    min(schema.priority, 0);
    required(schema.penalty);
    min(schema.penalty, 0);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
    const paginator = this.paginator();
    if (paginator) paginator.firstPage();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load queues.'));
    this.dataSource.data = [];
    this.reconcileSelection();
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.itemsResource.reload();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  });

  refreshList() {
    this.itemsResource.reload();
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    this.search.set(nextSearch);
    if (nextSearch === this.appliedSearch()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    if (this.appliedSearch()) {
      this.appliedSearch.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  startCreate() {
    this.resetForm();
    this.openDialog();
  }

  startEdit(item: VoipPabxQueueItem) {
    this.editing.set(item);
    this.formModel.set({
      pabxUUID: item.VoipPabxAccountVpaUUID ?? '',
      name: item.VpqName ?? '',
      strategy: item.VpqStrategy ?? 'ring_all',
      timeoutSeconds: Number(item.VpqTimeoutSeconds ?? 30),
      retrySeconds: Number(item.VpqRetrySeconds ?? 5),
      maxWaitSeconds: Number(item.VpqMaxWaitSeconds ?? 300),
      mediaFileUUID: item.VoipPabxMediaFileVmfUUID ?? '',
      enabled: item.VpqEnabled === 1,
    });
    this.resetMemberForm();
    void this.fetchMembers();
    this.openDialog();
  }

  async save(keepOpen = false) {
    if (this.saving()) return;
    if (!this.form().valid()) return;

    this.saving.set(true);
    try {
      const payload = this.payload();
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VpqUUID, payload);
        this.snack.success('Queue updated successfully.');
      } else {
        const response = await this.api.create(payload);
        await this.persistPendingMembers(
          (response?.data?.item ?? response?.data?.items?.[0]) as VoipPabxQueueItem | null,
        );
        this.snack.success('Queue created successfully.');
      }

      if (keepOpen && !editing) {
        this.resetForm();
        await this.fetchLookups();
      } else {
        this.closeDialog();
      }
      this.itemsResource.reload();
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to save queue.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.save(true);
  }

  async deleteItem(item: VoipPabxQueueItem) {
    const confirmed = await this.confirm(
      'Delete queue',
      `Delete queue "${item.VpqName}"? This will also remove its members.`,
      'Delete',
    );
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.remove(item.VpqUUID);
      this.snack.success('Queue deleted successfully.');
      this.selectedUUIDs.update((set) => {
        const next = new Set(set);
        next.delete(item.VpqUUID);
        return next;
      });
      this.itemsResource.reload();
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to delete queue.'));
    } finally {
      this.mutating.set(false);
    }
  }

  selectedCount() {
    return this.selectedUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const paginator = this.paginator();
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipPabxQueueItem) {
    return this.selectedUUIDs().has(item.VpqUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleSelection(item: VoipPabxQueueItem, checked: boolean) {
    this.selectedUUIDs.update((set) => {
      const next = new Set(set);
      if (checked) next.add(item.VpqUUID);
      else next.delete(item.VpqUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }

  async deleteSelected() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const names = this.dataSource.data
      .filter((row) => ids.includes(row.VpqUUID))
      .slice(0, 3)
      .map((row) => row.VpqName)
      .join(', ');
    const confirmed = await this.confirm(
      'Delete selected queues',
      `Delete ${ids.length} selected queue(s)?${names ? ` Examples: ${names}.` : ''}`,
      'Delete selected',
    );
    if (!confirmed) return;

    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VpqUUID));
      this.selectedUUIDs.set(new Set(failed));
      if (failed.length) {
        this.snack.warning(`${failed.length} selected queue(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size} selected queue(s) deleted successfully.`);
      }
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected queues.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  onPabxOpened(opened: boolean) {
    if (!opened) this.pabxSearch.set('');
  }

  onMediaFileOpened(opened: boolean) {
    if (!opened) this.mediaFileSearch.set('');
  }

  onMemberExtensionOpened(opened: boolean) {
    if (!opened) this.memberExtensionSearch.set('');
  }

  onPabxChange() {
    this.formModel.update((value) => ({ ...value, mediaFileUUID: '' }));
    this.mediaFileSearch.set('');
    this.memberFormModel.update((value) => ({ ...value, extensionUUID: '' }));
    this.memberRows.set([]);
    this.memberExtensionSearch.set('');
  }

  async addMember() {
    if (this.memberSaving()) return;
    if (!this.memberForm().valid()) return;

    const payload = this.memberPayload();
    if (!this.editing()) {
      this.memberRows.update((rows) => [...rows, this.pendingMemberRow(payload)]);
      this.resetMemberForm();
      return;
    }

    this.memberSaving.set(true);
    try {
      const response = await this.api.createMember(this.editing()!.VpqUUID, payload);
      this.memberRows.set((response?.data?.items ?? []) as VoipPabxQueueMemberItem[]);
      this.resetMemberForm();
      this.snack.success('Member added successfully.');
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to add member.'));
    } finally {
      this.memberSaving.set(false);
    }
  }

  async removeMember(row: VoipPabxQueueMemberItem) {
    const confirmed = await this.confirm(
      'Delete member',
      'Remove this member from the queue?',
      'Delete',
    );
    if (!confirmed) return;

    if (!this.editing()) {
      const memberUUID = this.memberUuidOf(row);
      this.memberRows.update((rows) =>
        rows.filter((member) => this.memberUuidOf(member) !== memberUUID),
      );
      return;
    }

    try {
      await this.api.removeMember(this.editing()!.VpqUUID, this.memberUuidOf(row));
      await this.fetchMembers();
      this.snack.success('Member removed successfully.');
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to remove member.'));
    }
  }

  isActive(item: VoipPabxQueueItem) {
    return item.VpqEnabled === 1;
  }

  closeDialog() {
    this.dialogBinding?.ref.close();
    this.dialogBinding?.stop();
    this.dialogBinding = null;
  }

  private async fetchLookups() {
    const [pabxResponse, extensionResponse, mediaFileResponse] = await Promise.all([
      this.pabxApi.list({ limit: this.listLimit }),
      this.extensionApi.list(new URLSearchParams({ limit: String(this.listLimit) })),
      this.mediaFileApi.list({ limit: this.listLimit, status: '1' }),
    ]);
    this.pabxOptions.set(
      (pabxResponse?.data?.items ?? []).map((item: VoipPabxAccount) => ({
        value: item.VpaUUID,
        label: item.VpaName,
      })),
    );
    this.extensionOptions.set(
      (extensionResponse?.data?.items ?? []).map((item: VoipPabxExtensionItem) => ({
        value: item.VpeUUID,
        label: item.VpeUsername,
        pabxUUID: item.VoipPabxAccountVpaUUID,
      })),
    );
    this.mediaFileOptions.set(
      (mediaFileResponse?.data?.items ?? []).map((item: VoipPabxMediaFileItem) => ({
        value: item.uuid,
        label: item.name,
        pabxUUID: item.pabxUUID,
      })),
    );
  }

  private async fetchItems(search: string): Promise<VoipPabxQueueItem[]> {
    await this.fetchLookups();
    const params = new URLSearchParams({ limit: String(this.listLimit) });
    if (search) params.set('search', search);
    const response = await this.api.list(params);
    return (response?.data?.items ?? []) as VoipPabxQueueItem[];
  }

  private async fetchMembers() {
    const editing = this.editing();
    if (!editing) {
      this.memberRows.set([]);
      return;
    }
    this.membersLoading.set(true);
    try {
      const response = await this.api.listMembers(editing.VpqUUID);
      this.memberRows.set((response?.data?.items ?? []) as VoipPabxQueueMemberItem[]);
    } catch (err) {
      this.snack.error(this.messageFromError(err, 'Failed to load queue members.'));
    } finally {
      this.membersLoading.set(false);
    }
  }

  private async persistPendingMembers(created: VoipPabxQueueItem | null) {
    if (!created?.VpqUUID || !this.memberRows().length) return;
    for (const member of this.memberRows()) {
      await this.api.createMember(created.VpqUUID, this.payloadFromMemberRow(member));
    }
  }

  private payload() {
    const value = this.formModel();
    return {
      pabxUUID: value.pabxUUID,
      name: value.name,
      strategy: value.strategy,
      timeoutSeconds: value.timeoutSeconds,
      retrySeconds: value.retrySeconds,
      maxWaitSeconds: value.maxWaitSeconds,
      mediaFileUUID: value.mediaFileUUID || null,
      enabled: value.enabled,
    };
  }

  private memberPayload() {
    const value = this.memberFormModel();
    return {
      extensionUUID: value.extensionUUID,
      priority: value.priority,
      penalty: value.penalty,
      enabled: value.enabled,
    };
  }

  private pendingMemberRow(payload: Record<string, unknown>): VoipPabxQueueMemberItem {
    const extensionUUID = String(payload['extensionUUID'] ?? '');
    const extension = this.extensionOptions().find((option) => option.value === extensionUUID);
    return {
      _localUUID: crypto.randomUUID(),
      VoipPabxExtensionVpeUUID: extensionUUID,
      ExtensionUsername: extension?.label ?? extensionUUID,
      VqmPriority: Number(payload['priority'] ?? 0),
      VqmPenalty: Number(payload['penalty'] ?? 0),
      VqmEnabled: payload['enabled'] ? 1 : 0,
    };
  }

  private payloadFromMemberRow(row: VoipPabxQueueMemberItem) {
    return {
      extensionUUID: row.VoipPabxExtensionVpeUUID,
      priority: row.VqmPriority ?? 0,
      penalty: row.VqmPenalty ?? 0,
      enabled: row.VqmEnabled === 1,
    };
  }

  private resetForm() {
    this.editing.set(null);
    this.pabxSearch.set('');
    this.mediaFileSearch.set('');
    this.memberExtensionSearch.set('');
    this.memberRows.set([]);
    this.formModel.set(this.emptyFormModel());
    this.resetMemberForm();
  }

  private resetMemberForm() {
    this.memberExtensionSearch.set('');
    this.memberFormModel.set(this.emptyMemberFormModel());
  }

  private emptyFormModel(): QueueFormModel {
    return {
      pabxUUID: '',
      name: '',
      strategy: 'ring_all',
      timeoutSeconds: 30,
      retrySeconds: 5,
      maxWaitSeconds: 300,
      mediaFileUUID: '',
      enabled: true,
    };
  }

  private emptyMemberFormModel(): QueueMemberFormModel {
    return {
      extensionUUID: '',
      priority: 0,
      penalty: 0,
      enabled: true,
    };
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, formDialog, 'voip-pabx-queue-dialog', {
      onEscape: () => this.closeDialog(),
    });
  }

  private async confirm(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private filterOptions(options: Option[], search: string) {
    const value = search.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.label.toLowerCase().includes(value));
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VpqUUID));
    this.selectedUUIDs.update((set) => {
      const next = new Set<string>();
      set.forEach((uuid) => {
        if (validIds.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private failedUUIDs(items: Array<Record<string, unknown>>) {
    return items
      .map((item) => String(item['VpqUUID'] ?? item['uuid'] ?? ''))
      .filter((uuid) => uuid.length > 0);
  }

  private memberUuidOf(row: VoipPabxQueueMemberItem) {
    return row.VqmUUID ?? row._localUUID ?? '';
  }

  private sortValue(row: VoipPabxQueueItem, column: string): string | number {
    switch (column) {
      case 'name':
        return this.sortText(row.VpqName);
      case 'pabx':
        return this.sortText(row.PabxName);
      case 'engine':
        return this.sortText(row.VpqEngine);
      case 'strategy':
        return this.sortText(row.VpqStrategy);
      case 'timeout':
        return Number(row.VpqTimeoutSeconds ?? 0);
      case 'status':
        return Number(row.VpqEnabled ?? 0);
      default:
        return this.sortText(String((row as any)[column] ?? ''));
    }
  }

  private sortText(value: string | null | undefined) {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  private messageFromError(err: unknown, fallback: string) {
    const anyErr = err as any;
    return anyErr?.error?.message || anyErr?.error?.error || anyErr?.message || fallback;
  }
}
