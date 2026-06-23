import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSortModule, Sort, SortDirection } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { bindDialogClosed } from '../../../shared/dialog/dialog-events.util';
import {
  MnsStatusSelectFieldComponent,
  MnsTextFieldComponent,
  MnsTextareaFieldComponent,
} from '../../../shared/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type Entity = {
  UUID: string;
  Name: string;
  Status: number | string;
};

@Component({
  selector: 'app-crud',
  standalone: true,
  imports: [
    FormField,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatMenuModule,
    MatChipsModule,
    MnsStatusSelectFieldComponent,
    MnsTextFieldComponent,
    MnsTextareaFieldComponent,
    TranslocoPipe,
  ],
  templateUrl: './page.html',
  styleUrls: ['./page.scss'],
})
export class CrudPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  private readonly mutating = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Entity | null>(null);
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  readonly search = signal('');
  readonly status = signal<number | ''>('');
  readonly sortActive = signal('');
  readonly sortDirection = signal<SortDirection>('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly selectedEntityUUIDs = signal<Set<string>>(new Set());
  private readonly itemsResource = resource({
    params: () => ({ search: this.search(), status: this.status() }),
    defaultValue: [] as Entity[],
    loader: ({ params }) => this.fetchItems(params),
  });
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly rows = computed(() => this.itemsResource.value());
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly visibleRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly allVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  });
  readonly someVisibleSelected = computed(() => {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.allVisibleSelected();
  });
  readonly displayedColumns = ['select', 'name', 'status', 'actions'];

  readonly formModel = signal({
    name: '',
    status: 1,
    notes: '',
  });

  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
  });

  readonly entityFormDialog = viewChild<TemplateRef<unknown>>('entityFormDialog');

  private entityDialogBinding: CrudDialogBinding | null = null;

  private readonly cleanup = this.destroyRef.onDestroy(() => this.closeEntityDialog());

  private readonly syncSelection = effect(() => {
    this.rows();
    queueMicrotask(() => this.reconcileSelection());
  });

  private readonly reportLoadError = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.extractErrorMessage(error, 'Failed to load items.'));
  });

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.pageIndex.set(0);
    if (nextSearch === this.search() && nextStatus === this.status()) {
      this.itemsResource.reload();
    } else {
      this.search.set(nextSearch);
      this.status.set(nextStatus);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.pageIndex.set(0);
    if (this.search() || this.status() !== '') {
      this.search.set('');
      this.status.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  refreshList() {
    this.itemsResource.reload();
  }

  setSort(sort: Sort) {
    this.sortActive.set(sort.active || '');
    this.sortDirection.set(sort.direction || '');
    this.pageIndex.set(0);
  }

  setPage(page: PageEvent) {
    this.pageIndex.set(page.pageIndex);
    this.pageSize.set(page.pageSize);
  }

  private async fetchItems(filters: { search: string; status: number | '' }) {
    const params = new URLSearchParams();
    params.set('limit', String(this.listLimit));
    if (filters.search) params.set('q', filters.search);
    if (filters.status !== '') params.set('status', String(filters.status));
    const response = await this.api.get<any>(`endpoint?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  private reloadItems() {
    this.itemsResource.reload();
  }

  private async runMutation(action: () => Promise<void>) {
    this.mutating.set(true);
    try {
      await action();
    } finally {
      this.mutating.set(false);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set({
      name: '',
      status: 1,
      notes: '',
    });
    this.openEntityDialog();
  }

  startEdit(item: Entity) {
    this.editing.set(item);
    this.formModel.set({
      name: item.Name,
      status: Number(item.Status) || 1,
      notes: '',
    });
    this.openEntityDialog();
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;

    const value = this.formModel();
    const payload = {
      name: value.name.trim(),
      status: value.status,
      notes: value.notes.trim() || null,
    };
    const createMode = !this.editing();

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`endpoint/${editing.UUID}`, payload);
        this.snack.success('Item updated successfully.');
      } else {
        await this.api.post<any>('endpoint', payload);
        this.snack.success('Item created successfully.');
      }

      this.reloadItems();

      if (saveAndNew && createMode) {
        this.formModel.set({ name: '', status: 1, notes: '' });
        this.editing.set(null);
        return;
      }

      this.closeEntityDialog();
      this.formModel.set({ name: '', status: 1, notes: '' });
      this.editing.set(null);
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save item.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeEntityDialog();
    this.formModel.set({ name: '', status: 1, notes: '' });
    this.editing.set(null);
  }

  async deleteItem(item: Entity) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete item',
        message: `Are you sure you want to delete "${item.Name}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.runMutation(async () => {
      await this.api.delete(`endpoint/${item.UUID}`);
      this.reloadItems();
      this.snack.success('Item deleted successfully.');
    }).catch((err: any) => {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete item.'));
    });
  }

  get selectedCount() {
    return this.selectedEntityUUIDs().size;
  }

  isSelected(item: Entity) {
    return this.selectedEntityUUIDs().has(item.UUID);
  }

  isAllVisibleSelected() {
    return this.allVisibleSelected();
  }

  isSomeVisibleSelected() {
    return this.someVisibleSelected();
  }

  toggleEntitySelection(item: Entity, checked: boolean) {
    this.selectedEntityUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(item.UUID);
      } else {
        next.delete(item.UUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedEntityUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (checked) {
          next.add(row.UUID);
        } else {
          next.delete(row.UUID);
        }
      }
      return next;
    });
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedEntityUUIDs());
    if (!ids.length) return;
    const labels = this.rows()
      .filter((item) => ids.includes(item.UUID))
      .slice(0, 3)
      .map((item) => item.Name);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected items',
        message: `Are you sure you want to delete ${ids.length} selected item(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    await this.runMutation(async () => {
      const response = await this.api.delete<any>('endpoint/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.selectedEntityUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(`${failed.size} selected item(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} selected item(s) deleted.`);
      }
      this.reloadItems();
    }).catch((err: any) => {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected items.'));
    });
  }

  isActive(item: Entity) {
    const status = String(item.Status ?? '').toLowerCase();
    return status === '1' || status === 'active';
  }

  private openEntityDialog() {
    const entityFormDialog = this.entityFormDialog();
    if (!entityFormDialog || this.entityDialogBinding) return;
    this.entityDialogBinding = openCrudTemplateDialog(
      this.dialog,
      entityFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    bindDialogClosed(
      this.entityDialogBinding.ref,
      () => {
        this.entityDialogBinding?.stop();
        this.entityDialogBinding = null;
      },
      this.destroyRef,
    );
  }

  private closeEntityDialog() {
    if (!this.entityDialogBinding) return;
    this.entityDialogBinding.ref.close();
    this.entityDialogBinding.stop();
    this.entityDialogBinding = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private extractBulkFailureUUID(item: any): string | null {
    if (!item || typeof item !== 'object') return null;
    if (typeof item.UUID === 'string') return item.UUID;
    const uuidKey = Object.keys(item).find((key) => key.endsWith('UUID'));
    return uuidKey && typeof item[uuidKey] === 'string' ? item[uuidKey] : null;
  }

  private reconcileSelection() {
    const available = new Set(this.rows().map((item) => item.UUID));
    this.selectedEntityUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortRows(rows: Entity[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((left, right) => {
      const result = this.compareValues(this.sortValue(left, active), this.sortValue(right, active));
      return direction === 'asc' ? result : -result;
    });
  }

  private sortValue(item: Entity, column: string): string | number {
    switch (column) {
      case 'name':
        return item.Name ?? '';
      case 'status':
        return this.isActive(item) ? 'ACTIVE' : 'INACTIVE';
      default:
        return '';
    }
  }

  private compareValues(left: string | number, right: string | number) {
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }
}
