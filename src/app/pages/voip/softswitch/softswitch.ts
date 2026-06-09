import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
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

import { fadeIn } from '../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../services/snackbar.service';
import { ApiService } from '../../../services/api.service';
import { VoipDomainItem, VoipDomainService } from '../domain/domain.service';
import { VoipSoftswitchAccountService, VoipSoftswitchAccount } from './softswitch.service';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  VoipSoftswitchProviderItem,
  VoipSoftswitchProviderService,
} from './provider/provider.service';
import { VoipSoftswitchServerItem, VoipSoftswitchServerService } from './server/server.service';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Status?: number;
};

@Component({
  selector: 'app-voip-softswitch',
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
  templateUrl: './softswitch.html',
  styleUrls: ['./softswitch.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class VoipSoftswitchPage implements AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipSoftswitchAccountService);
  private readonly rawApi = inject(ApiService);
  private readonly providerApi = inject(VoipSoftswitchProviderService);
  private readonly serverApi = inject(VoipSoftswitchServerService);
  private readonly domainApi = inject(VoipDomainService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly pageTitle = computed(() => 'Softswitch');
  readonly pageSubtitle = computed(() =>
    this.isMaster()
      ? 'Configure default Softswitch APIs for all tenants.'
      : 'Register API accounts for Softswitch providers.',
  );

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipSoftswitchAccount | null>(null);

  search = '';
  searchInput = '';
  readonly selectedAccountUUIDs = new Set<string>();
  readonly displayedColumns = [
    'select',
    'name',
    'customer',
    'domain',
    'server',
    'provider',
    'status',
    'default',
    'actions',
  ];
  readonly dataSource = new MatTableDataSource<VoipSoftswitchAccount>([]);
  readonly providerOptions = signal<VoipSoftswitchProviderItem[]>([]);
  readonly serverOptions = signal<VoipSoftswitchServerItem[]>([]);
  readonly domainOptions = signal<VoipDomainItem[]>([]);
  readonly customerOptions = signal<CustomerOption[]>([]);
  providerSearch = '';
  serverSearch = '';
  domainSearch = '';
  customerSearch = '';
  filteredProviders() {
    return this.filterBy(this.providerOptions(), this.providerSearch, 'VspName');
  }

  filteredServers() {
    return this.filterBy(this.serverOptions(), this.serverSearch, 'VsrName');
  }

  filteredDomains() {
    return this.filterBy(this.domainOptions(), this.domainSearch, 'VdmName');
  }

  filteredCustomers() {
    return this.filterBy(this.customerOptions(), this.customerSearch, 'Name');
  }

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    providerUUID: ['', [Validators.required]],
    serverUUID: ['', [Validators.required]],
    customerUUID: ['', [Validators.required]],
    domainUUID: ['', [Validators.required]],
    baseUrl: [''],
    apiKey: [''],
    apiSecret: [''],
    isActive: [true],
    isDefault: [false],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('softswitchFormDialog') softswitchFormDialog?: TemplateRef<unknown>;
  private softswitchFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.VssName ?? '';
        case 'provider':
          return this.providerLabel(data);
        case 'server':
          return this.serverLabel(data);
        case 'domain':
          return data.DomainName ?? '';
        case 'customer':
          return data.CustomerName ?? '';
        case 'status':
          return data.VssIsActive === 1 ? 'active' : 'inactive';
        case 'default':
          return data.VssIsDefault === 1 ? 'default' : '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const statusLabel = data.VssIsActive === 1 ? 'active' : 'inactive';
      const defaultLabel = data.VssIsDefault === 1 ? 'default' : 'not default';
      const providerLabel = this.providerLabel(data).toLowerCase();
      return [
        data.VssName,
        data.CustomerName,
        data.DomainName,
        this.serverLabel(data),
        providerLabel,
        statusLabel,
        defaultLabel,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      void this.loadLookups();
      void this.loadAccounts();
    }, 0);
  }

  ngOnDestroy() {
    this.closeAccountDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.dataSource.filter = this.search.toLowerCase();
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.dataSource.filter = '';
    if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
  }

  async loadAccounts() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();
    try {
      const res = await this.api.list(this.isMaster(), {
        search: this.search,
        limit: this.listLimit,
      });
      this.dataSource.data = res?.data?.items ?? [];
      this.reconcileSelection();
      this.applySearchFilters();
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to load accounts.';
      this.error.set(message);
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

  refresh() {
    return this.loadAccounts();
  }

  startCreate() {
    this.resetForm();
    this.openAccountDialog();
  }

  async submit(saveAndNew = false) {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const payload = {
      name: value.name,
      providerUUID: value.providerUUID,
      serverUUID: value.serverUUID,
      customerUUID: value.customerUUID,
      domainUUID: value.domainUUID,
      config: { baseUrl: value.baseUrl || null },
      credentials: {
        apiKey: value.apiKey || null,
        apiSecret: value.apiSecret || null,
      },
      isActive: value.isActive,
      isDefault: value.isDefault,
    };

    this.saving.set(true);
    this.error.set(null);
    try {
      if (this.editing()) {
        await this.api.update(this.editing()!.VssUUID, payload, this.isMaster());
      } else {
        await this.api.create(payload, this.isMaster());
      }
      await this.loadAccounts();
      if (saveAndNew && !this.editing()) {
        this.resetForm();
        return;
      }
      this.cancelEdit();
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to save account.';
      this.error.set(message);
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewAccount() {
    void this.submit(true);
  }

  editAccount(item: VoipSoftswitchAccount) {
    const config = item.VssConfig as { baseUrl?: string } | null;
    this.editing.set(item);
    this.form.patchValue({
      name: item.VssName,
      providerUUID: item.VoipSoftswitchProviderVspUUID,
      serverUUID: item.VoipSoftswitchServerVsrUUID ?? '',
      customerUUID: item.CustomerCusUUID ?? '',
      domainUUID: item.VoipDomainVdmUUID ?? '',
      baseUrl: config?.baseUrl ?? '',
      apiKey: '',
      apiSecret: '',
      isActive: item.VssIsActive === 1,
      isDefault: item.VssIsDefault === 1,
    });
    this.openAccountDialog();
  }

  cancelEdit() {
    this.resetForm();
    this.closeAccountDialog();
  }

  async removeAccount(item: VoipSoftswitchAccount) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Softswitch Account',
        message: `Are you sure you want to delete "${item.VssName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.remove(item.VssUUID, this.isMaster());
      this.dataSource.data = this.dataSource.data.filter((row) => row.VssUUID !== item.VssUUID);
      this.selectedAccountUUIDs.delete(item.VssUUID);
      this.applySearchFilters();
    } catch (err: any) {
      const message =
        err?.error?.message || err?.error?.error || err?.message || 'Failed to delete account.';
      this.error.set(message);
      this.snack.error(message);
    }
  }

  get selectedCount() {
    return this.selectedAccountUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipSoftswitchAccount) {
    return this.selectedAccountUUIDs.has(item.VssUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleAccountSelection(item: VoipSoftswitchAccount, checked: boolean) {
    if (checked) {
      this.selectedAccountUUIDs.add(item.VssUUID);
    } else {
      this.selectedAccountUUIDs.delete(item.VssUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleAccountSelection(row, checked));
  }

  async removeSelectedAccounts() {
    const ids = Array.from(this.selectedAccountUUIDs);
    if (!ids.length) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Selected Softswitch Accounts',
        message: `Are you sure you want to delete ${ids.length} selected Softswitch account(s)?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);
    this.error.set(null);
    try {
      const response = await this.api.removeMany(ids, this.isMaster());
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.VssUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VssUUID));
      this.selectedAccountUUIDs.clear();
      failed.forEach((uuid) => this.selectedAccountUUIDs.add(uuid));
      if (failed.size) {
        this.error.set(`${failed.size} selected Softswitch account(s) could not be deleted.`);
      }
      this.applySearchFilters();
    } catch (err: any) {
      const message =
        err?.error?.message ||
        err?.error?.error ||
        err?.message ||
        'Failed to delete selected accounts.';
      this.error.set(message);
      this.snack.error(message);
    } finally {
      this.deletingSelected.set(false);
    }
  }

  providerLabel(item: VoipSoftswitchAccount) {
    return item.ProviderName || item.ProviderEngine || '-';
  }

  serverLabel(item: VoipSoftswitchAccount) {
    return item.ServerName || item.ServerHostname || '-';
  }

  setSelectSearch(kind: 'provider' | 'server' | 'domain' | 'customer', value: string) {
    this[`${kind}Search`] = value;
  }

  clearSelectSearch(kind: 'provider' | 'server' | 'domain' | 'customer', opened: boolean) {
    if (!opened) this[`${kind}Search`] = '';
  }

  private resetForm() {
    this.form.reset({
      name: '',
      providerUUID: this.providerOptions()[0]?.VspUUID ?? '',
      serverUUID: this.serverOptions()[0]?.VsrUUID ?? '',
      customerUUID: this.customerOptions()[0]?.CustomerUUID ?? '',
      domainUUID: this.domainOptions()[0]?.VdmUUID ?? '',
      baseUrl: '',
      apiKey: '',
      apiSecret: '',
      isActive: true,
      isDefault: false,
    });
    this.editing.set(null);
  }

  private openAccountDialog() {
    if (!this.softswitchFormDialog || this.softswitchFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.softswitchFormDialog,
      'voip-softswitch-form-dialog',
      { onEscape: () => this.cancelEdit() },
    );
    this.softswitchFormDialogRef = this.dialogBinding.ref;
    this.softswitchFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeAccountDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.softswitchFormDialogRef?.close();
    this.softswitchFormDialogRef = null;
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.VssUUID));
    Array.from(this.selectedAccountUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedAccountUUIDs.delete(uuid);
    });
  }

  private async loadLookups() {
    try {
      const [providers, servers, domains, customers] = await Promise.all([
        this.providerApi.list(this.isMaster(), { limit: this.listLimit }),
        this.serverApi.list(true, { limit: this.listLimit }),
        this.domainApi.list({ limit: this.listLimit }),
        this.rawApi.get<any>(`erp/customers?limit=${this.listLimit}`),
      ]);
      this.providerOptions.set(providers?.data?.items ?? []);
      this.serverOptions.set(servers?.data?.items ?? []);
      this.domainOptions.set(domains?.data?.items ?? []);
      this.customerOptions.set(customers?.data?.items ?? []);
    } catch (err: any) {
      this.snack.error(err?.error?.error || 'Failed to load Softswitch lookups.');
    }
  }

  private filterBy<T extends Record<string, any>>(items: T[], search: string, key: keyof T) {
    const value = search.trim().toLowerCase();
    if (!value) return items;
    return items.filter((item) =>
      String(item[key] ?? '')
        .toLowerCase()
        .includes(value),
    );
  }
}
