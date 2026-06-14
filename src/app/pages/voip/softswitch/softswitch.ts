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

import {
  FormField,
  form as createForm,
  minLength,
  required,
} from '@angular/forms/signals';
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
import { firstValueFrom, takeUntil } from 'rxjs';

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
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Status?: number;
};

@Component({
  selector: 'app-voip-softswitch',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipSoftswitchPage {
  private readonly listLimit = 5000;
  private readonly api = inject(VoipSoftswitchAccountService);
  private readonly rawApi = inject(ApiService);
  private readonly providerApi = inject(VoipSoftswitchProviderService);
  private readonly serverApi = inject(VoipSoftswitchServerService);
  private readonly domainApi = inject(VoipDomainService);
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

  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<VoipSoftswitchAccount | null>(null);

  readonly search = signal('');
  readonly searchInput = signal('');
  readonly appliedSearch = signal('');
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
  readonly providerSearch = signal('');
  readonly serverSearch = signal('');
  readonly domainSearch = signal('');
  readonly customerSearch = signal('');
  filteredProviders() {
    return this.filterBy(this.providerOptions(), this.providerSearch(), 'VspName');
  }

  filteredServers() {
    return this.filterBy(this.serverOptions(), this.serverSearch(), 'VsrName');
  }

  filteredDomains() {
    return this.filterBy(this.domainOptions(), this.domainSearch(), 'VdmName');
  }

  filteredCustomers() {
    return this.filterBy(this.customerOptions(), this.customerSearch(), 'Name');
  }

  readonly formModel = signal(this.emptyFormModel());
  readonly form = createForm(this.formModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.providerUUID);
    required(schema.serverUUID);
    required(schema.customerUUID);
    required(schema.domainUUID);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly softswitchFormDialog = viewChild<TemplateRef<unknown>>('softswitchFormDialog');
  private readonly accountsResource = resource({
    params: () => ({
      isMaster: this.isMaster(),
      search: this.appliedSearch(),
      limit: this.listLimit,
    }),
    defaultValue: [] as VoipSoftswitchAccount[],
    loader: async ({ params }) => {
      const res = await this.api.list(params.isMaster, {
        search: params.search,
        limit: params.limit,
      });
      return res?.data?.items ?? [];
    },
  });
  readonly loading = this.accountsResource.isLoading;
  private softswitchFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncTableData = effect(() => {
    this.dataSource.data = this.accountsResource.value();
    this.reconcileSelection();
    this.dataSource.filter = '';
    this.dataSource.paginator?.firstPage();
  });
  private readonly reportLoadError = effect(() => {
    const error = this.accountsResource.error();
    if (!error) return;
    const message = this.messageFromError(error, 'Failed to load accounts.');
    this.error.set(message);
    this.snack.error(message);
  });

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
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

    void this.loadLookups();
  
  });

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeAccountDialog();
  
  });

  onSearchChange(value: string) {
    this.searchInput.set(value);
  }

  applySearchFilters() {
    const search = this.searchInput().trim();
    this.search.set(search);
    this.appliedSearch.set(search);
  }

  clearSearchFilters() {
    this.searchInput.set('');
    this.search.set('');
    this.appliedSearch.set('');
  }

  refresh() {
    this.accountsResource.reload();
  }

  startCreate() {
    this.resetForm();
    this.openAccountDialog();
  }

  async submit(saveAndNew = false) {
    if (!this.form().valid()) {
      return;
    }

    const value = this.formModel();
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
      this.accountsResource.reload();
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
    this.formModel.set({
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
      this.selectedAccountUUIDs.delete(item.VssUUID);
      this.accountsResource.reload();
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
      this.accountsResource.reload();
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
    this.selectSearchSignal(kind).set(value);
  }

  clearSelectSearch(kind: 'provider' | 'server' | 'domain' | 'customer', opened: boolean) {
    if (!opened) this.selectSearchSignal(kind).set('');
  }

  private resetForm() {
    this.formModel.set(this.emptyFormModel());
    this.editing.set(null);
  }

  private openAccountDialog() {
    const softswitchFormDialog = this.softswitchFormDialog();
    if (!softswitchFormDialog || this.softswitchFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      softswitchFormDialog,
      'voip-softswitch-form-dialog',
      { onEscape: () => this.cancelEdit() },
    );
    this.softswitchFormDialogRef = this.dialogBinding.ref;
    this.softswitchFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.softswitchFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
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

  private messageFromError(error: unknown, fallback: string) {
    const err = error as { error?: { message?: string; error?: string }; message?: string };
    return err?.error?.message || err?.error?.error || err?.message || fallback;
  }

  private emptyFormModel() {
    return {
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
    };
  }

  private selectSearchSignal(kind: 'provider' | 'server' | 'domain' | 'customer') {
    switch (kind) {
      case 'provider':
        return this.providerSearch;
      case 'server':
        return this.serverSearch;
      case 'domain':
        return this.domainSearch;
      case 'customer':
        return this.customerSearch;
    }
  }
}
