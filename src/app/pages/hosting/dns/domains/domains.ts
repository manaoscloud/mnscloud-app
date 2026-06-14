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
import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
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
import { bindDialogClosed, bindDialogEscape } from '../../../../shared/dialog/dialog-events.util';

type DomainStatus = 0 | 1;

type HostingDnsDomain = {
  HddUUID: string;
  HddID: string;
  HddName: string;
  CustomerCusUUID?: string | null;
  CustomerName?: string | null;
  HostingDnsProviderHdpUUID?: string | null;
  ProviderName?: string | null;
  ProviderPlatform?: string | null;
  HddProvider?: string | null;
  HddStatus: DomainStatus;
  HddNotes?: string | null;
};

type DomainProviderOption = {
  HdpUUID: string;
  HdpName: string;
  HdpProvider: string;
  HdpStatus: number;
};

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  Document?: string | null;
  Status?: number | null;
};

@Component({
  selector: 'app-hosting-dns-domains',
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
  templateUrl: './domains.html',
  styleUrls: ['./domains.scss'],
})
export class HostingDnsDomainsPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly domainFormDialog = viewChild<TemplateRef<unknown>>('domainFormDialog');

  private domainDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  readonly appliedName = signal('');
  readonly appliedCustomerUUID = signal('');
  readonly appliedProviderUUID = signal('');
  readonly appliedStatus = signal('');

  private readonly domainsResource = resource({
    params: () => ({
      name: this.appliedName().trim(),
      customerUUID: this.appliedCustomerUUID().trim(),
      providerUUID: this.appliedProviderUUID().trim(),
      status: this.appliedStatus(),
    }),
    defaultValue: [] as HostingDnsDomain[],
    loader: async ({ params }) => {
      const query = new URLSearchParams();
      if (params.name) query.set('name', params.name);
      if (params.customerUUID) query.set('customerUUID', params.customerUUID);
      if (params.providerUUID) query.set('providerUUID', params.providerUUID);
      if (params.status === '0' || params.status === '1') query.set('status', params.status);
      query.set('limit', '500');
      query.set('offset', '0');

      const response = await this.api.get<{ data?: { items?: HostingDnsDomain[] } }>(
        `hosting/dns/domains?${query.toString()}`,
      );
      return response?.data?.items ?? [];
    },
  });

  readonly loading = this.domainsResource.isLoading;
  readonly saving = signal(false);
  readonly domains = signal<HostingDnsDomain[]>([]);
  readonly customers = signal<CustomerOption[]>([]);
  readonly providers = signal<DomainProviderOption[]>([]);
  readonly customerFilterSearch = signal('');
  readonly customerFormSearch = signal('');
  readonly providerFilterSearch = signal('');
  readonly providerFormSearch = signal('');
  readonly editing = signal<HostingDnsDomain | null>(null);
  readonly selectedDomainUUIDs = signal<Set<string>>(new Set());
  readonly selectedCount = computed(() => this.selectedDomainUUIDs().size);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly sortActive = signal('');
  readonly sortDirection = signal<'asc' | 'desc' | ''>('');
  readonly sortedDomains = computed(() => this.sortDomains(this.domains()));
  readonly pagedDomains = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedDomains().slice(start, start + this.pageSize());
  });

  readonly displayedColumns = ['select', 'name', 'customer', 'provider', 'status', 'actions'];

  readonly filterFormModel = signal({
    name: '',
    customerUUID: '',
    providerUUID: '',
    status: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly domainFormModel = signal({
    name: '',
    customerUUID: '',
    providerUUID: '',
    status: 1 as DomainStatus,
    notes: '',
  });
  readonly domainForm = createForm(this.domainFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    required(schema.customerUUID);
    required(schema.status);
  });

  readonly filteredProviderOptions = computed(() =>
    this.filterProviders(this.providerFormSearch()),
  );
  readonly filteredProviderFilterOptions = computed(() =>
    this.filterProviders(this.providerFilterSearch()),
  );
  readonly filteredCustomerOptions = computed(() =>
    this.filterCustomers(this.customerFormSearch()),
  );
  readonly filteredCustomerFilterOptions = computed(() =>
    this.filterCustomers(this.customerFilterSearch()),
  );

  private readonly syncDomains = effect(() => {
    this.domains.set(this.domainsResource.value());
    this.pageIndex.set(0);
    this.reconcileDomainSelection();
  });

  private readonly reportDomainsError = effect(() => {
    const error = this.domainsResource.error();
    if (error) {
      this.snack.error(this.extractErrorMessage(error, 'Failed to load domains.'));
    }
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.closeDomainDialog();
      this.stopDialogViewportObserver();
    });
    void this.fetchCustomers();
    void this.fetchDomainProviders();
  }

  refreshList() {
    this.domainsResource.reload();
  }

  async fetchDomainProviders() {
    try {
      const response = await this.api.get<{ data?: { items?: DomainProviderOption[] } }>(
        'hosting/dns/providers?status=1&limit=500&offset=0',
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load domain providers.'));
    }
  }

  async fetchCustomers() {
    try {
      const response = await this.api.get<{ data?: { items?: CustomerOption[] } }>(
        'erp/customers?status=1&limit=500&offset=0',
      );
      this.customers.set(response?.data?.items ?? []);
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load customers.'));
    }
  }

  applyFilters() {
    const { name, customerUUID, providerUUID, status } = this.filterFormModel();
    this.appliedName.set(name);
    this.appliedCustomerUUID.set(customerUUID);
    this.appliedProviderUUID.set(providerUUID);
    this.appliedStatus.set(status);
    this.domainsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ name: '', customerUUID: '', providerUUID: '', status: '' });
    this.appliedName.set('');
    this.appliedCustomerUUID.set('');
    this.appliedProviderUUID.set('');
    this.appliedStatus.set('');
    this.domainsResource.reload();
  }

  onPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  onSort(sort: Sort) {
    this.sortActive.set(sort.active);
    this.sortDirection.set(sort.direction);
    this.pageIndex.set(0);
  }

  startCreate() {
    this.editing.set(null);
    this.domainFormModel.set({
      name: '',
      customerUUID: '',
      providerUUID: '',
      status: 1,
      notes: '',
    });
    this.customerFormSearch.set('');
    this.providerFormSearch.set('');
    this.openDomainDialog();
  }

  startEdit(domain: HostingDnsDomain) {
    this.editing.set(domain);
    this.domainFormModel.set({
      name: domain.HddName ?? '',
      customerUUID: domain.CustomerCusUUID ?? '',
      providerUUID: domain.HostingDnsProviderHdpUUID ?? '',
      status: (domain.HddStatus ?? 1) as DomainStatus,
      notes: domain.HddNotes ?? '',
    });
    this.customerFormSearch.set('');
    this.providerFormSearch.set('');
    this.openDomainDialog();
  }

  cancelForm() {
    this.closeDomainDialog();
    this.resetForm();
  }

  async saveDomain(closeAfterSave = true) {
    if (!this.domainForm().valid()) {
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.domainFormModel();
    const payload = {
      name: values.name.trim(),
      customerUUID: values.customerUUID.trim(),
      providerUUID: values.providerUUID.trim() || null,
      status: values.status,
      notes: values.notes.trim() || null,
    };

    if (!payload.name) {
      this.snack.warning('Domain name is required.');
      return;
    }

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`hosting/dns/domains/${editing.HddUUID}`, payload);
        this.snack.success('Domain updated successfully.');
      } else {
        await this.api.post('hosting/dns/domains', payload);
        this.snack.success('Domain created successfully.');
      }

      this.domainsResource.reload();
      if (closeAfterSave || editing) {
        this.closeDomainDialog();
        this.resetForm();
      } else {
        this.domainFormModel.set({
          name: '',
          customerUUID: '',
          providerUUID: '',
          status: 1,
          notes: '',
        });
      }
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to save domain.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewDomain() {
    void this.saveDomain(false);
  }

  async deleteDomain(domain: HostingDnsDomain) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete domain',
        message: `Are you sure you want to delete "${domain.HddName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`hosting/dns/domains/${domain.HddUUID}`);
      this.snack.success('Domain deleted successfully.');
      this.domainsResource.reload();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete domain.'));
    }
  }

  isSelected(domain: HostingDnsDomain) {
    return this.selectedDomainUUIDs().has(domain.HddUUID);
  }

  isAllVisibleSelected() {
    const rows = this.pagedDomains();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.pagedDomains();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleDomainSelection(domain: HostingDnsDomain, checked: boolean) {
    this.selectedDomainUUIDs.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(domain.HddUUID);
      } else {
        next.delete(domain.HddUUID);
      }
      return next;
    });
  }

  toggleVisibleSelection(checked: boolean) {
    this.selectedDomainUUIDs.update((current) => {
      const next = new Set(current);
      for (const row of this.pagedDomains()) {
        if (checked) {
          next.add(row.HddUUID);
        } else {
          next.delete(row.HddUUID);
        }
      }
      return next;
    });
  }

  async deleteSelectedDomains() {
    const ids = Array.from(this.selectedDomainUUIDs());
    if (!ids.length) return;

    const labels = this.domains()
      .filter((domain) => ids.includes(domain.HddUUID))
      .slice(0, 3)
      .map((domain) => domain.HddName);
    const suffix = labels.length ? ` (${labels.join(', ')}${ids.length > 3 ? ', ...' : ''})` : '';
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected domains',
        message: `Are you sure you want to delete ${ids.length} selected domain(s)?${suffix}`,
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
          failed?: { HostingDnsDomainUUID?: string; HddUUID?: string; message: string }[];
        };
      }>('hosting/dns/domains/bulk', { ids });
      const deleted = new Set(response?.data?.deleted ?? []);
      const failed = new Set(
        (response?.data?.failed ?? []).map(
          (item) => item.HostingDnsDomainUUID ?? item.HddUUID ?? '',
        ),
      );
      this.domains.update((rows) => rows.filter((row) => !deleted.has(row.HddUUID)));
      this.domainsResource.reload();
      this.selectedDomainUUIDs.set(failed);
      if (failed.size) {
        this.snack.warning(`${failed.size} domain(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} domain(s) deleted.`);
      }
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to delete selected domains.'));
    }
  }

  statusLabel(status: DomainStatus) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  providerDisplay(domain: HostingDnsDomain) {
    return domain.ProviderName || domain.HddProvider || '-';
  }

  customerDisplay(domain: HostingDnsDomain) {
    return domain.CustomerName || '-';
  }

  customerLabel(customer: CustomerOption) {
    return [customer.Name, customer.Document].filter(Boolean).join(' · ');
  }

  onCustomerFilterOpened(opened: boolean) {
    if (!opened) this.customerFilterSearch.set('');
  }

  onCustomerFormOpened(opened: boolean) {
    if (!opened) this.customerFormSearch.set('');
  }

  updateCustomerFilterSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.customerFilterSearch.set(input.value);
  }

  updateCustomerFormSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.customerFormSearch.set(input.value);
  }

  onProviderFilterOpened(opened: boolean) {
    if (!opened) this.providerFilterSearch.set('');
  }

  onProviderFormOpened(opened: boolean) {
    if (!opened) this.providerFormSearch.set('');
  }

  updateProviderFilterSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.providerFilterSearch.set(input.value);
  }

  updateProviderFormSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.providerFormSearch.set(input.value);
  }

  private resetForm() {
    this.editing.set(null);
    this.domainFormModel.set({
      name: '',
      customerUUID: '',
      providerUUID: '',
      status: 1,
      notes: '',
    });
  }

  private reconcileDomainSelection() {
    const available = new Set(this.domains().map((domain) => domain.HddUUID));
    this.selectedDomainUUIDs.update((current) => {
      const next = new Set<string>();
      current.forEach((uuid) => {
        if (available.has(uuid)) next.add(uuid);
      });
      return next;
    });
  }

  private sortDomains(rows: HostingDnsDomain[]) {
    const active = this.sortActive();
    const direction = this.sortDirection();
    if (!active || !direction) return rows;

    return [...rows].sort((a, b) => {
      const compared = this.compareValues(
        this.domainSortValue(a, active),
        this.domainSortValue(b, active),
      );
      return direction === 'asc' ? compared : -compared;
    });
  }

  private domainSortValue(domain: HostingDnsDomain, column: string) {
    switch (column) {
      case 'name':
        return domain.HddName;
      case 'provider':
        return this.providerDisplay(domain);
      case 'customer':
        return this.customerDisplay(domain);
      case 'status':
        return domain.HddStatus;
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

  private filterProviders(search: string) {
    const term = search.trim().toLowerCase();
    const rows = this.providers();
    if (!term) return rows;
    return rows.filter((provider) =>
      [provider.HdpName, provider.HdpProvider]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  private filterCustomers(search: string) {
    const term = search.trim().toLowerCase();
    const rows = this.customers();
    if (!term) return rows;
    return rows.filter((customer) =>
      [customer.Name, customer.Document]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }

  private openDomainDialog() {
    const domainFormDialog = this.domainFormDialog();
    if (!domainFormDialog || this.domainDialogRef) return;
    this.domainDialogRef = this.dialog.open(domainFormDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-dns-domain-form-dialog',
    });
    bindDialogEscape(this.domainDialogRef, () => {
      this.cancelForm();
    });
    this.startDialogViewportObserver();
    bindDialogClosed(this.domainDialogRef, () => {
      this.stopDialogViewportObserver();
      this.domainDialogRef = null;
    });
  }

  private closeDomainDialog() {
    if (!this.domainDialogRef) return;
    this.stopDialogViewportObserver();
    this.domainDialogRef.close();
    this.domainDialogRef = null;
  }

  private getDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: 'calc(100vw - 24px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100dvh - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        position: { left: '12px', top: '12px' },
      };
    }

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) {
      return {
        width: 'min(1280px, calc(100vw - 1.5rem))',
        maxWidth: '99vw',
        maxHeight: '95vh',
      };
    }

    const rect = pageContent.getBoundingClientRect();
    const spacing = 8;
    const widthPx = Math.max(320, Math.floor(rect.width - spacing * 2));
    const maxHeightPx = Math.max(420, Math.floor(rect.height - spacing * 2));
    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${Math.max(0, Math.floor(rect.left + spacing))}px`,
        top: `${Math.max(0, Math.floor(rect.top + spacing))}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.domainDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => this.updateDialogViewport());
    this.dialogViewportObserver.observe(pageContent);
    this.updateDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDialogViewport() {
    if (!this.domainDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.domainDialogRef.updateSize(width, height);
    if (config.position) {
      this.domainDialogRef.updatePosition(config.position);
    } else {
      this.domainDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: unknown, fallback: string) {
    if (err && typeof err === 'object' && 'error' in err) {
      const payload = (err as { error?: { error?: string; message?: string } }).error;
      return payload?.error || payload?.message || fallback;
    }
    if (err instanceof Error) return err.message;
    return fallback;
  }
}
