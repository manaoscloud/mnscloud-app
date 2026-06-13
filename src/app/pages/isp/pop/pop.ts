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
import { firstValueFrom, takeUntil } from 'rxjs';

import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { ApiService } from '../../../services/api.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type IspPopItem = {
  IppUUID: string;
  IppID: string;
  IppName: string;
  IppCity: string;
  IppState: string;
  IppAddress?: string | null;
  IppNotes?: string | null;
  IppStatus: number;
  IppDateCreated?: string | null;
  IppDateUpdated?: string | null;
};

@Component({
  selector: 'app-isp-pop',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
  templateUrl: './pop.html',
  styleUrls: ['./pop.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IspPopPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<IspPopItem | null>(null);
  private readonly popsResource = resource({
    defaultValue: [] as IspPopItem[],
    loader: () => this.fetchPops(),
  });
  readonly loading = this.popsResource.isLoading;

  readonly dataSource = new MatTableDataSource<IspPopItem>([]);
  readonly displayedColumns = ['name', 'city', 'state', 'status', 'actions'];
  search = '';
  searchInput = '';

  readonly popForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    city: ['', [Validators.required, Validators.minLength(2)]],
    state: ['', [Validators.required, Validators.minLength(2)]],
    address: [''],
    notes: [''],
    status: [1],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly popFormDialog = viewChild<TemplateRef<unknown>>('popFormDialog');
  private popFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncPops = effect(() => {
    this.dataSource.data = this.popsResource.value();
    this.applySearchFilters();
  });
  private readonly reportPopsError = effect(() => {
    const error = this.popsResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load POPs.'));
      this.dataSource.data = [];
    }
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.IppName, data.IppCity, data.IppState]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closePopDialog();
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
    this.popsResource.reload();
  }

  private async fetchPops() {
    this.error.set(null);
    const response = await this.api.get<any>('isp/pops');
    return response?.data?.items ?? [];
  }

  startCreate() {
    this.editing.set(null);
    this.popForm.reset({
      name: '',
      city: '',
      state: '',
      address: '',
      notes: '',
      status: 1,
    });
  }

  startEdit(pop: IspPopItem) {
    this.editing.set(pop);
    this.popForm.reset({
      name: pop.IppName,
      city: pop.IppCity,
      state: pop.IppState,
      address: pop.IppAddress ?? '',
      notes: pop.IppNotes ?? '',
      status: pop.IppStatus ?? 1,
    });
    this.openPopDialog();
  }

  async savePop() {
    if (this.popForm.invalid) return;

    const value = this.popForm.getRawValue();
    const payload = {
      name: value.name.trim(),
      city: value.city.trim(),
      state: value.state.trim(),
      address: value.address?.trim() || null,
      notes: value.notes?.trim() || null,
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`isp/pops/${editing.IppUUID}`, payload);
      } else {
        await this.api.post<any>('isp/pops', payload);
      }

      this.popsResource.reload();
      this.closePopDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save POP.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deletePop(pop: IspPopItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete POP',
        message: `Are you sure you want to delete "${pop.IppName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/pops/${pop.IppUUID}`);
      this.popsResource.reload();
    } catch (err) {
      console.error('Failed to delete POP.', err);
      alert('Failed to delete POP.');
    }
  }

  statusLabel(pop: IspPopItem) {
    return pop.IppStatus === 1 ? 'Active' : 'Inactive';
  }

  openCreateDialog() {
    this.startCreate();
    this.openPopDialog();
  }

  cancelPopForm() {
    this.closePopDialog();
    this.startCreate();
  }

  private openPopDialog() {
    const popFormDialog = this.popFormDialog();
    if (!popFormDialog || this.popFormDialogRef) return;
    this.error.set(null);
    this.popFormDialogRef = this.dialog.open(popFormDialog, {
      ...this.getPopDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-pop-form-dialog',
    });
    this.popFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.popFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.closePopDialog();
        }
      });
    this.startDialogViewportObserver();
    this.popFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.popFormDialogRef = null;
    });
  }

  private closePopDialog() {
    if (!this.popFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.popFormDialogRef.close();
    this.popFormDialogRef = null;
  }

  private getPopDialogViewportConfig() {
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
    if (!this.popFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updatePopDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updatePopDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updatePopDialogViewport() {
    if (!this.popFormDialogRef) return;
    const config = this.getPopDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.popFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.popFormDialogRef.updatePosition(config.position);
    } else {
      this.popFormDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
