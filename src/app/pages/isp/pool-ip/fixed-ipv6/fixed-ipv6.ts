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

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

import { ApiService } from '../../../../services/api.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type FixedIpv6Item = {
  If6UUID: string;
  If6Name: string;
  If6Description?: string | null;
  If6Cidr: string;
  If6Status: number;
};

@Component({
  selector: 'app-isp-fixed-ipv6',
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
  templateUrl: './fixed-ipv6.html',
  styleUrls: ['./fixed-ipv6.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IspFixedIpv6Page {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fixedIpv6Resource = resource({
    defaultValue: [] as FixedIpv6Item[],
    loader: () => this.fetchItems(),
  });

  readonly loading = this.fixedIpv6Resource.isLoading;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<FixedIpv6Item | null>(null);

  readonly dataSource = new MatTableDataSource<FixedIpv6Item>([]);
  readonly displayedColumns = ['name', 'cidr', 'status', 'actions'];

  search = '';
  searchInput = '';

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    cidr: ['', [Validators.required]],
    status: [1, [Validators.required]],
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private formDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  private readonly syncRows = effect(() => {
    this.dataSource.data = this.fixedIpv6Resource.value();
    this.applySearchFilters();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.fixedIpv6Resource.error();
    this.error.set(
      error ? this.extractErrorMessage(error, 'Failed to load fixed IPv6 entries.') : null,
    );
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.If6Name, data.If6Description, data.If6Cidr]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopDialogViewportObserver();
      this.closeDialog();
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
    this.error.set(null);
    this.fixedIpv6Resource.reload();
  }

  startCreate() {
    this.editing.set(null);
    this.form.reset({ name: '', description: '', cidr: '', status: 1 });
  }

  startEdit(item: FixedIpv6Item) {
    this.editing.set(item);
    this.form.reset({
      name: item.If6Name,
      description: item.If6Description ?? '',
      cidr: item.If6Cidr,
      status: item.If6Status ?? 1,
    });
    this.openDialog();
  }

  openCreateDialog() {
    this.startCreate();
    this.openDialog();
  }

  async save(createAnother = false) {
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    const payload = {
      name: value.name.trim(),
      description: value.description?.trim() || null,
      cidr: value.cidr.trim(),
      status: value.status,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put(`isp/fixed-ipv6-addresses/${editing.If6UUID}`, payload);
      } else {
        await this.api.post('isp/fixed-ipv6-addresses', payload);
      }

      this.fixedIpv6Resource.reload();
      if (createAnother) {
        this.startCreate();
        return;
      }
      this.closeDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save fixed IPv6 entry.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.save(true);
  }

  async delete(item: FixedIpv6Item) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete fixed IPv6',
        message: `Are you sure you want to delete "${item.If6Name}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/fixed-ipv6-addresses/${item.If6UUID}`);
      this.fixedIpv6Resource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete fixed IPv6 entry.'));
    }
  }

  cancelForm() {
    this.closeDialog();
    this.startCreate();
  }

  statusLabel(item: FixedIpv6Item) {
    return item.If6Status === 1 ? 'Active' : 'Inactive';
  }

  private async fetchItems(): Promise<FixedIpv6Item[]> {
    const response = await this.api.get<any>('isp/fixed-ipv6-addresses');
    return response?.data?.items ?? [];
  }

  private openDialog() {
    const formDialog = this.formDialog();
    if (!formDialog || this.formDialogRef) return;
    this.error.set(null);
    this.formDialogRef = this.dialog.open(formDialog, {
      ...this.getDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'isp-fixed-ipv6-form-dialog',
    });
    this.formDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.formDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.closeDialog();
        }
      });
    this.startDialogViewportObserver();
    this.formDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.formDialogRef = null;
    });
  }

  private closeDialog() {
    if (!this.formDialogRef) return;
    this.stopDialogViewportObserver();
    this.formDialogRef.close();
    this.formDialogRef = null;
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
    if (!this.formDialogRef) return;

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
    if (!this.formDialogRef) return;
    const config = this.getDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.formDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.formDialogRef.updatePosition(config.position);
    } else {
      this.formDialogRef.updatePosition();
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || fallback;
  }
}
