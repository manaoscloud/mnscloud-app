import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
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

type PoolIpv6Item = {
  Ip6UUID: string;
  Ip6Name: string;
  Ip6Description?: string | null;
  Ip6Status: number;
};

type PoolIpv6NetworkItem = {
  I6nUUID: string;
  I6nCidr: string;
  I6nDescription?: string | null;
  I6nStatus: number;
};

@Component({
  selector: 'app-isp-pool-ipv6',
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
    MatPaginatorModule,
    MatSortModule,
    MatSelectModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './pool-ipv6.html',
  styleUrls: ['./pool-ipv6.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class IspPoolIpv6Page implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly savingPool = signal(false);
  readonly savingNetwork = signal(false);
  readonly error = signal<string | null>(null);

  readonly editingPool = signal<PoolIpv6Item | null>(null);
  readonly selectedPool = signal<PoolIpv6Item | null>(null);
  readonly editingNetwork = signal<PoolIpv6NetworkItem | null>(null);

  readonly poolDataSource = new MatTableDataSource<PoolIpv6Item>([]);
  readonly poolDisplayedColumns = ['name', 'status', 'actions'];

  readonly networkDataSource = new MatTableDataSource<PoolIpv6NetworkItem>([]);
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

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild('poolSort') poolSort?: MatSort;
  @ViewChild('networkSort') networkSort?: MatSort;
  @ViewChild('poolDialog') poolDialog?: TemplateRef<unknown>;
  @ViewChild('networkDialog') networkDialog?: TemplateRef<unknown>;
  private poolDialogRef: MatDialogRef<unknown> | null = null;
  private networkDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    this.poolDataSource.paginator = this.paginator ?? null;
    this.poolDataSource.sort = this.poolSort ?? null;
    this.poolDataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Ip6Name, data.Ip6Description]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => this.loadPools(), 0);
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

  async loadPools() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const response = await this.api.get<any>('isp/ipv6-pools');
      this.poolDataSource.data = response?.data?.items ?? [];
      this.applySearchFilters();
      const selected = this.selectedPool();
      if (selected) {
        const refreshed =
          this.poolDataSource.data.find((row) => row.Ip6UUID === selected.Ip6UUID) ?? null;
        this.selectedPool.set(refreshed);
      }
      if (this.selectedPool()) await this.loadNetworks();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load IPv6 pools.'));
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

  refreshList() {
    void this.loadPools();
  }

  selectPool(item: PoolIpv6Item) {
    this.selectedPool.set(item);
    this.startCreateNetwork();
    void this.loadNetworks();
  }

  startCreatePool() {
    this.editingPool.set(null);
    this.poolForm.reset({ name: '', description: '', status: 1 });
  }

  startEditPool(item: PoolIpv6Item) {
    this.editingPool.set(item);
    this.poolForm.reset({
      name: item.Ip6Name,
      description: item.Ip6Description ?? '',
      status: item.Ip6Status ?? 1,
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
        await this.api.put(`isp/ipv6-pools/${editing.Ip6UUID}`, payload);
      } else {
        await this.api.post('isp/ipv6-pools', payload);
      }

      await this.loadPools();
      if (createAnother) {
        this.startCreatePool();
        return;
      }
      this.closePoolDialog();
      this.startCreatePool();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save IPv6 pool.'));
    } finally {
      this.savingPool.set(false);
    }
  }

  savePoolAndNew() {
    void this.savePool(true);
  }

  async deletePool(item: PoolIpv6Item) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete IPv6 pool',
        message: `Are you sure you want to delete "${item.Ip6Name}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/ipv6-pools/${item.Ip6UUID}`);
      this.poolDataSource.data = this.poolDataSource.data.filter(
        (row) => row.Ip6UUID !== item.Ip6UUID,
      );
      if (this.selectedPool()?.Ip6UUID === item.Ip6UUID) {
        this.selectedPool.set(null);
        this.networkDataSource.data = [];
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete IPv6 pool.'));
    }
  }

  async loadNetworks() {
    const selected = this.selectedPool();
    if (!selected) {
      this.networkDataSource.data = [];
      return;
    }

    try {
      const response = await this.api.get<any>(`isp/ipv6-pools/${selected.Ip6UUID}/networks`);
      this.networkDataSource.data = response?.data?.items ?? [];
      this.networkDataSource.sort = this.networkSort ?? null;
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load IPv6 networks.'));
    }
  }

  startCreateNetwork() {
    this.editingNetwork.set(null);
    this.networkForm.reset({ cidr: '', description: '', status: 1 });
  }

  startEditNetwork(item: PoolIpv6NetworkItem) {
    this.editingNetwork.set(item);
    this.networkForm.reset({
      cidr: item.I6nCidr,
      description: item.I6nDescription ?? '',
      status: item.I6nStatus ?? 1,
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
          `isp/ipv6-pools/${selected.Ip6UUID}/networks/${editing.I6nUUID}`,
          payload,
        );
      } else {
        await this.api.post(`isp/ipv6-pools/${selected.Ip6UUID}/networks`, payload);
      }

      await this.loadNetworks();
      if (createAnother) {
        this.startCreateNetwork();
        return;
      }
      this.closeNetworkDialog();
      this.startCreateNetwork();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save IPv6 network.'));
    } finally {
      this.savingNetwork.set(false);
    }
  }

  saveNetworkAndNew() {
    void this.saveNetwork(true);
  }

  async deleteNetwork(item: PoolIpv6NetworkItem) {
    const selected = this.selectedPool();
    if (!selected) return;

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete IPv6 network',
        message: `Are you sure you want to delete "${item.I6nCidr}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/ipv6-pools/${selected.Ip6UUID}/networks/${item.I6nUUID}`);
      this.networkDataSource.data = this.networkDataSource.data.filter(
        (row) => row.I6nUUID !== item.I6nUUID,
      );
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete IPv6 network.'));
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
    if (!this.poolDialog || this.poolDialogRef) return;
    this.error.set(null);
    this.poolDialogRef = this.dialog.open(this.poolDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pool-ipv6-form-dialog',
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
    if (!this.networkDialog || this.networkDialogRef) return;
    this.error.set(null);
    this.networkDialogRef = this.dialog.open(this.networkDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pool-ipv6-network-form-dialog',
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
}
