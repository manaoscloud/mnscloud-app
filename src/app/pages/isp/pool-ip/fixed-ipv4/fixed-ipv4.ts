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

import { FormField, form as createForm, minLength, required } from '@angular/forms/signals';
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

type FixedIpv4Item = {
  If4UUID: string;
  If4Name: string;
  If4Description?: string | null;
  If4Cidr: string;
  If4Status: number;
};

@Component({
  selector: 'app-isp-fixed-ipv4',
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
  ],
  templateUrl: './fixed-ipv4.html',
  styleUrls: ['./fixed-ipv4.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IspFixedIpv4Page {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fixedIpv4Resource = resource({
    defaultValue: [] as FixedIpv4Item[],
    loader: () => this.fetchItems(),
  });

  readonly loading = this.fixedIpv4Resource.isLoading;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editing = signal<FixedIpv4Item | null>(null);

  readonly dataSource = new MatTableDataSource<FixedIpv4Item>([]);
  readonly displayedColumns = ['name', 'cidr', 'status', 'actions'];

  search = '';
  searchInput = '';

  readonly formModel = signal({ name: '', description: '', cidr: '', status: 1 });
  readonly form = createForm(this.formModel, (path) => {
    required(path.name);
    minLength(path.name, 2);
    required(path.cidr);
    required(path.status);
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly formDialog = viewChild<TemplateRef<unknown>>('formDialog');
  private formDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  private readonly syncRows = effect(() => {
    this.dataSource.data = this.fixedIpv4Resource.value();
    this.applySearchFilters();
  });

  private readonly reportLoadError = effect(() => {
    const error = this.fixedIpv4Resource.error();
    this.error.set(
      error ? this.extractErrorMessage(error, 'Failed to load fixed IPv4 entries.') : null,
    );
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.If4Name, data.If4Description, data.If4Cidr]
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
    this.fixedIpv4Resource.reload();
  }

  startCreate() {
    this.editing.set(null);
    this.formModel.set({ name: '', description: '', cidr: '', status: 1 });
  }

  startEdit(item: FixedIpv4Item) {
    this.editing.set(item);
    this.formModel.set({
      name: item.If4Name,
      description: item.If4Description ?? '',
      cidr: item.If4Cidr,
      status: item.If4Status ?? 1,
    });
    this.openDialog();
  }

  openCreateDialog() {
    this.startCreate();
    this.openDialog();
  }

  async save(createAnother = false) {
    if (!this.form().valid()) return;

    const value = this.formModel();
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
        await this.api.put(`isp/fixed-ipv4-addresses/${editing.If4UUID}`, payload);
      } else {
        await this.api.post('isp/fixed-ipv4-addresses', payload);
      }

      this.fixedIpv4Resource.reload();
      if (createAnother) {
        this.startCreate();
        return;
      }
      this.closeDialog();
      this.startCreate();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save fixed IPv4 entry.'));
    } finally {
      this.saving.set(false);
    }
  }

  saveAndNew() {
    void this.save(true);
  }

  async delete(item: FixedIpv4Item) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete fixed IPv4',
        message: `Are you sure you want to delete "${item.If4Name}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`isp/fixed-ipv4-addresses/${item.If4UUID}`);
      this.fixedIpv4Resource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete fixed IPv4 entry.'));
    }
  }

  cancelForm() {
    this.closeDialog();
    this.startCreate();
  }

  statusLabel(item: FixedIpv4Item) {
    return item.If4Status === 1 ? 'Active' : 'Inactive';
  }

  private async fetchItems(): Promise<FixedIpv4Item[]> {
    const response = await this.api.get<any>('isp/fixed-ipv4-addresses');
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
      panelClass: 'isp-fixed-ipv4-form-dialog',
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
