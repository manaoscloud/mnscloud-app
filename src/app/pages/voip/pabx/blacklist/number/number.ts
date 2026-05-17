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

import { SnackbarService } from '../../../../../services/snackbar.service';
import { fadeIn } from '../../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  VoipBlacklistItem,
  VoipBlacklistNumberItem,
  VoipBlacklistUiService,
} from '../blacklist.service';

@Component({
  selector: 'app-voip-pabx-blacklist-number',
  standalone: true,
  imports: [
    CommonModule,
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
    MatTooltipModule,
  ],
  templateUrl: './number.html',
  styleUrls: ['./number.scss'],
  animations: [fadeIn],
})
export class VoipPabxBlacklistNumberPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(VoipBlacklistUiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly blacklistFilter = signal('');
  readonly blacklistSearch = signal('');
  readonly lists = signal<VoipBlacklistItem[]>([]);
  readonly editing = signal<VoipBlacklistNumberItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly dataSource = new MatTableDataSource<VoipBlacklistNumberItem>([]);
  readonly displayedColumns = [
    'select',
    'number',
    'blacklist',
    'matchType',
    'action',
    'priority',
    'status',
    'actions',
  ];
  readonly filteredLists = computed(() => {
    const term = this.blacklistSearch().trim().toLowerCase();
    if (!term) return this.lists();
    return this.lists().filter((item) => item.VbkName.toLowerCase().includes(term));
  });

  readonly form = this.fb.nonNullable.group({
    blacklistUUID: ['', [Validators.required]],
    number: ['', [Validators.required, Validators.minLength(2)]],
    matchType: ['exact', [Validators.required]],
    action: ['reject', [Validators.required]],
    cause: ['CALL_REJECTED'],
    reason: [''],
    priority: [100],
    enabled: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('formDialog') formDialog?: TemplateRef<unknown>;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => void this.bootstrap(), 0);
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  async bootstrap() {
    await this.loadLists();
    await this.loadItems();
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
    this.blacklistFilter.set('');
    void this.loadItems();
  }

  onBlacklistOpened(opened: boolean) {
    if (!opened) this.blacklistSearch.set('');
  }

  async loadLists() {
    const response = await this.api.list({ limit: this.listLimit });
    this.lists.set((response?.data?.items ?? []) as VoipBlacklistItem[]);
  }

  async loadItems() {
    this.loading.set(true);
    const start = performance.now();
    try {
      const response = await this.api.listNumbers(this.blacklistFilter(), {
        search: this.search(),
        limit: this.listLimit,
      });
      this.dataSource.data = (response?.data?.items ?? []) as VoipBlacklistNumberItem[];
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to load blacklist numbers.'));
      this.dataSource.data = [];
      this.reconcileSelection();
    } finally {
      await this.finishLoading(start);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      blacklistUUID: this.blacklistFilter() || this.lists()[0]?.VbkUUID || '',
      number: '',
      matchType: 'exact',
      action: 'reject',
      cause: 'CALL_REJECTED',
      reason: '',
      priority: 100,
      enabled: 1,
    });
    this.openDialog();
  }

  startEdit(item: VoipBlacklistNumberItem) {
    this.editing.set(item);
    this.form.reset({
      blacklistUUID: item.VoipBlacklistVbkUUID,
      number: item.VbnNumber,
      matchType: item.VbnMatchType,
      action: item.VbnAction,
      cause: item.VbnCause ?? 'CALL_REJECTED',
      reason: item.VbnReason ?? '',
      priority: Number(item.VbnPriority ?? 100),
      enabled: item.VbnEnabled === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
      blacklistUUID: value.blacklistUUID,
      number: value.number.trim(),
      matchType: value.matchType,
      action: value.action,
      cause: value.cause.trim() || null,
      reason: value.reason.trim() || null,
      priority: Number(value.priority ?? 100),
      enabled: value.enabled === 1,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.api.updateNumber(editing.VbnUUID, payload);
      else await this.api.createNumber(payload);
      this.snack.success(
        editing
          ? 'Blacklist number updated successfully.'
          : 'Blacklist number created successfully.',
      );
      await this.loadItems();
      if (saveAndNew && createMode) {
        this.startCreate();
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to save blacklist number.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    if (!this.editing()) void this.saveItem(true);
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
  }

  async deleteItem(item: VoipBlacklistNumberItem) {
    const confirmed = await this.confirmDelete(
      'Delete blacklist number',
      `Delete number "${item.VbnNumber}"?`,
      'Delete',
    );
    if (!confirmed) return;
    this.loading.set(true);
    try {
      await this.api.removeNumber(item.VbnUUID);
      this.selectedUUIDs.update((current) => this.removeFromSet(current, item.VbnUUID));
      this.snack.success('Blacklist number deleted successfully.');
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete blacklist number.'));
    } finally {
      this.loading.set(false);
    }
  }

  get selectedCount() {
    return this.selectedUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipBlacklistNumberItem) {
    return this.selectedUUIDs().has(item.VbnUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleEntitySelection(item: VoipBlacklistNumberItem, checked: boolean) {
    this.selectedUUIDs.update((current) => this.toggleSet(current, item.VbnUUID, checked));
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows())
        checked ? next.add(row.VbnUUID) : next.delete(row.VbnUUID);
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete selected numbers',
      `Delete ${ids.length} selected number(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.loading.set(true);
    try {
      const response = await this.api.removeManyNumbers(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VbnUUID));
      this.selectedUUIDs.set(failed);
      if (failed.size) this.snack.error(`${failed.size} selected number(s) could not be deleted.`);
      else this.snack.success(`${deleted.size || ids.length} selected number(s) deleted.`);
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected numbers.'));
    } finally {
      this.loading.set(false);
    }
  }

  listLabel(uuid: string, fallback?: string | null) {
    return fallback || this.lists().find((item) => item.VbkUUID === uuid)?.VbkName || uuid || '-';
  }

  isActive(item: VoipBlacklistNumberItem) {
    return Number(item.VbnEnabled ?? 0) === 1;
  }

  private openDialog() {
    if (!this.formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, this.formDialog, 'crud-form-dialog', {
      onEscape: () => this.cancelForm(),
    });
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding?.ref.close();
    this.dialogBinding = null;
  }

  private async confirmDelete(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private sortValue(row: VoipBlacklistNumberItem, column: string): string | number {
    if (column === 'blacklist') return this.listLabel(row.VoipBlacklistVbkUUID, row.BlacklistName);
    if (column === 'number') return row.VbnNumber ?? '';
    if (column === 'matchType') return row.VbnMatchType ?? '';
    if (column === 'action') return row.VbnAction ?? '';
    if (column === 'priority') return Number(row.VbnPriority ?? 0);
    if (column === 'status') return this.isActive(row) ? 'ACTIVE' : 'INACTIVE';
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((item) => item.VbnUUID));
    this.selectedUUIDs.update(
      (current) => new Set(Array.from(current).filter((uuid) => valid.has(uuid))),
    );
  }

  private toggleSet(current: Set<string>, uuid: string, checked: boolean) {
    const next = new Set(current);
    checked ? next.add(uuid) : next.delete(uuid);
    return next;
  }

  private removeFromSet(current: Set<string>, uuid: string) {
    const next = new Set(current);
    next.delete(uuid);
    return next;
  }

  private failedUUIDs(items: any[]) {
    return new Set<string>(
      items
        .map((item) => item?.uuid ?? item?.VbnUUID ?? null)
        .filter((uuid): uuid is string => !!uuid),
    );
  }

  private async finishLoading(start: number) {
    const waitMs = Math.max(0, 600 - (performance.now() - start));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.loading.set(false);
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
