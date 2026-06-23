import {
  Component,
  computed,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
  DestroyRef,
} from '@angular/core';
import { createSignalCrudTable } from '../../../../shared/crud/signal-crud-table';

import { ActivatedRoute } from '@angular/router';
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { VoipDidOperatorService, VoipDidOperatorItem } from './operator.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import { bindDialogClosed, bindDialogEscape } from '../../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';

type SupplierOption = { value: string; label: string };

type DidOperatorFilters = {
  search: string;
  status: number | '';
  isMasterScope: boolean;
};

type DidOperatorFormModel = {
  name: string;
  nick: string;
  supplierUUID: string;
  status: number;
};

@Component({
  selector: 'app-voip-did-operator',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './operator.html',
  styleUrls: ['./operator.scss'],
})
export class VoipDidOperatorPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDidOperatorService);
  private readonly route = inject(ActivatedRoute);
  private readonly coreApi = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDidOperatorItem | null>(null);
  readonly selectedOperatorUUIDs = signal<Set<string>>(new Set());
  readonly rows = computed(() => this.operatorsResource.value());
  readonly table = createSignalCrudTable<VoipDidOperatorItem>(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  readonly displayedColumns = ['select', 'name', 'nick', 'supplier', 'status', 'actions'];
  search = '';
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  private readonly operatorsResource = resource({
    params: (): DidOperatorFilters => ({
      search: this.appliedSearch(),
      status: this.appliedStatus(),
      isMasterScope: this.isMasterScope(),
    }),
    defaultValue: [] as VoipDidOperatorItem[],
    loader: ({ params }) => this.fetchOperators(params),
  });
  readonly loading = this.operatorsResource.isLoading;
  suppliers: SupplierOption[] = [];
  supplierMap = new Map<string, SupplierOption>();
  readonly suppliersReady = signal(false);
  readonly supplierOptions = computed<MnsSearchSelectFieldOption[]>(() => {
    this.suppliersReady();
    return [{ value: '', label: 'Unlinked' }, ...this.suppliers];
  });
  readonly isMasterScope = signal(false);

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];

  readonly formModel = signal<DidOperatorFormModel>({
    name: '',
    nick: '',
    supplierUUID: '',
    status: 1,
  });

  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.nick);
    minLength(schema.nick, 2);
  });
  readonly operatorFormDialog = viewChild<TemplateRef<unknown>>('operatorFormDialog');
  private operatorFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly operatorsEffect = effect(() => {
    const operators = this.operatorsResource.value();
    this.rows();
    this.reconcileSelection(operators);
  });
  private readonly operatorsErrorEffect = effect(() => {
    const error = this.operatorsResource.error();
    if (!error) return;
    this.snack.error(this.extractErrorMessage(error, 'Failed to load DID operators.'));
    this.rows();
  });

  private readonly initializePage = (() => {
    this.isMasterScope.set(this.route.snapshot.data['scope'] === 'master');
    void this.fetchSuppliers();
    this.operatorsResource.reload();

    return true;
  })();

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeOperatorDialog();
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }
  setSort(sort: Sort): void {
    this.table.setSort(sort);
  }

  setPage(page: PageEvent): void {
    this.table.setPage(page);
  }

  applySearchFilters() {
    const nextSearch = this.searchInput().trim();
    const nextStatus = this.statusInput();
    this.search = nextSearch;
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.operatorsResource.reload();
    } else {
      this.appliedSearch.set(nextSearch);
      this.appliedStatus.set(nextStatus);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.statusInput.set('');
    this.search = '';
    if (this.appliedSearch() || this.appliedStatus() !== '') {
      this.appliedSearch.set('');
      this.appliedStatus.set('');
    } else {
      this.operatorsResource.reload();
    }
  }

  selectedCount() {
    return this.selectedOperatorUUIDs().size;
  }

  isSelected(item: VoipDidOperatorItem) {
    return this.selectedOperatorUUIDs().has(item.VdoUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleOperatorSelection(item: VoipDidOperatorItem, checked: boolean) {
    const next = new Set(this.selectedOperatorUUIDs());
    if (checked) {
      next.add(item.VdoUUID);
    } else {
      next.delete(item.VdoUUID);
    }
    this.selectedOperatorUUIDs.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const rows = this.visibleRows();
    const next = new Set(this.selectedOperatorUUIDs());

    for (const row of rows) {
      if (checked) {
        next.add(row.VdoUUID);
      } else {
        next.delete(row.VdoUUID);
      }
    }

    this.selectedOperatorUUIDs.set(next);
  }

  clearSelection() {
    this.selectedOperatorUUIDs.set(new Set());
  }

  private async fetchOperators(filters: DidOperatorFilters): Promise<VoipDidOperatorItem[]> {
    const response = await this.api.list(
      {
        search: filters.search || undefined,
        status: filters.status === '' ? undefined : filters.status,
        limit: this.listLimit,
      },
      filters.isMasterScope,
    );
    return response?.data?.items ?? [];
  }

  async refreshList() {
    await this.fetchSuppliers();
    this.operatorsResource.reload();
  }

  async fetchSuppliers() {
    try {
      this.suppliersReady.set(false);
      const res = await this.coreApi.get<any>('erp/suppliers');
      const items = res?.data?.items ?? [];
      const mapped = items.map((item: any) => ({
        value: item.SupplierUUID,
        label: item.Name,
      }));
      this.suppliers = mapped;
      this.supplierMap = new Map(mapped.map((s: { value: string; label: string }) => [s.value, s]));
      this.suppliersReady.set(true);
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load suppliers.'));
    }
  }

  async submit(saveAndNew = false) {
    if (!this.form().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const { name, nick, status, supplierUUID } = this.formModel();
    const payload = { name, nick, supplierUUID: supplierUUID || null, status };

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VdoUUID, payload, this.isMasterScope());
        this.snack.success('DID operator updated successfully.');
      } else {
        await this.api.create(payload, this.isMasterScope());
        this.snack.success('DID operator created successfully.');
      }

      this.operatorsResource.reload();
      if (saveAndNew && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save DID operator.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewOperator() {
    void this.submit(true);
  }

  editOperator(item: VoipDidOperatorItem) {
    this.editing.set(item);
    this.formModel.set({
      name: item.VdoName,
      nick: item.VdoNick,
      supplierUUID: item.ErpSupplierSupUUID ?? '',
      status: item.VdoStatus,
    });
    this.openOperatorDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeOperatorDialog();
  }

  startCreate() {
    this.resetForm();
    this.openOperatorDialog();
  }

  async removeOperator(item: VoipDidOperatorItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Operator',
        message: `Are you sure you want to delete "${item.VdoName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VdoUUID, this.isMasterScope());
    this.rows();
      this.toggleOperatorSelection(item, false);
      this.snack.success('DID operator deleted successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete DID operator.'));
    }
  }

  async removeSelectedOperators() {
    const ids = [...this.selectedOperatorUUIDs()];
    if (!ids.length) return;

    const selectedNames = this.rows()
      .filter((item) => this.selectedOperatorUUIDs().has(item.VdoUUID))
      .slice(0, 3)
      .map((item) => item.VdoName)
      .join(', ');

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected operators',
        message: `Are you sure you want to delete ${ids.length} selected operator${ids.length === 1 ? '' : 's'}${selectedNames ? ` (${selectedNames}${ids.length > 3 ? ', ...' : ''})` : ''}?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);

    try {
      const response = await this.api.removeMany(ids, this.isMasterScope());
      const deleted = new Set<string>(response?.data?.deleted ?? []);
    this.rows();
      this.selectedOperatorUUIDs.set(
        new Set([...this.selectedOperatorUUIDs()].filter((uuid) => !deleted.has(uuid))),
      );

      const failed = response?.data?.failed ?? [];
      if (failed.length) {
        this.snack.warning(`${deleted.size} DID operator(s) deleted. ${failed.length} failed.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} DID operator(s) deleted.`);
      }
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected DID operators.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  private resetForm() {
    this.formModel.set({ name: '', nick: '', supplierUUID: '', status: 1 });
    this.editing.set(null);
  }

  private reconcileSelection(items = this.rows()) {
    const available = new Set(items.map((item) => item.VdoUUID));
    const current = untracked(() => this.selectedOperatorUUIDs());
    const next = new Set([...current].filter((uuid) => available.has(uuid)));
    if (next.size === current.size && [...next].every((uuid) => current.has(uuid))) return;
    this.selectedOperatorUUIDs.set(next);
  }

  supplierLabel(uuid?: string | null) {
    if (!uuid) return '-';
    return this.supplierMap.get(uuid)?.label ?? '-';
  }

  private openOperatorDialog() {
    const operatorFormDialog = this.operatorFormDialog();
    if (!operatorFormDialog || this.operatorFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      operatorFormDialog,
      'voip-did-operator-form-dialog',
    );
    this.operatorFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.operatorFormDialogRef, () => {
      this.cancelEdit();
    });
    bindDialogClosed(this.operatorFormDialogRef, () => {
      this.dialogBinding = null;
      this.operatorFormDialogRef = null;
    });
  }

  private closeOperatorDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.operatorFormDialogRef?.close();
    this.operatorFormDialogRef = null;
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object') {
      const err = error as any;
      return err?.error?.error || err?.error?.message || err?.message || fallback;
    }
    return fallback;
  }
  private sortValue(row: VoipDidOperatorItem, column: string): string | number {
    const value = (row as Record<string, unknown>)[column];
    if (typeof value === 'number') return value;
    return String(value ?? '');
  }
}
