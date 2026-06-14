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
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

type SaleStockTypeItem = {
  SstUUID: string;
  SstID: string;
  SstName: string;
  SstDateCreated: string | null;
  SstDateUpdated: string | null;
};

type StockTypeFilters = {
  search: string;
};

@Component({
  selector: 'app-sale-stock-type',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
  templateUrl: './stock-type.html',
  styleUrls: ['./stock-type.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleStockTypePage {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly stockTypes = signal<SaleStockTypeItem[]>([]);
  readonly editing = signal<SaleStockTypeItem | null>(null);
  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });
  private readonly stockTypesResource = resource({
    defaultValue: [] as SaleStockTypeItem[],
    params: (): StockTypeFilters => ({
      search: this.filterForm.controls.search.value.trim(),
    }),
    loader: ({ params }) => this.fetchStockTypes(params),
  });
  readonly loading = this.stockTypesResource.isLoading;

  readonly stockTypeForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly displayedColumns = ['name', 'actions'];
  readonly dataSource = new MatTableDataSource<SaleStockTypeItem>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly stockTypeFormDialog = viewChild<TemplateRef<unknown>>('stockTypeFormDialog');
  private stockTypeFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;
  private readonly syncStockTypes = effect(() => {
    const items = this.stockTypesResource.value();
    this.stockTypes.set(items);
    this.dataSource.data = [...items];
  });
  private readonly reportStockTypesError = effect(() => {
    const error = this.stockTypesResource.error();
    if (error) {
      this.error.set(this.extractErrorMessage(error, 'Failed to load stock types.'));
      this.dataSource.data = [];
    }
  });

  private readonly setupTable = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.closeStockTypeDialog());
  }

  private async fetchStockTypes(filters: StockTypeFilters) {
    this.error.set(null);

    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);

    const response = await this.api.get<any>(`sale/stock-types?${params.toString()}`);
    return response?.data?.items ?? [];
  }

  applyFilters() {
    this.stockTypesResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ search: '' });
    this.stockTypesResource.reload();
  }

  refreshList() {
    this.stockTypesResource.reload();
  }

  startEdit(stockType: SaleStockTypeItem) {
    this.editing.set(stockType);
    this.stockTypeForm.reset({ name: stockType.SstName });
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openStockTypeDialog();
  }

  openEditDialog(stockType: SaleStockTypeItem) {
    this.startEdit(stockType);
    this.openStockTypeDialog();
  }

  cancelEdit() {
    this.editing.set(null);
    this.stockTypeForm.reset({ name: '' });
    this.closeStockTypeDialog();
  }

  async saveStockType() {
    if (this.stockTypeForm.invalid) return;

    const payload = { name: this.stockTypeForm.getRawValue().name.trim() };
    if (!payload.name) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/stock-types/${editing.SstUUID}`, payload);
      } else {
        await this.api.post<any>('sale/stock-types', payload);
      }

      this.cancelEdit();
      this.stockTypesResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save stock type.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteStockType(stockType: SaleStockTypeItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete stock type',
        message: 'Are you sure you want to delete this stock type?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/stock-types/${stockType.SstUUID}`);
      this.stockTypesResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete stock type.'));
    }
  }

  private openStockTypeDialog() {
    const stockTypeFormDialog = this.stockTypeFormDialog();
    if (!stockTypeFormDialog || this.stockTypeFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      stockTypeFormDialog,
      'sale-stock-type-form-dialog',
    );
    this.stockTypeFormDialogRef = this.dialogBinding.ref;
    this.stockTypeFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.stockTypeFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closeStockTypeDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.stockTypeFormDialogRef?.close();
    this.stockTypeFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
