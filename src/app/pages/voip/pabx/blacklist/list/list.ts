import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { createSignalCrudTable } from '../../../../../shared/crud/signal-crud-table';

import { SnackbarService } from '../../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipBlacklistItem, VoipBlacklistUiService } from '../blacklist.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../../shared/dialog/dialog-events.util';
import type {
  ConfigurableCrudOption,
  ConfigurableCrudQuickCreateResult,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';

type BlacklistListFilters = {
  search: string;
  status: number | '';
};

@Component({
  selector: 'app-voip-pabx-blacklist-list',
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
  templateUrl: './list.html',
  styleUrls: ['./list.scss'],
})
export class VoipPabxBlacklistListPage {
  private readonly api = inject(VoipBlacklistUiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  private readonly itemsResource = resource({
    params: () => ({ search: this.appliedSearch(), status: this.appliedStatus() }),
    defaultValue: [] as VoipBlacklistItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  private readonly mutating = signal(false);
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  readonly search = signal('');
  readonly statusFilterOptions = [
    { value: '', label: 'All' },
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly editing = signal<VoipBlacklistItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly rows = computed(() => this.itemsResource.value());
  readonly table = createSignalCrudTable<VoipBlacklistItem>(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  readonly displayedColumns = ['select', 'name', 'description', 'numbers', 'status', 'actions'];

  readonly formModel = signal({
    name: '',
    description: '',
    enabled: 1,
  });
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
  });
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.rows();
    this.reconcileSelection();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.messageFromError(error, 'Failed to load blacklists.'));
    this.rows();
    this.reconcileSelection();
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDialog();
  });
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  refreshList() {
    this.itemsResource.reload();
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.search.set(nextSearch);
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.itemsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search.set('');
    if (this.appliedSearch() || this.appliedStatus() !== '') {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.itemsResource.reload();
    }
  }

  private async fetchItems(filters: BlacklistListFilters): Promise<VoipBlacklistItem[]> {
    const response = await this.api.list({
      search: filters.search,
      status: filters.status,
      limit: this.listLimit,
    });
    return (response?.data?.items ?? []) as VoipBlacklistItem[];
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  startEdit(item: VoipBlacklistItem) {
    this.editing.set(item);
    this.formModel.set({
      name: item.VbkName,
      description: item.VbkDescription ?? '',
      enabled: item.VbkEnabled === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;
    const value = this.formModel();
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
        this.resetForm();
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
    this.resetForm();
  }

  private resetForm() {
    this.formModel.set({ name: '', description: '', enabled: 1 });
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
    this.rows();
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
    bindDialogClosed(this.dialogBinding.ref, () => {
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
    const valid = new Set(this.rows().map((item) => item.VbkUUID));
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

@Component({
  selector: 'app-voip-pabx-blacklist-list-quick-create-host',
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
  templateUrl: './list.html',
  styleUrls: ['./list.scss', '../../../../erp/customer/customer-quick-create-host.scss'],
})
export class VoipPabxBlacklistListQuickCreateHostComponent extends VoipPabxBlacklistListPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<
      VoipPabxBlacklistListQuickCreateHostComponent,
      ConfigurableCrudQuickCreateResult
    >,
  );
  private readonly quickLookupApi = inject(VoipBlacklistUiService);
  private savingFromQuickCreate = false;

  constructor() {
    super();
    queueMicrotask(() => this.startCreate());
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    const name = this.formModel().name.trim();
    this.savingFromQuickCreate = true;
    try {
      await super.saveItem(saveAndNew);
      if (!this.editing() && name) {
        this.quickDialogRef.close({
          option: await this.findCreatedOption(name),
          payload: { name },
        });
      }
    } finally {
      this.savingFromQuickCreate = false;
    }
  }

  override cancelForm() {
    super.cancelForm();
    if (!this.savingFromQuickCreate) {
      this.quickDialogRef.close({ option: null });
    }
  }

  private async findCreatedOption(name: string): Promise<ConfigurableCrudOption | null> {
    const response = await this.quickLookupApi.list({ search: name, status: 1, limit: 20 });
    const rows = (response?.data?.items ?? []) as VoipBlacklistItem[];
    const exact = rows.find((row) => row.VbkName.toLowerCase() === name.toLowerCase()) ?? rows[0];
    if (!exact) return null;
    return {
      value: exact.VbkUUID,
      label: exact.VbkName,
      description: exact.VbkDescription ?? '',
      searchText: `${exact.VbkName} ${exact.VbkDescription ?? ''} ${exact.VbkUUID}`,
    };
  }
}
