import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
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
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './page.html',
  styleUrls: ['./page.scss'],
  animations: [fadeIn],
})
export class CrudPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly listLimit = 200;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Entity | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedEntityUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<Entity>([]);
  readonly displayedColumns = ['select', 'name', 'status', 'actions'];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    status: [1],
    notes: [''],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('entityFormDialog') entityFormDialog?: TemplateRef<unknown>;

  private entityDialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
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
    this.closeEntityDialog();
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

  refreshList() {
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    const start = performance.now();

    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search()) params.set('q', this.search());
      const response = await this.api.get<any>(`endpoint?${params.toString()}`);
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load items.'));
      this.dataSource.data = [];
      this.reconcileSelection();
    } finally {
      const elapsed = performance.now() - start;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({
      name: '',
      status: 1,
      notes: '',
    });
    this.openEntityDialog();
  }

  startEdit(item: Entity) {
    this.editing.set(item);
    this.form.reset({
      name: item.Name,
      status: Number(item.Status) || 1,
      notes: '',
    });
    this.openEntityDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
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

      await this.loadItems();

      if (saveAndNew && createMode) {
        this.form.reset({ name: '', status: 1, notes: '' });
        this.editing.set(null);
        return;
      }

      this.closeEntityDialog();
      this.form.reset({ name: '', status: 1, notes: '' });
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
    this.form.reset({ name: '', status: 1 });
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

    this.loading.set(true);
    try {
      await this.api.delete(`endpoint/${item.UUID}`);
      await this.loadItems();
      this.snack.success('Item deleted successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete item.'));
    } finally {
      this.loading.set(false);
    }
  }

  get selectedCount() {
    return this.selectedEntityUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: Entity) {
    return this.selectedEntityUUIDs().has(item.UUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
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
    const labels = this.dataSource.data
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

    this.loading.set(true);
    try {
      const response = await this.api.delete<any>('endpoint/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.UUID));
      this.selectedEntityUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(`${failed.size} selected item(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} selected item(s) deleted.`);
      }
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected items.'));
    } finally {
      this.loading.set(false);
    }
  }

  isActive(item: Entity) {
    const status = String(item.Status ?? '').toLowerCase();
    return status === '1' || status === 'active';
  }

  private openEntityDialog() {
    if (!this.entityFormDialog || this.entityDialogBinding) return;
    this.entityDialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.entityFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.entityDialogBinding.ref.afterClosed().subscribe(() => {
      this.entityDialogBinding?.stop();
      this.entityDialogBinding = null;
    });
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
    const available = new Set(this.dataSource.data.map((item) => item.UUID));
    this.selectedEntityUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
