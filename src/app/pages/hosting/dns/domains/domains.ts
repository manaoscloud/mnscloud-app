import {
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
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

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
  ],
  templateUrl: './domains.html',
  styleUrls: ['./domains.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class HostingDnsDomainsPage implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  @ViewChild('domainFormDialog') domainFormDialog?: TemplateRef<unknown>;

  private domainDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  readonly loading = signal(false);
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

  readonly filterForm = this.fb.nonNullable.group({
    name: [''],
    customerUUID: [''],
    providerUUID: [''],
    status: [''],
  });

  readonly domainForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    customerUUID: ['', [Validators.required]],
    providerUUID: [''],
    status: [1 as DomainStatus, [Validators.required]],
    notes: [''],
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

  ngOnInit() {
    void this.loadCustomers();
    void this.loadDomainProviders();
    void this.loadDomains();
  }

  ngOnDestroy() {
    this.closeDomainDialog();
    this.stopDialogViewportObserver();
  }

  refreshList() {
    void this.loadDomains();
  }

  async loadDomains() {
    this.loading.set(true);
    const start = performance.now();

    const { name, customerUUID, providerUUID, status } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (name?.trim()) params.set('name', name.trim());
    if (customerUUID?.trim()) params.set('customerUUID', customerUUID.trim());
    if (providerUUID?.trim()) params.set('providerUUID', providerUUID.trim());
    if (status === '0' || status === '1') params.set('status', status);
    params.set('limit', '500');
    params.set('offset', '0');

    try {
      const response = await this.api.get<{ data?: { items?: HostingDnsDomain[] } }>(
        `hosting/dns/domains?${params.toString()}`,
      );
      this.domains.set(response?.data?.items ?? []);
      this.pageIndex.set(0);
      this.reconcileDomainSelection();
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load domains.'));
    } finally {
      this.finishLoading(start);
    }
  }

  async loadDomainProviders() {
    try {
      const response = await this.api.get<{ data?: { items?: DomainProviderOption[] } }>(
        'hosting/dns/providers?status=1&limit=500&offset=0',
      );
      this.providers.set(response?.data?.items ?? []);
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load domain providers.'));
    }
  }

  async loadCustomers() {
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
    void this.loadDomains();
  }

  clearFilters() {
    this.filterForm.reset({ name: '', customerUUID: '', providerUUID: '', status: '' });
    void this.loadDomains();
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
    this.domainForm.reset({ name: '', customerUUID: '', providerUUID: '', status: 1, notes: '' });
    this.customerFormSearch.set('');
    this.providerFormSearch.set('');
    this.openDomainDialog();
  }

  startEdit(domain: HostingDnsDomain) {
    this.editing.set(domain);
    this.domainForm.reset({
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
    if (this.domainForm.invalid) {
      this.domainForm.markAllAsTouched();
      this.snack.warning('Please fill all required fields.');
      return;
    }

    const values = this.domainForm.getRawValue();
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

      await this.loadDomains();
      if (closeAfterSave || editing) {
        this.closeDomainDialog();
        this.resetForm();
      } else {
        this.domainForm.reset({
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
      await this.loadDomains();
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
      await this.loadDomains();
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
    this.domainForm.reset({ name: '', customerUUID: '', providerUUID: '', status: 1, notes: '' });
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

  private finishLoading(start: number) {
    const elapsed = performance.now() - start;
    const waitMs = Math.max(0, 600 - elapsed);
    if (waitMs) {
      setTimeout(() => this.loading.set(false), waitMs);
      return;
    }
    this.loading.set(false);
  }

  private openDomainDialog() {
    if (!this.domainFormDialog || this.domainDialogRef) return;
    this.domainDialogRef = this.dialog.open(this.domainFormDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'hosting-dns-domain-form-dialog',
    });
    this.domainDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelForm();
      }
    });
    this.startDialogViewportObserver();
    this.domainDialogRef.afterClosed().subscribe(() => {
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
