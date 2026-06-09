import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';

import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { VoipDidOperatorService, VoipDidOperatorItem } from './operator.service';
import { TranslocoPipe } from '@jsverse/transloco';

type SupplierOption = { value: string; label: string };

@Component({
  selector: 'app-voip-did-operator',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './operator.html',
  styleUrls: ['./operator.scss'],
  animations: [fadeIn],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipDidOperatorPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDidOperatorService);
  private readonly route = inject(ActivatedRoute);
  private readonly coreApi = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  private readonly operatorsResource = resource({
    defaultValue: [] as VoipDidOperatorItem[],
    loader: () => this.fetchOperators(),
  });
  readonly loading = this.operatorsResource.isLoading;
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDidOperatorItem | null>(null);
  readonly selectedOperatorUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<VoipDidOperatorItem>([]);
  readonly displayedColumns = ['select', 'name', 'nick', 'supplier', 'status', 'actions'];
  search = '';
  searchInput = '';
  suppliers: SupplierOption[] = [];
  supplierMap = new Map<string, SupplierOption>();
  readonly suppliersReady = signal(false);
  readonly isMasterScope = signal(false);
  supplierSearch = '';

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nick: ['', [Validators.required, Validators.minLength(2)]],
    supplierUUID: [''],
    status: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly operatorFormDialog = viewChild<TemplateRef<unknown>>('operatorFormDialog');
  private operatorFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly operatorsEffect = effect(() => {
    this.dataSource.data = this.operatorsResource.value();
    this.reconcileSelection();
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  });
  private readonly operatorsErrorEffect = effect(() => {
    const error = this.operatorsResource.error();
    if (!error) return;
    this.snack.error(this.extractErrorMessage(error, 'Failed to load DID operators.'));
    this.dataSource.data = [];
  });

  ngOnInit() {
    this.isMasterScope.set(this.route.snapshot.data['scope'] === 'master');
    void this.loadSuppliers();
    this.operatorsResource.reload();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, column) => {
      switch (column) {
        case 'name':
          return data.VdoName ?? '';
        case 'nick':
          return data.VdoNick ?? '';
        case 'supplier':
          return this.supplierLabel(data.ErpSupplierSupUUID);
        case 'status':
          return data.VdoStatus ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const statusLabel = data.VdoStatus === 1 ? 'active' : 'inactive';
      const supplierLabel = this.supplierLabel(data.ErpSupplierSupUUID);
      return [data.VdoName, data.VdoNick, supplierLabel, statusLabel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.closeOperatorDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.operatorsResource.reload();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.operatorsResource.reload();
  }

  selectedCount() {
    return this.selectedOperatorUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;

    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
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

  private async fetchOperators(): Promise<VoipDidOperatorItem[]> {
    const response = await this.api.list(
      {
        search: this.search || undefined,
        limit: this.listLimit,
      },
      this.isMasterScope(),
    );
    return response?.data?.items ?? [];
  }

  async refreshList() {
    await this.loadSuppliers();
    this.operatorsResource.reload();
  }

  async loadSuppliers() {
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
      this.cdr.detectChanges();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load suppliers.'));
    }
  }

  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const { name, nick, status, supplierUUID } = this.form.getRawValue();
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
    this.form.patchValue({
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
      this.dataSource.data = this.dataSource.data.filter((row) => row.VdoUUID !== item.VdoUUID);
      this.toggleOperatorSelection(item, false);
      this.snack.success('DID operator deleted successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete DID operator.'));
    }
  }

  async removeSelectedOperators() {
    const ids = [...this.selectedOperatorUUIDs()];
    if (!ids.length) return;

    const selectedNames = this.dataSource.data
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
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VdoUUID));
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
    this.form.reset({ name: '', nick: '', supplierUUID: '', status: 1 });
    this.editing.set(null);
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.VdoUUID));
    const next = new Set([...this.selectedOperatorUUIDs()].filter((uuid) => available.has(uuid)));
    this.selectedOperatorUUIDs.set(next);
  }

  supplierLabel(uuid?: string | null) {
    if (!uuid) return '-';
    return this.supplierMap.get(uuid)?.label ?? '-';
  }

  get filteredSuppliers() {
    const value = this.supplierSearch.trim().toLowerCase();
    if (!value) return this.suppliers;
    return this.suppliers.filter((supplier) =>
      (supplier.label ?? '').toLowerCase().includes(value),
    );
  }

  onSupplierOpened(opened: boolean) {
    if (!opened) {
      this.supplierSearch = '';
    }
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
    this.operatorFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
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
}
