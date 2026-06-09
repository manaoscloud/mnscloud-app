import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../../../services/api.service';
import { fadeIn } from '../../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

type PoolIpv4Item = {
  Ip4UUID: string;
  Ip4Name: string;
  Ip4Description?: string | null;
  Ip4Status: number;
};

type PoolIpv4NetworkItem = {
  I4nUUID: string;
  I4nCidr: string;
  I4nDescription?: string | null;
  I4nStatus: number;
};

@Component({
  selector: 'app-isp-pool-ipv4',
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
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './pool-ipv4.html',
  styleUrls: ['./pool-ipv4.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class IspPoolIpv4Page implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  private readonly mutating = signal(false);
  private readonly poolsResource = resource({
    defaultValue: [] as PoolIpv4Item[],
    loader: () => this.fetchPools(),
  });
  private readonly networksResource = resource({
    params: () => this.selectedPool()?.Ip4UUID ?? '',
    defaultValue: [] as PoolIpv4NetworkItem[],
    loader: ({ params }) => this.fetchNetworks(params),
  });

  readonly loading = computed(
    () => this.poolsResource.isLoading() || this.networksResource.isLoading() || this.mutating(),
  );
  readonly savingPool = signal(false);
  readonly savingNetwork = signal(false);
  readonly error = signal<string | null>(null);

  readonly editingPool = signal<PoolIpv4Item | null>(null);
  readonly selectedPool = signal<PoolIpv4Item | null>(null);
  readonly editingNetwork = signal<PoolIpv4NetworkItem | null>(null);

  readonly poolDataSource = new MatTableDataSource<PoolIpv4Item>([]);
  readonly poolDisplayedColumns = ['name', 'status', 'actions'];

  readonly networkDataSource = new MatTableDataSource<PoolIpv4NetworkItem>([]);
  readonly networkDisplayedColumns = ['cidr', 'status', 'actions'];

  search = '';
  searchInput = '';

  readonly poolForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    status: [1, [Validators.required]],
  });

  readonly networkForm = this.fb.nonNullable.group({
    cidr: ['', [Validators.required]],
    description: [''],
    status: [1, [Validators.required]],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly poolSort = viewChild<MatSort>('poolSort');
  readonly networkSort = viewChild<MatSort>('networkSort');
  readonly poolDialog = viewChild<TemplateRef<unknown>>('poolDialog');
  readonly networkDialog = viewChild<TemplateRef<unknown>>('networkDialog');
  private poolDialogRef: MatDialogRef<unknown> | null = null;
  private networkDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  private readonly syncPools = effect(() => {
    const pools = this.poolsResource.value();
    this.poolDataSource.data = pools;
    this.applySearchFilters();

    const selected = this.selectedPool();
    if (selected) {
      const refreshed = pools.find((row) => row.Ip4UUID === selected.Ip4UUID) ?? null;
      if (refreshed !== selected) this.selectedPool.set(refreshed);
    }
  });

  private readonly syncNetworks = effect(() => {
    this.networkDataSource.data = this.networksResource.value();
    this.networkDataSource.sort = this.networkSort() ?? null;
  });

  private readonly reportResourceErrors = effect(() => {
    const error = this.poolsResource.error() ?? this.networksResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load IPv4 pool data.'));
    }
  });

  ngAfterViewInit() {
    this.poolDataSource.paginator = this.paginator() ?? null;
    this.poolDataSource.sort = this.poolSort() ?? null;
    this.poolDataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Ip4Name, data.Ip4Description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closePoolDialog();
    this.closeNetworkDialog();
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters(value?: string) {
    if (value !== undefined) this.searchInput = value;
    this.search = this.searchInput.trim();
    this.poolDataSource.filter = this.search.toLowerCase();
    if (this.poolDataSource.paginator) this.poolDataSource.paginator.firstPage();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.poolDataSource.filter = '';
    if (this.poolDataSource.paginator) this.poolDataSource.paginator.firstPage();
  }

  refreshList() {
    this.error.set(null);
    this.poolsResource.reload();
    this.networksResource.reload();
  }

  selectPool(item: PoolIpv4Item) {
    this.selectedPool.set(item);
    this.startCreateNetwork();
  }

  startCreatePool() {
    this.editingPool.set(null);
    this.poolForm.reset({ name: '', description: '', status: 1 });
  }

  startEditPool(item: PoolIpv4Item) {
    this.editingPool.set(item);
    this.poolForm.reset({
      name: item.Ip4Name,
      description: item.Ip4Description ?? '',
      status: item.Ip4Status ?? 1,
    });
    this.openPoolDialog();
  }

  openCreatePoolDialog() {
    this.startCreatePool();
    this.openPoolDialog();
  }

  async savePool(createAnother = false) {
    if (this.poolForm.invalid) return;

    const value = this.poolForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description?.trim() || null,
      status: value.status,
    };

    this.savingPool.set(true);
    this.error.set(null);

    try {
      const editing = this.editingPool();
      if (editing) {
        await this.api.put(`isp/ipv4-pools/${editing.Ip4UUID}`, payload);
      } else {
        await this.api.post('isp/ipv4-pools', payload);
      }

      this.poolsResource.reload();
      if (createAnother) {
        this.startCreatePool();
        return;
      }
      this.closePoolDialog();
      this.startCreatePool();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save IPv4 pool.'));
    } finally {
      this.savingPool.set(false);
    }
  }

  savePoolAndNew() {
    void this.savePool(true);
  }

  async deletePool(item: PoolIpv4Item) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete IPv4 pool',
        message: `Are you sure you want to delete "${item.Ip4Name}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.delete(`isp/ipv4-pools/${item.Ip4UUID}`);
      if (this.selectedPool()?.Ip4UUID === item.Ip4UUID) {
        this.selectedPool.set(null);
        this.networkDataSource.data = [];
      }
      this.poolsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete IPv4 pool.'));
    } finally {
      this.mutating.set(false);
    }
  }

  startCreateNetwork() {
    this.editingNetwork.set(null);
    this.networkForm.reset({ cidr: '', description: '', status: 1 });
  }

  startEditNetwork(item: PoolIpv4NetworkItem) {
    this.editingNetwork.set(item);
    this.networkForm.reset({
      cidr: item.I4nCidr,
      description: item.I4nDescription ?? '',
      status: item.I4nStatus ?? 1,
    });
    this.openNetworkDialog();
  }

  openCreateNetworkDialog() {
    if (!this.selectedPool()) {
      this.error.set('Select a pool first to manage networks.');
      return;
    }
    this.startCreateNetwork();
    this.openNetworkDialog();
  }

  async saveNetwork(createAnother = false) {
    const selected = this.selectedPool();
    if (!selected || this.networkForm.invalid) return;

    const value = this.networkForm.getRawValue();
    const payload = {
      cidr: value.cidr.trim(),
      description: value.description?.trim() || null,
      status: value.status,
    };

    this.savingNetwork.set(true);
    this.error.set(null);

    try {
      const editing = this.editingNetwork();
      if (editing) {
        await this.api.put(
          `isp/ipv4-pools/${selected.Ip4UUID}/networks/${editing.I4nUUID}`,
          payload,
        );
      } else {
        await this.api.post(`isp/ipv4-pools/${selected.Ip4UUID}/networks`, payload);
      }

      this.networksResource.reload();
      if (createAnother) {
        this.startCreateNetwork();
        return;
      }
      this.closeNetworkDialog();
      this.startCreateNetwork();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save IPv4 network.'));
    } finally {
      this.savingNetwork.set(false);
    }
  }

  saveNetworkAndNew() {
    void this.saveNetwork(true);
  }

  async deleteNetwork(item: PoolIpv4NetworkItem) {
    const selected = this.selectedPool();
    if (!selected) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete IPv4 network',
        message: `Are you sure you want to delete "${item.I4nCidr}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      this.mutating.set(true);
      await this.api.delete(`isp/ipv4-pools/${selected.Ip4UUID}/networks/${item.I4nUUID}`);
      this.networksResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete IPv4 network.'));
    } finally {
      this.mutating.set(false);
    }
  }

  cancelPoolForm() {
    this.closePoolDialog();
    this.startCreatePool();
  }

  cancelNetworkForm() {
    this.closeNetworkDialog();
    this.startCreateNetwork();
  }

  statusLabel(status: number) {
    return status === 1 ? 'Active' : 'Inactive';
  }

  private openPoolDialog() {
    const poolDialog = this.poolDialog();
    if (!poolDialog || this.poolDialogRef) return;
    this.error.set(null);
    this.poolDialogRef = this.dialog.open(poolDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pool-ipv4-form-dialog',
    });
    this.poolDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closePoolDialog();
    });
    this.startDialogViewportObserver();
    this.poolDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.poolDialogRef = null;
    });
  }

  private closePoolDialog() {
    if (!this.poolDialogRef) return;
    this.stopDialogViewportObserver();
    this.poolDialogRef.close();
    this.poolDialogRef = null;
  }

  private openNetworkDialog() {
    const networkDialog = this.networkDialog();
    if (!networkDialog || this.networkDialogRef) return;
    this.error.set(null);
    this.networkDialogRef = this.dialog.open(networkDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pool-ipv4-network-form-dialog',
    });
    this.networkDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeNetworkDialog();
    });
    this.startDialogViewportObserver();
    this.networkDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.networkDialogRef = null;
    });
  }

  private closeNetworkDialog() {
    if (!this.networkDialogRef) return;
    this.stopDialogViewportObserver();
    this.networkDialogRef.close();
    this.networkDialogRef = null;
  }

  private getDialogViewportConfig() {
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
    if (!this.poolDialogRef && !this.networkDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateDialogViewport() {
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    if (this.poolDialogRef) {
      this.poolDialogRef.updateSize(width, maxHeight);
      if (config.position) this.poolDialogRef.updatePosition(config.position);
      else this.poolDialogRef.updatePosition();
    }
    if (this.networkDialogRef) {
      this.networkDialogRef.updateSize(width, maxHeight);
      if (config.position) this.networkDialogRef.updatePosition(config.position);
      else this.networkDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || fallback;
  }

  private async fetchPools(): Promise<PoolIpv4Item[]> {
    const response = await this.api.get<any>('isp/ipv4-pools');
    return response?.data?.items ?? [];
  }

  private async fetchNetworks(poolUUID: string): Promise<PoolIpv4NetworkItem[]> {
    if (!poolUUID) return [];
    const response = await this.api.get<any>(`isp/ipv4-pools/${poolUUID}/networks`);
    return response?.data?.items ?? [];
  }
}
