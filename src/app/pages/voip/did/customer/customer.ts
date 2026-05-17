import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../shared/dialog/crud-dialog.util';
import { SnackbarService } from '../../../../services/snackbar.service';
import { VoipDidCustomerService, VoipDidCustomerLink } from './customer.service';

type CustomerItem = {
  CustomerUUID: string;
  Name: string;
  Status: number;
};

type VoipDidItem = {
  VddUUID: string;
  VddNumber: string;
  VddStatus: number;
  IsAvailable?: number;
};

type Option = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-voip-did-customer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './customer.html',
  styleUrls: ['./customer.scss'],
  animations: [fadeIn],
})
export class VoipDidCustomerPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly listLimit = 5000;
  private readonly api = inject(ApiService);
  private readonly linkApi = inject(VoipDidCustomerService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly deletingSelected = signal(false);
  readonly editing = signal<VoipDidCustomerLink | null>(null);
  readonly selectedLinkUUIDs = signal<Set<string>>(new Set());
  readonly dataSource = new MatTableDataSource<VoipDidCustomerLink>([]);

  readonly customers = signal<Option[]>([]);
  readonly dids = signal<Option[]>([]);
  readonly linkDids = signal<Option[]>([]);
  readonly customerMap = signal<Map<string, CustomerItem>>(new Map());
  readonly didMap = signal<Map<string, VoipDidItem>>(new Map());
  readonly filterCustomerSearch = signal('');
  readonly filterDidSearch = signal('');
  readonly linkCustomerSearch = signal('');
  readonly linkDidSearch = signal('');

  readonly filteredFilterCustomers = computed(() =>
    this.filterOptions(this.customers(), this.filterCustomerSearch()),
  );
  readonly filteredFilterDids = computed(() =>
    this.filterOptions(this.dids(), this.filterDidSearch()),
  );
  readonly filteredLinkCustomers = computed(() =>
    this.filterOptions(this.customers(), this.linkCustomerSearch()),
  );
  readonly filteredLinkDids = computed(() =>
    this.filterOptions(this.linkDids(), this.linkDidSearch()),
  );

  readonly displayedColumns = ['select', 'customer', 'did', 'status', 'actions'];

  readonly statusOptions = [
    { value: 1, label: 'Active' },
    { value: 0, label: 'Inactive' },
  ];

  readonly filterForm = this.fb.nonNullable.group({
    customerUUID: [''],
    didUUID: [''],
    status: [''],
  });

  readonly linkForm = this.fb.nonNullable.group({
    customerUUID: ['', [Validators.required]],
    didUUID: ['', [Validators.required]],
    status: [1, [Validators.required]],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('didCustomerFormDialog') didCustomerFormDialog?: TemplateRef<unknown>;
  private didCustomerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    void this.loadCustomers();
    void this.loadDids();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'customer':
          return this.customerLabel(data.CustomerCusUUID).toLowerCase();
        case 'did':
          return this.didLabel(data).toLowerCase();
        case 'status':
          return data.VdcStatus ?? 0;
        default:
          return '';
      }
    };
    setTimeout(() => void this.loadLinks(), 0);
  }

  ngOnDestroy() {
    this.closeDidCustomerDialog();
  }

  refreshList() {
    void this.loadCustomers();
    void this.loadDids();
    void this.loadLinks();
  }

  async loadCustomers() {
    try {
      const response = await this.api.get<any>('erp/customers');
      const items: CustomerItem[] = response?.data?.items ?? [];
      const map = new Map<string, CustomerItem>();
      items.forEach((item) => map.set(item.CustomerUUID, item));
      this.customerMap.set(map);
      this.customers.set(items.map((item) => ({ value: item.CustomerUUID, label: item.Name })));
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load customers.'));
    }
  }

  async loadDids() {
    try {
      const response = await this.api.get<any>(`voip/did/numbers?limit=${this.listLimit}`);
      const items: VoipDidItem[] = response?.data?.items ?? [];
      const map = new Map<string, VoipDidItem>();
      items.forEach((item) => map.set(item.VddUUID, item));
      this.didMap.set(map);
      this.dids.set(items.map((item) => ({ value: item.VddUUID, label: item.VddNumber })));
    } catch (err) {
      this.snack.error(this.extractErrorMessage(err, 'Failed to load DIDs.'));
    }
  }

  async loadAvailableDids(currentLink: VoipDidCustomerLink | null = null) {
    try {
      const response = await this.api.get<any>(`voip/did/numbers?limit=${this.listLimit}&availableOnly=1`);
      const items: VoipDidItem[] = response?.data?.items ?? [];
      const options = items.map((item) => ({ value: item.VddUUID, label: item.VddNumber }));

      if (currentLink && !options.some((option) => option.value === currentLink.VoipDidVddUUID)) {
        options.unshift({
          value: currentLink.VoipDidVddUUID,
          label: this.didLabel(currentLink),
        });
      }

      this.linkDids.set(options);
    } catch (err) {
      this.linkDids.set(
        currentLink
          ? [{ value: currentLink.VoipDidVddUUID, label: this.didLabel(currentLink) }]
          : [],
      );
      this.snack.error(this.extractErrorMessage(err, 'Failed to load available DIDs.'));
    }
  }

  async loadLinks() {
    this.loading.set(true);
    const start = performance.now();

    const { customerUUID, didUUID, status } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (customerUUID) params.set('customerUuid', customerUUID);
    if (didUUID) params.set('didUuid', didUUID);
    if (status !== '') params.set('status', String(status));
    params.set('limit', String(this.listLimit));

    try {
      const response = await this.linkApi.list(params);
      this.dataSource.data = response?.data?.items ?? [];
      this.reconcileSelection();
    } catch (err: any) {
      const message = this.extractErrorMessage(err, 'Failed to load customer DIDs.');
      this.snack.error(message);
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

  applyFilters() {
    void this.loadLinks();
  }

  clearFilters() {
    this.filterForm.reset({ customerUUID: '', didUUID: '', status: '' });
    this.filterCustomerSearch.set('');
    this.filterDidSearch.set('');
    void this.loadLinks();
  }

  async startCreate() {
    this.resetForm();
    this.linkForm.controls.customerUUID.enable();
    this.linkForm.controls.didUUID.enable();
    await this.loadAvailableDids(null);
    this.openDidCustomerDialog();
  }

  async submitLink(saveAndNew = false) {
    if (this.linkForm.invalid) {
      this.linkForm.markAllAsTouched();
      return;
    }

    const { customerUUID, didUUID, status } = this.linkForm.getRawValue();

    this.saving.set(true);

    try {
      const editing = this.editing();
      if (editing) {
        await this.linkApi.update(editing.VdcUUID, { customerUUID, didUUID, status });
        this.snack.success('DID customer link updated successfully.');
      } else {
        await this.linkApi.create({ customerUUID, didUUID, status });
        this.snack.success('DID customer link created successfully.');
      }
      await this.loadLinks();
      await this.loadAvailableDids(editing ?? null);
      if (saveAndNew && !editing) {
        this.resetForm();
        await this.loadAvailableDids(null);
        return;
      }
      this.cancelCreate();
    } catch (err: any) {
      const message = this.extractErrorMessage(err, 'Failed to link DID.');
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNewLink() {
    void this.submitLink(true);
  }

  async startEdit(link: VoipDidCustomerLink) {
    this.editing.set(link);
    this.linkForm.reset({
      customerUUID: link.CustomerCusUUID,
      didUUID: link.VoipDidVddUUID,
      status: link.VdcStatus,
    });
    this.linkForm.controls.customerUUID.enable();
    this.linkForm.controls.didUUID.enable();
    await this.loadAvailableDids(link);
    this.openDidCustomerDialog();
  }

  cancelCreate() {
    this.resetForm();
    this.closeDidCustomerDialog();
  }

  async toggleStatus(link: VoipDidCustomerLink) {
    const nextStatus = link.VdcStatus === 1 ? 0 : 1;
    try {
      await this.linkApi.update(link.VdcUUID, {
        customerUUID: link.CustomerCusUUID,
        didUUID: link.VoipDidVddUUID,
        status: nextStatus,
      });
      await this.loadLinks();
      this.snack.success('DID customer link status updated successfully.');
    } catch (err: any) {
      const message = this.extractErrorMessage(err, 'Failed to update link status.');
      this.snack.error(message);
    }
  }

  async removeLink(link: VoipDidCustomerLink) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete Link',
        message: 'Are you sure you want to delete this DID link?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.linkApi.remove(link.VdcUUID);
      this.dataSource.data = this.dataSource.data.filter((item) => item.VdcUUID !== link.VdcUUID);
      this.toggleLinkSelection(link, false);
      await this.loadAvailableDids(null);
      this.snack.success('DID customer link deleted successfully.');
    } catch (err: any) {
      const message = this.extractErrorMessage(err, 'Failed to delete link.');
      this.snack.error(message);
    }
  }

  selectedCount() {
    return this.selectedLinkUUIDs().size;
  }

  visibleRows() {
    const rows = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;

    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  isSelected(item: VoipDidCustomerLink) {
    return this.selectedLinkUUIDs().has(item.VdcUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleLinkSelection(item: VoipDidCustomerLink, checked: boolean) {
    const next = new Set(this.selectedLinkUUIDs());
    if (checked) {
      next.add(item.VdcUUID);
    } else {
      next.delete(item.VdcUUID);
    }
    this.selectedLinkUUIDs.set(next);
  }

  toggleVisibleSelection(checked: boolean) {
    const rows = this.visibleRows();
    const next = new Set(this.selectedLinkUUIDs());

    for (const row of rows) {
      if (checked) {
        next.add(row.VdcUUID);
      } else {
        next.delete(row.VdcUUID);
      }
    }

    this.selectedLinkUUIDs.set(next);
  }

  async removeSelectedLinks() {
    const ids = [...this.selectedLinkUUIDs()];
    if (!ids.length) return;

    const selectedLabels = this.dataSource.data
      .filter((item) => this.selectedLinkUUIDs().has(item.VdcUUID))
      .slice(0, 3)
      .map((item) => `${this.customerLabel(item.CustomerCusUUID)} / ${this.didLabel(item)}`)
      .join(', ');

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected links',
        message: `Are you sure you want to delete ${ids.length} selected DID customer link${ids.length === 1 ? '' : 's'}${selectedLabels ? ` (${selectedLabels}${ids.length > 3 ? ', ...' : ''})` : ''}?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });

    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deletingSelected.set(true);

    try {
      const response = await this.linkApi.removeMany(ids);
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.VdcUUID));
      this.selectedLinkUUIDs.set(
        new Set([...this.selectedLinkUUIDs()].filter((uuid) => !deleted.has(uuid))),
      );

      const failed = response?.data?.failed ?? [];
      if (failed.length) {
        this.snack.warning(`${deleted.size} links deleted. ${failed.length} links failed.`);
      } else {
        this.snack.success(`${deleted.size} links deleted successfully.`);
      }
      await this.loadAvailableDids(null);
    } catch (err: any) {
      const message = this.extractErrorMessage(err, 'Failed to delete selected links.');
      this.snack.error(message);
    } finally {
      this.deletingSelected.set(false);
    }
  }

  customerLabel(uuid: string) {
    return this.customerMap().get(uuid)?.Name ?? uuid;
  }

  didLabel(link: VoipDidCustomerLink) {
    if (link.VddNumber) return link.VddNumber;
    return this.didMap().get(link.VoipDidVddUUID)?.VddNumber ?? link.VoipDidVddUUID;
  }

  onFilterCustomerOpened(opened: boolean) {
    if (!opened) {
      this.filterCustomerSearch.set('');
    }
  }

  onFilterDidOpened(opened: boolean) {
    if (!opened) {
      this.filterDidSearch.set('');
    }
  }

  onLinkCustomerOpened(opened: boolean) {
    if (!opened) {
      this.linkCustomerSearch.set('');
    }
  }

  onLinkDidOpened(opened: boolean) {
    if (!opened) {
      this.linkDidSearch.set('');
    }
  }

  private resetForm() {
    this.editing.set(null);
    this.linkForm.controls.customerUUID.enable();
    this.linkForm.controls.didUUID.enable();
    this.linkForm.reset({ customerUUID: '', didUUID: '', status: 1 });
    this.linkCustomerSearch.set('');
    this.linkDidSearch.set('');
  }

  private reconcileSelection() {
    const available = new Set(this.dataSource.data.map((item) => item.VdcUUID));
    const next = new Set([...this.selectedLinkUUIDs()].filter((uuid) => available.has(uuid)));
    this.selectedLinkUUIDs.set(next);
  }

  private openDidCustomerDialog() {
    if (!this.didCustomerFormDialog || this.didCustomerFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.didCustomerFormDialog,
      'voip-did-customer-form-dialog',
    );
    this.didCustomerFormDialogRef = this.dialogBinding.ref;
    this.didCustomerFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelCreate();
    });
  }

  private closeDidCustomerDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.didCustomerFormDialogRef?.close();
    this.didCustomerFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }

  private filterOptions(options: Option[], query: string) {
    const value = query.trim().toLowerCase();
    if (!value) return options;
    return options.filter((option) => option.label.toLowerCase().includes(value));
  }
}
