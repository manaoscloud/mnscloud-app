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

import { fadeIn } from '../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipDidService, VoipDidItem } from './did.service';
import { VoipDidOperatorService, VoipDidOperatorItem } from './operator/operator.service';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { SnackbarService } from '../../../services/snackbar.service';

type OperatorOption = {
  value: string;
  label: string;
};

type CreateMode = 'single' | 'range';

@Component({
  selector: 'app-voip-did',
  standalone: true,
  imports: [
    CommonModule,
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
    PhoneInputComponent,
  ],
  templateUrl: './did.html',
  styleUrls: ['./did.scss'],
  animations: [fadeIn],
})
export class VoipDidPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDidService);
  private readonly operatorApi = inject(VoipDidOperatorService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDidItem | null>(null);
  readonly selectedDidUUIDs = signal<Set<string>>(new Set());
  readonly skippedExisting = signal<Array<{ number: string; reason: string }>>([]);
  readonly failedBulkItems = signal<Array<{ number: string; message: string }>>([]);
  readonly isMasterScope = signal(false);
  readonly availableDids = signal<VoipDidItem[]>([]);
  readonly availableLoading = signal(false);
  readonly claimingUUID = signal<string | null>(null);

  readonly operators = signal<OperatorOption[]>([]);
  readonly operatorMap = signal<Map<string, VoipDidOperatorItem>>(new Map());
  operatorSearch = '';

  readonly dataSource = new MatTableDataSource<VoipDidItem>([]);
  private readonly masterDisplayedColumns = ['select', 'number', 'operator', 'status', 'actions'];
  private readonly tenantDisplayedColumns = ['number', 'operator', 'status', 'actions'];
  search = '';
  searchInput = '';
  availableSearch = '';
  availableSearchInput = '';

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  readonly form = this.fb.nonNullable.group({
    createMode: ['single' as CreateMode],
    number: ['', [Validators.required, Validators.pattern(/^\d{8,15}$/)]],
    didRange: [''],
    operatorUUID: ['', [Validators.required]],
    status: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('didFormDialog') didFormDialog?: TemplateRef<unknown>;
  @ViewChild('availableDidDialog') availableDidDialog?: TemplateRef<unknown>;
  private didFormDialogRef: MatDialogRef<unknown> | null = null;
  private availableDidDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  get displayedColumns() {
    return this.isMasterScope() ? this.masterDisplayedColumns : this.tenantDisplayedColumns;
  }

  async ngAfterViewInit() {
    this.isMasterScope.set(this.route.snapshot.data['scope'] === 'master');
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'number':
          return data.VddNumber ?? '';
        case 'operator':
          return this.operatorLabel(data.VoipDidOperatorVdoUUID).toLowerCase();
        case 'status':
          return data.VddStatus ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const operatorLabel = this.operatorLabel(data.VoipDidOperatorVdoUUID).toLowerCase();
      const statusLabel = data.VddStatus === 1 ? 'active' : 'inactive';
      return [data.VddNumber, operatorLabel, statusLabel]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => void this.refreshList(), 0);
  }

  ngOnDestroy() {
    this.closeDidDialog();
    this.closeAvailableDidDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadDids();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadDids();
  }

  selectedCount() {
    return this.selectedDidUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;

    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipDidItem) {
    return this.selectedDidUUIDs().has(item.VddUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleDidSelection(item: VoipDidItem, checked: boolean) {
    const next = new Set(this.selectedDidUUIDs());
    if (checked) {
      next.add(item.VddUUID);
    } else {
      next.delete(item.VddUUID);
    }
    this.selectedDidUUIDs.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const rows = this.visibleRows();
    const next = new Set(this.selectedDidUUIDs());

    for (const row of rows) {
      if (checked) {
        next.add(row.VddUUID);
      } else {
        next.delete(row.VddUUID);
      }
    }

    this.selectedDidUUIDs.set(next);
  }

  async loadOperators() {
    try {
      const response = await this.operatorApi.list({ limit: this.listLimit }, this.isMasterScope());
      const items: VoipDidOperatorItem[] = response?.data?.items ?? [];
      const map = new Map<string, VoipDidOperatorItem>();
      items.forEach((item) => {
        map.set(item.VdoUUID, item);
        map.set(item.VdoUUID.toLowerCase(), item);
      });
      this.operatorMap.set(map);
      this.operators.set(
        items.map((item) => ({
          value: item.VdoUUID,
          label: item.VdoName,
        })),
      );
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load operators.'));
    }
  }

  async loadDids() {
    this.loading.set(true);
    const start = performance.now();

    try {
      const response = await this.api.list(
        {
          search: this.search || undefined,
          limit: this.listLimit,
        },
        this.isMasterScope(),
      );
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
      this.dataSource.filter = '';
      if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load DIDs.'));
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  async refreshList() {
    await this.loadOperators();
    await this.loadDids();
  }

  async openAvailableDids() {
    if (this.isMasterScope() || !this.availableDidDialog || this.availableDidDialogRef) return;
    this.availableDidDialogRef = this.dialog.open(this.availableDidDialog, {
      panelClass: ['crud-dialog-panel', 'voip-did-available-dialog-panel'],
      width: 'min(960px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: false,
    });
    this.availableDidDialogRef.afterClosed().subscribe(() => {
      this.availableDidDialogRef = null;
      this.availableSearchInput = '';
      this.availableSearch = '';
      this.availableDids.set([]);
      this.claimingUUID.set(null);
    });
    await this.loadAvailableDids();
  }

  closeAvailableDidDialog() {
    this.availableDidDialogRef?.close();
    this.availableDidDialogRef = null;
  }

  onAvailableSearchChange(value: string) {
    this.availableSearchInput = value;
  }

  applyAvailableSearchFilters() {
    this.availableSearch = this.availableSearchInput.trim();
    void this.loadAvailableDids();
  }

  clearAvailableSearchFilters() {
    this.availableSearchInput = '';
    this.availableSearch = '';
    void this.loadAvailableDids();
  }

  async loadAvailableDids() {
    if (this.isMasterScope()) return;
    this.availableLoading.set(true);
    try {
      const response = await this.api.available({
        search: this.availableSearch || undefined,
        limit: this.listLimit,
      });
      this.availableDids.set(response?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load available DIDs.'));
    } finally {
      this.availableLoading.set(false);
    }
  }

  async claimDid(item: VoipDidItem) {
    if (this.isMasterScope() || this.claimingUUID()) return;

    this.claimingUUID.set(item.VddUUID);
    try {
      await this.api.claim(item.VddUUID);
      this.snack.success('DID contracted successfully.');
      this.availableDids.set(this.availableDids().filter((row) => row.VddUUID !== item.VddUUID));
      await this.loadDids();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to contract DID.'));
      await this.loadAvailableDids();
    } finally {
      this.claimingUUID.set(null);
    }
  }

  startCreate() {
    if (!this.isMasterScope()) return;
    this.resetForm();
    this.syncCreateModeValidators();
    this.openDidDialog();
  }

  onCreateModeChange(value: CreateMode) {
    this.form.controls.createMode.setValue(value, { emitEvent: false });
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);
    this.syncCreateModeValidators();
  }

  isRangeMode() {
    return !this.editing() && this.form.controls.createMode.value === 'range';
  }

  isSingleMode() {
    return this.editing() || this.form.controls.createMode.value === 'single';
  }

  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { number, didRange, operatorUUID, status, createMode } = this.form.getRawValue();
    const payload = { number, operatorUUID, status };

    this.saving.set(true);
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VddUUID, payload, this.isMasterScope());
      } else if (createMode === 'range') {
        const parsedRange = this.parseRange(didRange);
        if (!parsedRange) {
          this.snack.error('Range must follow the format "551140000000-551140000099".');
          return;
        }

        if (parsedRange.total > 100) {
          this.snack.error('Range exceeds max size of 100 DIDs per operation.');
          return;
        }

        const response = await this.api.bulkCreate(
          {
            rangeStart: parsedRange.start,
            rangeEnd: parsedRange.end,
            operatorUUID,
            status,
          },
          this.isMasterScope(),
        );

        this.skippedExisting.set(response?.data?.skippedExisting ?? []);
        this.failedBulkItems.set(response?.data?.failed ?? []);
        await this.loadDids();

        if (!this.skippedExisting().length && !this.failedBulkItems().length) {
          this.snack.success('DID range created successfully.');
          this.cancelEdit();
          return;
        }

        this.snack.warning(response?.message ?? 'DID range completed with warnings.');
        return;
      } else {
        await this.api.create(payload, this.isMasterScope());
      }

      await this.loadDids();
      this.snack.success(editing ? 'DID updated successfully.' : 'DID created successfully.');
      if (saveAndNew && !editing) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save DID.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewDid() {
    void this.submit(true);
  }

  editDid(item: VoipDidItem) {
    if (!this.isMasterScope()) return;
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);
    this.editing.set(item);
    this.form.patchValue({
      createMode: 'single',
      number: item.VddNumber,
      didRange: '',
      operatorUUID: item.VoipDidOperatorVdoUUID,
      status: item.VddStatus,
    });
    this.syncCreateModeValidators();
    this.openDidDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeDidDialog();
  }

  async removeDid(item: VoipDidItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete DID',
        message: `Are you sure you want to delete "${item.VddNumber}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VddUUID, this.isMasterScope());
      this.dataSource.data = this.dataSource.data.filter((row) => row.VddUUID !== item.VddUUID);
      this.toggleDidSelection(item, false);
      this.snack.success('DID deleted successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete DID.'));
    }
  }

  async releaseDid(item: VoipDidItem) {
    if (this.isMasterScope()) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Release DID',
        message: `Release "${item.VddNumber}" from this tenant? Billing for this DID will be cancelled when the release succeeds.`,
        confirmLabel: 'Release',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.release(item.VddUUID);
      this.dataSource.data = this.dataSource.data.filter((row) => row.VddUUID !== item.VddUUID);
      this.snack.success('DID released successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to release DID.'));
    }
  }

  async removeSelectedDids() {
    const ids = [...this.selectedDidUUIDs()];
    if (!ids.length) return;

    const selectedNumbers = this.dataSource.data
      .filter((item) => this.selectedDidUUIDs().has(item.VddUUID))
      .slice(0, 3)
      .map((item) => item.VddNumber)
      .join(', ');

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected DIDs',
        message: `Are you sure you want to delete ${ids.length} selected DID${ids.length === 1 ? '' : 's'}${selectedNumbers ? ` (${selectedNumbers}${ids.length > 3 ? ', ...' : ''})` : ''}?`,
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
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VddUUID));
      this.selectedDidUUIDs.set(
        new Set([...this.selectedDidUUIDs()].filter((uuid) => !deleted.has(uuid))),
      );

      const failed = response?.data?.failed ?? [];
      if (failed.length) {
        this.snack.warning(`${deleted.size} DIDs deleted. ${failed.length} DIDs failed.`);
      } else {
        this.snack.success(`${deleted.size} DIDs deleted successfully.`);
      }
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected DIDs.'));
    } finally {
      this.deletingSelected.set(false);
    }
  }

  operatorLabel(uuid: string) {
    if (!uuid) return '';
    const normalized = uuid.toLowerCase();
    return (
      this.operatorMap().get(normalized)?.VdoName ?? this.operatorMap().get(uuid)?.VdoName ?? uuid
    );
  }

  get filteredOperators() {
    const value = this.operatorSearch.trim().toLowerCase();
    if (!value) return this.operators();
    return this.operators().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  onOperatorOpened(opened: boolean) {
    if (!opened) {
      this.operatorSearch = '';
    }
  }

  private resetForm() {
    this.form.reset({
      createMode: 'single',
      number: '',
      didRange: '',
      operatorUUID: '',
      status: 1,
    });
    this.editing.set(null);
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);
    this.syncCreateModeValidators();
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.VddUUID));
    const next = new Set([...this.selectedDidUUIDs()].filter((uuid) => available.has(uuid)));
    this.selectedDidUUIDs.set(next);
  }

  private openDidDialog() {
    if (!this.didFormDialog || this.didFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.didFormDialog,
      'voip-did-form-dialog',
    );
    this.didFormDialogRef = this.dialogBinding.ref;
    this.didFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeDidDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.didFormDialogRef?.close();
    this.didFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private syncCreateModeValidators() {
    const numberControl = this.form.controls.number;
    const rangeControl = this.form.controls.didRange;
    const createMode = this.form.controls.createMode.value;

    if (this.editing() || createMode === 'single') {
      numberControl.setValidators([Validators.required, Validators.pattern(/^\d{8,15}$/)]);
      rangeControl.clearValidators();
    } else {
      numberControl.clearValidators();
      rangeControl.setValidators([
        Validators.required,
        Validators.pattern(/^\s*\d{8,15}\s*-\s*\d{8,15}\s*$/),
      ]);
    }

    numberControl.updateValueAndValidity({ emitEvent: false });
    rangeControl.updateValueAndValidity({ emitEvent: false });
  }

  private parseRange(rangeText: string): { start: string; end: string; total: number } | null {
    const match = rangeText.trim().match(/^(\d{8,15})\s*-\s*(\d{8,15})$/);
    if (!match) return null;

    const start = match[1];
    const end = match[2];
    if (start.length !== end.length) return null;

    const startValue = BigInt(start);
    const endValue = BigInt(end);
    if (startValue > endValue) return null;

    return {
      start,
      end,
      total: Number(endValue - startValue + 1n),
    };
  }
}
