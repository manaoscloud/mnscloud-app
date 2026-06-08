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
    CommonModule,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class SaleBrandPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly brands = signal<BrandItem[]>([]);
  readonly editing = signal<BrandItem | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    name: [''],
  });

  readonly brandForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly displayedColumns = ['name', 'actions'];
  readonly dataSource = new MatTableDataSource<BrandItem>([]);
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild('brandFormDialog') brandFormDialog?: TemplateRef<unknown>;
  private brandFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.loadBrands();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
  }

  async loadBrands() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    const { name } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (name?.trim()) params.set('name', name.trim());

    try {
      const response = await this.api.get<any>(`sale/brands?${params.toString()}`);
      const items = response?.data?.items ?? [];
      this.brands.set(items);
      this.dataSource.data = [...items];
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load brands.'));
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

  applyFilters() {
    void this.loadBrands();
  }

  clearFilters() {
    this.filterForm.reset({ name: '' });
    void this.loadBrands();
  }

  refreshList() {
    void this.loadBrands();
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
        const response = await this.api.put<any>(`sale/brands/${editing.SbrUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.brands.update((items) =>
            items.map((row) => (row.SbrUUID === item.SbrUUID ? item : row)),
          );
          this.dataSource.data = [...this.brands()];
        }
      } else {
        const response = await this.api.post<any>('sale/brands', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.brands.update((items) => [item, ...items]);
          this.dataSource.data = [...this.brands()];
        }
      }

      this.cancelEdit();
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
    if (!this.brandFormDialog || this.brandFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.brandFormDialog,
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
      this.brands.update((items) => items.filter((row) => row.SbrUUID !== brand.SbrUUID));
      this.dataSource.data = [...this.brands()];
    } catch (err) {
      console.error('Failed to delete brand.', err);
      alert('Failed to delete brand.');
    }
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
