import {
  AfterViewInit,
  Component,
  effect,
  OnDestroy,
  OnInit,
  resource,
  TemplateRef,
  inject,
  ChangeDetectionStrategy,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { DateMaskDirective } from '../../../../../shared/date-mask/date-mask.directive';
import { CurrencyMaskDirective } from '../../../../../shared/currency-mask/currency-mask.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../../../shared/refresh-button/refresh-button';

type ContractStatus = 'draft' | 'active' | 'expired' | 'canceled';

type ErpFinInvContract = {
  ErpFinInvContractUUID: string;
  CustomerUUID?: string | null;
  DueDayUUID?: string | null;
  Title: string;
  Amount: number;
  Status: ContractStatus;
  StartDate: string;
  EndDate?: string | null;
  Notes?: string | null;
  BillingComplexUUID?: string | null;
  AddressBillingStreet?: string | null;
  AddressBillingNumber?: string | null;
  AddressBillingDistrict?: string | null;
  AddressBillingCity?: string | null;
  AddressBillingState?: string | null;
  AddressBillingZip?: string | null;
  AddressBillingCountry?: string | null;
  InstallSameAsBilling?: boolean | number | null;
  AddressInstallStreet?: string | null;
  AddressInstallNumber?: string | null;
  AddressInstallDistrict?: string | null;
  AddressInstallCity?: string | null;
  AddressInstallState?: string | null;
  AddressInstallZip?: string | null;
  AddressInstallCountry?: string | null;
};

type ErpComplexOption = {
  ComplexUUID: string;
  Name: string;
  Address?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
};

type CustomerOption = {
  CustomerUUID: string;
  Name: string;
  DueDayUUID?: string | null;
};

@Component({
  selector: 'app-invoicing-contracts',
  standalone: true,
  imports: [
    RefreshButtonComponent,
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
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTabsModule,
    TranslocoPipe,
    DateMaskDirective,
    CurrencyMaskDirective,
  ],
  templateUrl: './contracts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./contracts.scss'],
})
export class InvoicingContractsPage implements OnInit, AfterViewInit, OnDestroy {
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private dialog = inject(MatDialog);

  amountPrefix = '';

  contracts: ErpFinInvContract[] = [];
  dataSource = new MatTableDataSource<ErpFinInvContract>([]);
  displayedColumns: string[] = [
    'title',
    'customer',
    'startDate',
    'endDate',
    'amount',
    'status',
    'actions',
  ];
  private readonly contractsResource = resource({
    defaultValue: [] as ErpFinInvContract[],
    loader: async () => {
      const res = await this.api.get<any>('erp/financial/invoicing/contracts');
      return res?.data?.items ?? [];
    },
  });
  get loading() {
    return this.contractsResource.isLoading();
  }
  saving = false;
  error = '';
  search = '';
  searchInput = '';
  editingContract: ErpFinInvContract | null = null;
  complexes: ErpComplexOption[] = [];
  complexMap = new Map<string, ErpComplexOption>();
  customers: CustomerOption[] = [];
  customerMap = new Map<string, CustomerOption>();

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly contractFormDialog = viewChild<TemplateRef<unknown>>('contractFormDialog');
  private contractFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;
  private readonly syncContracts = effect(() => {
    this.contracts = this.contractsResource.value();
    this.dataSource.data = [...this.contracts];
    this.applyFilter();
  });
  private readonly reportContractsError = effect(() => {
    const error = this.contractsResource.error();
    if (error) {
      this.showError(this.extractErrorMessage(error, 'Failed to load contracts.'));
      this.dataSource.data = [];
    }
  });

