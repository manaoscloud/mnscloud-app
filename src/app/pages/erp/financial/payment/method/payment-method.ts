import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../../../shared/i18n/translate.pipe';

type PaymentMethod = {
  ErpFinPayMethodUUID: string;
  Type: 'card' | 'bank_transfer' | 'pix' | 'cash' | 'boleto';
  Name: string;
  Code?: string | null;
  Status: number;
  Notes?: string | null;
};

@Component({
  selector: 'app-finance-payment-method',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatChipsModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './payment-method.html',
  styleUrls: ['./payment-method.scss'],
})
export class FinancialPaymentMethodPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  paymentMethods: PaymentMethod[] = [];
  dataSource = new MatTableDataSource<PaymentMethod>([]);
  displayedColumns: string[] = ['name', 'type', 'code', 'status', 'actions'];
  loading = false;
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingPaymentMethod: PaymentMethod | null = null;

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('paymentMethodFormDialog') paymentMethodFormDialog?: TemplateRef<unknown>;
  private paymentMethodFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  form = {
    type: 'card' as PaymentMethod['Type'],
    name: '',
    code: '',
    notes: '',
    status: 1,
  };

  ngOnInit() {
    this.startCreate();
    void this.loadPaymentMethods();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closePaymentMethodDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'type':
          return data.Type ?? '';
        case 'code':
          return data.Code ?? '';
        case 'status':
          return data.Status ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Code, data.Type]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    this.applyFilter();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    this.applyFilter();
  }

  refreshList() {
    void this.loadPaymentMethods();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadPaymentMethods() {
    this.loading = true;
    this.error = '';
    const start = performance.now();
    try {
      const res = await this.api.get<any>('erp/financial/payment/methods');
      this.paymentMethods = res?.data?.items ?? [];
      this.dataSource.data = [...this.paymentMethods];
      this.applySearchFilters();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load payment methods.');
      this.dataSource.data = [];
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, waitMs);
      } else {
        this.loading = false;
        this.cdr.detectChanges();
      }
    }
  }

  startCreate() {
    this.editingPaymentMethod = null;
    this.form.type = 'card';
    this.form.name = '';
    this.form.code = '';
    this.form.notes = '';
    this.form.status = 1;
  }

  openCreateDialog() {
    this.startCreate();
    this.openPaymentMethodDialog();
  }

  startEdit(method: PaymentMethod) {
    this.editingPaymentMethod = method;
    this.form.type = method.Type;
    this.form.name = method.Name ?? '';
    this.form.code = method.Code ?? '';
    this.form.notes = method.Notes ?? '';
    this.form.status = method.Status ?? 1;
  }

  openEditDialog(method: PaymentMethod) {
    this.startEdit(method);
    this.openPaymentMethodDialog();
  }

  async savePaymentMethod(keepOpenForNew = false) {
    if (!this.form.name.trim()) {
      this.showWarning('Name is required.');
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const payload = {
        type: this.form.type,
        name: this.form.name.trim(),
        code: this.form.code?.trim() || null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingPaymentMethod) {
        await this.api.put(
          `erp/financial/payment/methods/${this.editingPaymentMethod.ErpFinPayMethodUUID}`,
          payload,
        );
        this.snack.success('Payment method updated successfully.');
      } else {
        await this.api.post('erp/financial/payment/methods', payload);
        this.snack.success('Payment method created successfully.');
      }

      if (!this.editingPaymentMethod && keepOpenForNew) {
        this.startCreate();
        this.cdr.detectChanges();
      } else {
        this.closePaymentMethodDialog();
        this.startCreate();
        this.cdr.detectChanges();
      }
      await this.loadPaymentMethods();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save payment method.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewPaymentMethod() {
    if (this.editingPaymentMethod) return;
    void this.savePaymentMethod(true);
  }

  cancelPaymentMethodForm() {
    this.closePaymentMethodDialog();
    this.startCreate();
  }

  async deletePaymentMethod(paymentMethodUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete payment method',
        message: 'Are you sure you want to delete this payment method?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.loading = true;
    this.error = '';
    try {
      await this.api.delete(`erp/financial/payment/methods/${paymentMethodUUID}`);
      this.snack.success('Payment method deleted successfully.');
      await this.loadPaymentMethods();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete payment method.');
    } finally {
      this.loading = false;
    }
  }

  private openPaymentMethodDialog() {
    if (!this.paymentMethodFormDialog || this.paymentMethodFormDialogRef) return;
    this.error = '';
    this.paymentMethodFormDialogRef = this.dialog.open(this.paymentMethodFormDialog, {
      ...this.getPaymentMethodDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-payment-method-form-dialog',
    });
    this.paymentMethodFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.cancelPaymentMethodForm();
      }
    });
    this.startDialogViewportObserver();
    this.paymentMethodFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.paymentMethodFormDialogRef = null;
    });
  }

  private closePaymentMethodDialog() {
    if (!this.paymentMethodFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.paymentMethodFormDialogRef.close();
    this.paymentMethodFormDialogRef = null;
  }

  private getPaymentMethodDialogViewportConfig() {
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
    if (!this.paymentMethodFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updatePaymentMethodDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updatePaymentMethodDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updatePaymentMethodDialogViewport() {
    if (!this.paymentMethodFormDialogRef) return;
    const config = this.getPaymentMethodDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.paymentMethodFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.paymentMethodFormDialogRef.updatePosition(config.position);
    } else {
      this.paymentMethodFormDialogRef.updatePosition();
    }
  }
  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }
}
