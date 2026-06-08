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
import { firstValueFrom } from 'rxjs';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslocoPipe } from '@jsverse/transloco';

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

@Component({
  selector: 'app-sales-stocks',
  standalone: true,
  imports: [
    CommonModule,
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
  changeDetection: ChangeDetectionStrategy.Eager,
  animations: [fadeIn],
})
export class SalesStocksPage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
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
  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('stockFormDialog') stockFormDialog?: TemplateRef<unknown>;
  private stockFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.loadStockTypes();
    this.loadStocks();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
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

  async loadStocks() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    const { search } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (search?.trim()) params.set('search', search.trim());

    try {
      const response = await this.api.get<any>(`sale/stocks?${params.toString()}`);
      const items = response?.data?.items ?? [];
      this.stocks.set(items);
      this.dataSource.data = [...items];
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load stocks.'));
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
    void this.loadStocks();
  }

  clearFilters() {
    this.filterForm.reset({ search: '' });
    void this.loadStocks();
  }

  refreshList() {
    void this.loadStocks();
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
        const response = await this.api.put<any>(`sale/stocks/${editing.SskUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.stocks.update((items) =>
            items.map((row) => (row.SskUUID === item.SskUUID ? item : row)),
          );
          this.dataSource.data = [...this.stocks()];
        }
      } else {
        const response = await this.api.post<any>('sale/stocks', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.stocks.update((items) => [item, ...items]);
          this.dataSource.data = [...this.stocks()];
        }
      }

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
      this.stocks.update((items) => items.filter((row) => row.SskUUID !== stock.SskUUID));
      this.dataSource.data = [...this.stocks()];
    } catch (err) {
      console.error('Failed to delete stock.', err);
      alert('Failed to delete stock.');
    }
  }

  ngOnDestroy() {
    this.closeStockDialog();
  }

  private openStockDialog() {
    if (!this.stockFormDialog || this.stockFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.stockFormDialog,
      'sale-stocks-form-dialog',
    );
    this.stockFormDialogRef = this.dialogBinding.ref;
    this.stockFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
