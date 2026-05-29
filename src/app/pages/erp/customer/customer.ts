import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { PhoneInputComponent } from '../../../shared/phone-input/phone-input.component';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

type Customer = {
  CustomerUUID: string;
  ComplexUUID?: string | null;
  DueDayUUID?: string | null;
  Type: 'company' | 'person';
  Name: string;
  Document?: string | null;
  Email?: string | null;
  Phone?: string | null;
  AddressMainStreet?: string | null;
  AddressMainNumber?: string | null;
  AddressMainDistrict?: string | null;
  AddressMainCity?: string | null;
  AddressMainState?: string | null;
  AddressMainZip?: string | null;
  AddressMainCountry?: string | null;
  AddressBillingStreet?: string | null;
  AddressBillingNumber?: string | null;
  AddressBillingDistrict?: string | null;
  AddressBillingCity?: string | null;
  AddressBillingState?: string | null;
  AddressBillingZip?: string | null;
  AddressBillingCountry?: string | null;
  AddressInstallStreet?: string | null;
  AddressInstallNumber?: string | null;
  AddressInstallDistrict?: string | null;
  AddressInstallCity?: string | null;
  AddressInstallState?: string | null;
  AddressInstallZip?: string | null;
  AddressInstallCountry?: string | null;
  Lat?: number | null;
  Lng?: number | null;
  Status: number;
  Notes?: string | null;
};

type ErpComplexOption = {
  ComplexUUID: string;
  Name: string;
  Address?: string | null;
  City?: string | null;
  State?: string | null;
  Zip?: string | null;
};

type DueDayOption = {
  ErpFinInvDueDayUUID: string;
  Name: string;
  DueDay: number;
  BillingDay: number;
  ClosedMonth: boolean;
  Status: 'active' | 'inactive';
};

type PostalCodeLookupItem = {
  street?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
};

type GeoMapStyleMode = 'street' | 'satellite';

const GEO_MAP_STYLE_URLS: Record<GeoMapStyleMode, string> = {
  street: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

const STREET_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M20.5 3l-5.5 2-6-2-5.5 2v16l5.5-2 6 2 5.5-2V3zm-11.5 2.38l4 1.33v11.91l-4-1.33V5.38zm-4 1.29l2-.73v11.91l-2 .73V6.67zm14 11.66l-2 .73V6.77l2-.73v11.56z"></path>
    </svg>
`;

const SATELLITE_ICON = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c.9 0 1.76.13 2.58.37-.5.78-1.16 1.5-1.96 2.12-.47-.39-1.02-.7-1.62-.91V4zm-2.58.37c.82-.24 1.68-.37 2.58-.37v1.58c-.6.21-1.15.52-1.62.91-.8-.62-1.46-1.34-1.96-2.12zM4 12c0-1.64.49-3.17 1.33-4.44.8.72 1.72 1.31 2.74 1.74-.21.86-.31 1.78-.31 2.7s.1 1.84.31 2.7c-1.02.43-1.94 1.02-2.74 1.74C4.49 15.17 4 13.64 4 12zm6 7.63c-1.02-.43-1.94-1.02-2.74-1.74.5-.78 1.16-1.5 1.96-2.12.47.39 1.02.7 1.62.91v2.95zm2 0v-2.95c.6-.21 1.15-.52 1.62-.91.8.62 1.46 1.34 1.96 2.12-0.8.72-1.72 1.31-2.74 1.74zM14.6 12c0-.92-.1-1.84-.31-2.7 1.02-.43 1.94-1.02 2.74-1.74C19.51 8.83 20 10.36 20 12s-.49 3.17-1.33 4.44c-.8-.72-1.72-1.31-2.74-1.74.21-.86.31-1.78.31-2.7z"></path>
    </svg>
`;

class GeoMapStyleControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private readonly handleClick = () => {
    this.options.onToggle();
    this.update();
  };

  constructor(
    private readonly options: {
      getNextMode: () => GeoMapStyleMode;
      onToggle: () => void;
    },
  ) {}

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group geomap-style-control';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'mapboxgl-ctrl-icon geomap-style-toggle';
    this.button.addEventListener('click', this.handleClick);

    this.container.appendChild(this.button);
    this.update();
    return this.container;
  }

  onRemove() {
    if (this.button) {
      this.button.removeEventListener('click', this.handleClick);
    }
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.button = undefined;
  }

  update() {
    if (!this.button) return;
    const nextMode = this.options.getNextMode();
    const nextLabel =
      nextMode === 'satellite' ? 'Switch to satellite view' : 'Switch to streets view';
    this.button.setAttribute('aria-label', nextLabel);
    this.button.setAttribute('title', nextLabel);
    this.button.dataset['next'] = nextMode;
    this.button.innerHTML = nextMode === 'satellite' ? SATELLITE_ICON : STREET_ICON;
  }
}

