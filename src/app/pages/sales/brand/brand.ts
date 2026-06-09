import {
  AfterViewInit,
  Component,
  effect,
  OnDestroy,
  resource,
  TemplateRef,
  inject,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

type BrandItem = {
  SbrUUID: string;
  SbrID: string;
  SbrName: string;
  SbrDateCreated: string | null;
  SbrDateUpdated: string | null;
};

@Component({
  selector: 'app-sale-brand',
  standalone: true,
  imports: [
    ReactiveFormsModule,
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
  animations: [fadeIn],
})
export class SaleBrandPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly brands = signal<BrandItem[]>([]);
  readonly editing = signal<BrandItem | null>(null);
  private readonly brandsResource = resource({
    defaultValue: [] as BrandItem[],
    loader: () => this.fetchBrands(),
  });
  readonly loading = this.brandsResource.isLoading;

  readonly filterForm = this.fb.nonNullable.group({
    name: [''],
  });

  readonly brandForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
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

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
  }

  private async fetchBrands() {
    this.error.set(null);

    const { name } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (name?.trim()) params.set('name', name.trim());

    const response = await this.api.get<any>(`sale/brands?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.brandsResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ name: '' });
    this.brandsResource.reload();
  }

  refreshList() {
    this.brandsResource.reload();
  }

  startEdit(brand: BrandItem) {
    this.editing.set(brand);
    this.brandForm.reset({ name: brand.SbrName });
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
    this.brandForm.reset({ name: '' });
    this.closeBrandDialog();
  }

  async saveBrand() {
    if (this.brandForm.invalid) return;

    const payload = { name: this.brandForm.getRawValue().name.trim() };
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

  ngOnDestroy() {
    this.closeBrandDialog();
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
    this.brandFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
