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
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipBlacklistItem, VoipBlacklistUiService } from '../blacklist.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';

@Component({
  selector: 'app-voip-pabx-blacklist-list',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
  templateUrl: './list.html',
  styleUrls: ['./list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxBlacklistListPage {
  private readonly api = inject(VoipBlacklistUiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly appliedSearch = signal('');
  private readonly itemsResource = resource({
    params: () => this.appliedSearch(),
    defaultValue: [] as VoipBlacklistItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  private readonly mutating = signal(false);
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly editing = signal<VoipBlacklistItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly dataSource = new MatTableDataSource<VoipBlacklistItem>([]);
  readonly displayedColumns = ['select', 'name', 'description', 'numbers', 'status', 'actions'];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    enabled: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load blacklists.'));
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

  private async fetchItems(search: string): Promise<VoipBlacklistItem[]> {
    const response = await this.api.list({ search, limit: this.listLimit });
    return (response?.data?.items ?? []) as VoipBlacklistItem[];
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({ name: '', description: '', enabled: 1 });
    this.openDialog();
  }

  startEdit(item: VoipBlacklistItem) {
    this.editing.set(item);
    this.form.reset({
      name: item.VbkName,
      description: item.VbkDescription ?? '',
      enabled: item.VbkEnabled === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || '',
      enabled: value.enabled === 1,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.api.update(editing.VbkUUID, payload);
      else await this.api.create(payload);
      this.snack.success(
        editing ? 'Blacklist updated successfully.' : 'Blacklist created successfully.',
      );
      this.itemsResource.reload();
      if (saveAndNew && createMode) {
        this.form.reset({ name: '', description: '', enabled: 1 });
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to save blacklist.'));
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
    this.form.reset({ name: '', description: '', enabled: 1 });
  }

  async deleteItem(item: VoipBlacklistItem) {
    const confirmed = await this.confirmDelete(
      'Delete blacklist',
      `Delete blacklist "${item.VbkName}"?`,
      'Delete',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.api.remove(item.VbkUUID);
      this.selectedUUIDs.update((current) => this.removeFromSet(current, item.VbkUUID));
      this.snack.success('Blacklist deleted successfully.');
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete blacklist.'));
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
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipBlacklistItem) {
    return this.selectedUUIDs().has(item.VbkUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleEntitySelection(item: VoipBlacklistItem, checked: boolean) {
    this.selectedUUIDs.update((current) => this.toggleSet(current, item.VbkUUID, checked));
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows())
        checked ? next.add(row.VbkUUID) : next.delete(row.VbkUUID);
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete selected blacklists',
      `Delete ${ids.length} selected blacklist(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VbkUUID));
      this.selectedUUIDs.set(failed);
      if (failed.size)
        this.snack.error(`${failed.size} selected blacklist(s) could not be deleted.`);
      else this.snack.success(`${deleted.size || ids.length} selected blacklist(s) deleted.`);
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, 'Failed to delete selected blacklists.'));
    } finally {
      this.mutating.set(false);
    }
  }

  isActive(item: VoipBlacklistItem) {
    return Number(item.VbkEnabled ?? 0) === 1;
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, formDialog, 'crud-form-dialog', {
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

  private sortValue(row: VoipBlacklistItem, column: string): string | number {
    if (column === 'name') return row.VbkName ?? '';
    if (column === 'description') return row.VbkDescription ?? '';
    if (column === 'numbers') return Number(row.ActiveNumberCount ?? 0);
    if (column === 'status') return this.isActive(row) ? 'ACTIVE' : 'INACTIVE';
    return '';
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((item) => item.VbkUUID));
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
        .map((item) => item?.uuid ?? item?.VbkUUID ?? null)
        .filter((uuid): uuid is string => !!uuid),
    );
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }
}
