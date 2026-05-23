import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  OnDestroy,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { fadeIn } from '../../../shared/animations/fade.animation';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  BillingPrice,
  BillingProduct,
  BillingService,
  BillingSubscription,
} from '../shared/billing.service';

@Component({
  selector: 'app-billing-system',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
  ],
  templateUrl: './system.html',
  styleUrls: ['./system.scss'],
  animations: [fadeIn],
})
export class BillingSystemPage implements AfterViewInit, OnDestroy {
  private readonly billing = inject(BillingService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly editingProduct = signal<BillingProduct | null>(null);
  readonly editingPrice = signal<BillingPrice | null>(null);
  readonly products = signal<BillingProduct[]>([]);

  readonly productSource = new MatTableDataSource<BillingProduct>([]);
  readonly priceSource = new MatTableDataSource<BillingPrice>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);

  readonly productColumns = ['code', 'name', 'module', 'scope', 'prices', 'status', 'actions'];
  readonly priceColumns = ['product', 'name', 'mode', 'unitPrice', 'setup', 'status', 'actions'];
  readonly subscriptionColumns = [
    'tenant',
    'product',
    'resource',
    'quantity',
    'status',
    'price',
    'actions',
  ];

  searchInput = '';
  priceProductFilter = '';
  statusFilter: number | null = null;
  subscriptionStatusFilter = '';

