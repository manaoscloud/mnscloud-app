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
  BillingCatalogItem,
  BillingLedgerEntry,
  BillingService,
  BillingSubscription,
  BillingWallet,
} from '../shared/billing.service';

@Component({
  selector: 'app-billing-wallet',
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
  templateUrl: './wallet.html',
  styleUrls: ['./wallet.scss'],
  animations: [fadeIn],
})
export class BillingWalletPage implements AfterViewInit, OnDestroy {
  private readonly billing = inject(BillingService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly wallets = signal<BillingWallet[]>([]);
  readonly selectedCatalogItem = signal<BillingCatalogItem | null>(null);

  readonly catalogSource = new MatTableDataSource<BillingCatalogItem>([]);
  readonly subscriptionSource = new MatTableDataSource<BillingSubscription>([]);
  readonly ledgerSource = new MatTableDataSource<BillingLedgerEntry>([]);

  readonly catalogColumns = ['product', 'mode', 'price', 'setup', 'actions'];
  readonly subscriptionColumns = ['product', 'resource', 'quantity', 'status', 'price', 'actions'];
  readonly ledgerColumns = ['date', 'type', 'direction', 'amount', 'balance', 'reason'];

  searchInput = '';
  ledgerSearchInput = '';
  statusFilter = '';

  readonly subscriptionForm = this.fb.nonNullable.group({
    priceUUID: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.000001)]],
    resourceType: [''],
    resourceUUID: [''],
    resourceLabel: [''],
  });

  @ViewChild('subscriptionDialog') subscriptionDialog?: TemplateRef<unknown>;
  @ViewChild('catalogPaginator') catalogPaginator?: MatPaginator;
  @ViewChild('subscriptionPaginator') subscriptionPaginator?: MatPaginator;
  @ViewChild('ledgerPaginator') ledgerPaginator?: MatPaginator;
  @ViewChild('catalogSort') catalogSort?: MatSort;
  @ViewChild('subscriptionSort') subscriptionSort?: MatSort;
  @ViewChild('ledgerSort') ledgerSort?: MatSort;
  private subscriptionDialogRef: MatDialogRef<unknown> | null = null;

  ngAfterViewInit() {
    this.catalogSource.paginator = this.catalogPaginator ?? null;
    this.subscriptionSource.paginator = this.subscriptionPaginator ?? null;
    this.ledgerSource.paginator = this.ledgerPaginator ?? null;
    this.catalogSource.sort = this.catalogSort ?? null;
    this.subscriptionSource.sort = this.subscriptionSort ?? null;
    this.ledgerSource.sort = this.ledgerSort ?? null;
    this.catalogSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.subscriptionSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    this.ledgerSource.sortingDataAccessor = (row, column) => this.sortValue(row, column);
    setTimeout(() => this.refresh(), 0);
  }

  ngOnDestroy() {
    this.subscriptionDialogRef?.close();
  }

  async refresh() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [wallets, catalog, subscriptions, ledger] = await Promise.all([
        this.billing.listWallets(),
        this.billing.listCatalog(this.searchInput),
        this.billing.listSubscriptions(this.searchInput, this.statusFilter),
        this.billing.listLedger(this.ledgerSearchInput),
      ]);
      this.wallets.set(wallets);
      this.catalogSource.data = catalog;
      this.subscriptionSource.data = subscriptions;
      this.ledgerSource.data = ledger;
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
    this.ledgerSearchInput = '';
    this.statusFilter = '';
    void this.refresh();
  }

  openSubscribeDialog(row: BillingCatalogItem) {
    this.selectedCatalogItem.set(row);
    this.subscriptionForm.reset({
      priceUUID: row.BpcUUID,
      quantity: 1,
      resourceType: '',
      resourceUUID: '',
      resourceLabel: '',
    });
    if (!this.subscriptionDialog) return;
    this.subscriptionDialogRef = this.dialog.open(this.subscriptionDialog, {
      width: '720px',
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'calc(100vh - 32px)',
      autoFocus: false,
    });
    this.subscriptionDialogRef.updateSize('720px', 'auto');
  }

  async saveSubscription() {
    if (this.subscriptionForm.invalid || this.saving()) return;
    this.saving.set(true);
    try {
      await this.billing.createSubscription({
        priceUUID: this.subscriptionForm.value.priceUUID,
        quantity: this.subscriptionForm.value.quantity,
        resourceType: this.emptyToNull(this.subscriptionForm.value.resourceType),
        resourceUUID: this.emptyToNull(this.subscriptionForm.value.resourceUUID),
        resourceLabel: this.emptyToNull(this.subscriptionForm.value.resourceLabel),
      });
      this.snack.success('Subscription created.');
      this.subscriptionDialogRef?.close();
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to create subscription.');
    } finally {
      this.saving.set(false);
    }
  }

  async cancelSubscription(row: BillingSubscription) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      width: '440px',
      data: {
        title: 'Cancel subscription',
        message: `Cancel ${row.BprName ?? row.BprCode ?? 'this subscription'}?`,
        confirmText: 'Cancel subscription',
      },
    });
    const confirmed = await ref.afterClosed().toPromise();
    if (!confirmed) return;
    try {
      await this.billing.cancelSubscription(row.BsuUUID);
      this.snack.success('Subscription canceled.');
      await this.refresh();
    } catch (error) {
      this.snack.error(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    }
  }

  formatMoney(value: unknown, currency = '') {
    const amount = Number(value ?? 0);
    return `${currency ? `${currency} ` : ''}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  statusLabel(value: unknown) {
    return String(value ?? '').replace(/_/g, ' ');
  }

  private sortValue(row: any, column: string) {
    return String(row?.[column] ?? row?.BprName ?? row?.BleDateCreated ?? '').toLowerCase();
  }

  private emptyToNull(value: unknown) {
    const text = String(value ?? '').trim();
    return text ? text : null;
  }
}
