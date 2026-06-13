import {
  AfterViewInit,
  Component,
  effect,
  OnDestroy,
  TemplateRef,
  inject,
  resource,
  signal,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
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

type SaleStockItem = {
  SskUUID: string;
  SskID: string;
  SskName: string;
  SaleStockTypeSstUUID: string | null;
  SaleStockTypeName: string | null;
  SskDateCreated: string | null;
  SskDateUpdated: string | null;
};

type SaleStockTypeItem = {
  SstUUID: string;
  SstName: string;
};

type StockFilters = {
  search: string;
};

@Component({
  selector: 'app-sales-stocks',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
  ],
  templateUrl: './stocks.html',
  styleUrls: ['./stocks.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesStocksPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly stocks = signal<SaleStockItem[]>([]);
  readonly stockTypes = signal<SaleStockTypeItem[]>([]);
  readonly editing = signal<SaleStockItem | null>(null);
  stockTypeSearch = '';

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly stockForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    saleStockTypeUUID: ['', [Validators.required]],
  });

  readonly displayedColumns = ['name', 'type', 'actions'];
  readonly dataSource = new MatTableDataSource<SaleStockItem>([]);
  private readonly stocksResource = resource({
    defaultValue: [] as SaleStockItem[],
    params: (): StockFilters => ({
      search: this.filterForm.controls.search.value.trim(),
    }),
    loader: ({ params }) => this.fetchStocks(params),
  });
  private readonly syncStocks = effect(() => {
    const items = this.stocksResource.value();
    this.stocks.set(items);
    this.dataSource.data = [...items];
    this.error.set(null);
  });
  private readonly reportStocksError = effect(() => {
    const error = this.stocksResource.error();
    if (error) this.error.set(this.extractErrorMessage(error, 'Failed to load stocks.'));
  });
  readonly loading = this.stocksResource.isLoading;
  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly stockFormDialog = viewChild<TemplateRef<unknown>>('stockFormDialog');
  private stockFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.loadStockTypes();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.SskName ?? '';
        case 'type':
          return data.SaleStockTypeName ?? '';
        default:
          return '';
      }
    };
  }

  async loadStockTypes() {
    try {
      const response = await this.api.get<any>('sale/stock-types?limit=200');
      this.stockTypes.set(response?.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load stock types.', err);
    }
  }

  private async fetchStocks(filters: StockFilters): Promise<SaleStockItem[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);

    const query = params.toString();
    const response = await this.api.get<any>(`sale/stocks${query ? `?${query}` : ''}`);
    return Array.isArray(response?.data?.items) ? response.data.items : [];
  }

  applyFilters() {
    this.stocksResource.reload();
  }

  clearFilters() {
    this.filterForm.reset({ search: '' });
    this.stocksResource.reload();
  }

  refreshList() {
    this.stocksResource.reload();
  }

  startEdit(stock: SaleStockItem) {
    this.editing.set(stock);
    this.stockForm.reset({
      name: stock.SskName,
      saleStockTypeUUID: stock.SaleStockTypeSstUUID ?? '',
    });
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openStockDialog();
  }

  openEditDialog(stock: SaleStockItem) {
    this.startEdit(stock);
    this.openStockDialog();
  }

  cancelEdit() {
    this.editing.set(null);
    this.stockForm.reset({ name: '', saleStockTypeUUID: '' });
    this.closeStockDialog();
  }

  get filteredStockTypes() {
    const value = this.stockTypeSearch.trim().toLowerCase();
    if (!value) return this.stockTypes();
    return this.stockTypes().filter((item) => (item.SstName ?? '').toLowerCase().includes(value));
  }

  onStockTypeOpened(opened: boolean) {
    if (opened) {
      this.stockTypeSearch = '';
    }
  }

  async saveStock() {
    if (this.stockForm.invalid) return;

    const payload = {
      name: this.stockForm.getRawValue().name.trim(),
      saleStockTypeUUID: this.stockForm.getRawValue().saleStockTypeUUID,
    };
    if (!payload.name || !payload.saleStockTypeUUID) return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/stocks/${editing.SskUUID}`, payload);
      } else {
        await this.api.post<any>('sale/stocks', payload);
      }

      this.stocksResource.reload();
      this.cancelEdit();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save stock.'));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteStock(stock: SaleStockItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete stock',
        message: 'Are you sure you want to delete this stock?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/stocks/${stock.SskUUID}`);
      this.stocksResource.reload();
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete stock.'));
    }
  }

  ngOnDestroy() {
    this.closeStockDialog();
  }

  private openStockDialog() {
    const stockFormDialog = this.stockFormDialog();
    if (!stockFormDialog || this.stockFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      stockFormDialog,
      'sale-stocks-form-dialog',
    );
    this.stockFormDialogRef = this.dialogBinding.ref;
    this.stockFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.stockFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') this.cancelEdit();
      });
  }

  private closeStockDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.stockFormDialogRef?.close();
    this.stockFormDialogRef = null;
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
  }
}
