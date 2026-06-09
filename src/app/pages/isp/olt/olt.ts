import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

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
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { ApiService } from '../../../services/api.service';
import { IspVendor } from '../../../models/isp-vendor.model';
import { IspVendorModel } from '../../../models/isp-vendor-model.model';
import { TranslocoPipe } from '@jsverse/transloco';

type IspPopOption = {
  IppUUID: string;
  IppName: string;
};

type VendorOption = Pick<IspVendor, 'VendorUUID' | 'VendorName'>;
type VendorModelOption = Pick<
  IspVendorModel,
  'VendorModelUUID' | 'VendorModelName' | 'VendorUUID' | 'VendorName'
>;

type IspOltItem = {
  IolUUID: string;
  IolID: string;
  IolName: string;
  IolIp: string;
  IspVendorIveUUID?: string | null;
  IspVendorModelIvmUUID?: string | null;
  IolVendorName?: string | null;
  IolVendorModelName?: string | null;
  IolNotes?: string | null;
  IolStatus: number;
  IspPopIppUUID: string;
  IppName?: string | null;
  IolDateCreated?: string | null;
  IolDateUpdated?: string | null;
};

@Component({
  selector: 'app-isp-olt',
  standalone: true,
  imports: [
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
    TranslocoPipe,
  ],
  templateUrl: './olt.html',
  styleUrls: ['./olt.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class IspOltPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspOltItem | null>(null);
  readonly popOptions = signal<IspPopOption[]>([]);
  readonly vendorOptions = signal<VendorOption[]>([]);
  readonly vendorModelOptions = signal<VendorModelOption[]>([]);
  popSearch = '';
  vendorSearch = '';
  vendorModelSearch = '';

  readonly dataSource = new MatTableDataSource<IspOltItem>([]);
  readonly displayedColumns = ['name', 'ip', 'vendor', 'model', 'pop', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly oltForm = this.fb.nonNullable.group({
    popUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    ip: ['', [Validators.required]],
    vendorUUID: ['', [Validators.required]],
    vendorModelUUID: ['', [Validators.required]],
    notes: [''],
    status: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly oltFormDialog = viewChild<TemplateRef<unknown>>('oltFormDialog');
  private oltFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [
        data.IolName,
        data.IolIp,
        data.IolVendorName,
        data.IolVendorModelName,
        this.popNameFor(data),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      this.loadPops();
      this.loadVendors();
      this.loadVendorModels();
      this.loadOlts();
    }, 0);
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeOltDialog();
  }

  get filteredPopOptions() {
    const value = this.popSearch.trim().toLowerCase();
    if (!value) return this.popOptions();
    return this.popOptions().filter((pop) => (pop.IppName ?? '').toLowerCase().includes(value));
  }

  get filteredVendorOptions() {
    const value = this.vendorSearch.trim().toLowerCase();
    if (!value) return this.vendorOptions();
    return this.vendorOptions().filter((vendor) =>
      (vendor.VendorName ?? '').toLowerCase().includes(value),
    );
  }

  get filteredVendorModelOptions() {
    const value = this.vendorModelSearch.trim().toLowerCase();
    if (!value) return this.vendorModelOptions();
    return this.vendorModelOptions().filter((model) =>
      (model.VendorModelName ?? '').toLowerCase().includes(value),
    );
  }

  onPopOpened(opened: boolean) {
    if (opened) {
      this.popSearch = '';
    }
  }

  onVendorOpened(opened: boolean) {
    if (opened) {
      this.vendorSearch = '';
    }
  }

  onVendorModelOpened(opened: boolean) {
    if (opened) {
      this.vendorModelSearch = '';
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
    void this.loadOlts();
  }

  async loadPops() {
    try {
      const response = await this.api.get<any>('isp/pops');
      const items = response?.data?.items ?? [];
      this.popOptions.set(
        items.map((pop: any) => ({ IppUUID: pop.IppUUID, IppName: pop.IppName })),
      );
      if (!this.oltForm.get('popUUID')?.value && items.length) {
        this.oltForm.patchValue({ popUUID: items[0].IppUUID });
      }
    } catch (err) {
      console.error('Failed to load POPs.', err);
    }
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
      if (!this.oltForm.get('vendorUUID')?.value && items.length) {
        this.oltForm.patchValue({ vendorUUID: items[0].VendorUUID });
      }
    } catch (err) {
      console.error('Failed to load vendors.', err);
    }
  }

  async loadVendorModels() {
    try {
      const response = await this.api.get<any>('isp/vendor-models');
      const items = response?.data?.items ?? [];
      this.vendorModelOptions.set(
        items.map((model: IspVendorModel) => ({
          VendorModelUUID: model.VendorModelUUID,
          VendorModelName: model.VendorModelName,
          VendorUUID: model.VendorUUID,
          VendorName: model.VendorName ?? null,
        })),
      );
      if (!this.oltForm.get('vendorModelUUID')?.value && items.length) {
        this.oltForm.patchValue({ vendorModelUUID: items[0].VendorModelUUID });
      }
    } catch (err) {
      console.error('Failed to load vendor models.', err);
    }
  }

  async loadOlts() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/olts');
      const items = response?.data?.items ?? [];
      this.dataSource.data = items;
      this.applySearchFilters();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load OLTs.'));
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

  startCreate() {
    this.editing.set(null);
    this.oltForm.reset({
      popUUID: this.popOptions()[0]?.IppUUID ?? '',
      name: '',
      ip: '',
      vendorUUID: this.vendorOptions()[0]?.VendorUUID ?? '',
      vendorModelUUID: this.vendorModelOptions()[0]?.VendorModelUUID ?? '',
      notes: '',
      status: 1,
    });
  }

  startEdit(item: IspOltItem) {
    this.editing.set(item);
    this.oltForm.reset({
      popUUID: item.IspPopIppUUID,
      name: item.IolName,
      ip: item.IolIp,
      vendorUUID: item.IspVendorIveUUID ?? '',
      vendorModelUUID: item.IspVendorModelIvmUUID ?? '',
      notes: item.IolNotes ?? '',
      status: item.IolStatus ?? 1,
    });
    this.openOltDialog();
  }

  async saveOlt() {
    if (this.oltForm.invalid) return;

    const value = this.oltForm.getRawValue();
    const payload = {
      popUUID: value.popUUID,
      name: value.name.trim(),
      ip: value.ip.trim(),
      vendorUUID: value.vendorUUID,
      vendorModelUUID: value.vendorModelUUID,
      notes: value.notes?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        const response = await this.api.put<any>(`isp/olts/${editing.IolUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = this.dataSource.data.map((row) =>
            row.IolUUID === item.IolUUID ? item : row,
          );
        }
      } else {
        const response = await this.api.post<any>('isp/olts', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.dataSource.data = [item, ...this.dataSource.data];
        }
      }

      this.closeOltDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save OLT.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteOlt(item: IspOltItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete OLT',
        message: `Are you sure you want to delete "${item.IolName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/olts/${item.IolUUID}`);
      this.dataSource.data = this.dataSource.data.filter((row) => row.IolUUID !== item.IolUUID);
    } catch (err) {
      console.error('Failed to delete OLT.', err);
      alert('Failed to delete OLT.');
    }
  }

  statusLabel(item: IspOltItem) {
    return item.IolStatus === 1 ? 'Active' : 'Inactive';
  }

  popNameFor(item: IspOltItem) {
    if (item.IppName) return item.IppName;
    return (
      this.popOptions().find((pop) => pop.IppUUID === item.IspPopIppUUID)?.IppName ?? 'Unknown'
    );
  }

  vendorNameFor(item: IspOltItem) {
    if (item.IolVendorName) return item.IolVendorName;
    return (
      this.vendorOptions().find((vendor) => vendor.VendorUUID === item.IspVendorIveUUID)
        ?.VendorName ?? 'Unknown'
    );
  }

  vendorModelNameFor(item: IspOltItem) {
    if (item.IolVendorModelName) return item.IolVendorModelName;
    return (
      this.vendorModelOptions().find(
        (model) => model.VendorModelUUID === item.IspVendorModelIvmUUID,
      )?.VendorModelName ?? 'Unknown'
    );
  }

  openCreateDialog() {
    this.startCreate();
    this.openOltDialog();
  }

  cancelOltForm() {
    this.closeOltDialog();
    this.startCreate();
  }

  private openOltDialog() {
    const oltFormDialog = this.oltFormDialog();
    if (!oltFormDialog || this.oltFormDialogRef) return;
    this.error.set(null);
    this.oltFormDialogRef = this.dialog.open(oltFormDialog, {
      ...this.getOltDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-olt-form-dialog',
    });
    this.oltFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeOltDialog();
      }
    });
    this.startDialogViewportObserver();
    this.oltFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.oltFormDialogRef = null;
    });
  }

  private closeOltDialog() {
    if (!this.oltFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.oltFormDialogRef.close();
    this.oltFormDialogRef = null;
  }

  private getOltDialogViewportConfig() {
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
    if (!this.oltFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateOltDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateOltDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateOltDialogViewport() {
    if (!this.oltFormDialogRef) return;
    const config = this.getOltDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.oltFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.oltFormDialogRef.updatePosition(config.position);
    } else {
      this.oltFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
