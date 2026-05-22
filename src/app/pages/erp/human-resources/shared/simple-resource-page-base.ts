import {
  AfterViewInit,
  Directive,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

export const HUMAN_RESOURCES_CRUD_IMPORTS = [
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
];

export type SimpleResource = {
  UUID: string;
  Name: string;
  Description?: string | null;
  Status: number;
  Notes?: string | null;
};

type SimpleResourceConfig = {
  endpoint: string;
  uuidField: string;
  pageTitle: string;
  pageDescription: string;
  dialogCreateTitle: string;
  dialogEditTitle: string;
  dialogDescription: string;
  deleteLabel: string;
};

@Directive()
export abstract class SimpleResourcePageBase implements AfterViewInit, OnDestroy {
  protected readonly api = inject(ApiService);
  protected readonly fb = inject(FormBuilder);
  protected readonly dialog = inject(MatDialog);
  protected readonly snack = inject(SnackbarService);
  protected readonly listLimit = 200;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<SimpleResource | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly selectedUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<SimpleResource>([]);
  readonly displayedColumns = ['select', 'name', 'description', 'status', 'actions'];
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    status: [1],
    notes: [''],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('resourceFormDialog') resourceFormDialog?: TemplateRef<unknown>;

  private dialogBinding: CrudDialogBinding | null = null;

  protected constructor(readonly config: SimpleResourceConfig) {}

  get pageTitle() {
    return this.config.pageTitle;
  }

  get pageDescription() {
    return this.config.pageDescription;
  }

  get dialogTitle() {
    return this.editing() ? this.config.dialogEditTitle : this.config.dialogCreateTitle;
  }

  get dialogDescription() {
    return this.config.dialogDescription;
  }

  get selectedCount() {
    return this.selectedUUIDs().size;
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'description':
          return data.Description ?? '';
        case 'status':
          return this.isActive(data) ? 'ACTIVE' : 'INACTIVE';
        default:
          return '';
      }
    };
    setTimeout(() => void this.loadItems(), 0);
  }

  ngOnDestroy() {
    this.closeDialog();
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
      const response = await this.api.get<any>(`${this.config.endpoint}?${params.toString()}`);
      this.dataSource.data = (response?.data?.items ?? []).map((row: any) => this.mapRow(row));
      this.reconcileSelection();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load records.'));
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
    this.form.reset({ name: '', description: '', status: 1, notes: '' });
    this.openDialog();
  }

  startEdit(item: SimpleResource) {
    this.editing.set(item);
    this.form.reset({
      name: item.Name ?? '',
      description: item.Description ?? '',
      status: Number(item.Status) || 1,
      notes: item.Notes ?? '',
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      status: value.status,
      notes: value.notes.trim() || null,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.config.endpoint}/${editing.UUID}`, payload);
        this.snack.success(`${this.config.deleteLabel} updated successfully.`);
      } else {
        await this.api.post(this.config.endpoint, payload);
        this.snack.success(`${this.config.deleteLabel} created successfully.`);
      }
      await this.loadItems();
      if (saveAndNew && createMode) {
        this.form.reset({ name: '', description: '', status: 1, notes: '' });
        this.editing.set(null);
        return;
      }
      this.closeDialog();
      this.form.reset({ name: '', description: '', status: 1, notes: '' });
      this.editing.set(null);
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save record.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.form.reset({ name: '', description: '', status: 1, notes: '' });
  }

  async deleteItem(item: SimpleResource) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: `Delete ${this.config.deleteLabel.toLowerCase()}`,
        message: `Are you sure you want to delete ${item.Name}?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete(`${this.config.endpoint}/${item.UUID}`);
      this.snack.success(`${this.config.deleteLabel} deleted successfully.`);
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete record.'));
    }
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedUUIDs());
    if (!ids.length) return;
    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.UUID))
      .slice(0, 3)
      .map((item) => item.Name)
      .join(', ');
    const suffix = labels ? ` Selected: ${labels}${ids.length > 3 ? ', ...' : ''}.` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: `Delete selected ${this.config.deleteLabel.toLowerCase()} records`,
        message: `Are you sure you want to delete ${ids.length} selected record(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading.set(true);
    try {
      const response = await this.api.delete<any>(`${this.config.endpoint}/bulk`, { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => this.extractBulkFailureUUID(item))
          .filter((uuid: string | null): uuid is string => !!uuid),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.UUID));
      this.selectedUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(`${failed.size} selected record(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} selected record(s) deleted.`);
      }
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected records.'));
    } finally {
      this.loading.set(false);
    }
  }

  isActive(item: SimpleResource) {
    const status = String(item.Status ?? '').toLowerCase();
    return status === '1' || status === 'active';
  }

  isSelected(item: SimpleResource) {
    return this.selectedUUIDs().has(item.UUID);
  }

  toggleSelection(item: SimpleResource, selected: boolean) {
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      if (selected) next.add(item.UUID);
      else next.delete(item.UUID);
      return next;
    });
  }

  visibleRows() {
    const filtered = this.dataSource.filteredData?.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    if (!this.paginator) return filtered;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return filtered.slice(start, start + this.paginator.pageSize);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedUUIDs().has(row.UUID));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    const selected = rows.filter((row) => this.selectedUUIDs().has(row.UUID)).length;
    return selected > 0 && selected < rows.length;
  }

  toggleVisibleSelection(selected: boolean) {
    const rows = this.visibleRows();
    this.selectedUUIDs.update((current) => {
      const next = new Set(current);
      rows.forEach((row) => {
        if (selected) next.add(row.UUID);
        else next.delete(row.UUID);
      });
      return next;
    });
  }

  private mapRow(row: any): SimpleResource {
    return {
      UUID: row[this.config.uuidField] ?? row.UUID ?? row.uuid,
      Name: row.Name ?? row.name ?? '',
      Description: row.Description ?? row.description ?? null,
      Status: Number(row.Status ?? row.status ?? 1),
      Notes: row.Notes ?? row.notes ?? null,
    };
  }

  private openDialog() {
    if (!this.resourceFormDialog || this.dialogBinding) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.resourceFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.dialogBinding.ref.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
    });
  }

  private closeDialog() {
    if (!this.dialogBinding) return;
    this.dialogBinding.ref.close();
    this.dialogBinding.stop();
    this.dialogBinding = null;
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
    this.selectedUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }
}
