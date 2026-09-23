import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe, NgClass } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../shared/refresh-button/refresh-button';

type FeeAccrual = {
  BfaUUID: string;
  UserUsrUUID: string;
  TenantEmail: string | null;
  BfaTransactionType: string;
  BfaAmount: number;
  BfaCurrency: string;
  BfaStatus: 'open' | 'settled';
  BfaSettlementReference: string | null;
  BfaDateCreated: string;
};

@Component({
  selector: 'app-system-mnscloud-pay-fee-accruals',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    DatePipe,
    NgClass,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './fee-accruals.html',
  styleUrls: ['./fee-accruals.scss'],
  host: { class: 'app-fade-in-host' },
})
export class SystemMnscloudPayFeeAccrualsPage {
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);

  readonly pageTitle = computed(() => 'MNSCloud Pay — Postpaid Accruals');
  readonly pageSubtitle = computed(
    () => 'Open MNSCloud Pay fees for postpaid tenants, awaiting manual settlement by finance.',
  );
  readonly baseEndpoint = '/system/mnscloud-pay/fee-accruals';

  private readonly accrualsResource = resource({
    defaultValue: [] as FeeAccrual[],
    loader: async () => {
      const result = await this.api.get<any>(this.baseEndpoint);
      return Array.isArray(result?.data?.items) ? result.data.items : [];
    },
  });

  readonly accruals = signal<FeeAccrual[]>([]);
  readonly loadingAccruals = this.accrualsResource.isLoading;
  readonly settlingUUID = signal<string | null>(null);
  readonly settlingItem = signal<FeeAccrual | null>(null);
  readonly settlementReference = signal<string>('');

  dataSource = new MatTableDataSource<FeeAccrual>([]);
  displayedColumns: string[] = [
    'tenant',
    'transactionType',
    'amount',
    'status',
    'date',
    'actions',
  ];
  search = '';
  searchInput = '';

  private readonly syncAccruals = effect(() => {
    const normalized = this.accrualsResource.value();
    this.accruals.set(normalized);
    this.dataSource.data = [...normalized];
    this.applyFilter();
  });

  private readonly reportAccrualsError = effect(() => {
    const error = this.accrualsResource.error();
    if (error) {
      this.showError(this.friendlyError(error, 'Failed to load fee accruals.'));
      this.accruals.set([]);
      this.dataSource.data = [];
    }
  });

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly settleDialog = viewChild<TemplateRef<unknown>>('settleDialog');
  private settleDialogRef: MatDialogRef<unknown> | null = null;

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'tenant':
          return data.TenantEmail ?? '';
        case 'transactionType':
          return data.BfaTransactionType ?? '';
        case 'amount':
          return data.BfaAmount ?? 0;
        case 'status':
          return data.BfaStatus ?? '';
        case 'date':
          return data.BfaDateCreated ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.TenantEmail, data.BfaTransactionType, data.BfaStatus]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(value));
    };
  });

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
    this.accrualsResource.reload();
  }

  applyFilter() {
    this.dataSource.filter = this.search.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private friendlyError(error: unknown, fallback: string) {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.error;
      if (typeof serverMessage === 'string' && serverMessage.trim().length) {
        return serverMessage;
      }
      return error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  statusLabel(item: FeeAccrual) {
    return item.BfaStatus === 'settled' ? 'Settled' : 'Open';
  }

  statusChipClass(item: FeeAccrual) {
    return item.BfaStatus === 'settled' ? 'chip-success' : 'chip-queued';
  }

  isSettling(item: FeeAccrual) {
    return this.settlingUUID() === item.BfaUUID;
  }

  openSettleDialog(item: FeeAccrual) {
    this.settlingItem.set(item);
    this.settlementReference.set('');
    const template = this.settleDialog();
    if (!template || this.settleDialogRef) return;
    this.settleDialogRef = this.dialog.open(template, { panelClass: 'crud-dialog-panel' });
    this.settleDialogRef.afterClosed().subscribe(() => {
      this.settleDialogRef = null;
      this.settlingItem.set(null);
    });
  }

  cancelSettle() {
    this.settleDialogRef?.close();
  }

  async confirmSettle() {
    const item = this.settlingItem();
    if (!item) return;
    this.settlingUUID.set(item.BfaUUID);
    try {
      await this.api.post(`${this.baseEndpoint}/${item.BfaUUID}/settle`, {
        reference: this.settlementReference() || null,
      });
      this.showSuccess('Fee accrual marked settled.');
      this.settleDialogRef?.close();
      this.accrualsResource.reload();
    } catch (error) {
      this.showError(this.friendlyError(error, 'Failed to settle fee accrual.'));
    } finally {
      this.settlingUUID.set(null);
    }
  }

  private showSuccess(message: string) {
    this.snack.success(message);
  }

  private showError(message: string) {
    this.snack.error(message);
  }
}
