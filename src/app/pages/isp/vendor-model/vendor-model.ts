import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { IspVendorModel } from '../../../models/isp-vendor-model.model';
import { IspVendor } from '../../../models/isp-vendor.model';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

type VendorOption = Pick<IspVendor, 'VendorUUID' | 'VendorName'>;

@Component({
  selector: 'app-isp-vendor-model',
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
    TranslatePipe,
  ],
  templateUrl: './vendor-model.html',
  styleUrls: ['./vendor-model.scss'],
  animations: [fadeIn],
})
export class IspVendorModelPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspVendorModel | null>(null);
  readonly vendorOptions = signal<VendorOption[]>([]);
  readonly modelTypes = [
    'OLT',
    'ONU',
    'NAS',
    'CPE',
    'OPTICAL_CABLE',
    'UTP_CABLE',
    'SPLITTER',
  ] as const;
  vendorSearch = '';

  readonly dataSource = new MatTableDataSource<IspVendorModel>([]);
  readonly displayedColumns = ['name', 'type', 'vendor', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly modelForm = this.fb.nonNullable.group({
    vendorUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    type: ['OLT', [Validators.required]],
    notes: [''],
    status: [1],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('vendorModelFormDialog') vendorModelFormDialog?: TemplateRef<unknown>;
  private vendorModelFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.VendorModelName, data.VendorModelType, this.vendorNameFor(data)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      this.loadVendors();
      this.loadModels();
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeVendorModelDialog();
  }

  get filteredVendorOptions() {
    const value = this.vendorSearch.trim().toLowerCase();
    if (!value) return this.vendorOptions();
    return this.vendorOptions().filter((vendor) =>
      (vendor.VendorName ?? '').toLowerCase().includes(value),
    );
  }

  onVendorOpened(opened: boolean) {
    if (opened) {
      this.vendorSearch = '';
    }
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
    void this.loadModels();
  }

  async loadVendors() {
    try {
      const response = await this.api.get<any>('isp/vendors');
      const items = response?.data?.items ?? [];
      this.vendorOptions.set(
        items.map((vendor: IspVendor) => ({
          VendorUUID: vendor.VendorUUID,
          VendorName: vendor.VendorName,
        })),
      );
      if (!this.modelForm.get('vendorUUID')?.value && items.length) {
        this.modelForm.patchValue({ vendorUUID: items[0].VendorUUID });
      }
    } catch (err) {
      console.error('Failed to load vendors.', err);
    }
  }

  async loadModels() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/vendor-models');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load vendor models.'));
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
    this.modelForm.reset({
      vendorUUID: this.vendorOptions()[0]?.VendorUUID ?? '',
      name: '',
      type: 'OLT',
      notes: '',
      status: 1,
    });
  }

  startEdit(item: IspVendorModel) {
    this.editing.set(item);
    this.modelForm.reset({
      vendorUUID: item.VendorUUID,
      name: item.VendorModelName,
      type: item.VendorModelType,
      notes: item.VendorModelNotes ?? '',
      status: item.VendorModelStatus ?? 1,
    });
    this.openVendorModelDialog();
  }

  async saveModel() {
    if (this.modelForm.invalid) return;

    const value = this.modelForm.getRawValue();
    const payload = {
      vendorUUID: value.vendorUUID,
      name: value.name.trim(),
      type: value.type,
      notes: value.notes?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(
          `isp/vendor-models/${editing.VendorModelUUID}`,
          payload,
        );
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = this.dataSource.data.map((row) =>
            row.VendorModelUUID === item.VendorModelUUID ? item : row,
          );
        }
      } else {
        const response = await this.api.post<any>('isp/vendor-models', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = [item, ...this.dataSource.data];
        }
      }

      this.closeVendorModelDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save vendor model.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteModel(item: IspVendorModel) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete vendor model',
        message: `Are you sure you want to delete "${item.VendorModelName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/vendor-models/${item.VendorModelUUID}`);
      this.dataSource.data = this.dataSource.data.filter(
        (row) => row.VendorModelUUID !== item.VendorModelUUID,
      );
    } catch (err) {
      console.error('Failed to delete vendor model.', err);
      alert('Failed to delete vendor model.');
    }
  }

  vendorNameFor(item: IspVendorModel) {
    if (item.VendorName) return item.VendorName;
    return (
      this.vendorOptions().find((vendor) => vendor.VendorUUID === item.VendorUUID)?.VendorName ??
      'Unknown'
    );
  }

  statusLabel(item: IspVendorModel) {
    return item.VendorModelStatus === 1 ? 'Active' : 'Inactive';
  }

  openCreateDialog() {
    this.startCreate();
    this.openVendorModelDialog();
  }

  cancelVendorModelForm() {
    this.closeVendorModelDialog();
    this.startCreate();
  }

  private openVendorModelDialog() {
    if (!this.vendorModelFormDialog || this.vendorModelFormDialogRef) return;
    this.error.set(null);
    this.vendorModelFormDialogRef = this.dialog.open(this.vendorModelFormDialog, {
      ...this.getVendorModelDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-vendor-model-form-dialog',
    });
    this.vendorModelFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeVendorModelDialog();
      }
    });
    this.startDialogViewportObserver();
    this.vendorModelFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.vendorModelFormDialogRef = null;
    });
  }

  private closeVendorModelDialog() {
    if (!this.vendorModelFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.vendorModelFormDialogRef.close();
    this.vendorModelFormDialogRef = null;
  }

  private getVendorModelDialogViewportConfig() {
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
    if (!this.vendorModelFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateVendorModelDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateVendorModelDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateVendorModelDialogViewport() {
    if (!this.vendorModelFormDialogRef) return;
    const config = this.getVendorModelDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.vendorModelFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.vendorModelFormDialogRef.updatePosition(config.position);
    } else {
      this.vendorModelFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
