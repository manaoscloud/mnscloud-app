import {
  AfterViewInit,
  Component,
  effect,
  OnDestroy,
  resource,
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
} from './subscriber.service';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-voip-softswitch-subscriber',
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
  templateUrl: './subscriber.html',
  styleUrls: ['./subscriber.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class VoipSoftswitchSubscriberPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipSoftswitchSubscriberService);
  private readonly accountApi = inject(VoipSoftswitchAccountService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipSoftswitchSubscriberItem | null>(null);
  readonly accountOptions = signal<VoipSoftswitchAccount[]>([]);
  readonly selectedSubscriberUUIDs = new Set<string>();
  readonly displayedColumns = [
    'select',
    'username',
    'softswitch',
    'customer',
    'domain',
    'register',
    'status',
    'actions',
  ];
  readonly dataSource = new MatTableDataSource<VoipSoftswitchSubscriberItem>([]);
  readonly appliedSearch = signal('');
  search = '';
  searchInput = '';
  accountSearch = '';

  readonly form = this.fb.nonNullable.group({
    accountUUID: ['', [Validators.required]],
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    callerIdName: [''],
    callerIdNumber: [''],
    context: ['default'],
    maxContacts: [1, [Validators.required, Validators.min(1)]],
    maxConcurrentCalls: [1, [Validators.required, Validators.min(1)]],
    outboundCid: [''],
    codecs: [''],
    registerEnabled: [true],
    recordCalls: [true],
    enabled: [true],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly subscriberFormDialog = viewChild<TemplateRef<unknown>>('subscriberFormDialog');
  private readonly subscribersResource = resource({
    params: () => ({ search: this.appliedSearch(), limit: this.listLimit }),
    defaultValue: [] as VoipSoftswitchSubscriberItem[],
    loader: async ({ params }) => {
      const res = await this.api.list(params);
      return res?.data?.items ?? [];
    },
  });
  readonly loading = this.subscribersResource.isLoading;
  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.subscribersResource.value();
    this.reconcileSelection();
    this.dataSource.paginator?.firstPage();
  });
  private readonly reportLoadError = effect(() => {
    const error = this.subscribersResource.error();
    if (!error) return;
    const message = this.errorMessage(error, 'Failed to load subscribers.');
    this.error.set(message);
    this.snack.error(message);
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, column) => {
      switch (column) {
        case 'username':
          return data.VsuUsername ?? '';
        case 'softswitch':
          return data.SoftswitchName ?? '';
        case 'customer':
          return data.CustomerName ?? '';
        case 'domain':
          return data.DomainName ?? '';
        case 'register':
          return data.VsuRegisterEnabled ? 'yes' : 'no';
        case 'status':
          return data.VsuEnabled ? 'active' : 'inactive';
        default:
          return '';
      }
    };
    setTimeout(() => void this.loadLookups(), 0);
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
    this.searchInput = '';
    this.search = '';
    this.appliedSearch.set('');
  }

  refreshList() {
    this.subscribersResource.reload();
  }

  startCreate() {
    this.resetForm();
    this.openDialog();
  }

  editItem(item: VoipSoftswitchSubscriberItem) {
    this.editing.set(item);
    this.form.patchValue({
      accountUUID: item.VoipSoftswitchAccountVssUUID,
      username: item.VsuUsername,
      password: item.VsuPassword,
      callerIdName: item.VsuCallerIdName ?? '',
      callerIdNumber: item.VsuCallerIdNumber ?? '',
      context: item.VsuContext ?? 'default',
      maxContacts: item.VsuMaxContacts ?? 1,
      maxConcurrentCalls: item.VsuMaxConcurrentCalls ?? 1,
      outboundCid: item.VsuOutboundCid ?? '',
      codecs: item.VsuCodecs ?? '',
      registerEnabled: item.VsuRegisterEnabled === 1,
      recordCalls: item.VsuRecordCalls === 1,
      enabled: item.VsuEnabled === 1,
    });
    this.openDialog();
  }

  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload = { ...value };
    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.editing()) await this.api.update(this.editing()!.VsuUUID, payload);
      else await this.api.create(payload);
      this.subscribersResource.reload();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message = err?.error?.error || err?.message || 'Failed to save subscriber.';
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

  async removeItem(item: VoipSoftswitchSubscriberItem) {
    const confirmed = await this.confirmDelete(
      'Delete Subscriber',
      `Delete "${item.VsuUsername}"?`,
      'Delete',
    );
    if (!confirmed) return;
    try {
      await this.api.remove(item.VsuUUID);
      this.subscribersResource.reload();
    } catch (err: any) {
      this.snack.error(err?.error?.error || err?.message || 'Failed to delete subscriber.');
    }
  }

  get selectedCount() {
    return this.selectedSubscriberUUIDs.size;
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

  isSelected(item: VoipSoftswitchSubscriberItem) {
    return this.selectedSubscriberUUIDs.has(item.VsuUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleSelection(item: VoipSoftswitchSubscriberItem, checked: boolean) {
    if (checked) this.selectedSubscriberUUIDs.add(item.VsuUUID);
    else this.selectedSubscriberUUIDs.delete(item.VsuUUID);
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleSelection(row, checked));
  }

  async removeSelected() {
    const ids = Array.from(this.selectedSubscriberUUIDs);
    if (!ids.length) return;
    const confirmed = await this.confirmDelete(
      'Delete Selected Subscribers',
      `Delete ${ids.length} selected subscriber(s)?`,
      'Delete selected',
    );
    if (!confirmed) return;
    this.deletingSelected.set(true);
    try {
      const response = await this.api.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VsuUUID),
      );
      this.selectedSubscriberUUIDs.clear();
      failed.forEach((uuid) => this.selectedSubscriberUUIDs.add(uuid));
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VsuUUID));
      if (failed.size)
        this.error.set(`${failed.size} selected subscriber(s) could not be deleted.`);
    } catch (err: any) {
      this.snack.error(
        err?.error?.error || err?.message || 'Failed to delete selected subscribers.',
      );
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

  private resetForm() {
    this.form.reset({
      accountUUID: this.accountOptions()[0]?.VssUUID ?? '',
      username: '',
      password: '',
      callerIdName: '',
      callerIdNumber: '',
      context: 'default',
      maxContacts: 1,
      maxConcurrentCalls: 1,
      outboundCid: '',
      codecs: '',
      registerEnabled: true,
      recordCalls: true,
      enabled: true,
    });
    this.editing.set(null);
  }

  private openDialog() {
    const subscriberFormDialog = this.subscriberFormDialog();
    if (!subscriberFormDialog || this.dialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      subscriberFormDialog,
      'voip-softswitch-subscriber-form-dialog',
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
      const accounts = await this.accountApi.list(false, { limit: this.listLimit });
      this.accountOptions.set(accounts?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(err?.error?.error || 'Failed to load Softswitch accounts.');
    }
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.VsuUUID));
    Array.from(this.selectedSubscriberUUIDs).forEach((uuid) => {
      if (!valid.has(uuid)) this.selectedSubscriberUUIDs.delete(uuid);
    });
  }

  private errorMessage(error: unknown, fallback: string) {
    const err = error as { error?: { error?: string }; message?: string };
    return err?.error?.error || err?.message || fallback;
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
