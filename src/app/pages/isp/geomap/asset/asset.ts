import { AfterViewInit, Component, OnDestroy, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { ApiService } from '../../../../services/api.service';
import { IspVendor } from '../../../../models/isp-vendor.model';
import { IspVendorModel } from '../../../../models/isp-vendor-model.model';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

type GeoMapAssetTypeOption = {
  IatUUID: string;
  IatCode: string;
  IatName: string;
  IatSortOrder?: number;
};

type GeoMapAssetRegistryItem = {
  IgaUUID: string;
  IgaID: string;
  IgaStatus: string;
  IgaNotes?: string | null;
  IspGeoMapAssetTypeIatUUID: string;
  IatCode?: string | null;
  IatName?: string | null;
  IspVendorIveUUID?: string | null;
  VendorName?: string | null;
  IspVendorModelIvmUUID?: string | null;
  VendorModelName?: string | null;
  VendorModelType?: string | null;
};

@Component({
  selector: 'app-isp-geomap-asset',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
  ],
  templateUrl: './asset.html',
  styleUrls: ['./asset.scss'],
  animations: [fadeIn],
})
export class IspGeoMapAssetPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<GeoMapAssetRegistryItem | null>(null);
  readonly assetTypes = signal<GeoMapAssetTypeOption[]>([]);
  readonly vendors = signal<IspVendor[]>([]);
  readonly vendorModels = signal<IspVendorModel[]>([]);

  vendorSearch = '';
  modelSearch = '';
  typeSearch = '';

  readonly dataSource = new MatTableDataSource<GeoMapAssetRegistryItem>([]);
  readonly displayedColumns = ['type', 'vendor', 'model', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly assetForm = this.fb.nonNullable.group({
    assetTypeUUID: ['', [Validators.required]],
    vendorUUID: [''],
    vendorModelUUID: [''],
    status: ['ACTIVE', [Validators.required]],
    notes: [''],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('assetFormDialog') assetFormDialog?: TemplateRef<unknown>;
  private assetFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  get filteredVendorOptions() {
    const value = this.vendorSearch.trim().toLowerCase();
    if (!value) return this.vendors();
    return this.vendors().filter((vendor) =>
      (vendor.VendorName ?? '').toLowerCase().includes(value),
    );
  }

  get filteredAssetTypeOptions() {
    const value = this.typeSearch.trim().toLowerCase();
    if (!value) return this.assetTypes();
    return this.assetTypes().filter((type) =>
      (type.IatName ?? type.IatCode).toLowerCase().includes(value),
    );
  }

  get filteredVendorModelOptions() {
    const selectedVendor = this.assetForm.get('vendorUUID')?.value || '';
    const selectedTypeUUID = this.assetForm.get('assetTypeUUID')?.value || '';
    const typeCode = this.assetTypes().find((type) => type.IatUUID === selectedTypeUUID)?.IatCode;

    const value = this.modelSearch.trim().toLowerCase();
    return this.vendorModels().filter((model) => {
      if (selectedVendor && model.VendorUUID !== selectedVendor) return false;
      if (
        typeCode &&
        ['OLT', 'ONU', 'NAS', 'CPE', 'OPTICAL_CABLE', 'UTP_CABLE', 'SPLITTER'].includes(typeCode)
      ) {
        if (model.VendorModelType !== typeCode) return false;
      }
      if (!value) return true;
      return (
        model.VendorModelName.toLowerCase().includes(value) ||
        (model.VendorName ?? '').toLowerCase().includes(value)
      );
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [
        data.IatCode,
        data.IatName,
        data.VendorName,
        data.VendorModelName,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      this.loadAssetTypes();
      this.loadVendors();
      this.vendorModels.set([]);
      this.loadAssets();
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeAssetDialog();
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
    void this.loadAssets();
  }

  onVendorOpened(opened: boolean) {
    if (opened) {
      this.vendorSearch = '';
    }
  }

  onTypeOpened(opened: boolean) {
    if (opened) {
      this.typeSearch = '';
    }
  }

  onVendorModelOpened(opened: boolean) {
    if (opened) {
      this.modelSearch = '';
    }
  }

  async onVendorChange() {
    const selectedVendor = this.assetForm.get('vendorUUID')?.value || '';
    await this.loadVendorModels(selectedVendor || null);
    this.ensureVendorModelValid();
  }

  onTypeChange() {
    this.ensureVendorModelValid();
  }

  private ensureVendorModelValid() {
    const modelUUID = this.assetForm.get('vendorModelUUID')?.value || '';
    if (!modelUUID) return;
    const available = this.filteredVendorModelOptions;
    if (!available.some((model) => model.VendorModelUUID === modelUUID)) {
      this.assetForm.patchValue({ vendorModelUUID: '' });
    }
  }

  async loadAssetTypes() {
    try {
      const response = await this.api.get<any>('isp/geomap/asset-types?status=ACTIVE&limit=500');
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      const normalized = items
        .map((item: any) => ({
          IatUUID: item?.IatUUID,
          IatCode: String(item?.IatCode ?? '').trim().toUpperCase(),
          IatName: String(item?.IatName ?? '').trim() || String(item?.IatCode ?? '').trim().toUpperCase(),
          IatSortOrder: Number.isFinite(Number(item?.IatSortOrder)) ? Number(item.IatSortOrder) : 100,
        }))
        .filter((item: GeoMapAssetTypeOption) => item.IatUUID && item.IatCode)
        .sort((a: GeoMapAssetTypeOption, b: GeoMapAssetTypeOption) => {
          const left = Number(a.IatSortOrder ?? 100);
          const right = Number(b.IatSortOrder ?? 100);
          if (left !== right) return left - right;
          return a.IatName.localeCompare(b.IatName);
        });

      this.assetTypes.set(normalized);
      if (!this.assetForm.get('assetTypeUUID')?.value && normalized.length) {
        this.assetForm.patchValue({ assetTypeUUID: normalized[0].IatUUID });
      }
    } catch (err) {
      console.error('Failed to load asset types.', err);
    }
  }

  async loadVendors() {
    try {
      const response = await this.api.get<any>('isp/vendors?status=1&limit=500');
      const items = response?.data?.items ?? [];
      this.vendors.set(items);
    } catch (err) {
      console.error('Failed to load vendors.', err);
    }
  }

  async loadVendorModels(vendorUUID?: string | null) {
    try {
      const params = new URLSearchParams({
        status: '1',
        limit: '500',
      });
      if (vendorUUID) {
        params.set('vendorUUID', vendorUUID);
      }
      const response = await this.api.get<any>(`isp/vendor-models?${params.toString()}`);
      const items = response?.data?.items ?? [];
      this.vendorModels.set(items);
    } catch (err) {
      console.error('Failed to load vendor models.', err);
      this.vendorModels.set([]);
    }
  }

  async loadAssets() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/geomap/asset-models?limit=500');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load GeoMap assets.'));
    } finally {
      const elapsed = performance.now() - start;
      const waitMs = Math.max(0, 600 - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  startCreate() {
    this.editing.set(null);
    this.assetForm.reset({
      assetTypeUUID: this.assetTypes()[0]?.IatUUID ?? '',
      vendorUUID: '',
      vendorModelUUID: '',
      status: 'ACTIVE',
      notes: '',
    });
    this.vendorModels.set([]);
  }

  startEdit(item: GeoMapAssetRegistryItem) {
    this.editing.set(item);
    this.assetForm.reset({
      assetTypeUUID: item.IspGeoMapAssetTypeIatUUID,
      vendorUUID: item.IspVendorIveUUID ?? '',
      vendorModelUUID: item.IspVendorModelIvmUUID ?? '',
      status: item.IgaStatus ?? 'ACTIVE',
      notes: item.IgaNotes ?? '',
    });
    void this.loadVendorModels(item.IspVendorIveUUID ?? null).then(() => this.ensureVendorModelValid());
    this.openAssetDialog();
  }

  async saveAsset() {
    if (this.assetForm.invalid) return;

    const value = this.assetForm.getRawValue();
    const payload = {
      assetTypeUUID: value.assetTypeUUID,
      vendorUUID: value.vendorUUID || null,
      vendorModelUUID: value.vendorModelUUID || null,
      status: value.status,
      notes: value.notes?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(`isp/geomap/asset-models/${editing.IgaUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = this.dataSource.data.map((row) =>
            row.IgaUUID === item.IgaUUID ? item : row,
          );
        }
      } else {
        const response = await this.api.post<any>('isp/geomap/asset-models', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = [item, ...this.dataSource.data];
        }
      }

      this.closeAssetDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save GeoMap asset.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteAsset(item: GeoMapAssetRegistryItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete asset',
        message: 'Are you sure you want to delete this asset model?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/geomap/asset-models/${item.IgaUUID}`);
      this.dataSource.data = this.dataSource.data.filter((row) => row.IgaUUID !== item.IgaUUID);
      if (this.editing()?.IgaUUID === item.IgaUUID) {
        this.startCreate();
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete GeoMap asset.'));
    }
  }

  typeLabel(item: GeoMapAssetRegistryItem) {
    return item.IatName || item.IatCode || 'Unknown';
  }

  statusLabel(item: GeoMapAssetRegistryItem) {
    return item.IgaStatus === 'INACTIVE' ? 'Inactive' : 'Active';
  }

  openCreateDialog() {
    this.startCreate();
    this.openAssetDialog();
  }

  cancelAssetForm() {
    this.closeAssetDialog();
    this.startCreate();
  }

  private openAssetDialog() {
    if (!this.assetFormDialog || this.assetFormDialogRef) return;
    this.error.set(null);
    this.assetFormDialogRef = this.dialog.open(this.assetFormDialog, {
      ...this.getAssetDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-geomap-asset-form-dialog',
    });
    this.assetFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeAssetDialog();
      }
    });
    this.startDialogViewportObserver();
    this.assetFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.assetFormDialogRef = null;
    });
  }

  private closeAssetDialog() {
    if (!this.assetFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.assetFormDialogRef.close();
    this.assetFormDialogRef = null;
  }

  private getAssetDialogViewportConfig() {
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
    if (!this.assetFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateAssetDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateAssetDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateAssetDialogViewport() {
    if (!this.assetFormDialogRef) return;
    const config = this.getAssetDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.assetFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.assetFormDialogRef.updatePosition(config.position);
    } else {
      this.assetFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
