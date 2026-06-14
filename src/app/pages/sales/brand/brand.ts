import {
  Component,
  DestroyRef,
  afterNextRender,
  effect,
  resource,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormField, form as createForm, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type BrandItem = {
  SbrUUID: string;
  SbrID: string;
  SbrName: string;
  SbrDateCreated: string | null;
  SbrDateUpdated: string | null;
};

type BrandFilters = {
  name: string;
};

@Component({
  selector: 'app-sale-brand',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './brand.html',
  styleUrls: ['./brand.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleBrandPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly brands = signal<BrandItem[]>([]);
  readonly editing = signal<BrandItem | null>(null);
  readonly filterFormModel = signal({ name: '' });
  readonly filterForm = createForm(this.filterFormModel);
  private readonly brandsResource = resource({
    defaultValue: [] as BrandItem[],
    params: (): BrandFilters => ({
      name: this.filterFormModel().name.trim(),
    }),
    loader: ({ params }) => this.fetchBrands(params),
  });
  readonly loading = this.brandsResource.isLoading;

  readonly brandFormModel = signal({ name: '' });
  readonly brandForm = createForm(this.brandFormModel, (path) => {
    required(path.name);
  });

  readonly displayedColumns = ['name', 'actions'];
  readonly dataSource = new MatTableDataSource<BrandItem>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly brandFormDialog = viewChild<TemplateRef<unknown>>('brandFormDialog');
  private brandFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncBrands = effect(() => {
    const items = this.brandsResource.value();
    this.brands.set(items);
    this.dataSource.data = [...items];
  });
  private readonly reportBrandsError = effect(() => {
    const error = this.brandsResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load brands.'));
      this.dataSource.data = [];
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeBrandDialog());
  }

  private async fetchBrands(filters: BrandFilters) {
    this.error.set(null);

    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);

    const response = await this.api.get<any>(`sale/brands?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.brandsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ name: '' });
    this.brandsResource.reload();
  }

  refreshList() {
    this.brandsResource.reload();
  }

  startEdit(brand: BrandItem) {
    this.editing.set(brand);
    this.brandFormModel.set({ name: brand.SbrName });
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openBrandDialog();
  }

  openEditDialog(brand: BrandItem) {
    this.startEdit(brand);
    this.openBrandDialog();
  }

  cancelEdit() {
    this.editing.set(null);
    this.brandFormModel.set({ name: '' });
    this.closeBrandDialog();
  }

  async saveBrand() {
    if (!this.brandForm().valid()) return;

    const payload = { name: this.brandFormModel().name.trim() };
    if (!payload.name) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/brands/${editing.SbrUUID}`, payload);
      } else {
        await this.api.post<any>('sale/brands', payload);
      }

      this.cancelEdit();
      this.brandsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save brand.'));
    } finally {
      this.saving.set(false);
    }
  }

  private openBrandDialog() {
    const brandFormDialog = this.brandFormDialog();
    if (!brandFormDialog || this.brandFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      brandFormDialog,
      'sale-brand-form-dialog',
    );
    this.brandFormDialogRef = this.dialogBinding.ref;
    this.brandFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.brandFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closeBrandDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.brandFormDialogRef?.close();
    this.brandFormDialogRef = null;
  }

  async deleteBrand(brand: BrandItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete brand',
        message: 'Are you sure you want to delete this brand?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/brands/${brand.SbrUUID}`);
      this.brandsResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete brand.'));
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
