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
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';

type IspGeoMapAssetType = {
  IatUUID: string;
  IatID: string;
  IatCode: string;
  IatName: string;
  IatDefaultColor: string;
  IatStatus: 'ACTIVE' | 'INACTIVE' | string;
  IatSortOrder: number;
  IatNotes?: string | null;
  IatDateCreated?: string | null;
  IatDateUpdated?: string | null;
};

@Component({
  selector: 'app-isp-geomap-asset-type',
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
  templateUrl: './asset-type.html',
  styleUrls: ['./asset-type.scss'],
  animations: [fadeIn],
})
export class IspGeoMapAssetTypePage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspGeoMapAssetType | null>(null);

  readonly dataSource = new MatTableDataSource<IspGeoMapAssetType>([]);
  readonly displayedColumns = ['name', 'code', 'color', 'status', 'order', 'actions'];
  search = '';
  searchInput = '';

  readonly typeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(32)]],
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    defaultColor: ['#22C55E', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    status: ['ACTIVE', [Validators.required]],
    sortOrder: [100, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('assetTypeFormDialog') assetTypeFormDialog?: TemplateRef<unknown>;
  private assetTypeFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.IatCode, data.IatName, data.IatStatus]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      this.loadTypes();
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeAssetTypeDialog();
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
    void this.loadTypes();
  }

  async loadTypes() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/geomap/asset-types?limit=500');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load GeoMap asset types.'));
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
    this.typeForm.reset({
      code: '',
      name: '',
      defaultColor: '#22C55E',
      status: 'ACTIVE',
      sortOrder: 100,
      notes: '',
    });
  }

  startEdit(item: IspGeoMapAssetType) {
    this.editing.set(item);
    this.typeForm.reset({
      code: item.IatCode,
      name: item.IatName,
      defaultColor: item.IatDefaultColor || '#22C55E',
      status: item.IatStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      sortOrder: Number(item.IatSortOrder ?? 100),
      notes: item.IatNotes ?? '',
    });
    this.openAssetTypeDialog();
  }

  async saveType() {
    if (this.typeForm.invalid) return;

    const value = this.typeForm.getRawValue();
    const payload = {
      code: value.code.trim().toUpperCase(),
      name: value.name.trim(),
      defaultColor: value.defaultColor.toUpperCase(),
      status: value.status,
      sortOrder: Number(value.sortOrder ?? 100),
      notes: value.notes?.trim() || null,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(
          `isp/geomap/asset-types/${editing.IatUUID}`,
          payload,
        );
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = this.dataSource.data.map((row) =>
            row.IatUUID === item.IatUUID ? item : row,
          );
        }
      } else {
        const response = await this.api.post<any>('isp/geomap/asset-types', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = [item, ...this.dataSource.data];
        }
      }

      this.closeAssetTypeDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save GeoMap asset type.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteType(item: IspGeoMapAssetType) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete asset type',
        message: `Are you sure you want to delete "${item.IatName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/geomap/asset-types/${item.IatUUID}`);
      this.dataSource.data = this.dataSource.data.filter((row) => row.IatUUID !== item.IatUUID);
      if (this.editing()?.IatUUID === item.IatUUID) {
        this.startCreate();
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete GeoMap asset type.'));
    }
  }

  statusLabel(item: IspGeoMapAssetType) {
    return item.IatStatus === 'INACTIVE' ? 'Inactive' : 'Active';
  }

  openCreateDialog() {
    this.startCreate();
    this.openAssetTypeDialog();
  }

  cancelAssetTypeForm() {
    this.closeAssetTypeDialog();
    this.startCreate();
  }

  private openAssetTypeDialog() {
    if (!this.assetTypeFormDialog || this.assetTypeFormDialogRef) return;
    this.error.set(null);
    this.assetTypeFormDialogRef = this.dialog.open(this.assetTypeFormDialog, {
      ...this.getAssetTypeDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-geomap-asset-type-form-dialog',
    });
    this.assetTypeFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeAssetTypeDialog();
      }
    });
    this.startDialogViewportObserver();
    this.assetTypeFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.assetTypeFormDialogRef = null;
    });
  }

  private closeAssetTypeDialog() {
    if (!this.assetTypeFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.assetTypeFormDialogRef.close();
    this.assetTypeFormDialogRef = null;
  }

  private getAssetTypeDialogViewportConfig() {
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
    if (!this.assetTypeFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateAssetTypeDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateAssetTypeDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateAssetTypeDialogViewport() {
    if (!this.assetTypeFormDialogRef) return;
    const config = this.getAssetTypeDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.assetTypeFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.assetTypeFormDialogRef.updatePosition(config.position);
    } else {
      this.assetTypeFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
