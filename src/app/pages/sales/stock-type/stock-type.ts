import {
  AfterViewInit,
  Component,
  OnDestroy,
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

type SaleStockTypeItem = {
  SstUUID: string;
  SstID: string;
  SstName: string;
  SstDateCreated: string | null;
  SstDateUpdated: string | null;
};

@Component({
  selector: 'app-sale-stock-type',
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
  templateUrl: './stock-type.html',
  styleUrls: ['./stock-type.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fadeIn],
})
export class SaleStockTypePage implements AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly stockTypes = signal<SaleStockTypeItem[]>([]);
  readonly editing = signal<SaleStockTypeItem | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    search: [''],
  });

  readonly stockTypeForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly displayedColumns = ['name', 'actions'];
  readonly dataSource = new MatTableDataSource<SaleStockTypeItem>([]);
  readonly paginator = viewChild(MatPaginator);
  readonly stockTypeFormDialog = viewChild<TemplateRef<unknown>>('stockTypeFormDialog');
  private stockTypeFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.loadStockTypes();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
  }

  async loadStockTypes() {
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    const { search } = this.filterForm.getRawValue();
    const params = new URLSearchParams();
    if (search?.trim()) params.set('search', search.trim());

    try {
      const response = await this.api.get<any>(`sale/stock-types?${params.toString()}`);
      const items = response?.data?.items ?? [];
      this.stockTypes.set(items);
      this.dataSource.data = [...items];
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to load stock types.'));
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
    void this.loadStockTypes();
  }

  clearFilters() {
    this.filterForm.reset({ search: '' });
    void this.loadStockTypes();
  }

  refreshList() {
    void this.loadStockTypes();
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
        const response = await this.api.put<any>(`sale/stock-types/${editing.SstUUID}`, payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.stockTypes.update((items) =>
            items.map((row) => (row.SstUUID === item.SstUUID ? item : row)),
          );
          this.dataSource.data = [...this.stockTypes()];
        }
      } else {
        const response = await this.api.post<any>('sale/stock-types', payload);
        const item = response?.data?.item ?? null;
        if (item) {
          this.stockTypes.update((items) => [item, ...items]);
          this.dataSource.data = [...this.stockTypes()];
        }
      }

      this.cancelEdit();
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
      this.stockTypes.update((items) => items.filter((row) => row.SstUUID !== stockType.SstUUID));
      this.dataSource.data = [...this.stockTypes()];
    } catch (err) {
      console.error('Failed to delete stock type.', err);
      alert('Failed to delete stock type.');
    }
  }

  ngOnDestroy() {
    this.closeStockTypeDialog();
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
    this.stockTypeFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
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
