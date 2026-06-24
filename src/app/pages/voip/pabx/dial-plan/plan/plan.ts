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
import {
  FormField,
  form as createForm,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { VoipPabxDialPlanItem, VoipPabxDialPlanUiService } from '../dial-plan.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed } from '../../../../../shared/dialog/dialog-events.util';

type DialPlanListFilters = {
  search: string;
  status: number | '';
};

@Component({
  selector: 'app-voip-pabx-dial-plan-plan',
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
  templateUrl: './plan.html',
  styleUrls: ['./plan.scss'],
})
export class VoipPabxDialPlanPlanPage {
  private readonly api = inject(VoipPabxDialPlanUiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);
  private readonly listLimit = 5000;

  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  private readonly itemsResource = resource({
    params: () => ({ search: this.appliedSearch(), status: this.appliedStatus() }),
    defaultValue: [] as VoipPabxDialPlanItem[],
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
  readonly editing = signal<VoipPabxDialPlanItem | null>(null);
  readonly selectedUUIDs = signal<Set<string>>(new Set());
  readonly rows = computed(() => this.itemsResource.value());
  readonly table = createSignalCrudTable<VoipPabxDialPlanItem>(this.rows, (row, column) =>
    this.sortValue(row, column),
  );
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  readonly displayedColumns = ['select', 'name', 'code', 'default', 'status', 'actions'];

  readonly formModel = signal({
    name: '',
    code: '',
    description: '',
    isDefault: 0,
    enabled: 1,
  });
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.code);
    pattern(schema.code, /^[A-Za-z0-9][A-Za-z0-9_-]{1,39}$/);
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
    this.snack.error(this.messageFromError(error, this.t('Failed to load dial plans.')));
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

  private async fetchItems(filters: DialPlanListFilters): Promise<VoipPabxDialPlanItem[]> {
    const response = await this.api.listPlans({
      search: filters.search,
      status: filters.status,
      limit: this.listLimit,
    });
    return (response?.data?.items ?? []) as VoipPabxDialPlanItem[];
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  startEdit(item: VoipPabxDialPlanItem) {
    this.editing.set(item);
    this.formModel.set({
      name: item.name,
      code: item.code,
      description: item.description ?? '',
      isDefault: item.isDefault === 1 ? 1 : 0,
      enabled: item.enabled === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  async saveItem(saveAndNew = false) {
    if (!this.form().valid()) return;
    const value = this.formModel();
    const payload = {
      name: value.name.trim(),
      code: value.code.trim().toUpperCase(),
      description: value.description.trim() || null,
      isDefault: value.isDefault === 1,
      enabled: value.enabled === 1,
    };
    const createMode = !this.editing();
    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.api.updatePlan(editing.uuid, payload);
      else await this.api.createPlan(payload);
      this.snack.success(
        this.t(editing ? 'Dial plan updated successfully.' : 'Dial plan created successfully.'),
      );
      this.itemsResource.reload();
      if (saveAndNew && createMode) {
        this.resetForm();
        return;
      }
      this.cancelForm();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, this.t('Failed to save dial plan.')));
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
    this.formModel.set({ name: '', code: '', description: '', isDefault: 0, enabled: 1 });
  }

  async deleteItem(item: VoipPabxDialPlanItem) {
    const confirmed = await this.confirmDelete(
      this.t('Delete dial plan'),
      this.t('Delete dial plan "{{name}}"?', { name: item.name }),
      this.t('Delete'),
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      await this.api.removePlan(item.uuid);
      this.selectedUUIDs.update((current) => this.removeFromSet(current, item.uuid));
      this.snack.success(this.t('Dial plan deleted successfully.'));
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, this.t('Failed to delete dial plan.')));
    } finally {
      this.mutating.set(false);
    }
  }

  get selectedCount() {
    return this.selectedUUIDs().size;
  }

  isSelected(item: VoipPabxDialPlanItem) {
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

  toggleEntitySelection(item: VoipPabxDialPlanItem, checked: boolean) {
    this.selectedUUIDs.update((current) => this.toggleSet(current, item.uuid, checked));
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
      this.t('Delete selected dial plans'),
      this.t('Delete {{count}} selected dial plan(s)?', { count: ids.length }),
      this.t('Delete selected'),
    );
    if (!confirmed) return;
    this.mutating.set(true);
    try {
      const response = await this.api.removeManyPlans(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = this.failedUUIDs(response?.data?.failed ?? [], ['VdpUUID', 'uuid']);
      this.rows();
      this.selectedUUIDs.set(failed);
      if (failed.size)
        this.snack.error(
          this.t('{{count}} selected dial plan(s) could not be deleted.', {
            count: failed.size,
          }),
        );
      else
        this.snack.success(
          this.t('{{count}} selected dial plan(s) deleted.', { count: deleted.size || ids.length }),
        );
      this.itemsResource.reload();
    } catch (err: any) {
      this.snack.error(this.messageFromError(err, this.t('Failed to delete selected dial plans.')));
    } finally {
      this.mutating.set(false);
    }
  }

  isActive(item: VoipPabxDialPlanItem) {
    return Number(item.enabled ?? 0) === 1;
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

  private sortValue(row: VoipPabxDialPlanItem, column: string): string | number {
    if (column === 'default') return row.isDefault === 1 ? this.t('Yes') : this.t('No');
    if (column === 'status') return this.isActive(row) ? this.t('Active') : this.t('Inactive');
    return String((row as any)[column] ?? '');
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  private reconcileSelection() {
    const valid = new Set(this.rows().map((item) => item.uuid));
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

  private failedUUIDs(items: any[], keys: string[]) {
    return new Set<string>(
      items
        .map(
          (item) =>
            keys.map((key) => item?.[key]).find((value) => typeof value === 'string') ?? null,
        )
        .filter((uuid): uuid is string => !!uuid),
    );
  }

  private messageFromError(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
