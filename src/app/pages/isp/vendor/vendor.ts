import {
  Component,
  DestroyRef,
  TemplateRef,
  afterNextRender,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import {
  FormField,
  email,
  form as createForm,
  minLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { firstValueFrom, takeUntil } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../../services/api.service';
import { IspVendor } from '../../../models/isp-vendor.model';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type SupplierOption = {
  value: string;
  label: string;
};

@Component({
  selector: 'app-isp-vendor',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    PhoneInputComponent,
  ],
  templateUrl: './vendor.html',
  styleUrls: ['./vendor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IspVendorPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspVendor | null>(null);
  readonly supportEmailError = signal('');
  readonly supplierSearch = signal('');
  private readonly vendorsResource = resource({
    defaultValue: [] as IspVendor[],
    loader: () => this.fetchVendors(),
  });
  readonly loading = this.vendorsResource.isLoading;

  readonly dataSource = new MatTableDataSource<IspVendor>([]);
  readonly displayedColumns = ['name', 'supplier', 'website', 'support', 'status', 'actions'];
  search = '';
  searchInput = '';
  suppliers: SupplierOption[] = [];
  supplierMap = new Map<string, SupplierOption>();

  readonly vendorFormModel = signal({
    name: '',
    supplierUUID: '',
    website: '',
    supportEmail: '',
    supportPhone: '',
    notes: '',
    status: 1,
  });
  readonly vendorForm = createForm(this.vendorFormModel, (schema) => {
    required(schema.name);
    minLength(schema.name, 2);
    email(schema.supportEmail);
    pattern(schema.supportPhone, /^\d{8,15}$/);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly vendorFormDialog = viewChild<TemplateRef<unknown>>('vendorFormDialog');
  private vendorFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncVendors = effect(() => {
    this.dataSource.data = this.vendorsResource.value();
    this.applySearchFilters();
  });
  private readonly reportVendorsError = effect(() => {
    const error = this.vendorsResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load vendors.'));
      this.dataSource.data = [];
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [
        data.VendorName,
        data.SupplierName,
        this.supplierLabel(data.SupplierUUID),
        data.VendorWebsite,
        data.VendorSupportEmail,
        data.VendorSupportPhone,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    this.loadSuppliers();
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopDialogViewportObserver();
      this.closeVendorDialog();
    });
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters(value?: string) {
    if (value !== undefined) this.searchInput = value;
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

  refreshList() {
    this.vendorsResource.reload();
  }

  private async fetchVendors() {
    this.error.set(null);
    const response = await this.api.get<any>('isp/vendors');
    return response?.data?.items ?? [];
  }

  async loadSuppliers() {
    try {
      const response = await this.api.get<any>('erp/suppliers');
      const items = response?.data?.items ?? [];
      this.suppliers = items.map((item: any) => ({
        value: item.SupplierUUID,
        label: item.Name,
      }));
      this.supplierMap = new Map(this.suppliers.map((supplier) => [supplier.value, supplier]));
    } catch (err) {
      console.error('Failed to load suppliers.', err);
    }
  }

  startCreate() {
    this.editing.set(null);
    this.vendorFormModel.set({
      name: '',
      supplierUUID: '',
      website: '',
      supportEmail: '',
      supportPhone: '',
      notes: '',
      status: 1,
    });
    this.updateSupportEmailError();
  }

  startEdit(item: IspVendor) {
    this.editing.set(item);
    this.vendorFormModel.set({
      name: item.VendorName,
      supplierUUID: item.SupplierUUID ?? '',
      website: item.VendorWebsite ?? '',
      supportEmail: item.VendorSupportEmail ?? '',
      supportPhone: item.VendorSupportPhone ?? '',
      notes: item.VendorNotes ?? '',
      status: item.VendorStatus ?? 1,
    });
    this.updateSupportEmailError();
    this.openVendorDialog();
  }

  async saveVendor() {
    this.updateSupportEmailError();
    if (!this.vendorForm().valid()) return;

    const value = this.vendorFormModel();
    const payload = {
      name: value.name.trim(),
      supplierUUID: value.supplierUUID || null,
      website: value.website?.trim() || null,
      supportEmail: value.supportEmail?.trim() || null,
      supportPhone: value.supportPhone?.trim() || null,
      notes: value.notes?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`isp/vendors/${editing.VendorUUID}`, payload);
      } else {
        await this.api.post<any>('isp/vendors', payload);
      }

      this.vendorsResource.reload();
      this.closeVendorDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save vendor.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteVendor(item: IspVendor) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete vendor',
        message: `Are you sure you want to delete "${item.VendorName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/vendors/${item.VendorUUID}`);
      this.vendorsResource.reload();
    } catch (err) {
      console.error('Failed to delete vendor.', err);
      alert('Failed to delete vendor.');
    }
  }

  supportLabel(item: IspVendor) {
    if (item.VendorSupportEmail && item.VendorSupportPhone) {
      return `${item.VendorSupportEmail} • ${item.VendorSupportPhone}`;
    }
    return item.VendorSupportEmail || item.VendorSupportPhone || '-';
  }

  supplierLabel(supplierUUID?: string | null) {
    if (!supplierUUID) return '-';
    return this.supplierMap.get(supplierUUID)?.label ?? '-';
  }

  get filteredSuppliers() {
    const value = this.supplierSearch().trim().toLowerCase();
    if (!value) return this.suppliers;
    return this.suppliers.filter((supplier) =>
      (supplier.label ?? '').toLowerCase().includes(value),
    );
  }

  onSupplierOpened(opened: boolean) {
    if (opened) {
      this.supplierSearch.set('');
    }
  }

  statusLabel(item: IspVendor) {
    return item.VendorStatus === 1 ? 'Active' : 'Inactive';
  }

  openCreateDialog() {
    this.startCreate();
    this.openVendorDialog();
  }

  cancelVendorForm() {
    this.closeVendorDialog();
    this.startCreate();
  }

  private openVendorDialog() {
    const vendorFormDialog = this.vendorFormDialog();
    if (!vendorFormDialog || this.vendorFormDialogRef) return;
    this.error.set(null);
    this.vendorFormDialogRef = this.dialog.open(vendorFormDialog, {
      ...this.getVendorDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-vendor-form-dialog',
    });
    this.vendorFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.vendorFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.closeVendorDialog();
        }
      });
    this.startDialogViewportObserver();
    this.vendorFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.vendorFormDialogRef = null;
    });
  }

  private closeVendorDialog() {
    if (!this.vendorFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.vendorFormDialogRef.close();
    this.vendorFormDialogRef = null;
  }

  private getVendorDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: '100vw',
        maxWidth: '100vw',
        maxHeight: '100dvh',
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
    const leftPx = Math.max(0, Math.floor(rect.left + spacing));
    const topPx = Math.max(0, Math.floor(rect.top + spacing));

    return {
      width: `${widthPx}px`,
      maxWidth: `${widthPx}px`,
      maxHeight: `${maxHeightPx}px`,
      position: {
        left: `${leftPx}px`,
        top: `${topPx}px`,
      },
    };
  }

  private startDialogViewportObserver() {
    this.stopDialogViewportObserver();
    if (!this.vendorFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateVendorDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateVendorDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateVendorDialogViewport() {
    if (!this.vendorFormDialogRef) return;
    const config = this.getVendorDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.vendorFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.vendorFormDialogRef.updatePosition(config.position);
    } else {
      this.vendorFormDialogRef.updatePosition();
    }
  }

  private updateSupportEmailError() {
    if (
      this.vendorForm
        .supportEmail()
        .errors()
        .some((error) => error.kind === 'email')
    ) {
      this.supportEmailError.set('Email is invalid.');
    } else {
      this.supportEmailError.set('');
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