  readonly productForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    module: ['', [Validators.required]],
    billingScope: ['SERVICE', [Validators.required]],
    description: [''],
    status: [1],
  });

  readonly priceForm = this.fb.nonNullable.group({
    productUUID: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    currency: [''],
    billingMode: ['MONTHLY', [Validators.required]],
    unitCode: ['UNIT', [Validators.required]],
    unitPrice: [0, [Validators.required, Validators.min(0)]],
    setupAmount: [0, [Validators.required, Validators.min(0)]],
    includedQuantity: [0, [Validators.required, Validators.min(0)]],
    minimumCommitment: [0, [Validators.required, Validators.min(0)]],
    configJson: [''],
    status: [1],
  });

  readonly creditForm = this.fb.nonNullable.group({
    environmentUUID: ['', [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.000001)]],
    currency: [''],
    reason: ['', [Validators.required, Validators.minLength(4)]],
    reference: [''],
    idempotencyKey: [''],
  });

  @ViewChild('productDialog') productDialog?: TemplateRef<unknown>;
  @ViewChild('priceDialog') priceDialog?: TemplateRef<unknown>;
  @ViewChild('creditDialog') creditDialog?: TemplateRef<unknown>;
  @ViewChild('productPaginator') productPaginator?: MatPaginator;
  @ViewChild('pricePaginator') pricePaginator?: MatPaginator;
  @ViewChild('subscriptionPaginator') subscriptionPaginator?: MatPaginator;
  @ViewChild('productSort') productSort?: MatSort;
  @ViewChild('priceSort') priceSort?: MatSort;
  @ViewChild('subscriptionSort') subscriptionSort?: MatSort;
  private activeDialogRef: MatDialogRef<unknown> | null = null;

  ngAfterViewInit() {
    this.productSource.paginator = this.productPaginator ?? null;
    this.priceSource.paginator = this.pricePaginator ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator ?? null;
    this.productSource.sort = this.productSort ?? null;
    this.priceSource.sort = this.priceSort ?? null;
    this.subscriptionSource.sort = this.subscriptionSort ?? null;
    this.productSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.priceSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => this.refresh(), 0);
  }

  ngOnDestroy() {
    this.activeDialogRef?.close();
  }

  async refresh() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [products, prices, subscriptions] = await Promise.all([
        this.billing.listProducts(this.searchInput, this.statusFilter),
        this.billing.listPrices(this.searchInput, this.priceProductFilter, this.statusFilter),
        this.billing.listSystemSubscriptions(this.searchInput, this.subscriptionStatusFilter),
      ]);
      this.products.set(products);
      this.productSource.data = products;
      this.priceSource.data = prices;
      this.subscriptionSource.data = subscriptions;
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Failed to load billing data.');
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters() {
    void this.refresh();
  }

  clearFilters() {
    this.searchInput = '';
    this.priceProductFilter = '';
    this.statusFilter = null;
    this.subscriptionStatusFilter = '';
    void this.refresh();
  }

  openProductCreate() {
    this.editingProduct.set(null);
    this.productForm.reset({
      code: '',
      name: '',
      module: '',
      billingScope: 'SERVICE',
      description: '',
      status: 1,
    });
    this.openDialog(this.productDialog, '760px');
  }

  openProductEdit(row: BillingProduct) {
    this.editingProduct.set(row);
    this.productForm.reset({
      code: row.BprCode,
      name: row.BprName,
      module: row.BprModule,
      billingScope: row.BprBillingScope,
      description: row.BprDescription ?? '',
      status: row.BprStatus,
    });
    this.openDialog(this.productDialog, '760px');
  }

  async saveProduct() {
    if (this.productForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.productForm.getRawValue();
    const payload = {
      code: value.code,
      name: value.name,
      module: value.module,
      billingScope: value.billingScope,
      description: this.emptyToNull(value.description),
      status: Number(value.status),
    };
    try {
      const current = this.editingProduct();
      if (current) await this.billing.updateProduct(current.BprUUID, payload);
      else await this.billing.createProduct(payload);
      this.snack.success(current ? 'Product updated.' : 'Product created.');
      this.activeDialogRef?.close();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to save product.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteProduct(row: BillingProduct) {
    if (!(await this.confirm('Delete product', `Delete ${row.BprName}?`, 'Delete'))) return;
    try {
      await this.billing.deleteProduct(row.BprUUID);
      this.snack.success('Product deleted.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to delete product.');
    }
  }

  openPriceCreate() {
    this.editingPrice.set(null);
    this.priceForm.reset({
      productUUID: this.products()[0]?.BprUUID ?? '',
      name: '',
      currency: '',
      billingMode: 'MONTHLY',
      unitCode: 'UNIT',
      unitPrice: 0,
      setupAmount: 0,
      includedQuantity: 0,
      minimumCommitment: 0,
      configJson: '',
      status: 1,
    });
    this.openDialog(this.priceDialog, '860px');
  }

  openPriceEdit(row: BillingPrice) {
    this.editingPrice.set(row);
    this.priceForm.reset({
      productUUID: row.BillingProductBprUUID,
      name: row.BpcName,
      currency: row.BpcCurrency,
      billingMode: row.BpcBillingMode,
      unitCode: row.BpcUnitCode,
      unitPrice: Number(row.BpcUnitPrice ?? 0),
      setupAmount: Number(row.BpcSetupAmount ?? 0),
      includedQuantity: Number(row.BpcIncludedQuantity ?? 0),
      minimumCommitment: Number(row.BpcMinimumCommitment ?? 0),
      configJson: row.BpcConfigJson ?? '',
      status: row.BpcStatus,
    });
    this.openDialog(this.priceDialog, '860px');
  }

  async savePrice() {
    if (this.priceForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.priceForm.getRawValue();
    const config = this.parseJson(value.configJson);
    if (config === false) {
      this.saving.set(false);
      this.snack.error('Config JSON is invalid.');
      return;
    }
    const payload = {
      productUUID: value.productUUID,
      name: value.name,
      currency: this.emptyToNull(value.currency),
      billingMode: value.billingMode,
      unitCode: value.unitCode,
      unitPrice: Number(value.unitPrice),
      setupAmount: Number(value.setupAmount),
      includedQuantity: Number(value.includedQuantity),
      minimumCommitment: Number(value.minimumCommitment),
      config,
      status: Number(value.status),
    };
    try {
      const current = this.editingPrice();
      if (current) await this.billing.updatePrice(current.BpcUUID, payload);
      else await this.billing.createPrice(payload);
      this.snack.success(current ? 'Price updated.' : 'Price created.');
      this.activeDialogRef?.close();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to save price.');
    } finally {
      this.saving.set(false);
    }
  }

  async deletePrice(row: BillingPrice) {
    if (!(await this.confirm('Delete price', `Delete ${row.BpcName}?`, 'Delete'))) return;
    try {
      await this.billing.deletePrice(row.BpcUUID);
      this.snack.success('Price deleted.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to delete price.');
    }
  }

  openCreditDialog() {
    this.creditForm.reset({
      environmentUUID: '',
      amount: 0,
      currency: '',
      reason: '',
      reference: '',
      idempotencyKey: crypto.randomUUID(),
    });
    this.openDialog(this.creditDialog, '720px');
  }

  async saveManualCredit() {
    if (this.creditForm.invalid || this.saving()) return;
    this.saving.set(true);
    const value = this.creditForm.getRawValue();
    try {
      await this.billing.manualCredit({
        environmentUUID: value.environmentUUID,
        amount: Number(value.amount),
        currency: this.emptyToNull(value.currency),
        reason: value.reason,
        reference: this.emptyToNull(value.reference),
        idempotencyKey: this.emptyToNull(value.idempotencyKey),
      });
      this.snack.success('Manual credit added.');
      this.activeDialogRef?.close();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to add credit.');
    } finally {
      this.saving.set(false);
    }
  }

  async cancelSubscription(row: BillingSubscription) {
    const label = row.BsuResourceLabel || row.BprName || row.BprCode || 'subscription';
    if (!(await this.confirm('Cancel subscription', `Cancel ${label}?`, 'Cancel subscription')))
      return;
    try {
      await this.billing.cancelSubscription(row.BsuUUID);
      this.snack.success('Subscription canceled.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    }
  }

  productName(uuid: string) {
    return this.products().find((product) => product.BprUUID === uuid)?.BprName ?? uuid;
  }

  formatMoney(value: unknown, currency = '') {
    const amount = Number(value ?? 0);
    return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  label(value: unknown) {
    return String(value ?? '').replace(/_/g, ' ');
  }

  private openDialog(template: TemplateRef<unknown> | undefined, width: string) {
    if (!template) return;
    this.activeDialogRef?.close();
    this.activeDialogRef = this.dialog.open(template, {
      width,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: false,
    });
    this.activeDialogRef.updateSize(width, 'auto');
  }

  private async confirm(title: string, message: string, confirmText: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '440px',
      data: { title, message, confirmText },
    });
    return !!(await ref.afterClosed().toPromise());
  }

  private emptyToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }

  private parseJson(value: string) {
    const text = value.trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return false;
    }
  }

  private sortValue(row: any, column: string) {
    return String(
      row?.[column] ?? row?.BprName ?? row?.BpcName ?? row?.EnvironmentName ?? '',
    ).toLowerCase();
  }
}