@Component({
  selector: 'app-erp-customer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    MatCheckboxModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
    MatMenuModule,
    PhoneInputComponent,
  ],
  templateUrl: './customer.html',
  styleUrls: ['./customer.scss'],
})
export class ErpCustomerPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly listLimit = 200;
  private api = inject(ApiService);
  private snack = inject(SnackbarService);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);
  private map: any;
  private mapMarker: any;
  private mapboxgl?: any;
  private mapboxToken: string | null = null;
  private styleControl?: GeoMapStyleControl;
  private mapStyle: GeoMapStyleMode = 'street';
  customers: Customer[] = [];
  complexes: ErpComplexOption[] = [];
  complexMap = new Map<string, ErpComplexOption>();
  dueDays: DueDayOption[] = [];
  dueDayMap = new Map<string, DueDayOption>();
  dataSource = new MatTableDataSource<Customer>([]);
  displayedColumns: string[] = [
    'select',
    'name',
    'complex',
    'dueDay',
    'type',
    'document',
    'email',
    'status',
    'actions',
  ];
  selectedCustomerUUIDs = new Set<string>();
  loading = true;
  saving = false;
  searchingMainPostalCode = false;
  searchingBillingPostalCode = false;
  searchingInstallPostalCode = false;
  error = '';
  search = '';
  searchInput = '';
  editingCustomer: Customer | null = null;
  mapVisible = false;
  readonly emailControl = new FormControl('', [Validators.email]);
  readonly emailError = signal('');
  complexSearch = '';
  dueDaySearch = '';

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('customerFormDialog') customerFormDialog?: TemplateRef<unknown>;
  @ViewChild('mainAddressNumberInput') mainAddressNumberInput?: ElementRef<HTMLInputElement>;
  @ViewChild('billingAddressNumberInput') billingAddressNumberInput?: ElementRef<HTMLInputElement>;
  @ViewChild('installAddressNumberInput') installAddressNumberInput?: ElementRef<HTMLInputElement>;
  private customerFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogViewportObserver: ResizeObserver | null = null;

  form = {
    complexUUID: '',
    dueDayUUID: '',
    type: 'company' as 'company' | 'person',
    name: '',
    document: '',
    email: '',
    phone: '',
    addressMainStreet: '',
    addressMainNumber: '',
    addressMainDistrict: '',
    addressMainCity: '',
    addressMainState: '',
    addressMainZip: '',
    addressMainCountry: '',
    addressBillingStreet: '',
    addressBillingNumber: '',
    addressBillingDistrict: '',
    addressBillingCity: '',
    addressBillingState: '',
    addressBillingZip: '',
    addressBillingCountry: '',
    addressInstallStreet: '',
    addressInstallNumber: '',
    addressInstallDistrict: '',
    addressInstallCity: '',
    addressInstallState: '',
    addressInstallZip: '',
    addressInstallCountry: '',
    lat: null as number | null,
    lng: null as number | null,
    notes: '',
    status: 1,
  };

  billingSameAsMain = false;
  installSameAsMain = false;

  constructor() {
    merge(this.emailControl.statusChanges, this.emailControl.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateEmailError());
  }

  ngOnInit() {
    this.resetForm();
    void this.loadComplexes();
    void this.loadDueDays();
    void this.loadMapboxParameter();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.Name ?? '';
        case 'complex':
          return this.complexLabel(data.ComplexUUID);
        case 'dueDay':
          return this.dueDayLabel(data.DueDayUUID);
        case 'type':
          return data.Type ?? '';
        case 'document':
          return data.Document ?? '';
        case 'email':
          return data.Email ?? '';
        case 'status':
          return data.Status ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      return [data.Name, data.Document, data.Email, data.Phone]
        .filter(Boolean)
        .concat([this.complexLabel(data.ComplexUUID), this.dueDayLabel(data.DueDayUUID)])
        .some((field) => String(field).toLowerCase().includes(value));
    };

    setTimeout(() => {
      void this.loadCustomers();
    }, 0);
  }

  ngOnDestroy() {
    this.closeCustomerDialog();
    if (this.map) {
      this.map.remove();
    }
  }

  onSearchChange(value: string) {
    this.searchInput = value;
  }

  applySearchFilters() {
    this.search = this.searchInput.trim();
    void this.loadCustomers();
  }

  clearSearchFilters() {
    this.searchInput = '';
    this.search = '';
    void this.loadCustomers();
  }

  refreshList() {
    void this.loadCustomers();
  }

  applyFilter() {
    const q = this.search.trim().toLowerCase();
    this.dataSource.filter = q;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  async loadCustomers() {
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.loading = true;
    this.cdr.detectChanges();
    this.error = '';
    const start = performance.now();
    try {
      const params = new URLSearchParams();
      params.set('limit', String(this.listLimit));
      if (this.search) params.set('q', this.search);
      const res = await this.api.get<any>(`erp/customers?${params.toString()}`);
      this.customers = res?.data?.items ?? [];
      this.dataSource.data = [...this.customers];
      this.reconcileSelection();
      this.applyFilter();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to load customers.');
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

  async loadComplexes() {
    try {
      const res = await this.api.get<any>('erp/complexes');
      const items = res?.data?.items ?? [];
      setTimeout(() => {
        this.complexes = items;
        this.complexMap = new Map(items.map((item: ErpComplexOption) => [item.ComplexUUID, item]));
        this.cdr.detectChanges();
      }, 0);
    } catch (err) {
      console.error('Failed to load complexes.', err);
    }
  }

  async loadDueDays() {
    try {
      const res = await this.api.get<any>('erp/financial/invoicing/duedays');
      const items = (res?.data?.items ?? []).filter(
        (item: DueDayOption) => item?.Status === 'active',
      );
      setTimeout(() => {
        this.dueDays = items;
        this.dueDayMap = new Map(
          items.map((item: DueDayOption) => [item.ErpFinInvDueDayUUID, item]),
        );
        this.cdr.detectChanges();
      }, 0);
    } catch (err) {
      console.error('Failed to load due days.', err);
    }
  }

  startCreate() {
    this.resetForm();
    this.openCustomerDialog();
  }

  private resetForm() {
    this.editingCustomer = null;
    this.form.complexUUID = '';
    this.form.dueDayUUID = '';
    this.form.type = 'company';
    this.form.name = '';
    this.form.document = '';
    this.emailControl.setValue('', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = '';
    this.form.addressMainStreet = '';
    this.form.addressMainNumber = '';
    this.form.addressMainDistrict = '';
    this.form.addressMainCity = '';
    this.form.addressMainState = '';
    this.form.addressMainZip = '';
    this.form.addressMainCountry = '';
    this.form.addressBillingStreet = '';
    this.form.addressBillingNumber = '';
    this.form.addressBillingDistrict = '';
    this.form.addressBillingCity = '';
    this.form.addressBillingState = '';
    this.form.addressBillingZip = '';
    this.form.addressBillingCountry = '';
    this.form.addressInstallStreet = '';
    this.form.addressInstallNumber = '';
    this.form.addressInstallDistrict = '';
    this.form.addressInstallCity = '';
    this.form.addressInstallState = '';
    this.form.addressInstallZip = '';
    this.form.addressInstallCountry = '';
    this.form.lat = null;
    this.form.lng = null;
    this.form.notes = '';
    this.form.status = 1;
    this.billingSameAsMain = false;
    this.installSameAsMain = false;
    this.mapVisible = false;
    this.teardownMap();
    this.updateMapMarker();
  }

  startEdit(customer: Customer) {
    this.editingCustomer = customer;
    this.form.complexUUID = customer.ComplexUUID ?? '';
    this.form.dueDayUUID = customer.DueDayUUID ?? '';
    this.form.type = customer.Type;
    this.form.name = customer.Name ?? '';
    this.form.document = customer.Document ?? '';
    this.emailControl.setValue(customer.Email ?? '', { emitEvent: false });
    this.updateEmailError();
    this.form.phone = customer.Phone ?? '';
    this.form.addressMainStreet = customer.AddressMainStreet ?? '';
    this.form.addressMainNumber = customer.AddressMainNumber ?? '';
    this.form.addressMainDistrict = customer.AddressMainDistrict ?? '';
    this.form.addressMainCity = customer.AddressMainCity ?? '';
    this.form.addressMainState = customer.AddressMainState ?? '';
    this.form.addressMainZip = customer.AddressMainZip ?? '';
    this.form.addressMainCountry = customer.AddressMainCountry ?? '';
    this.form.addressBillingStreet = customer.AddressBillingStreet ?? '';
    this.form.addressBillingNumber = customer.AddressBillingNumber ?? '';
    this.form.addressBillingDistrict = customer.AddressBillingDistrict ?? '';
    this.form.addressBillingCity = customer.AddressBillingCity ?? '';
    this.form.addressBillingState = customer.AddressBillingState ?? '';
    this.form.addressBillingZip = customer.AddressBillingZip ?? '';
    this.form.addressBillingCountry = customer.AddressBillingCountry ?? '';
    this.form.addressInstallStreet = customer.AddressInstallStreet ?? '';
    this.form.addressInstallNumber = customer.AddressInstallNumber ?? '';
    this.form.addressInstallDistrict = customer.AddressInstallDistrict ?? '';
    this.form.addressInstallCity = customer.AddressInstallCity ?? '';
    this.form.addressInstallState = customer.AddressInstallState ?? '';
    this.form.addressInstallZip = customer.AddressInstallZip ?? '';
    this.form.addressInstallCountry = customer.AddressInstallCountry ?? '';
    this.form.lat = customer.Lat ?? null;
    this.form.lng = customer.Lng ?? null;
    this.form.notes = customer.Notes ?? '';
    this.form.status = customer.Status ?? 1;
    this.billingSameAsMain = false;
    this.installSameAsMain = false;
    this.mapVisible = false;
    this.teardownMap();
    this.updateMapMarker();
    this.openCustomerDialog();
  }

  async saveCustomer(createAnother = false) {
    if (this.saving) return;

    if (!this.form.name.trim()) {
      this.showWarning('Name is required.');
      return;
    }

    if (this.emailControl.value && this.emailControl.invalid) {
      this.showWarning('Email is invalid.');
      return;
    }

    if (this.form.phone && !/^\d{8,15}$/.test(this.form.phone)) {
      this.showWarning('Phone must contain 8 to 15 digits.');
      return;
    }

    this.saving = true;
    this.error = '';

    try {
      const isCreateMode = !this.editingCustomer;
      const payload = {
        complexUUID: this.form.complexUUID || null,
        dueDayUUID: this.form.dueDayUUID || null,
        type: this.form.type,
        name: this.form.name.trim(),
        document: this.form.document?.trim() || null,
        email: this.emailControl.value?.trim() || null,
        phone: this.form.phone?.trim() || null,
        addressMainStreet: this.form.addressMainStreet?.trim() || null,
        addressMainNumber: this.form.addressMainNumber?.trim() || null,
        addressMainDistrict: this.form.addressMainDistrict?.trim() || null,
        addressMainCity: this.form.addressMainCity?.trim() || null,
        addressMainState: this.form.addressMainState?.trim() || null,
        addressMainZip: this.form.addressMainZip?.trim() || null,
        addressMainCountry: this.form.addressMainCountry?.trim() || null,
        addressBillingStreet: this.form.addressBillingStreet?.trim() || null,
        addressBillingNumber: this.form.addressBillingNumber?.trim() || null,
        addressBillingDistrict: this.form.addressBillingDistrict?.trim() || null,
        addressBillingCity: this.form.addressBillingCity?.trim() || null,
        addressBillingState: this.form.addressBillingState?.trim() || null,
        addressBillingZip: this.form.addressBillingZip?.trim() || null,
        addressBillingCountry: this.form.addressBillingCountry?.trim() || null,
        addressInstallStreet: this.form.addressInstallStreet?.trim() || null,
        addressInstallNumber: this.form.addressInstallNumber?.trim() || null,
        addressInstallDistrict: this.form.addressInstallDistrict?.trim() || null,
        addressInstallCity: this.form.addressInstallCity?.trim() || null,
        addressInstallState: this.form.addressInstallState?.trim() || null,
        addressInstallZip: this.form.addressInstallZip?.trim() || null,
        addressInstallCountry: this.form.addressInstallCountry?.trim() || null,
        lat: this.form.lat ?? null,
        lng: this.form.lng ?? null,
        notes: this.form.notes?.trim() || null,
        status: this.form.status,
      };

      if (this.editingCustomer) {
        await this.api.put(`erp/customers/${this.editingCustomer.CustomerUUID}`, payload);
        this.snack.success('Customer updated successfully.');
      } else {
        await this.api.post('erp/customers', payload);
        this.snack.success('Customer created successfully.');
      }

      await this.loadCustomers();
      if (createAnother && isCreateMode) {
        this.resetForm();
        this.openCustomerDialog();
        return;
      }
      this.closeCustomerDialog();
      this.resetForm();
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to save customer.');
    } finally {
      this.saving = false;
    }
  }

  saveAndNewCustomer() {
    void this.saveCustomer(true);
  }

  async searchMainPostalCode() {
    await this.searchPostalCodeBySection('main');
  }

  async searchBillingPostalCode() {
    if (this.billingSameAsMain) return;
    await this.searchPostalCodeBySection('billing');
  }

  async searchInstallPostalCode() {
    if (this.installSameAsMain) return;
    await this.searchPostalCodeBySection('install');
  }

  cancelCustomerForm() {
    this.closeCustomerDialog();
    this.resetForm();
  }

  private openCustomerDialog() {
    if (!this.customerFormDialog) return;
    if (this.customerFormDialogRef) {
      return;
    }
    this.error = '';
    this.customerFormDialogRef = this.dialog.open(this.customerFormDialog, {
      ...this.getCustomerDialogViewportConfig(),
      disableClose: true,
      autoFocus: false,
      restoreFocus: true,
      panelClass: 'erp-customer-form-dialog',
    });
    this.customerFormDialogRef.keydownEvents().subscribe((event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeCustomerDialog();
      }
    });
    this.startDialogViewportObserver();
    this.customerFormDialogRef.afterClosed().subscribe(() => {
      this.stopDialogViewportObserver();
      this.customerFormDialogRef = null;
      this.mapVisible = false;
      this.teardownMap();
    });
  }

  private closeCustomerDialog() {
    if (!this.customerFormDialogRef) return;
    this.stopDialogViewportObserver();
    this.customerFormDialogRef.close();
    this.customerFormDialogRef = null;
    this.mapVisible = false;
    this.teardownMap();
  }

  private getCustomerDialogViewportConfig() {
    if (window.innerWidth <= 900) {
      return {
        width: 'calc(100vw - 24px)',
        maxWidth: 'calc(100vw - 24px)',
        height: 'calc(100dvh - 24px)',
        maxHeight: 'calc(100dvh - 24px)',
        position: {
          left: '12px',
          top: '12px',
        },
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
    if (!this.customerFormDialogRef) return;

    const pageContent = document.querySelector('.page-content') as HTMLElement | null;
    if (!pageContent) return;

    this.dialogViewportObserver = new ResizeObserver(() => {
      this.updateCustomerDialogViewport();
    });
    this.dialogViewportObserver.observe(pageContent);
    this.updateCustomerDialogViewport();
  }

  private stopDialogViewportObserver() {
    if (!this.dialogViewportObserver) return;
    this.dialogViewportObserver.disconnect();
    this.dialogViewportObserver = null;
  }

  private updateCustomerDialogViewport() {
    if (!this.customerFormDialogRef) return;
    const config = this.getCustomerDialogViewportConfig();
    const width = typeof config.width === 'string' ? config.width : '';
    const height =
      typeof config.height === 'string'
        ? config.height
        : typeof config.maxHeight === 'string'
          ? config.maxHeight
          : '';
    this.customerFormDialogRef.updateSize(width, height);
    if (config.position) {
      this.customerFormDialogRef.updatePosition(config.position);
    } else {
      this.customerFormDialogRef.updatePosition();
    }
  }

  async deleteCustomer(customerUUID: string) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete customer',
        message: 'Are you sure you want to delete this customer?',
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
      await this.api.delete(`erp/customers/${customerUUID}`);
      this.selectedCustomerUUIDs.delete(customerUUID);
      await this.loadCustomers();
      this.snack.success('Customer deleted successfully.');
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete customer.');
    } finally {
      this.loading = false;
    }
  }

  get selectedCount() {
    return this.selectedCustomerUUIDs.size;
  }

  visibleRows() {
    const filtered = this.dataSource.filter ? this.dataSource.filteredData : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return filtered;
    const start = paginator.pageIndex * paginator.pageSize;
    return filtered.slice(start, start + paginator.pageSize);
  }

  isSelected(customer: Customer) {
    return this.selectedCustomerUUIDs.has(customer.CustomerUUID);
  }

  isAllVisibleSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.isSelected(row));
  }

  isSomeVisibleSelected() {
    const rows = this.visibleRows();
    return rows.some((row) => this.isSelected(row)) && !this.isAllVisibleSelected();
  }

  toggleCustomerSelection(customer: Customer, checked: boolean) {
    if (checked) {
      this.selectedCustomerUUIDs.add(customer.CustomerUUID);
    } else {
      this.selectedCustomerUUIDs.delete(customer.CustomerUUID);
    }
  }

  toggleVisibleSelection(checked: boolean) {
    this.visibleRows().forEach((row) => this.toggleCustomerSelection(row, checked));
  }

  async removeSelectedCustomers() {
    const ids = Array.from(this.selectedCustomerUUIDs);
    if (!ids.length) return;

    const labels = this.dataSource.data
      .filter((row) => this.selectedCustomerUUIDs.has(row.CustomerUUID))
      .slice(0, 3)
      .map((row) => row.Name)
      .filter(Boolean);
    const detail = labels.length
      ? ` Selected: ${labels.join(', ')}${ids.length > 3 ? ', ...' : ''}`
      : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected customers',
        message: `Are you sure you want to delete ${ids.length} selected customer(s)?${detail}`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.loading = true;
    this.error = '';
    try {
      const response = await this.api.delete<any>('erp/customers/bulk', { ids });
      const deleted = new Set<string>(response?.data?.deleted ?? []);
      const failed = new Set<string>(
        (response?.data?.failed ?? []).map((item: any) => item.CustomerUUID),
      );
      this.dataSource.data = this.dataSource.data.filter((row) => !deleted.has(row.CustomerUUID));
      this.customers = this.customers.filter((row) => !deleted.has(row.CustomerUUID));
      this.selectedCustomerUUIDs.clear();
      failed.forEach((uuid) => this.selectedCustomerUUIDs.add(uuid));
      await this.loadCustomers();
      if (failed.size) {
        this.showError(`${failed.size} selected customer(s) could not be deleted.`);
      } else {
        this.snack.success(`${deleted.size || ids.length} customer(s) deleted.`);
      }
    } catch (err: any) {
      this.showError(err?.message ?? 'Failed to delete selected customers.');
    } finally {
      this.loading = false;
    }
  }

  private reconcileSelection() {
    const validIds = new Set(this.dataSource.data.map((row) => row.CustomerUUID));
    Array.from(this.selectedCustomerUUIDs).forEach((uuid) => {
      if (!validIds.has(uuid)) this.selectedCustomerUUIDs.delete(uuid);
    });
  }

  onMainAddressChange() {
    if (this.billingSameAsMain) {
      this.copyMainToBilling();
    }
    if (this.installSameAsMain) {
      this.copyMainToInstall();
    }
  }

  onComplexChange(value: string) {
    this.form.complexUUID = value ?? '';
    if (!value) return;
    const complex = this.complexMap.get(value);
    if (!complex) return;
    this.form.addressMainStreet = complex.Address ?? '';
    this.form.addressMainNumber = '';
    this.form.addressMainDistrict = '';
    this.form.addressMainCity = complex.City ?? '';
    this.form.addressMainState = complex.State ?? '';
    this.form.addressMainZip = complex.Zip ?? '';
    this.form.addressMainCountry = '';
    this.onMainAddressChange();
  }

  complexLabel(uuid: string | null | undefined) {
    if (!uuid) return '-';
    return this.complexMap.get(uuid)?.Name ?? '-';
  }

  dueDayLabel(uuid: string | null | undefined) {
    if (!uuid) return '-';
    const item = this.dueDayMap.get(uuid);
    if (!item) return '-';
    const closedMonthLabel = item.ClosedMonth ? 'closed' : 'open';
    return `${item.Name} - Due ${item.DueDay} / Bill ${item.BillingDay} (${closedMonthLabel})`;
  }

  onComplexOpened(opened: boolean) {
    if (!opened) {
      this.complexSearch = '';
    }
  }

  get filteredComplexes() {
    const value = this.complexSearch.trim().toLowerCase();
    if (!value) return this.complexes;
    return this.complexes.filter((complex) => (complex.Name ?? '').toLowerCase().includes(value));
  }

  onDueDayOpened(opened: boolean) {
    if (!opened) {
      this.dueDaySearch = '';
    }
  }

  get filteredDueDays() {
    const value = this.dueDaySearch.trim().toLowerCase();
    if (!value) return this.dueDays;
    return this.dueDays.filter(
      (item) =>
        (item.Name ?? '').toLowerCase().includes(value) ||
        String(item.DueDay).includes(value) ||
        String(item.BillingDay).includes(value) ||
        (item.ClosedMonth ? 'closed' : 'open').includes(value),
    );
  }

  toggleBillingSameAsMain(value: boolean) {
    this.billingSameAsMain = value;
    if (value) {
      this.copyMainToBilling();
    }
  }

  toggleInstallSameAsMain(value: boolean) {
    this.installSameAsMain = value;
    if (value) {
      this.copyMainToInstall();
    }
  }

  onLatLngChange() {
    this.updateMapMarker();
  }

  async copyCoordinates() {
    const latValue = typeof this.form.lat === 'number' ? this.form.lat : Number(this.form.lat);
    const lngValue = typeof this.form.lng === 'number' ? this.form.lng : Number(this.form.lng);
    if (!Number.isFinite(latValue) || !Number.isFinite(lngValue)) {
      this.showWarning('Coordinates are required to copy.');
      return;
    }
    const text = `${latValue.toFixed(6)}, ${lngValue.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      this.showError('Failed to copy coordinates.');
    }
  }

  toggleMap() {
    if (this.mapVisible) {
      this.mapVisible = false;
      this.teardownMap();
      return;
    }

    this.mapVisible = true;
    if (!this.hasValidCoordinates()) {
      this.fallbackToBrasilia();
    }
    this.requestUserLocation();
    setTimeout(() => {
      void this.initMap();
    }, 0);
  }

  private updateEmailError() {
    if (this.emailControl.hasError('email')) {
      this.emailError.set('Not a valid email');
    } else {
      this.emailError.set('');
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

  private async loadMapboxParameter() {
    const endpoints = [
      'settings/parameters/resolve/MAPBOX_TOKEN',
      'system/parameters/resolve/MAPBOX_TOKEN',
    ];

    this.mapboxToken = null;
    for (const endpoint of endpoints) {
      try {
        const response = await this.api.get<any>(endpoint);
        const row = Array.isArray(response)
          ? response[0]
          : Array.isArray(response?.data?.items)
            ? response.data.items[0]
            : null;
        const token = typeof row?.SprValue === 'string' ? row.SprValue.trim() : '';
        if (token) {
          this.mapboxToken = token;
          return;
        }
      } catch {
        // Try next endpoint.
      }
    }
  }

  private async getMapboxToken(): Promise<string | null> {
    if (this.mapboxToken && this.mapboxToken.trim()) {
      return this.mapboxToken.trim();
    }
    await this.loadMapboxParameter();
    return this.mapboxToken && this.mapboxToken.trim() ? this.mapboxToken.trim() : null;
  }

  private async initMap() {
    if (this.map) {
      this.map.resize?.();
      this.updateMapMarker();
      if (!this.hasValidCoordinates()) {
        this.fallbackToBrasilia();
        this.updateMapMarker();
        this.map.setCenter([this.form.lng as number, this.form.lat as number]);
        this.map.setZoom(Math.max(this.map.getZoom?.() ?? 12, 12));
      }
      return;
    }

    const token = await this.getMapboxToken();
    if (!token) {
      this.showError('Mapbox token missing in system parameters (MAPBOX_TOKEN).');
      this.cdr.detectChanges();
      return;
    }
    this.error = '';

    const mapboxgl = (await import('mapbox-gl')).default;
    mapboxgl.accessToken = token;
    this.mapboxgl = mapboxgl;

    const latValue = typeof this.form.lat === 'number' ? this.form.lat : Number(this.form.lat);
    const lngValue = typeof this.form.lng === 'number' ? this.form.lng : Number(this.form.lng);
    const defaultLat = Number.isFinite(latValue) ? latValue : -15.793889;
    const defaultLng = Number.isFinite(lngValue) ? lngValue : -47.882778;

    this.map = new mapboxgl.Map({
      container: 'erp-customer-map',
      style: GEO_MAP_STYLE_URLS.street,
      center: [defaultLng, defaultLat],
      zoom: 14,
      attributionControl: false,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    this.map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    this.styleControl = new GeoMapStyleControl({
      getNextMode: () => (this.mapStyle === 'street' ? 'satellite' : 'street'),
      onToggle: () => this.toggleMapStyle(),
    });
    this.map.addControl(this.styleControl, 'top-right');

    this.map.on('click', (event: any) => {
      const { lat, lng } = event.lngLat ?? {};
      if (lat === undefined || lng === undefined) return;
      this.form.lat = Number(lat.toFixed(6));
      this.form.lng = Number(lng.toFixed(6));
      this.updateMapMarker();
      this.cdr.detectChanges();
    });

    this.updateMapMarker();

    this.scheduleMapResize();
    this.map.on('style.load', () => this.scheduleMapResize());

    if (!this.hasValidCoordinates()) {
      this.requestUserLocation();
    }
  }

  private toggleMapStyle() {
    if (!this.map) return;
    this.mapStyle = this.mapStyle === 'street' ? 'satellite' : 'street';
    this.map.setStyle(GEO_MAP_STYLE_URLS[this.mapStyle], { diff: false });
  }

  private hasValidCoordinates() {
    const latRaw = this.form.lat;
    const lngRaw = this.form.lng;
    if (latRaw === null || lngRaw === null) {
      return false;
    }
    const latValue = typeof latRaw === 'number' ? latRaw : Number(latRaw);
    const lngValue = typeof lngRaw === 'number' ? lngRaw : Number(lngRaw);
    return Number.isFinite(latValue) && Number.isFinite(lngValue);
  }

  private requestUserLocation() {
    if (!('geolocation' in navigator)) {
      this.showWarning('Geolocation is not available in this browser.');
      this.cdr.detectChanges();
      this.fallbackToBrasilia();
      return;
    }

    if (!window.isSecureContext) {
      this.showWarning('Geolocation requires HTTPS.');
      this.cdr.detectChanges();
      this.fallbackToBrasilia();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.form.lat = Number(latitude.toFixed(6));
        this.form.lng = Number(longitude.toFixed(6));
        this.updateMapMarker();
        if (this.map) {
          this.map.setCenter([this.form.lng, this.form.lat]);
          this.map.setZoom(Math.max(this.map.getZoom?.() ?? 14, 14));
        }
        this.error = '';
        this.cdr.detectChanges();
      },
      (err) => {
        if (err?.code === 1) {
          this.showWarning('Location permission was denied.');
        } else if (err?.code === 2) {
          this.showError('Unable to determine location.');
        } else if (err?.code === 3) {
          this.showError('Location request timed out.');
        } else {
          this.showError('Failed to retrieve location.');
        }
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }

  private fallbackToBrasilia() {
    const lat = -15.793889;
    const lng = -47.882778;
    this.form.lat = Number(lat.toFixed(6));
    this.form.lng = Number(lng.toFixed(6));
    this.updateMapMarker();
    if (this.map) {
      this.map.setCenter([this.form.lng, this.form.lat]);
      this.map.setZoom(Math.max(this.map.getZoom?.() ?? 12, 12));
    }
    this.cdr.detectChanges();
  }

  private scheduleMapResize() {
    if (!this.map) return;
    setTimeout(() => {
      this.map?.resize?.();
      this.updateMapMarker();
    }, 0);
    setTimeout(() => {
      this.map?.resize?.();
      this.updateMapMarker();
    }, 200);
  }

  private updateMapMarker() {
    if (!this.map || !this.mapboxgl) return;

    const lat = this.form.lat;
    const lng = this.form.lng;
    if (lat === null || lng === null) {
      if (this.mapMarker) {
        this.mapMarker.remove();
        this.mapMarker = null;
      }
      return;
    }

    const latValue = typeof lat === 'number' ? lat : Number(lat);
    const lngValue = typeof lng === 'number' ? lng : Number(lng);

    if (Number.isFinite(latValue) && Number.isFinite(lngValue)) {
      const coords = [lngValue, latValue] as [number, number];
      if (!this.mapMarker) {
        const markerElement = document.createElement('div');
        markerElement.className = 'geomap-pin';
        markerElement.innerHTML = '<span class=\"geomap-pin-inner\"></span>';
        this.mapMarker = new this.mapboxgl.Marker({ element: markerElement, draggable: true })
          .setLngLat(coords)
          .addTo(this.map);
        this.mapMarker.on('dragend', () => {
          const pos = this.mapMarker.getLngLat();
          this.form.lat = Number(pos.lat.toFixed(6));
          this.form.lng = Number(pos.lng.toFixed(6));
          this.cdr.detectChanges();
        });
      } else {
        this.mapMarker.setLngLat(coords);
      }
      this.map.setCenter(coords);
      this.map.setZoom(Math.max(this.map.getZoom?.() ?? 14, 14));
    } else if (this.mapMarker) {
      this.mapMarker.remove();
      this.mapMarker = null;
    }
  }

  private teardownMap() {
    if (this.mapMarker) {
      this.mapMarker.remove();
    }
    if (this.map) {
      this.map.remove();
    }
    this.map = null;
    this.mapMarker = null;
  }

  private copyMainToBilling() {
    this.form.addressBillingStreet = this.form.addressMainStreet;
    this.form.addressBillingNumber = this.form.addressMainNumber;
    this.form.addressBillingDistrict = this.form.addressMainDistrict;
    this.form.addressBillingCity = this.form.addressMainCity;
    this.form.addressBillingState = this.form.addressMainState;
    this.form.addressBillingZip = this.form.addressMainZip;
    this.form.addressBillingCountry = this.form.addressMainCountry;
  }

  private copyMainToInstall() {
    this.form.addressInstallStreet = this.form.addressMainStreet;
    this.form.addressInstallNumber = this.form.addressMainNumber;
    this.form.addressInstallDistrict = this.form.addressMainDistrict;
    this.form.addressInstallCity = this.form.addressMainCity;
    this.form.addressInstallState = this.form.addressMainState;
    this.form.addressInstallZip = this.form.addressMainZip;
    this.form.addressInstallCountry = this.form.addressMainCountry;
  }

  private async searchPostalCodeBySection(section: 'main' | 'billing' | 'install') {
    const zipFieldMap = {
      main: 'addressMainZip',
      billing: 'addressBillingZip',
      install: 'addressInstallZip',
    } as const;
    const streetFieldMap = {
      main: 'addressMainStreet',
      billing: 'addressBillingStreet',
      install: 'addressInstallStreet',
    } as const;
    const districtFieldMap = {
      main: 'addressMainDistrict',
      billing: 'addressBillingDistrict',
      install: 'addressInstallDistrict',
    } as const;
    const cityFieldMap = {
      main: 'addressMainCity',
      billing: 'addressBillingCity',
      install: 'addressInstallCity',
    } as const;
    const stateFieldMap = {
      main: 'addressMainState',
      billing: 'addressBillingState',
      install: 'addressInstallState',
    } as const;

    const zipKey = zipFieldMap[section];
    const streetKey = streetFieldMap[section];
    const districtKey = districtFieldMap[section];
    const cityKey = cityFieldMap[section];
    const stateKey = stateFieldMap[section];
    const normalizedZip = (this.form[zipKey] ?? '').replace(/\D/g, '');

    if (!normalizedZip) {
      this.showWarning('Inform a postal code to search.');
      return;
    }

    if (!/^\d{8}$/.test(normalizedZip)) {
      this.showWarning('Invalid postal code. Provide 8 digits.');
      return;
    }

    this.setSearchingPostalCode(section, true);
    this.error = '';
    this.form[zipKey] = normalizedZip;

    try {
      const res = await this.api.get<any>(`postal-codes/${normalizedZip}`);
      const item = (res?.data?.item ?? {}) as PostalCodeLookupItem;
      setTimeout(() => {
        this.form[streetKey] = item.street ?? this.form[streetKey];
        this.form[districtKey] = item.district ?? this.form[districtKey];
        this.form[cityKey] = item.city ?? this.form[cityKey];
        this.form[stateKey] = item.state ?? this.form[stateKey];
        if (section === 'main') {
          this.onMainAddressChange();
        }
        this.setSearchingPostalCode(section, false);
        this.cdr.detectChanges();

        setTimeout(() => {
          if (section === 'main') this.mainAddressNumberInput?.nativeElement?.focus();
          if (section === 'billing') this.billingAddressNumberInput?.nativeElement?.focus();
          if (section === 'install') this.installAddressNumberInput?.nativeElement?.focus();
        }, 0);
      }, 0);
    } catch (err: any) {
      setTimeout(() => {
        this.showError(err?.message ?? 'Failed to search postal code.');
        this.setSearchingPostalCode(section, false);
        this.cdr.detectChanges();
      }, 0);
    }
  }

  private setSearchingPostalCode(section: 'main' | 'billing' | 'install', value: boolean) {
    if (section === 'main') this.searchingMainPostalCode = value;
    if (section === 'billing') this.searchingBillingPostalCode = value;
    if (section === 'install') this.searchingInstallPostalCode = value;
  }
}