  statusOptions: { value: ContractStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'expired', label: 'Expired' },
    { value: 'canceled', label: 'Canceled' },
  ];

  form = {
    title: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    amount: 0,
    status: 'draft' as ContractStatus,
    notes: '',
    billingComplexUUID: '',
    customerUUID: '',
    billingStreet: '',
    billingNumber: '',
    billingDistrict: '',
    billingCity: '',
    billingState: '',
    billingZip: '',
    billingCountry: '',
    installSameAsBilling: false,
    installStreet: '',
    installNumber: '',
    installDistrict: '',
    installCity: '',
    installState: '',
    installZip: '',
    installCountry: '',
  };

  ngOnInit() {
    const currencyMeta = this.getCurrencyAffixes();
    this.amountPrefix = currencyMeta.prefix;
    this.startCreate();
    void this.loadComplexes();
    void this.loadCustomers();
  }

  ngOnDestroy() {
    this.stopDialogViewportObserver();
    this.closeContractDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'title':
          return data.Title ?? '';
        case 'startDate':
          return data.StartDate ?? '';
        case 'endDate':
          return data.EndDate ?? '';
        case 'customer':
          return this.customerLabel(data.CustomerUUID);
        case 'amount':
          return data.Amount ?? 0;
        case 'status':
          return data.Status ?? '';
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Title, data.Status, data.Notes]
        .filter(Boolean)
        .concat(this.customerLabel(data.CustomerUUID))
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
    this.contractsResource.reload();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadComplexes() {
    try {
      const res = await this.api.get<any>('erp/complexes');
      const items = res?.data?.items ?? [];
      const mapped = items.map((item: any) => ({
        ComplexUUID: item.ComplexUUID,
        Name: item.Name,
        Address: item.Address ?? null,
        City: item.City ?? null,
        State: item.State ?? null,
        Zip: item.Zip ?? null,
      }));
      this.complexes = mapped;
      this.complexMap = new Map(mapped.map((c: ErpComplexOption) => [c.ComplexUUID, c]));
    } catch (err) {
      console.error('Failed to load complexes.', err);
    }
  }

  async loadCustomers() {
    try {
      const res = await this.api.get<any>('erp/customers');
      const items = res?.data?.items ?? [];
      const mapped = items.map((item: any) => ({
        CustomerUUID: item.CustomerUUID,
        Name: item.Name,
        DueDayUUID: item.DueDayUUID ?? null,
      }));
      this.customers = mapped;
      this.customerMap = new Map(mapped.map((c: CustomerOption) => [c.CustomerUUID, c]));
    } catch (err) {
      console.error('Failed to load customers.', err);
    }
  }

  startCreate() {
    this.editingContract = null;
    this.form.title = '';
    this.form.startDate = null;
    this.form.endDate = null;
    this.form.amount = 0;
    this.form.status = 'draft';
    this.form.notes = '';
    this.form.billingComplexUUID = '';
    this.form.customerUUID = '';
    this.form.billingStreet = '';
    this.form.billingNumber = '';
    this.form.billingDistrict = '';
    this.form.billingCity = '';
    this.form.billingState = '';
    this.form.billingZip = '';
    this.form.billingCountry = '';
    this.form.installSameAsBilling = false;
    this.form.installStreet = '';
    this.form.installNumber = '';
    this.form.installDistrict = '';
    this.form.installCity = '';
    this.form.installState = '';
    this.form.installZip = '';
    this.form.installCountry = '';
  }

  openCreateDialog() {
    this.startCreate();
    this.openContractDialog();
  }

  startEdit(contract: ErpFinInvContract) {
    this.editingContract = contract;
    this.form.title = contract.Title ?? '';
    this.form.startDate = this.parseDateInput(contract.StartDate);
    this.form.endDate = this.parseDateInput(contract.EndDate);
    this.form.amount = contract.Amount ?? 0;
    this.form.status = contract.Status ?? 'draft';
    this.form.notes = contract.Notes ?? '';
    this.form.billingComplexUUID = contract.BillingComplexUUID ?? '';
    this.form.customerUUID = contract.CustomerUUID ?? '';
    this.form.billingStreet = contract.AddressBillingStreet ?? '';
    this.form.billingNumber = contract.AddressBillingNumber ?? '';
    this.form.billingDistrict = contract.AddressBillingDistrict ?? '';
    this.form.billingCity = contract.AddressBillingCity ?? '';
    this.form.billingState = contract.AddressBillingState ?? '';
    this.form.billingZip = contract.AddressBillingZip ?? '';
    this.form.billingCountry = contract.AddressBillingCountry ?? '';
    this.form.installSameAsBilling = Boolean(contract.InstallSameAsBilling);
    this.form.installStreet = contract.AddressInstallStreet ?? '';
    this.form.installNumber = contract.AddressInstallNumber ?? '';
    this.form.installDistrict = contract.AddressInstallDistrict ?? '';
    this.form.installCity = contract.AddressInstallCity ?? '';
    this.form.installState = contract.AddressInstallState ?? '';
    this.form.installZip = contract.AddressInstallZip ?? '';
    this.form.installCountry = contract.AddressInstallCountry ?? '';
    if (this.form.installSameAsBilling) {
      this.applyInstallSameAsBilling();
    }
  }

  openEditDialog(contract: ErpFinInvContract) {
    this.startEdit(contract);
    this.openContractDialog();
  }

  onBillingComplexChange(value: string) {
    this.form.billingComplexUUID = value ?? '';
    if (!value) return;
    const complex = this.complexMap.get(value);
    if (!complex) return;
    this.form.billingStreet = complex.Address ?? '';
    this.form.billingCity = complex.City ?? '';
    this.form.billingState = complex.State ?? '';
    this.form.billingZip = complex.Zip ?? '';
    if (this.form.installSameAsBilling) {
      this.applyInstallSameAsBilling();
    }
  }

  onInstallSameAsBillingChange(value: boolean) {
    this.form.installSameAsBilling = value;
    if (value) {
      this.applyInstallSameAsBilling();
    }
  }

  private applyInstallSameAsBilling() {
    this.form.installStreet = this.form.billingStreet;
    this.form.installNumber = this.form.billingNumber;
    this.form.installDistrict = this.form.billingDistrict;
    this.form.installCity = this.form.billingCity;
    this.form.installState = this.form.billingState;
    this.form.installZip = this.form.billingZip;
    this.form.installCountry = this.form.billingCountry;
  }

  async saveContract() {
    if (!this.form.title.trim()) {
      this.showWarning('Title is required.');
      return;
    }

    if (!this.form.startDate) {
      this.showWarning('Start date is required.');
      return;
    }

    if (this.form.endDate && this.form.endDate < this.form.startDate) {
      this.showWarning('End date must be on or after start date.');
      return;
    }

    if (!Number.isFinite(Number(this.form.amount)) || Number(this.form.amount) <= 0) {
      this.showWarning('Amount must be greater than zero.');
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      if (this.form.installSameAsBilling) {
        this.applyInstallSameAsBilling();
      }
      const payload = {
        title: this.form.title.trim(),
        startDate: this.formatDateInput(this.form.startDate),
        endDate: this.formatDateInput(this.form.endDate),
        amount: Number(this.form.amount),
        status: this.form.status,
        notes: this.form.notes?.trim() || null,
        billingComplexUUID: this.form.billingComplexUUID || null,
        customerUUID: this.form.customerUUID || null,
        addressBillingStreet: this.form.billingStreet?.trim() || null,
        addressBillingNumber: this.form.billingNumber?.trim() || null,
        addressBillingDistrict: this.form.billingDistrict?.trim() || null,
        addressBillingCity: this.form.billingCity?.trim() || null,
        addressBillingState: this.form.billingState?.trim() || null,
        addressBillingZip: this.form.billingZip?.trim() || null,
        addressBillingCountry: this.form.billingCountry?.trim() || null,
        installSameAsBilling: this.form.installSameAsBilling,
        addressInstallStreet: this.form.installStreet?.trim() || null,
        addressInstallNumber: this.form.installNumber?.trim() || null,
        addressInstallDistrict: this.form.installDistrict?.trim() || null,
        addressInstallCity: this.form.installCity?.trim() || null,
        addressInstallState: this.form.installState?.trim() || null,
        addressInstallZip: this.form.installZip?.trim() || null,
        addressInstallCountry: this.form.installCountry?.trim() || null,
      };

      if (this.editingContract) {
        await this.api.put(
          `erp/financial/invoicing/contracts/${this.editingContract.ErpFinInvContractUUID}`,
          payload,
        );
        this.snack.success('Contract updated successfully.');
      } else {
        await this.api.post('erp/financial/invoicing/contracts', payload);
        this.snack.success('Contract created successfully.');
      }

      this.closeContractDialog();
      this.startCreate();
      this.contractsResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save contract.');
    } finally {
      this.saving = false;
    }
  }

  cancelContractForm() {
    this.closeContractDialog();
    this.startCreate();
  }

  async deleteContract(contractUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete contract',
        message: 'Are you sure you want to delete this contract?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    this.error = '';
    try {
      await this.api.delete(`erp/financial/invoicing/contracts/${contractUUID}`);
      this.snack.success('Contract deleted successfully.');
      this.contractsResource.reload();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete contract.');
    }
  }

  formatAmount(value: number) {
    return Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  statusClass(status?: string) {
    return status ? `is-${status}` : '';
  }

  customerLabel(customerUUID?: string | null) {
    if (!customerUUID) return '-';
    return this.customerMap.get(customerUUID)?.Name ?? '-';
  }

  private parseDateInput(value?: string | null) {
    if (!value) return null;
    const trimmed = value.trim();
    const [datePart] = trimmed.split('T');
    if (!datePart) return null;
    const [year, month, day] = datePart.split('-').map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  private formatDateInput(value: Date | null) {
    if (!value) return null;
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getCurrencyAffixes() {
    const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
    const currency = this.getCurrencyFromLocale(locale);
    const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    const parts = formatter.formatToParts(1.1);
    const currencyPart = parts.find((part) => part.type === 'currency')?.value ?? currency;
    const integerIndex = parts.findIndex((part) => part.type === 'integer');
    const currencyIndex = parts.findIndex((part) => part.type === 'currency');
    let prefix = '';

    if (currencyIndex > -1 && integerIndex > -1 && currencyIndex < integerIndex) {
      const literal = parts[currencyIndex + 1];
      prefix = currencyPart + (literal?.type === 'literal' ? literal.value : ' ');
    } else if (currencyIndex > -1) {
      prefix = `${currencyPart} `;
    } else if (currencyPart) {
      prefix = `${currencyPart} `;
    }

    return { prefix };
  }

  private getCurrencyFromLocale(locale: string) {
    let region = '';
    try {
      region = new Intl.Locale(locale).region ?? '';
    } catch {
      region = '';
    }
    const map: Record<string, string> = {
      BR: 'BRL',
      US: 'USD',
      PT: 'EUR',
      ES: 'EUR',
      FR: 'EUR',
      DE: 'EUR',
      IT: 'EUR',
      NL: 'EUR',
      BE: 'EUR',
      IE: 'EUR',
      AT: 'EUR',
      FI: 'EUR',
      GR: 'EUR',
      LU: 'EUR',
      LT: 'EUR',
      LV: 'EUR',
      EE: 'EUR',
      SK: 'EUR',
      SI: 'EUR',
      CY: 'EUR',
      MT: 'EUR',
      GB: 'GBP',
      MX: 'MXN',
      AR: 'ARS',
      CL: 'CLP',
      CO: 'COP',
      PE: 'PEN',
      UY: 'UYU',
      PY: 'PYG',
      CA: 'CAD',
      AU: 'AUD',
      NZ: 'NZD',
      JP: 'JPY',
    };
    return map[region] ?? 'USD';
  }

  private openContractDialog() {
    const contractFormDialog = this.contractFormDialog();
    if (!contractFormDialog || this.contractFormDialogRef) return;
    this.error = '';
    this.contractFormDialogRef = this.dialog.open(contractFormDialog, {
      ...this.getContractDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-contract-form-dialog',
    });
    this.contractFormDialogRef
      .keydownEvents()
      .pipe(takeUntil(this.contractFormDialogRef.afterClosed()))
      .subscribe((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          this.cancelContractForm();
        }
      });
    this.startDialogViewportObserver();
    this.contractFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.contractFormDialogRef = null;
    });
  }

  private closeContractDialog() {
    if (!this.contractFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.contractFormDialogRef.close();
    this.contractFormDialogRef = null;
  }

  private getContractDialogViewportConfig() {
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
    if (!this.contractFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateContractDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateContractDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateContractDialogViewport() {
    if (!this.contractFormDialogRef) return;
    const config = this.getContractDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const maxHeight = typeof config.maxHeight === 'string' ? config.maxHeight : '';
    this.contractFormDialogRef.updateSize(width, maxHeight);
    if (config.position) {
      this.contractFormDialogRef.updatePosition(config.position);
    } else {
      this.contractFormDialogRef.updatePosition();
    }
  }
  private showError(message: string) {
    this.error = '';
    this.snack.error(message);
  }

  private extractErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }

  private showWarning(message: string) {
    this.error = '';
    this.snack.warning(message);
  }
}
