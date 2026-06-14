import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  DestroyRef,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, email, form as createForm, minLength, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';
import {
  getWebhostDialogViewportConfig,
  updateWebhostDialogViewport,
} from '../webhost-dialog-viewport';
import type {
  HostingDnsDomainOption,
  HostingWebhostHost,
  HostingWebhostPlan,
  WebhostHostConfig,
  WebhostHostProvisionStatus,
  WebhostHostStatus,
  WebhostProviderType,
} from '../webhost.types';

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

type WebhostHostFilters = {
  search: string;
  customerUUID: string;
  planUUID: string;
  hostingDnsDomainUUID: string;
  status: string;
  provisionStatus: string;
};

type WebhostHostFilterFormModel = WebhostHostFilters & {
  provider: string;
};

type WebhostHostFormModel = {
  name: string;
  customerUUID: string;
  planUUID: string;
  hostingDnsDomainUUID: string;
  username: string;
  status: WebhostHostStatus;
  provisionStatus: WebhostHostProvisionStatus;
  contactEmail: string;
  documentRoot: string;
  autoProvision: number;
  notes: string;
  isActive: number;
};

@Component({
  selector: 'app-hosting-webhost-hosts',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
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
  ],
  templateUrl: './hosts.html',
  styleUrls: ['./hosts.scss'],
})
export class HostingWebhostHostsPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly hostFormDialog = viewChild<TemplateRef<unknown>>('hostFormDialog');

  private dialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly hostEndpoint = 'hosting/webhost/hosts';
  readonly planEndpoint = 'hosting/webhost/plans';
  readonly domainEndpoint = 'hosting/dns/domains';
  readonly customerEndpoint = 'erp/customers';
  readonly hosts = signal<HostingWebhostHost[]>([]);
  readonly customers = signal<CustomerOption[]>([]);
  readonly plans = signal<HostingWebhostPlan[]>([]);
  readonly domains = signal<HostingDnsDomainOption[]>([]);
  readonly appliedSearch = signal('');
  readonly appliedProvider = signal('');
  readonly appliedCustomerUUID = signal('');
  readonly appliedPlanUUID = signal('');
  readonly appliedHostingDnsDomainUUID = signal('');
  readonly appliedStatus = signal('');
  readonly appliedProvisionStatus = signal('');
  readonly planSearch = signal('');
  readonly customerSearch = signal('');
  readonly domainSearch = signal('');
  readonly selectedFilterCustomerUUID = signal('');
  readonly selectedFormCustomerUUID = signal('');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  private readonly hostsResource = resource({
    defaultValue: [] as HostingWebhostHost[],
    params: (): WebhostHostFilters => ({
      search: this.appliedSearch().trim(),
      customerUUID: this.appliedCustomerUUID(),
      planUUID: this.appliedPlanUUID(),
      hostingDnsDomainUUID: this.appliedHostingDnsDomainUUID(),
      status: this.appliedStatus(),
      provisionStatus: this.appliedProvisionStatus(),
    }),
    loader: ({ params }) => this.fetchHosts(params),
  });
  readonly loading = this.hostsResource.isLoading;
  readonly saving = signal(false);
  readonly actionHostUUID = signal<string | null>(null);
  readonly editing = signal<HostingWebhostHost | null>(null);
  readonly selectedHostUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedHostUUIDs().size);

  readonly providerOptions: { value: WebhostProviderType; label: string }[] = [
    { value: 'cpanel_whm', label: 'cPanel/WHM' },
    { value: 'plesk', label: 'Plesk' },
    { value: 'directadmin', label: 'DirectAdmin' },
  ];
  readonly statusOptions: { value: WebhostHostStatus; label: string }[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'error', label: 'Error' },
    { value: 'cancelled', label: 'Cancelled' },
  ];
  readonly provisionOptions: { value: WebhostHostProvisionStatus; label: string }[] = [
    { value: 'manual', label: 'Manual' },
    { value: 'pending', label: 'Pending' },
    { value: 'provisioning', label: 'Provisioning' },
    { value: 'provisioned', label: 'Provisioned' },
    { value: 'failed', label: 'Failed' },
  ];
  readonly displayedColumns = [
    'select',
    'name',
    'customer',
    'domain',
    'plan',
    'provider',
    'user',
    'status',
    'provision',
    'actions',
  ];

  readonly filterFormModel = signal<WebhostHostFilterFormModel>({
    search: '',
    provider: '',
    customerUUID: '',
    planUUID: '',
    hostingDnsDomainUUID: '',
    status: '',
    provisionStatus: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly hostFormModel = signal<WebhostHostFormModel>({
    name: '',
    customerUUID: '',
    planUUID: '',
    hostingDnsDomainUUID: '',
    username: '',
    status: 'pending',
    provisionStatus: 'manual',
    contactEmail: '',
    documentRoot: '',
    autoProvision: 0,
    notes: '',
    isActive: 1,
  });
  readonly hostForm = createForm(this.hostFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.customerUUID);
    required(schema.planUUID);
    required(schema.hostingDnsDomainUUID);
    required(schema.username);
    minLength(schema.username, 2);
    required(schema.status);
    required(schema.provisionStatus);
    email(schema.contactEmail);
    required(schema.isActive);
  });

  readonly rows = computed(() => {
    const search = this.appliedSearch().trim().toLowerCase();
    const provider = this.appliedProvider();
    const customerUUID = this.appliedCustomerUUID();
    const planUUID = this.appliedPlanUUID();
    const hostingDnsDomainUUID = this.appliedHostingDnsDomainUUID();
    const status = this.appliedStatus();
    const provisionStatus = this.appliedProvisionStatus();
    return this.hosts().filter((item) => {
      const matchesSearch =
        !search ||
        item.HwhName.toLowerCase().includes(search) ||
        item.DomainName.toLowerCase().includes(search) ||
        item.HwhUsername.toLowerCase().includes(search) ||
        (item.CustomerName ?? '').toLowerCase().includes(search) ||
        item.PlanName.toLowerCase().includes(search) ||
        item.ProviderName.toLowerCase().includes(search);
      const matchesProvider = !provider || item.HostingWebhostProviderHwpUUID === provider;
      const matchesCustomer = !customerUUID || item.CustomerCusUUID === customerUUID;
      const matchesPlan = !planUUID || item.HostingWebhostPlanHwlUUID === planUUID;
      const matchesDomain =
        !hostingDnsDomainUUID || item.HostingDnsDomainHddUUID === hostingDnsDomainUUID;
      const matchesStatus = !status || item.HwhStatus === status;
      const matchesProvision = !provisionStatus || item.HwhProvisionStatus === provisionStatus;
      return (
        matchesSearch &&
        matchesProvider &&
        matchesCustomer &&
        matchesPlan &&
        matchesDomain &&
        matchesStatus &&
        matchesProvision
      );
    });
  });
  readonly sortedRows = computed(() => this.sortRows(this.rows()));
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly filteredPlans = computed(() => {
    const search = this.planSearch().trim().toLowerCase();
    const items = this.plans().filter((plan) => plan.HwlIsActive === 1);
    if (!search) return items;
    return items.filter(
      (plan) =>
        plan.HwlName.toLowerCase().includes(search) ||
        (plan.ProviderName ?? '').toLowerCase().includes(search) ||
        (plan.HwlPackage ?? '').toLowerCase().includes(search),
    );
  });
  readonly filteredCustomers = computed(() => {
    const search = this.customerSearch().trim().toLowerCase();
    const items = this.customers();
    if (!search) return items;
    return items.filter((customer) =>
      [customer.Name, customer.Document]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  });
  readonly filteredDomainFilterOptions = computed(() =>
    this.filterDomainOptions(this.domainSearch(), this.selectedFilterCustomerUUID(), false),
  );
  readonly filteredDomainFormOptions = computed(() =>
    this.filterDomainOptions(this.domainSearch(), this.selectedFormCustomerUUID(), true),
  );
  readonly providerFilterOptions = computed(() => {
    const providers = new Map<
      string,
      { uuid: string; name: string; platform: WebhostProviderType | string }
    >();
    for (const plan of this.plans()) {
      if (!plan.HostingWebhostProviderHwpUUID) continue;
      providers.set(plan.HostingWebhostProviderHwpUUID, {
        uuid: plan.HostingWebhostProviderHwpUUID,
        name: plan.ProviderName || '-',
        platform: plan.HwlProvider,
      });
    }
    return Array.from(providers.values()).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  });

  private readonly syncHosts = effect(() => {
    this.hosts.set(this.hostsResource.value());
    this.reconcileHostSelection();
  });

  private readonly reportHostsError = effect(() => {
    const error = this.hostsResource.error();
    if (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost hosts.'));
    }
  });

  private readonly syncFilterCustomer = effect(() => {
    const customerUUID = this.filterFormModel().customerUUID;
    this.selectedFilterCustomerUUID.set(customerUUID);
    this.clearFilterDomainIfNeeded(customerUUID);
  });

  private readonly syncFormCustomer = effect(() => {
    const customerUUID = this.hostFormModel().customerUUID;
    this.selectedFormCustomerUUID.set(customerUUID);
    this.clearFormDomainIfNeeded(customerUUID);
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDialog();
      this.stopDialogViewportObserver();
    });
    void this.fetchPlans();
    void this.fetchCustomers();
    void this.fetchDomains();
  }

  refreshList() {
    void this.fetchPlans();
    void this.fetchCustomers();
    void this.fetchDomains();
    this.hostsResource.reload();
  }

  applyFilters() {
    const values = this.filterFormModel();
    this.appliedSearch.set(values.search);
    this.appliedProvider.set(values.provider);
    this.appliedCustomerUUID.set(values.customerUUID);
    this.appliedPlanUUID.set(values.planUUID);
    this.appliedHostingDnsDomainUUID.set(values.hostingDnsDomainUUID);
    this.appliedStatus.set(values.status);
    this.appliedProvisionStatus.set(values.provisionStatus);
    this.resetPagination();
    this.hostsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({
      search: '',
      provider: '',
      customerUUID: '',
      planUUID: '',
      hostingDnsDomainUUID: '',
      status: '',
      provisionStatus: '',
    });
    this.applyFilters();
  }

  onPlanOpened(opened: boolean) {
    if (!opened) this.planSearch.set('');
  }

  onCustomerOpened(opened: boolean) {
    if (!opened) this.customerSearch.set('');
  }

  onDomainOpened(opened: boolean) {
    if (!opened) this.domainSearch.set('');
  }

  providerLabel(provider: WebhostProviderType | string) {
    return this.providerOptions.find((option) => option.value === provider)?.label ?? provider;
  }

  statusLabel(status: WebhostHostStatus | string) {
    return this.statusOptions.find((option) => option.value === status)?.label ?? status;
  }

  provisionLabel(status: WebhostHostProvisionStatus | string) {
    return this.provisionOptions.find((option) => option.value === status)?.label ?? status;
  }

  planLabel(item: HostingWebhostPlan) {
    const pkg = item.HwlPackage ? ` · ${item.HwlPackage}` : '';
    return `${item.HwlName}${pkg}`;
  }

  hostPlanLabel(item: HostingWebhostHost) {
    const pkg = item.PlanPackage ? ` · ${item.PlanPackage}` : '';
    return `${item.PlanName}${pkg}`;
  }

  hostProviderLabel(item: HostingWebhostHost) {
    return `${item.ProviderName} · ${this.providerLabel(item.HwlProvider)}`;
  }

  customerLabel(customer: CustomerOption) {
    return [customer.Name, customer.Document].filter(Boolean).join(' · ');
  }

  domainLabel(domain: HostingDnsDomainOption) {
    return [domain.HddName, domain.CustomerName].filter(Boolean).join(' · ');
  }

  hostCustomerLabel(item: HostingWebhostHost) {
    return item.CustomerName || '-';
  }

  actionLabel(item: HostingWebhostHost) {
    if (this.actionHostUUID() === item.HwhUUID) return 'Running';
    return item.HwhProvisionStatus === 'provisioned' ? 'Sync' : 'Provision';
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.resetPagination();
  }

  async fetchPlans() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingWebhostPlan[] } }>(
        `${this.planEndpoint}?limit=500&offset=0&status=1`,
      );
      this.plans.set(result?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost plans.'));
    }
  }

  async fetchCustomers() {
    try {
      const result = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        `${this.customerEndpoint}?status=1&limit=500&offset=0`,
      );
      this.customers.set(result?.data?.items ?? []);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load customers.'));
    }
  }

  async fetchDomains() {
    try {
      const result = await this.api.get<{ data?: { items?: HostingDnsDomainOption[] } }>(
        `${this.domainEndpoint}?limit=500&offset=0&status=1`,
      );
      this.domains.set(result?.data?.items ?? []);
      this.clearFilterDomainIfNeeded(this.selectedFilterCustomerUUID());
      this.clearFormDomainIfNeeded(this.selectedFormCustomerUUID());
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load hosting domains.'));
    }
  }

  private async fetchHosts(filters: WebhostHostFilters): Promise<HostingWebhostHost[]> {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filters.search) params.set('search', filters.search);
    if (filters.customerUUID) params.set('customerUUID', filters.customerUUID);
    if (filters.planUUID) params.set('planUUID', filters.planUUID);
    if (filters.hostingDnsDomainUUID)
      params.set('hostingDnsDomainUUID', filters.hostingDnsDomainUUID);
    if (filters.status) params.set('status', filters.status);
    if (filters.provisionStatus) params.set('provisionStatus', filters.provisionStatus);

    const result = await this.api.get<{ data?: { items?: HostingWebhostHost[] } }>(
      `${this.hostEndpoint}?${params.toString()}`,
    );
    const items = result?.data?.items ?? [];
    return items.map((item) => ({ ...item, HwhConfig: this.parseConfig(item.HwhConfig) }));
  }

  startCreate() {
    this.editing.set(null);
    this.resetForm();
    this.openDialog();
  }

  async startEdit(item: HostingWebhostHost) {
    let host = item;
    try {
      const result = await this.api.get<{ data?: { item?: HostingWebhostHost | null } }>(
        `${this.hostEndpoint}/${item.HwhUUID}`,
      );
      if (result?.data?.item) {
        host = { ...result.data.item, HwhConfig: this.parseConfig(result.data.item.HwhConfig) };
      }
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to load Webhost host.'));
    }

    const config = host.HwhConfig ?? {};
    this.editing.set(host);
    this.hostFormModel.set({
      name: host.HwhName,
      customerUUID: host.CustomerCusUUID ?? '',
      planUUID: host.HostingWebhostPlanHwlUUID,
      hostingDnsDomainUUID: host.HostingDnsDomainHddUUID,
      username: host.HwhUsername,
      status: host.HwhStatus,
      provisionStatus: host.HwhProvisionStatus,
      contactEmail: config.contactEmail ?? '',
      documentRoot: config.documentRoot ?? '',
      autoProvision: config.autoProvision ? 1 : 0,
      notes: config.notes ?? '',
      isActive: host.HwhIsActive === 1 ? 1 : 0,
    });
    this.openDialog();
  }

  cancelForm() {
    this.closeDialog();
    this.editing.set(null);
    this.resetForm();
  }

  async submit(closeAfterSave = true) {
    if (!this.hostForm().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.hostFormModel();
    if (!this.domainBelongsToCustomer(values.hostingDnsDomainUUID, values.customerUUID)) {
      this.snack.warning('Select a domain linked to the selected customer.');
      return;
    }

    this.saving.set(true);
    const payload = {
      name: values.name.trim(),
      customerUUID: values.customerUUID,
      planUUID: values.planUUID,
      hostingDnsDomainUUID: values.hostingDnsDomainUUID,
      username: values.username.trim(),
      status: values.status,
      provisionStatus: values.provisionStatus,
      config: this.buildConfigPayload(),
      isActive: values.isActive === 1,
    };

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`${this.hostEndpoint}/${editing.HwhUUID}`, payload);
        this.snack.success('Webhost host updated.');
      } else {
        await this.api.post(this.hostEndpoint, payload);
        this.snack.success('Webhost host created.');
      }
      this.hostsResource.reload();
      if (closeAfterSave || editing) {
        this.closeDialog();
        this.editing.set(null);
      }
      this.resetForm();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to save Webhost host.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.submit(false);
  }

  async runAction(
    item: HostingWebhostHost,
    action: 'provision' | 'sync' | 'suspend' | 'unsuspend',
  ) {
    this.actionHostUUID.set(item.HwhUUID);
    try {
      await this.api.post(`${this.hostEndpoint}/${item.HwhUUID}/${action}`, {});
      this.snack.success(`Webhost host ${action} queued.`);
      this.hostsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, `Failed to ${action} Webhost host.`));
    } finally {
      this.actionHostUUID.set(null);
    }
  }

  async remove(item: HostingWebhostHost) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Webhost host',
        message: `Are you sure you want to delete "${item.HwhName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.hostEndpoint}/${item.HwhUUID}`);
      this.snack.success('Webhost host deleted.');
      this.hostsResource.reload();
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete Webhost host.'));
    }
  }

  isSelected(item: HostingWebhostHost) {
    return this.selectedHostUUIDs().has(item.HwhUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleHostSelection(item: HostingWebhostHost, checked: boolean) {
    this.selectedHostUUIDs.update((current) => {
      const next = new Set(current);
      checked ? next.add(item.HwhUUID) : next.delete(item.HwhUUID);
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedHostUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedRows()) {
        checked ? next.add(row.HwhUUID) : next.delete(row.HwhUUID);
      }
      return next;
    });
  }

  async removeSelectedHosts() {
    const ids = Array.from(this.selectedHostUUIDs());
    if (!ids.length) return;
    const labels = this.hosts()
      .filter((item) => ids.includes(item.HwhUUID))
      .slice(0, 3)
      .map((item) => item.HwhName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected Webhost hosts',
        message: `Are you sure you want to delete ${ids.length} selected Webhost host(s)?${suffix}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const response = await this.api.delete<{
        data?: {
          deleted?: string[];
          failed?: { HostingWebhostHostUUID: string; message: string }[];
        };
      }>(`${this.hostEndpoint}/bulk`, { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map((item) => item.HostingWebhostHostUUID),
      );
      this.hosts.update((rows) => rows.filter((row) => !deleted.has(row.HwhUUID)));
      this.selectedHostUUIDs.set(failed);
      this.hostsResource.reload();
      failed.size
        ? this.snack.error(`${failed.size} Webhost host(s) could not be deleted.`)
        : this.snack.success(`${deleted.size || ids.length} Webhost host(s) deleted.`);
    } catch (error) {
      this.snack.error(this.friendlyError(error, 'Failed to delete selected Webhost hosts.'));
    }
  }

  private resetForm() {
    this.hostFormModel.set({
      name: '',
      customerUUID: '',
      planUUID: '',
      hostingDnsDomainUUID: '',
      username: '',
      status: 'pending',
      provisionStatus: 'manual',
      contactEmail: '',
      documentRoot: '',
      autoProvision: 0,
      notes: '',
      isActive: 1,
    });
    this.customerSearch.set('');
    this.domainSearch.set('');
  }

  private resetPagination() {
    this.pageIndex.set(0);
  }

  private reconcileHostSelection() {
    const available = new Set(this.hosts().map((item) => item.HwhUUID));
    this.selectedHostUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private filterDomainOptions(searchTerm: string, customerUUID: string, requireCustomer: boolean) {
    const search = searchTerm.trim().toLowerCase();
    const normalizedCustomerUUID = customerUUID.trim();
    const items = this.domains().filter((domain) => {
      const isActive = domain.HddStatus === undefined || domain.HddStatus === 1;
      if (!isActive) return false;
      if (requireCustomer && !normalizedCustomerUUID) return false;
      if (normalizedCustomerUUID && domain.CustomerCusUUID !== normalizedCustomerUUID) return false;
      return true;
    });
    if (!search) return items;
    return items.filter((domain) =>
      [domain.HddName, domain.CustomerName]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search)),
    );
  }

  private clearFilterDomainIfNeeded(customerUUID: string) {
    const domainUUID = this.filterFormModel().hostingDnsDomainUUID;
    if (this.isKnownDomainLinkedToAnotherCustomer(domainUUID, customerUUID)) {
      this.filterFormModel.update((current) => ({ ...current, hostingDnsDomainUUID: '' }));
    }
  }

  private clearFormDomainIfNeeded(customerUUID: string) {
    const domainUUID = this.hostFormModel().hostingDnsDomainUUID;
    if (this.isKnownDomainLinkedToAnotherCustomer(domainUUID, customerUUID)) {
      this.hostFormModel.update((current) => ({ ...current, hostingDnsDomainUUID: '' }));
    }
  }

  private isKnownDomainLinkedToAnotherCustomer(domainUUID: string, customerUUID: string) {
    if (!domainUUID || !customerUUID) return false;
    const domain = this.domains().find((item) => item.HddUUID === domainUUID);
    return !!domain && domain.CustomerCusUUID !== customerUUID;
  }

  private domainBelongsToCustomer(domainUUID: string, customerUUID: string) {
    if (!domainUUID || !customerUUID) return false;
    return this.domains().some(
      (domain) =>
        domain.HddUUID === domainUUID &&
        domain.CustomerCusUUID === customerUUID &&
        (domain.HddStatus === undefined || domain.HddStatus === 1),
    );
  }

  private sortRows(rows: HostingWebhostHost[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;
    return [...rows].sort((a, b) => {
      const compared = this.compareValues(this.sortValue(a, active), this.sortValue(b, active));
      return direction === 'asc' ? compared : -compared;
    });
  }

  private sortValue(item: HostingWebhostHost, column: string) {
    switch (column) {
      case 'name':
        return item.HwhName;
      case 'customer':
        return this.hostCustomerLabel(item);
      case 'domain':
        return item.DomainName;
      case 'plan':
        return this.hostPlanLabel(item);
      case 'provider':
        return this.hostProviderLabel(item);
      case 'user':
        return item.HwhUsername;
      case 'status':
        return this.statusLabel(item.HwhStatus);
      case 'provision':
        return this.provisionLabel(item.HwhProvisionStatus);
      default:
        return '';
    }
  }

  private compareValues(
    a: string | number | null | undefined,
    b: string | number | null | undefined,
  ) {
    const left = a ?? '';
    const right = b ?? '';
    if (typeof left === 'number' && typeof right === 'number') return left - right;
    return String(left).localeCompare(String(right), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  }

  private normalizeString(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private parseConfig(value: unknown): WebhostHostConfig | null {
    if (!value) return null;
    if (typeof value === 'object') return value as WebhostHostConfig;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as WebhostHostConfig) : null;
    } catch {
      return null;
    }
  }

  private buildConfigPayload(): WebhostHostConfig {
    const values = this.hostFormModel();
    return {
      contactEmail: this.normalizeString(values.contactEmail),
      documentRoot: this.normalizeString(values.documentRoot),
      autoProvision: values.autoProvision === 1,
      notes: this.normalizeString(values.notes),
    };
  }

  private friendlyError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error || error.error?.message;
      return typeof serverMessage === 'string' && serverMessage.trim().length
        ? serverMessage
        : error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  private openDialog() {
    const hostFormDialog = this.hostFormDialog();
    if (!hostFormDialog || this.dialogRef) return;
    this.dialogRef = this.dialog.open(hostFormDialog, {
      ...getWebhostDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-webhost-host-dialog',
    });
    this.dialogRef
      .keydownEvents()
      .pipe(takeUntil(this.dialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelForm();
      });
    this.startDialogViewportObserver();
    this.dialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.dialogRef = null;
    });
  }

  private closeDialog() {
    if (!this.dialogRef) return;
    this.stopDialogViewportObserver();
    this.dialogRef.close();
    this.dialogRef = null;
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.dialogRef) return;
    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;
    this.dialogViewportObserver = new ResizeObserver(() => {
      if (this.dialogRef) updateWebhostDialogViewport(this.dialogRef);
    });
    this.dialogViewportObserver.observe(pageContent);
    updateWebhostDialogViewport(this.dialogRef);
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }
}
