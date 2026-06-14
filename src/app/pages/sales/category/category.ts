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

type CategoryItem = {
  ScaUUID: string;
  ScaID: string;
  ScaName: string;
  ScaDateCreated: string | null;
  ScaDateUpdated: string | null;
};

type CategoryFilters = {
  name: string;
};

@Component({
  selector: 'app-sale-category',
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
  templateUrl: './category.html',
  styleUrls: ['./category.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleCategoryPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly categories = signal<CategoryItem[]>([]);
  readonly editing = signal<CategoryItem | null>(null);
  readonly filterFormModel = signal({ name: '' });
  readonly filterForm = createForm(this.filterFormModel);
  private readonly categoriesResource = resource({
    defaultValue: [] as CategoryItem[],
    params: (): CategoryFilters => ({
      name: this.filterFormModel().name.trim(),
    }),
    loader: ({ params }) => this.fetchCategories(params),
  });
  readonly loading = this.categoriesResource.isLoading;

  readonly categoryFormModel = signal({ name: '' });
  readonly categoryForm = createForm(this.categoryFormModel, (path) => {
    required(path.name);
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

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeCategoryDialog());
  }

  private async fetchCategories(filters: CategoryFilters) {
    this.error.set(null);

    const params = new URLSearchParams();
    if (filters.name) params.set('name', filters.name);

    const response = await this.api.get<any>(`sale/categories?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.categoriesResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({ name: '' });
    this.categoriesResource.reload();
  }

  refreshList() {
    this.categoriesResource.reload();
  }

  startEdit(category: CategoryItem) {
    this.editing.set(category);
    this.categoryFormModel.set({ name: category.ScaName });
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
    this.categoryFormModel.set({ name: '' });
    this.closeCategoryDialog();
  }

  async saveCategory() {
    if (!this.categoryForm().valid()) return;

    const payload = { name: this.categoryFormModel().name.trim() };
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

  private openCategoryDialog() {
    const categoryFormDialog = this.categoryFormDialog();
    if (!categoryFormDialog || this.categoryFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      categoryFormDialog,
      'sale-category-form-dialog',
    );
    this.categoryFormDialogRef = this.dialogBinding.ref;
    this.categoryFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.categoryFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
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
