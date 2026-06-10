import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, takeUntil } from 'rxjs';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipSoftswitchAccount, VoipSoftswitchAccountService } from '../softswitch.service';
import { VoipSoftswitchResourceUiService } from './resource.service';
import { TranslocoPipe } from '@jsverse/transloco';

type ResourceKind = 'trunks' | 'routes' | 'policies' | 'rates' | 'cdrs';
type ResourceRow = {
  uuid: string;
  id: string;
  name: string;
  status: string | number;
  accountUUID: string;
  accountName?: string | null;
  [key: string]: unknown;
};

const RESOURCE_META: Record<
  ResourceKind,
  {
    title: string;
    subtitle: string;
    primary: string;
    primaryKey: string;
    secondary: string;
    secondaryKey: string;
    defaults: Record<string, unknown>;
  }
> = {
  trunks: {
    title: 'Softswitch Trunks',
    subtitle: 'Register upstream and carrier trunks.',
    primary: 'Host',
    primaryKey: 'host',
    secondary: 'Direction',
    secondaryKey: 'direction',
    defaults: { direction: 'both', transport: 'udp', port: 5060, status: true },
  },
  routes: {
    title: 'Softswitch Routes',
    subtitle: 'Register prefix and pattern routing rules.',
    primary: 'Prefix',
    primaryKey: 'prefix',
    secondary: 'Direction',
    secondaryKey: 'direction',
    defaults: { direction: 'outbound', priority: 100, status: true },
  },
  policies: {
    title: 'Softswitch Policies',
    subtitle: 'Register account, subscriber, trunk and route policies.',
    primary: 'Scope',
    primaryKey: 'scope',
    secondary: 'Priority',
    secondaryKey: 'priority',
    defaults: { scope: 'account', priority: 100, status: true },
  },
  rates: {
    title: 'Softswitch Rates',
    subtitle: 'Register rating prefixes for billing.',
    primary: 'Prefix',
    primaryKey: 'prefix',
    secondary: 'Sell/Minute',
    secondaryKey: 'sellPerMinute',
    defaults: {
      currency: 'BRL',
      costPerMinute: 0,
      sellPerMinute: 0,
      minimumSeconds: 30,
      billingIncrementSeconds: 6,
      connectionFee: 0,
      status: true,
    },
  },
  cdrs: {
    title: 'Softswitch CDR/Billing',
    subtitle: 'Inspect and register billing call records.',
    primary: 'Callee',
    primaryKey: 'calleeNumber',
    secondary: 'Status',
    secondaryKey: 'callStatus',
    defaults: {
      direction: 'outbound',
      callStatus: 'failed',
      durationSeconds: 0,
      billSeconds: 0,
      costAmount: 0,
      sellAmount: 0,
      currency: 'BRL',
    },
  },
};

