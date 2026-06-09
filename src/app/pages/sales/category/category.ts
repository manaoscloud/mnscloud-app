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

type CategoryItem = {
  ScaUUID: string;
  ScaID: string;
  ScaName: string;
  ScaDateCreated: string | null;
  ScaDateUpdated: string | null;
};

@Component({
  selector: 'app-sale-category',
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
  templateUrl: './category.html',
  styleUrls: ['./category.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class SaleCategoryPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryItem[]>([]);
  readonly editing = signal<CategoryItem | null>(null);
  private readonly categoriesResource = resource({
    defaultValue: [] as CategoryItem[],
    loader: () => this.fetchCategories(),
  });
  readonly loading = this.categoriesResource.isLoading;

  readonly filterForm = this.fb.nonNullable.group({
    name: [''],
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly displayedColumns = ['name', 'actions'];
  readonly dataSource = new MatTableDataSource<CategoryItem>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly categoryFormDialog = viewChild<TemplateRef<unknown>>('categoryFormDialog');
  private categoryFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncCategories = effect(() => {
    const items = this.categoriesResource.value();
    this.categories.set(items);
    this.dataSource.data = [...items];
  });
  private readonly reportCategoriesError = effect(() => {
    const error = this.categoriesResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load categories.'));
      this.dataSource.data = [];
    }
  });

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
  }

  private async fetchCategories() {
    this.error.set(null);

    const { name } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (name?.trim()) params.set('name', name.trim());

    const response = await this.api.get<any>(`sale/categories?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.categoriesResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ name: '' });
    this.categoriesResource.reload();
  }

  refreshList() {
    this.categoriesResource.reload();
  }

  startEdit(category: CategoryItem) {
    this.editing.set(category);
    this.categoryForm.reset({ name: category.ScaName });
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openCategoryDialog();
  }

  openEditDialog(category: CategoryItem) {
    this.startEdit(category);
    this.openCategoryDialog();
  }

  cancelEdit() {
    this.editing.set(null);
    this.categoryForm.reset({ name: '' });
    this.closeCategoryDialog();
  }

  async saveCategory() {
    if (this.categoryForm.invalid) return;

    const payload = { name: this.categoryForm.getRawValue().name.trim() };
    if (!payload.name) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/categories/${editing.ScaUUID}`, payload);
      } else {
        await this.api.post<any>('sale/categories', payload);
      }

      this.cancelEdit();
      this.categoriesResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save category.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteCategory(category: CategoryItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete category',
        message: 'Are you sure you want to delete this category?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/categories/${category.ScaUUID}`);
      this.categoriesResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete category.'));
    }
  }

  ngOnDestroy() {
    this.closeCategoryDialog();
  }

  private openCategoryDialog() {
    const categoryFormDialog = this.categoryFormDialog();
    if (!categoryFormDialog || this.categoryFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      categoryFormDialog,
      'sale-category-form-dialog',
    );
    this.categoryFormDialogRef = this.dialogBinding.ref;
    this.categoryFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') this.cancelEdit();
    });
  }

  private closeCategoryDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.categoryFormDialogRef?.close();
    this.categoryFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
