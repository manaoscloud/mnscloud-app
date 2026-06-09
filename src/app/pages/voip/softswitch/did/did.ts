import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { firstValueFrom } from 'rxjs';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipSoftswitchAccount, VoipSoftswitchAccountService } from '../softswitch.service';
import {
  VoipSoftswitchSubscriberItem,
  VoipSoftswitchSubscriberService,
} from '../subscriber/subscriber.service';
import { VoipSoftswitchDidItem, VoipSoftswitchDidService } from './did.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-voip-softswitch-did',
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
  templateUrl: './did.html',
  styleUrls: ['./did.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipSoftswitchDidPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipSoftswitchDidService);
  private readonly accountApi = inject(VoipSoftswitchAccountService);
  private readonly subscriberApi = inject(VoipSoftswitchSubscriberService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipSoftswitchDidItem | null>(null);
  readonly accountOptions = signal<VoipSoftswitchAccount[]>([]);
  readonly subscriberOptions = signal<VoipSoftswitchSubscriberItem[]>([]);
  readonly selectedDidUUIDs = new Set<string>();
  readonly displayedColumns = [
    'select',
    'number',
    'softswitch',
    'customer',
    'domain',
    'route',
    'status',
    'actions',
  ];
  readonly dataSource = new MatTableDataSource<VoipSoftswitchDidItem>([]);
  search = '';
  searchInput = '';
  accountSearch = '';
  subscriberSearch = '';

  readonly form = this.fb.nonNullable.group({
    accountUUID: ['', [Validators.required]],
    subscriberUUID: [''],
    number: ['', [Validators.required]],
    direction: ['both', [Validators.required]],
    routeType: ['subscriber', [Validators.required]],
    routeValue: [''],
    description: [''],
    enabled: [true],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly didFormDialog = viewChild<TemplateRef<unknown>>('didFormDialog');
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, column) => {
      switch (column) {
        case 'number':
          return data.VsdNumber ?? '';
        case 'softswitch':
          return data.SoftswitchName ?? '';
        case 'customer':
          return data.CustomerName ?? '';
        case 'domain':
          return data.DomainName ?? '';
        case 'route':
          return this.routeLabel(data);
        case 'status':
          return data.VsdEnabled ? 'active' : 'inactive';
        default:
          return '';
      }
    };
    setTimeout(() => {
      void this.loadLookups();
      void this.loadItems();
    }, 0);
  }

  ngOnDestroy() {
    this.closeDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadItems();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadItems();
  }

  async loadItems() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();
    try {
      const res = await this.api.list({ search: this.search, limit: this.listLimit });
      this.dataSource.data = res?.data?.items ?? [];
      this.reconcileSelection();
      this.dataSource.paginator?.firstPage();
    } catch (err: any) {
      this.error.set(err?.error?.error || err?.message || 'Failed to load DIDs.');
    } finally {
      setTimeout(() => this.loading.set(false), Math.max(0, 600 - (performance.now() - start)));
    }
  }

  refreshList() {
    return this.loadItems();
  }

  startCreate() {
    this.resetForm();
    this.openDialog();
  }

  editItem(item: VoipSoftswitchDidItem) {
    this.editing.set(item);
    this.form.patchValue({
      accountUUID: item.VoipSoftswitchAccountVssUUID,
      subscriberUUID: item.VoipSoftswitchSubscriberVsuUUID ?? '',
      number: item.VsdNumber,
      direction: item.VsdDirection,
      routeType: item.VsdRouteType,
      routeValue: item.VsdRouteValue ?? '',
      description: item.VsdDescription ?? '',
      enabled: item.VsdEnabled === 1,
    });
    this.openDialog();
  }

  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload = {
      ...value,
      subscriberUUID: value.subscriberUUID || null,
      routeValue: value.routeValue || null,
      description: value.description || null,
    };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.editing()) await this.api.update(this.editing()!.VsdUUID, payload);
      else await this.api.create(payload);
      await this.loadItems();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Failed to save DID.';
      this.error.set(message);
      this.snack.error(message);
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

  async removeItem(item: VoipSoftswitchDidItem) {
    const confirmed = await this.confirmDelete(
      'Delete DID',
      `Delete "${item.VsdNumber}"?`,
      'Delete',
    );
    if (!confirmed) return;
    try {
      await this.api.remove(item.VsdUUID);
      await this.loadItems();
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to delete DID.');
    }
  }

  get selectedCount() {
    return this.selectedDidUUIDs.size;
  }

  visibleRows() {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;
    return rows.slice(
      paginator.pageIndex * paginator.pageSize,
      paginator.pageIndex * paginator.pageSize + paginator.pageSize,
    );
  }

  isSelected(item: VoipSoftswitchDidItem) {
    return this.selectedDidUUIDs.has(item.VsdUUID);
  }
  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }
  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }
  toggleSelection(item: VoipSoftswitchDidItem, checked: boolean) {
    if (checked) this.selectedDidUUIDs.add(item.VsdUUID);
    else this.selectedDidUUIDs.delete(item.VsdUUID);
  }
  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }

  async removeSelected() {
    const ids = Array.from(this.selectedDidUUIDs);
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete Selected DIDs',
      `Delete ${ids.length} selected DID(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VsdUUID),
      );
      this.selectedDidUUIDs.clear();
      failed.forEach((uuid) => this.selectedDidUUIDs.add(uuid));
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VsdUUID));
      if (failed.size) this.error.set(`${failed.size} selected DID(s) could not be deleted.`);
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to delete selected DIDs.');
    } finally {
      this.deletingSelected.set(false);
    }
  }

  routeLabel(item: VoipSoftswitchDidItem) {
    if (item.VsdRouteType === 'subscriber') return item.SubscriberUsername || 'Subscriber';
    return item.VsdRouteValue || item.VsdRouteType;
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

  filteredSubscribers() {
    const value = this.subscriberSearch.trim().toLowerCase();
    const accountUUID = this.form.controls.accountUUID.value;
    const items = this.subscriberOptions().filter(
      (item) => !accountUUID || item.VoipSoftswitchAccountVssUUID === accountUUID,
    );
    if (!value) return items;
    return items.filter((item) =>
      [item.VsuUsername, item.VsuCallerIdName, item.CustomerName, item.DomainName].some((field) =>
        String(field ?? '')
          .toLowerCase()
          .includes(value),
      ),
    );
  }

  setAccountSearch(value: string) {
    this.accountSearch = value;
  }
  setSubscriberSearch(value: string) {
    this.subscriberSearch = value;
  }
  clearAccountSearch(opened: boolean) {
    if (!opened) this.accountSearch = '';
  }
  clearSubscriberSearch(opened: boolean) {
    if (!opened) this.subscriberSearch = '';
  }

  private resetForm() {
    this.form.reset({
      accountUUID: this.accountOptions()[0]?.VssUUID ?? '',
      subscriberUUID: '',
      number: '',
      direction: 'both',
      routeType: 'subscriber',
      routeValue: '',
      description: '',
      enabled: true,
    });
    this.editing.set(null);
  }

  private openDialog() {
    const didFormDialog = this.didFormDialog();
    if (!didFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      didFormDialog,
      'voip-softswitch-did-form-dialog',
      { onEscape: () => this.cancelEdit() },
    );
    this.dialogRef = this.dialogBinding.ref;
    this.dialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.dialogRef?.close();
    this.dialogRef = null;
  }

  private async loadLookups() {
    try {
      const [accounts, subscribers] = await Promise.all([
        this.accountApi.list(false, { limit: this.listLimit }),
        this.subscriberApi.list({ limit: this.listLimit }),
      ]);
      this.accountOptions.set(accounts?.data?.items ?? []);
      this.subscriberOptions.set(subscribers?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(err?.error?.error || 'Failed to load DID lookups.');
    }
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.VsdUUID));
    Array.from(this.selectedDidUUIDs).forEach((uuid) => {
      if (!valid.has(uuid)) this.selectedDidUUIDs.delete(uuid);
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
}
