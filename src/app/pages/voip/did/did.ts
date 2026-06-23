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
import { createSignalCrudTable } from '../../../shared/crud/signal-crud-table';

import { ActivatedRoute } from '@angular/router';
import { FormField, form as createForm, pattern, required } from '@angular/forms/signals';

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

import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { VoipDidService, VoipDidItem } from './did.service';
import { VoipDidOperatorService, VoipDidOperatorItem } from './operator/operator.service';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { SnackbarService } from '../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogClosed, bindDialogEscape } from '../../../shared/dialog/dialog-events.util';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../../../shared/forms/mns-search-select-field/mns-search-select-field';

type OperatorOption = {
  value: string;
  label: string;
};

type DidFilters = {
  search: string;
  status: number | '';
  isMasterScope: boolean;
};

type CreateMode = 'single' | 'range';
type DidFormModel = {
  createMode: CreateMode;
  number: string;
  didRange: string;
  operatorUUID: string;
  status: number;
};

@Component({
  selector: 'app-voip-did',
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
    PhoneInputComponent,
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './did.html',
  styleUrls: ['./did.scss'],
})
export class VoipDidPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipDidService);
  private readonly operatorApi = inject(VoipDidOperatorService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDidItem | null>(null);
  readonly selectedDidUUIDs = signal<Set<string>>(new Set());
  readonly skippedExisting = signal<Array<{ number: string; reason: string }>>([]);
  readonly failedBulkItems = signal<Array<{ number: string; message: string }>>([]);
  readonly isMasterScope = signal(this.route.snapshot.data['scope'] === 'master');
  readonly availableDids = signal<VoipDidItem[]>([]);
  readonly availableLoading = signal(false);
  readonly claimingUUID = signal<string | null>(null);

  readonly operators = signal<OperatorOption[]>([]);
  readonly operatorOptions = computed<MnsSearchSelectFieldOption[]>(() => this.operators());
  readonly operatorMap = signal<Map<string, VoipDidOperatorItem>>(new Map());
  readonly rows = computed(() => this.didsResource.value());
  readonly table = createSignalCrudTable<VoipDidItem>(this.rows, (row, column) => this.sortValue(row, column));
  readonly sortActive = this.table.sortActive;
  readonly sortDirection = this.table.sortDirection;
  readonly pageIndex = this.table.pageIndex;
  readonly pageSize = this.table.pageSize;
  readonly sortedRows = this.table.sortedRows;
  readonly visibleRows = this.table.visibleRows;
  private readonly masterDisplayedColumns = ['select', 'number', 'operator', 'status', 'actions'];
  private readonly tenantDisplayedColumns = ['number', 'operator', 'status', 'actions'];
  readonly search = signal('');
  readonly searchInput = signal('');
  readonly statusInput = signal<number | ''>('');
  private readonly appliedSearch = signal('');
  private readonly appliedStatus = signal<number | ''>('');
  private readonly didsResource = resource({
    params: (): DidFilters => ({
      search: this.appliedSearch(),
      status: this.appliedStatus(),
      isMasterScope: this.isMasterScope(),
    }),
    defaultValue: [] as VoipDidItem[],
    loader: ({ params }) => this.fetchDids(params),
  });
  readonly loading = this.didsResource.isLoading;
  readonly availableSearch = signal('');
  readonly availableSearchInput = signal('');

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];
  readonly statusFilterOptions = [{ value: '', label: 'All' }, ...this.statusOptions];

  readonly formModel = signal<DidFormModel>(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.operatorUUID);
    required(schema.number, { when: () => this.isSingleMode() });
    pattern(schema.number, /^\d{8,15}$/, { when: () => this.isSingleMode() });
    required(schema.didRange, { when: () => this.isRangeMode() });
    pattern(schema.didRange, /^\s*\d{8,15}\s*-\s*\d{8,15}\s*$/, {
      when: () => this.isRangeMode(),
    });
  });
  readonly didFormDialog = viewChild<TemplateRef<unknown>>('didFormDialog');
  readonly availableDidDialog = viewChild<TemplateRef<unknown>>('availableDidDialog');
  private didFormDialogRef: MatDialogRef<unknown> | null = null;
  private availableDidDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly didsEffect = effect(() => {
    const dids = this.didsResource.value();
    this.rows();
    this.reconcileSelection(dids);
  });
  private readonly didsErrorEffect = effect(() => {
    const error = this.didsResource.error();
    if (!error) return;
    this.snack.error(this.extractErrorMessage(error, 'Failed to load DIDs.'));
    this.rows();
  });

  get displayedColumns() {
    return this.isMasterScope() ? this.masterDisplayedColumns : this.tenantDisplayedColumns;
  }

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeDidDialog();
    this.closeAvailableDidDialog();
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
    this.search.set(nextSearch);
    if (nextSearch === this.appliedSearch() && nextStatus === this.appliedStatus()) {
      this.didsResource.reload();
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
      this.didsResource.reload();
    }
  }

  selectedCount() {
    return this.selectedDidUUIDs().size;
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

  async fetchOperators() {
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

  private async fetchDids(filters: DidFilters): Promise<VoipDidItem[]> {
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
    await this.fetchOperators();
    this.didsResource.reload();
  }

  async openAvailableDids() {
    const availableDidDialog = this.availableDidDialog();
    if (this.isMasterScope() || !availableDidDialog || this.availableDidDialogRef) return;
    this.availableDidDialogRef = this.dialog.open(availableDidDialog, {
      panelClass: ['crud-dialog-panel', 'voip-did-available-dialog-panel'],
      width: 'min(960px, calc(100vw - 32px))',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: false,
    });
    bindDialogClosed(this.availableDidDialogRef, () => {
      this.availableDidDialogRef = null;
      this.availableSearchInput.set('');
      this.availableSearch.set('');
      this.availableDids.set([]);
      this.claimingUUID.set(null);
    });
    await this.fetchAvailableDids();
  }

  closeAvailableDidDialog() {
    this.availableDidDialogRef?.close();
    this.availableDidDialogRef = null;
  }

  onAvailableSearchChange(value: string) {
    this.availableSearchInput.set(value);
  }

  applyAvailableSearchFilters() {
    this.availableSearch.set(this.availableSearchInput().trim());
    void this.fetchAvailableDids();
  }

  clearAvailableSearchFilters() {
    this.availableSearchInput.set('');
    this.availableSearch.set('');
    void this.fetchAvailableDids();
  }

  async fetchAvailableDids() {
    if (this.isMasterScope()) return;
    this.availableLoading.set(true);
    try {
      const response = await this.api.available({
        search: this.availableSearch() || undefined,
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
      this.didsResource.reload();
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to contract DID.'));
      await this.fetchAvailableDids();
    } finally {
      this.claimingUUID.set(null);
    }
  }

  startCreate() {
    if (!this.isMasterScope()) return;
    this.resetForm();
    this.openDidDialog();
  }

  onCreateModeChange(value: CreateMode) {
    this.formModel.update((current) => ({ ...current, createMode: value }));
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);
  }

  isRangeMode() {
    return !this.editing() && this.formModel().createMode === 'range';
  }

  isSingleMode() {
    return !!this.editing() || this.formModel().createMode === 'single';
  }

  async submit(saveAndNew = false) {
    if (!this.form().valid()) return;

    const { number, didRange, operatorUUID, status, createMode } = this.formModel();
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
        this.didsResource.reload();

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

      this.didsResource.reload();
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
    this.formModel.set({
      createMode: 'single',
      number: item.VddNumber,
      didRange: '',
      operatorUUID: item.VoipDidOperatorVdoUUID,
      status: item.VddStatus,
    });
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
    this.rows();
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
    this.rows();
      this.snack.success('DID released successfully.');
    } catch (err: any) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to release DID.'));
    }
  }

  async removeSelectedDids() {
    const ids = [...this.selectedDidUUIDs()];
    if (!ids.length) return;

    const selectedNumbers = this.rows()
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
    this.rows();
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

  private resetForm() {
    this.formModel.set(this.emptyFormModel());
    this.editing.set(null);
    this.skippedExisting.set([]);
    this.failedBulkItems.set([]);
  }

  private reconcileSelection(items = this.rows()) {
    const available = new Set(items.map((item) => item.VddUUID));
    const current = untracked(() => this.selectedDidUUIDs());
    const next = new Set([...current].filter((uuid) => available.has(uuid)));
    if (next.size === current.size && [...next].every((uuid) => current.has(uuid))) return;
    this.selectedDidUUIDs.set(next);
  }

  private openDidDialog() {
    const didFormDialog = this.didFormDialog();
    if (!didFormDialog || this.didFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(this.dialog, didFormDialog, 'voip-did-form-dialog');
    this.didFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.didFormDialogRef, () => {
      this.cancelEdit();
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

  private emptyFormModel(): DidFormModel {
    return {
      createMode: 'single',
      number: '',
      didRange: '',
      operatorUUID: '',
      status: 1,
    };
  }
  private sortValue(row: VoipDidItem, column: string): string | number {
    const value = (row as Record<string, unknown>)[column];
    if (typeof value === 'number') return value;
    return String(value ?? '');
  }
}
