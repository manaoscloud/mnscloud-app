import {
  DatePipe } from '@angular/common';
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

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { VoipPabxExtensionItem, VoipPabxExtensionService } from '../extension/extension.service';
import { VoipPabxQueueAgentItem, VoipPabxQueueAgentService } from './queue-agent.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type RuntimeStatus = VoipPabxQueueAgentItem['VqaRuntimeStatus'];
type RuntimeAction = 'login' | 'logout' | 'pause' | 'unpause';

type LookupOption = {
  uuid: string;
  label: string;
  detail?: string | null;
};

type QueueAgentFilters = {
  search: string;
  runtimeStatus: RuntimeStatus | '';
  status: '1' | '0' | '';
};

const emptyQueueAgentFilters = (): QueueAgentFilters => ({
  search: '',
  runtimeStatus: '',
  status: '',
});

@Component({
  selector: 'app-voip-pabx-queue-agent',
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
    DatePipe,
  ],
  templateUrl: './queue-agent.html',
  styleUrls: ['./queue-agent.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPabxQueueAgentPage {
  private readonly api = inject(VoipPabxQueueAgentService);
  private readonly extensionApi = inject(VoipPabxExtensionService);
  private readonly genericApi = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly listLimit = 5000;

  private readonly appliedFilters = signal<QueueAgentFilters>(emptyQueueAgentFilters());
  private readonly itemsResource = resource({
    params: () => this.appliedFilters(),
    defaultValue: [] as VoipPabxQueueAgentItem[],
    loader: ({ params }) => this.fetchItems(params),
  });
  private readonly mutating = signal(false);
  readonly loading = computed(() => this.itemsResource.isLoading() || this.mutating());
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipPabxQueueAgentItem | null>(null);
  readonly searchInput = signal('');
  readonly search = signal('');
  readonly runtimeFilter = signal<RuntimeStatus | ''>('');
  readonly statusFilter = signal<'1' | '0' | ''>('');
  readonly employeeSearch = signal('');
  readonly extensionSearch = signal('');
  readonly employeeOptions = signal<LookupOption[]>([]);
  readonly extensionOptions = signal<LookupOption[]>([]);
  readonly selectedQueueAgentUUIDs = signal<Set<string>>(new Set());

  readonly dataSource = new MatTableDataSource<VoipPabxQueueAgentItem>([]);
  readonly displayedColumns = [
    'select',
    'loginCode',
    'employee',
    'extension',
    'runtime',
    'status',
    'lastStatus',
    'actions',
  ];

  readonly form = this.fb.nonNullable.group({
    employeeUUID: ['', Validators.required],
    extensionUUID: ['', Validators.required],
    loginCode: ['', [Validators.required, Validators.maxLength(32)]],
    displayName: ['', Validators.maxLength(150)],
    runtimeStatus: ['LOGGED_OUT' as RuntimeStatus, Validators.required],
    pauseReason: ['', Validators.maxLength(120)],
    enabled: [true],
  });

  readonly filteredEmployeeOptions = computed(() =>
    this.filterOptions(this.employeeOptions(), this.employeeSearch()),
  );

  readonly filteredExtensionOptions = computed(() =>
    this.filterOptions(this.extensionOptions(), this.extensionSearch()),
  );

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly queueAgentFormDialog = viewChild<TemplateRef<unknown>>('queueAgentFormDialog');

  private queueAgentDialogBinding: CrudDialogBinding | null = null;
  private readonly itemsEffect = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
  });
  private readonly itemsErrorEffect = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.dataSource.data = [];
    this.reconcileSelection();
    this.snack.error(this.extractErrorMessage(error, 'Failed to load queue agents.'));
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (row, column) => {
      switch (column) {
        case 'loginCode':
          return row.VqaLoginCode ?? '';
        case 'employee':
          return this.employeeLabel(row);
        case 'extension':
          return this.extensionLabel(row);
        case 'runtime':
          return this.runtimeLabel(row.VqaRuntimeStatus);
        case 'status':
          return this.isActive(row) ? 'ACTIVE' : 'INACTIVE';
        case 'lastStatus':
          return row.VqaLastStatusAt ?? '';
        default:
          return '';
      }
    };

    void this.bootstrap();
  
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeQueueAgentDialog();
  
  });

  async bootstrap() {
    await this.loadLookups();
    this.itemsResource.reload();
  }

  applySearchFilters() {
    const nextFilters = this.currentQueueAgentFilters();
    this.search.set(nextFilters.search);
    this.resetPaginator();
    if (this.sameQueueAgentFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.runtimeFilter.set('');
    this.statusFilter.set('');
    this.resetPaginator();
    const nextFilters = emptyQueueAgentFilters();
    if (this.sameQueueAgentFilters(nextFilters, this.appliedFilters())) {
      this.itemsResource.reload();
    } else {
      this.appliedFilters.set(nextFilters);
    }
  }

  refreshList() {
    this.itemsResource.reload();
  }

  private async fetchItems(filters: QueueAgentFilters): Promise<VoipPabxQueueAgentItem[]> {
    const params = new URLSearchParams({ limit: String(this.listLimit) });
    if (filters.search) params.set('search', filters.search);
    if (filters.runtimeStatus) params.set('runtimeStatus', filters.runtimeStatus);
    if (filters.status) params.set('status', filters.status);

    const response = await this.api.list(params);
    return response?.data?.items ?? [];
  }

  private currentQueueAgentFilters(): QueueAgentFilters {
    return {
      search: this.searchInput().trim(),
      runtimeStatus: this.runtimeFilter(),
      status: this.statusFilter(),
    };
  }

  private sameQueueAgentFilters(left: QueueAgentFilters, right: QueueAgentFilters) {
    return (
      left.search === right.search &&
      left.runtimeStatus === right.runtimeStatus &&
      left.status === right.status
    );
  }

  async loadLookups() {
    try {
      const [employeesResponse, extensionsResponse] = await Promise.all([
        this.genericApi.get<any>('erp/human-resources/employees?limit=5000'),
        this.extensionApi.list(new URLSearchParams({ limit: '5000' })),
      ]);

      this.employeeOptions.set(
        (employeesResponse?.data?.items ?? []).map((item: any) => ({
          uuid: item.EmployeeUUID,
          label: item.Name ?? item.EmployeeName ?? item.EmpName ?? item.EmployeeUUID,
          detail: item.Email ?? item.EmployeeEmail ?? item.EmpEmail ?? null,
        })),
      );

      this.extensionOptions.set(
        ((extensionsResponse?.data?.items ?? []) as VoipPabxExtensionItem[]).map((item) => ({
          uuid: item.VpeUUID,
          label: item.VpeUsername,
          detail: item.PabxName ?? item.DomainName ?? null,
        })),
      );
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load employees and extensions.'));
    }
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openQueueAgentDialog();
  }

  startEdit(item: VoipPabxQueueAgentItem) {
    this.editing.set(item);
    this.form.reset({
      employeeUUID: item.ErpHrEmployeeEmpUUID,
      extensionUUID: item.VoipPabxExtensionVpeUUID,
      loginCode: item.VqaLoginCode,
      displayName: item.VqaDisplayName ?? '',
      runtimeStatus: item.VqaRuntimeStatus,
      pauseReason: item.VqaPauseReason ?? '',
      enabled: item.VqaEnabled === 1,
    });
    this.openQueueAgentDialog();
  }

  async saveItem(saveAndNew = false) {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const payload = {
      employeeUUID: value.employeeUUID,
      extensionUUID: value.extensionUUID,
      loginCode: value.loginCode.trim(),
      displayName: value.displayName.trim() || null,
      runtimeStatus: value.runtimeStatus,
      pauseReason: value.runtimeStatus === 'PAUSED' ? value.pauseReason.trim() || null : null,
      enabled: value.enabled,
    };
    const createMode = !this.editing();

    this.saving.set(true);
    try {
      const editing = this.editing();
      if (editing) {
        await this.api.update(editing.VqaUUID, payload);
        this.snack.success('Queue agent updated successfully.');
      } else {
        await this.api.create(payload);
        this.snack.success('Queue agent created successfully.');
      }

      this.itemsResource.reload();

      if (saveAndNew && createMode) {
        this.resetForm();
        this.editing.set(null);
        return;
      }

      this.cancelForm();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save queue agent.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewItem() {
    if (this.editing()) return;
    void this.saveItem(true);
  }

  cancelForm() {
    this.closeQueueAgentDialog();
    this.resetForm();
    this.editing.set(null);
  }

  async deleteItem(item: VoipPabxQueueAgentItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete queue agent',
        message: `Are you sure you want to delete "${this.rowLabel(item)}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.mutating.set(true);
    try {
      await this.api.remove(item.VqaUUID);
      this.itemsResource.reload();
      this.selectedQueueAgentUUIDs.update((current) => {
        const next = new Set(current);
        next.delete(item.VqaUUID);
        return next;
      });
      this.snack.success('Queue agent deleted successfully.');
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete queue agent.'));
    } finally {
      this.mutating.set(false);
    }
  }

  async deleteSelectedItems() {
    const ids = Array.from(this.selectedQueueAgentUUIDs());
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((item) => ids.includes(item.VqaUUID))
      .slice(0, 3)
      .map((item) => this.rowLabel(item));
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected queue agents',
        message: `Are you sure you want to delete ${ids.length} selected queue agent(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    this.mutating.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? [])
          .map((item: any) => item?.VqaUUID)
          .filter((uuid: string | null): uuid is string => !!uuid),
      );

      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VqaUUID));
      this.selectedQueueAgentUUIDs.set(failed);
      if (failed.size) {
        this.snack.error(`${failed.size} selected queue agent(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} selected queue agent(s) deleted.`);
      }
      this.itemsResource.reload();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected queue agents.'));
    } finally {
      this.deletingSelected.set(false);
      this.mutating.set(false);
    }
  }

  async setRuntime(item: VoipPabxQueueAgentItem, action: RuntimeAction) {
    try {
      await this.api.setStatus(
        item.VqaUUID,
        action,
        action === 'pause' ? 'Manual pause' : undefined,
      );
      this.itemsResource.reload();
      this.snack.success('Queue agent status updated successfully.');
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to update queue agent status.'));
    }
  }

  get selectedCount() {
    return this.selectedQueueAgentUUIDs().size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipPabxQueueAgentItem) {
    return this.selectedQueueAgentUUIDs().has(item.VqaUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleQueueAgentSelection(item: VoipPabxQueueAgentItem, selected: boolean) {
    this.selectedQueueAgentUUIDs.update((current) => {
      const next = new Set(current);
      if (selected) next.add(item.VqaUUID);
      else next.delete(item.VqaUUID);
      return next;
    });
  }

  toggleVisibleSelection(selected: boolean) {
    this.selectedQueueAgentUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.visibleRows()) {
        if (selected) next.add(row.VqaUUID);
        else next.delete(row.VqaUUID);
      }
      return next;
    });
  }

  employeeLabel(item: VoipPabxQueueAgentItem) {
    return item.EmployeeName || item.VqaDisplayName || item.ErpHrEmployeeEmpUUID || '';
  }

  extensionLabel(item: VoipPabxQueueAgentItem) {
    return item.ExtensionUsername || item.VoipPabxExtensionVpeUUID || '';
  }

  runtimeLabel(status: RuntimeStatus | string) {
    if (status === 'AVAILABLE') return 'AVAILABLE';
    if (status === 'PAUSED') return 'PAUSED';
    return 'LOGGED OUT';
  }

  isActive(item: VoipPabxQueueAgentItem) {
    return Number(item.VqaEnabled) === 1;
  }

  runtimeChipClass(status: RuntimeStatus) {
    return {
      'chip-success': status === 'AVAILABLE',
      'chip-running': status === 'PAUSED',
      'chip-skipped': status === 'LOGGED_OUT',
      'is-active': status === 'AVAILABLE',
      'is-inactive': status !== 'AVAILABLE',
    };
  }

  statusChipClass(item: VoipPabxQueueAgentItem) {
    return {
      'chip-success': this.isActive(item),
      'chip-skipped': !this.isActive(item),
      'is-active': this.isActive(item),
      'is-inactive': !this.isActive(item),
    };
  }

  onEmployeeSelectOpened(opened: boolean) {
    if (!opened) this.employeeSearch.set('');
  }

  onExtensionSelectOpened(opened: boolean) {
    if (!opened) this.extensionSearch.set('');
  }

  private resetForm() {
    this.form.reset({
      employeeUUID: '',
      extensionUUID: '',
      loginCode: '',
      displayName: '',
      runtimeStatus: 'LOGGED_OUT',
      pauseReason: '',
      enabled: true,
    });
    this.employeeSearch.set('');
    this.extensionSearch.set('');
  }

  private openQueueAgentDialog() {
    const queueAgentFormDialog = this.queueAgentFormDialog();
    if (!queueAgentFormDialog || this.queueAgentDialogBinding) return;
    this.queueAgentDialogBinding = openCrudTemplateDialog(
      this.dialog,
      queueAgentFormDialog,
      'crud-form-dialog',
      { onEscape: () => this.cancelForm() },
    );
    this.queueAgentDialogBinding.ref.afterClosed().subscribe(() => {
      this.queueAgentDialogBinding?.stop();
      this.queueAgentDialogBinding = null;
    });
  }

  private closeQueueAgentDialog() {
    if (!this.queueAgentDialogBinding) return;
    this.queueAgentDialogBinding.ref.close();
    this.queueAgentDialogBinding.stop();
    this.queueAgentDialogBinding = null;
  }

  private filterOptions(options: LookupOption[], search: string) {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) =>
      `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(term),
    );
  }

  rowLabel(item: VoipPabxQueueAgentItem) {
    return this.employeeLabel(item) || item.VqaLoginCode || item.VqaID || item.VqaUUID;
  }

  resetPaginator() {
    const paginator = this.paginator();
    if (paginator) paginator.firstPage();
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.VqaUUID));
    this.selectedQueueAgentUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