@Component({
  selector: 'app-voip-softswitch-resource',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatCheckboxModule,
    MatMenuModule,
  ],
  templateUrl: './resource.html',
  styleUrls: ['./resource.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipSoftswitchResourcePage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(VoipSoftswitchResourceUiService);
  private readonly accountApi = inject(VoipSoftswitchAccountService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  readonly resource = signal<ResourceKind>(
    (this.route.snapshot.data?.['resource'] ?? 'trunks') as ResourceKind,
  );
  readonly meta = computed(() => RESOURCE_META[this.resource()]);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<ResourceRow | null>(null);
  private readonly appliedSearch = signal('');
  readonly selectedIds = new Set<string>();
  readonly displayedColumns = [
    'select',
    'name',
    'account',
    'primary',
    'secondary',
    'status',
    'actions',
  ];
  readonly dataSource = new MatTableDataSource<ResourceRow>([]);
  search = '';
  searchInput = '';
  accountSearch = '';

  private readonly itemsResource = resource({
    params: () => ({
      resource: this.resource(),
      search: this.appliedSearch(),
      limit: this.listLimit,
    }),
    defaultValue: [] as ResourceRow[],
    loader: async ({ params }) => {
      const res = await this.api.list(params.resource, {
        search: params.search,
        limit: params.limit,
      });
      return res?.data?.items ?? [];
    },
  });

  private readonly accountOptionsResource = resource({
    params: () => ({ limit: this.listLimit }),
    defaultValue: [] as VoipSoftswitchAccount[],
    loader: async ({ params }) => {
      const res = await this.accountApi.list(false, { limit: params.limit });
      return res?.data?.items ?? [];
    },
  });

  readonly loading = this.itemsResource.isLoading;
  readonly accountOptions = computed(
    () => this.accountOptionsResource.value() as VoipSoftswitchAccount[],
  );

  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.itemsResource.value();
    this.reconcileSelection();
    this.dataSource.paginator?.firstPage();
  });

  private readonly reportListError = effect(() => {
    const error = this.itemsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load Softswitch resources.'));
  });

  private readonly reportLookupError = effect(() => {
    const error = this.accountOptionsResource.error();
    if (!error) return;
    this.snack.error(this.errorMessage(error, 'Failed to load Softswitch accounts.'));
  });

  readonly form = this.fb.nonNullable.group({
    accountUUID: ['', [Validators.required]],
    name: ['', [Validators.required]],
    primary: ['', [Validators.required]],
    secondary: [''],
    status: [true],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly resourceFormDialog = viewChild<TemplateRef<unknown>>('resourceFormDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, column) => {
      if (column === 'primary') return this.primaryValue(data);
      if (column === 'secondary') return this.secondaryValue(data);
      if (column === 'account') return data.accountName ?? '';
      if (column === 'status') return this.statusLabel(data);
      return String((data as Record<string, unknown>)[column] ?? '');
    };
  }

  ngOnDestroy() {
    this.closeDialog();
  }
  onSearchChange(value: string) {
    this.searchInput = value;
  }
  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.appliedSearch.set(this.search);
  }
  clearSearchFilters() {
    this.search = '';
    this.searchInput = '';
    this.appliedSearch.set('');
  }
  refreshList() {
    this.itemsResource.reload();
    this.accountOptionsResource.reload();
  }

  startCreate() {
    this.resetForm();
    this.openDialog();
  }
  editItem(item: ResourceRow) {
    this.editing.set(item);
    this.form.patchValue({
      accountUUID: item.accountUUID,
      name: String(item.name ?? ''),
      primary: String(this.primaryValue(item) ?? ''),
      secondary: String(this.secondaryValue(item) ?? ''),
      status: item.status === 1 || item.status === 'answered',
    });
    this.openDialog();
  }
  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = this.payloadFromForm();
    this.saving.set(true);
    try {
      if (this.editing()) await this.api.update(this.resource(), this.editing()!.uuid, payload);
      else await this.api.create(this.resource(), payload);
      this.itemsResource.reload();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to save Softswitch resource.');
    } finally {
      this.saving.set(false);
    }
  }
  saveAndNew() {
    void this.submit(true);
  }
  cancelEdit() {
    this.resetForm();
    this.closeDialog();
  }
  async removeItem(item: ResourceRow) {
    if (
      !(await this.confirmDelete(`Delete ${this.meta().title}`, `Delete "${item.name}"?`, 'Delete'))
    )
      return;
    await this.api.remove(this.resource(), item.uuid);
    this.itemsResource.reload();
  }
  get selectedCount() {
    return this.selectedIds.size;
  }
  visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const p = this.dataSource.paginator;
    return p ? rows.slice(p.pageIndex * p.pageSize, p.pageIndex * p.pageSize + p.pageSize) : rows;
  }
  isSelected(item: ResourceRow) {
    return this.selectedIds.has(item.uuid);
  }
  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }
  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }
  toggleSelection(item: ResourceRow, checked: boolean) {
    if (checked) this.selectedIds.add(item.uuid);
    else this.selectedIds.delete(item.uuid);
  }
  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }
  async removeSelected() {
    const ids = Array.from(this.selectedIds);
    if (
      !ids.length ||
      !(await this.confirmDelete(
        `Delete Selected ${this.meta().title}`,
        `Delete ${ids.length} selected record(s)?`,
        'Delete selected',
      ))
    )
      return;
    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(this.resource(), ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>((response?.data?.failed ?? []).map((item: any) => item.uuid));
      this.selectedIds.clear();
      failed.forEach((uuid) => this.selectedIds.add(uuid));
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.uuid));
    } finally {
      this.deletingSelected.set(false);
    }
  }
  filteredAccounts() {
    const value = this.accountSearch.trim().toLowerCase();
    if (!value) return this.accountOptions();
    return this.accountOptions().filter((item) =>
      [item.VssName, item.CustomerName, item.DomainName].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }
  setAccountSearch(value: string) {
    this.accountSearch = value;
  }
  clearAccountSearch(opened: boolean) {
    if (!opened) this.accountSearch = '';
  }
  primaryValue(row: ResourceRow) {
    return String(row[this.meta().primaryKey] ?? row.name ?? '');
  }
  secondaryValue(row: ResourceRow) {
    return String(row[this.meta().secondaryKey] ?? '');
  }
  statusLabel(row: ResourceRow) {
    return row.status === 1 || row.status === 'answered'
      ? 'Active'
      : String(row.status ?? 'Inactive');
  }
  isActive(row: ResourceRow) {
    return row.status === 1 || row.status === 'answered';
  }

  private payloadFromForm() {
    const value = this.form.getRawValue();
    const meta = this.meta();
    const payload: Record<string, unknown> = {
      ...meta.defaults,
      accountUUID: value.accountUUID,
      name: value.name,
      status: value.status,
    };
    payload[meta.primaryKey] = value.primary;
    payload[meta.secondaryKey] = value.secondary;
    if (this.resource() === 'cdrs') {
      payload['calleeNumber'] = value.primary;
      payload['callStatus'] = value.secondary || 'failed';
    }
    return payload;
  }
  private resetForm() {
    const meta = this.meta();
    this.form.reset({
      accountUUID: this.accountOptions()[0]?.VssUUID ?? '',
      name: '',
      primary: '',
      secondary: String(meta.defaults[meta.secondaryKey] ?? ''),
      status: true,
    });
    this.editing.set(null);
  }
  private openDialog() {
    const resourceFormDialog = this.resourceFormDialog();
    if (!resourceFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      resourceFormDialog,
      'voip-softswitch-resource-form-dialog',
      { onEscape: () => this.cancelEdit() },
    );
    this.dialogRef = this.dialogBinding.ref;
    this.dialogRef.keydownEvents().pipe(takeUntil(this.dialogRef.afterClosed())).subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }
  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }
  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.uuid));
    Array.from(this.selectedIds).forEach((uuid) => {
      if (!valid.has(uuid)) this.selectedIds.delete(uuid);
    });
  }
  private async confirmDelete(title: string, message: string, confirmLabel: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: { title, message, confirmLabel },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    return Boolean(await firstValueFrom(ref.afterClosed()));
  }

  private errorMessage(error: unknown, fallback: string) {
    const maybe = error as { error?: { error?: string }; message?: string };
    return maybe?.error?.error || maybe?.message || fallback;
  }
}
