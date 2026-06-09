import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  effect,
  inject,
  resource,
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

type IspNasItem = {
  InsUUID: string;
  InsID: string;
  InsName: string;
  InsIp: string;
  IspVendorIveUUID?: string | null;
  IspVendorModelIvmUUID?: string | null;
  InsVendorName?: string | null;
  InsVendorModelName?: string | null;
  InsNotes?: string | null;
  InsStatus: number;
  IspPopIppUUID: string;
  IppName?: string | null;
  InsDateCreated?: string | null;
  InsDateUpdated?: string | null;
};

@Component({
  selector: 'app-isp-nas',
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
  templateUrl: './nas.html',
  styleUrls: ['./nas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class IspNasPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspNasItem | null>(null);
  readonly popOptions = signal<IspPopOption[]>([]);
  readonly vendorOptions = signal<VendorOption[]>([]);
  readonly vendorModelOptions = signal<VendorModelOption[]>([]);
  private readonly nasResource = resource({
    defaultValue: [] as IspNasItem[],
    loader: () => this.fetchNas(),
  });
  readonly loading = this.nasResource.isLoading;
  popSearch = '';
  vendorSearch = '';
  vendorModelSearch = '';

  readonly dataSource = new MatTableDataSource<IspNasItem>([]);
  readonly displayedColumns = ['name', 'ip', 'vendor', 'model', 'pop', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly nasForm = this.fb.nonNullable.group({
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
  readonly nasFormDialog = viewChild<TemplateRef<unknown>>('nasFormDialog');
  private nasFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncNas = effect(() => {
    this.dataSource.data = this.nasResource.value();
    this.applySearchFilters();
  });
  private readonly reportNasError = effect(() => {
    const error = this.nasResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load NAS.'));
      this.dataSource.data = [];
    }
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [
        data.InsName,
        data.InsIp,
        data.InsVendorName,
        data.InsVendorModelName,
        this.popNameFor(data),
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    this.loadPops();
    this.loadVendors();
    this.loadVendorModels();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeNasDialog();
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
    this.nasResource.reload();
  }

  async loadPops() {
    try {
      const response = await this.api.get<any>('isp/pops');
      const items = response?.data?.items ?? [];
      this.popOptions.set(
        items.map((pop: any) => ({ IppUUID: pop.IppUUID, IppName: pop.IppName })),
      );
      if (!this.nasForm.get('popUUID')?.value && items.length) {
        this.nasForm.patchValue({ popUUID: items[0].IppUUID });
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
      if (!this.nasForm.get('vendorUUID')?.value && items.length) {
        this.nasForm.patchValue({ vendorUUID: items[0].VendorUUID });
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
      if (!this.nasForm.get('vendorModelUUID')?.value && items.length) {
        this.nasForm.patchValue({ vendorModelUUID: items[0].VendorModelUUID });
      }
    } catch (err) {
      console.error('Failed to load vendor models.', err);
    }
  }

  private async fetchNas() {
    this.error.set(null);
    const response = await this.api.get<any>('isp/nas');
    return response?.data?.items ?? [];
  }

  startCreate() {
    this.editing.set(null);
    this.nasForm.reset({
      popUUID: this.popOptions()[0]?.IppUUID ?? '',
      name: '',
      ip: '',
      vendorUUID: this.vendorOptions()[0]?.VendorUUID ?? '',
      vendorModelUUID: this.vendorModelOptions()[0]?.VendorModelUUID ?? '',
      notes: '',
      status: 1,
    });
  }

  startEdit(item: IspNasItem) {
    this.editing.set(item);
    this.nasForm.reset({
      popUUID: item.IspPopIppUUID,
      name: item.InsName,
      ip: item.InsIp,
      vendorUUID: item.IspVendorIveUUID ?? '',
      vendorModelUUID: item.IspVendorModelIvmUUID ?? '',
      notes: item.InsNotes ?? '',
      status: item.InsStatus ?? 1,
    });
    this.openNasDialog();
  }

  async saveNas() {
    if (this.nasForm.invalid) return;

    const value = this.nasForm.getRawValue();
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
        await this.api.put<any>(`isp/nas/${editing.InsUUID}`, payload);
      } else {
        await this.api.post<any>('isp/nas', payload);
      }

      this.nasResource.reload();
      this.closeNasDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save NAS.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteNas(item: IspNasItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete NAS',
        message: `Are you sure you want to delete "${item.InsName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/nas/${item.InsUUID}`);
      this.nasResource.reload();
    } catch (err) {
      console.error('Failed to delete NAS.', err);
      alert('Failed to delete NAS.');
    }
  }

  statusLabel(item: IspNasItem) {
    return item.InsStatus === 1 ? 'Active' : 'Inactive';
  }

  popNameFor(item: IspNasItem) {
    if (item.IppName) return item.IppName;
    return (
      this.popOptions().find((pop) => pop.IppUUID === item.IspPopIppUUID)?.IppName ?? 'Unknown'
    );
  }

  vendorNameFor(item: IspNasItem) {
    if (item.InsVendorName) return item.InsVendorName;
    return (
      this.vendorOptions().find((vendor) => vendor.VendorUUID === item.IspVendorIveUUID)
        ?.VendorName ?? 'Unknown'
    );
  }

  vendorModelNameFor(item: IspNasItem) {
    if (item.InsVendorModelName) return item.InsVendorModelName;
    return (
      this.vendorModelOptions().find(
        (model) => model.VendorModelUUID === item.IspVendorModelIvmUUID,
      )?.VendorModelName ?? 'Unknown'
    );
  }

  openCreateDialog() {
    this.startCreate();
    this.openNasDialog();
  }

  cancelNasForm() {
    this.closeNasDialog();
    this.startCreate();
  }

  private openNasDialog() {
    const nasFormDialog = this.nasFormDialog();
    if (!nasFormDialog || this.nasFormDialogRef) return;
    this.error.set(null);
    this.nasFormDialogRef = this.dialog.open(nasFormDialog, {
      ...this.getNasDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-nas-form-dialog',
    });
    this.nasFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeNasDialog();
      }
    });
    this.startDialogViewportObserver();
    this.nasFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.nasFormDialogRef = null;
    });
  }

  private closeNasDialog() {
    if (!this.nasFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.nasFormDialogRef.close();
    this.nasFormDialogRef = null;
  }

  private getNasDialogViewportConfig() {
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
    if (!this.nasFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateNasDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateNasDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateNasDialogViewport() {
    if (!this.nasFormDialogRef) return;
    const config = this.getNasDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.nasFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.nasFormDialogRef.updatePosition(config.position);
    } else {
      this.nasFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
