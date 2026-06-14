import {
  Component,
  effect,
  TemplateRef,
  inject,
  resource,
  signal,
  viewChild,
  afterNextRender,
  DestroyRef,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormField, form as createForm, required } from '@angular/forms/signals';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { firstValueFrom, takeUntil } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { CrudDialogBinding, openCrudTemplateDialog } from '../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { CurrencyMaskDirective } from '../../../shared/currency-mask/currency-mask.directive';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';
import { bindDialogEscape } from '../../../shared/dialog/dialog-events.util';

type ProductItem = {
  SprUUID: string;
  SprID: string;
  SprName: string;
  SprDescription: string;
  SprType: string;
  SaleUnitSunUUID: string;
  SaleCategoryScaUUID: string;
  SaleBrandSbrUUID: string;
  SaleUnitName?: string | null;
  SaleCategoryName?: string | null;
  SaleBrandName?: string | null;
  SprTags?: string | null;
  SprPrice: number;
  SprStatus: number;
  SprBarcode?: string | null;
  CoverUrl?: string | null;
  SprDateCreated: string | null;
  SprDateUpdated: string | null;
};

type ProductImageItem = {
  SpiUUID: string;
  SpiUrl: string;
  SpiIsCover: number;
};

type OptionItem = {
  uuid: string;
  label: string;
};

type ProductTypeOption = {
  value: string;
  label: string;
};

type ProductFilters = {
  search: string;
  saleUnitUUID: string;
  saleCategoryUUID: string;
  saleBrandUUID: string;
  type: string;
  status: string;
  barcode: string;
};

type ProductFormModel = {
  name: string;
  description: string;
  type: string;
  saleUnitUUID: string;
  saleCategoryUUID: string;
  saleBrandUUID: string;
  tags: string;
  price: number;
  status: number;
  barcode: string;
};

const PRODUCT_TYPES: ProductTypeOption[] = [
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'RAW_MATERIAL', label: 'Raw material' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'CONSUMABLE', label: 'Consumable' },
];

@Component({
  selector: 'app-sale-product',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    FormField,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe,
    MatSortModule,
    CurrencyMaskDirective,
    DecimalPipe,
  ],
  templateUrl: './product.html',
  styleUrls: ['./product.scss'],
})
export class SaleProductPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);

  amountPrefix = '';
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly products = signal<ProductItem[]>([]);
  readonly images = signal<ProductImageItem[]>([]);
  readonly editing = signal<ProductItem | null>(null);

  readonly units = signal<OptionItem[]>([]);
  readonly categories = signal<OptionItem[]>([]);
  readonly brands = signal<OptionItem[]>([]);
  readonly productTypes = signal<ProductTypeOption[]>(PRODUCT_TYPES);
  readonly unitSearch = signal('');
  readonly categorySearch = signal('');
  readonly brandSearch = signal('');
  readonly filterUnitSearch = signal('');
  readonly filterCategorySearch = signal('');
  readonly filterBrandSearch = signal('');

  readonly filterFormModel = signal<ProductFilters>({
    search: '',
    saleUnitUUID: '',
    saleCategoryUUID: '',
    saleBrandUUID: '',
    type: '',
    status: '',
    barcode: '',
  });
  readonly filterForm = createForm(this.filterFormModel);

  readonly productFormModel = signal<ProductFormModel>({
    name: '',
    description: '',
    type: 'COMMERCE',
    saleUnitUUID: '',
    saleCategoryUUID: '',
    saleBrandUUID: '',
    tags: '',
    price: 0,
    status: 1,
    barcode: '',
  });
  readonly productForm = createForm(this.productFormModel, (schema) => {
    required(schema.name);
    required(schema.description);
    required(schema.type);
    required(schema.saleUnitUUID);
    required(schema.saleCategoryUUID);
    required(schema.saleBrandUUID);
    required(schema.price);
    required(schema.status);
  });

  dataSource = new MatTableDataSource<ProductItem>([]);
  private readonly productsResource = resource({
    defaultValue: [] as ProductItem[],
    params: (): ProductFilters => {
      const values = this.filterFormModel();
      return {
        search: values.search.trim(),
        saleUnitUUID: values.saleUnitUUID,
        saleCategoryUUID: values.saleCategoryUUID,
        saleBrandUUID: values.saleBrandUUID,
        type: values.type,
        status: values.status,
        barcode: values.barcode.trim(),
      };
    },
    loader: ({ params }) => this.fetchProducts(params),
  });
  private readonly syncProducts = effect(() => {
    const items = this.productsResource.value();
    this.products.set(items);
    this.dataSource.data = [...items];
    this.error.set(null);
  });
  private readonly reportProductsError = effect(() => {
    const error = this.productsResource.error();
    if (error) this.error.set(this.extractErrorMessage(error, 'Failed to load products.'));
  });
  readonly loading = this.productsResource.isLoading;

  readonly paginator = viewChild(MatPaginator);
  readonly sort = viewChild(MatSort);
  readonly productFormDialog = viewChild<TemplateRef<unknown>>('productFormDialog');
  private productFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  readonly displayedColumns = [
    'image',
    'name',
    'description',
    'type',
    'category',
    'brand',
    'unit',
    'price',
    'status',
    'actions',
  ];

  private readonly initializePage = (() => {
    const currencyMeta = this.getCurrencyAffixes();
    this.amountPrefix = currencyMeta.prefix;
    this.fetchLookups();

    return true;
  })();

  async fetchLookups() {
    try {
      const [unitsRes, categoriesRes, brandsRes] = await Promise.all([
        this.api.get<any>('sale/units?limit=200'),
        this.api.get<any>('sale/categories?limit=200'),
        this.api.get<any>('sale/brands?limit=200'),
      ]);

      this.units.set(
        (unitsRes?.data?.items ?? []).map((item: any) => ({
          uuid: item.SunUUID,
          label: `${item.SunCode} - ${item.SunName}`,
        })),
      );
      this.categories.set(
        (categoriesRes?.data?.items ?? []).map((item: any) => ({
          uuid: item.ScaUUID,
          label: item.ScaName,
        })),
      );
      this.brands.set(
        (brandsRes?.data?.items ?? []).map((item: any) => ({
          uuid: item.SbrUUID,
          label: item.SbrName,
        })),
      );
    } catch (err) {
      console.error('Failed to load lookups.', err);
    }
  }

  private readonly afterViewReady = afterNextRender(() => {
    this.dataSource.paginator = this.paginator() ?? null;
    this.dataSource.sort = this.sort() ?? null;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'name':
          return item.SprName ?? '';
        case 'description':
          return item.SprDescription ?? '';
        case 'type':
          return this.typeLabel(item.SprType);
        case 'category':
          return item.SaleCategoryName ?? '';
        case 'brand':
          return item.SaleBrandName ?? '';
        case 'unit':
          return item.SaleUnitName ?? '';
        case 'price':
          return Number(item.SprPrice ?? 0);
        case 'status':
          return Number(item.SprStatus ?? 0);
        default:
          return '';
      }
    };
  });

  private async fetchProducts(filters: ProductFilters): Promise<ProductItem[]> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.saleUnitUUID) params.set('saleUnitUuid', filters.saleUnitUUID);
    if (filters.saleCategoryUUID) params.set('saleCategoryUuid', filters.saleCategoryUUID);
    if (filters.saleBrandUUID) params.set('saleBrandUuid', filters.saleBrandUUID);
    if (filters.type) params.set('type', filters.type);
    if (filters.status !== '') params.set('status', filters.status);
    if (filters.barcode) params.set('barcode', filters.barcode);

    const query = params.toString();
    const response = await this.api.get<any>(`sale/products${query ? `?${query}` : ''}`);
    return Array.isArray(response?.data?.items) ? response.data.items : [];
  }

  applyFilters() {
    this.productsResource.reload();
  }

  clearFilters() {
    this.filterFormModel.set({
      search: '',
      saleUnitUUID: '',
      saleCategoryUUID: '',
      saleBrandUUID: '',
      type: '',
      status: '',
      barcode: '',
    });
    this.productsResource.reload();
  }

  refreshList() {
    this.productsResource.reload();
  }

  openCreateDialog() {
    this.cancelEdit();
    this.openProductDialog();
  }

  async openEditDialog(product: ProductItem) {
    await this.startEdit(product);
    this.openProductDialog();
  }

  async startEdit(product: ProductItem) {
    this.editing.set(product);
    this.productFormModel.set({
      name: product.SprName,
      description: product.SprDescription,
      type: product.SprType,
      saleUnitUUID: product.SaleUnitSunUUID,
      saleCategoryUUID: product.SaleCategoryScaUUID,
      saleBrandUUID: product.SaleBrandSbrUUID,
      tags: product.SprTags ?? '',
      price: product.SprPrice,
      status: product.SprStatus ?? 1,
      barcode: product.SprBarcode ?? '',
    });

    await this.fetchImages(product.SprUUID);
  }

  cancelEdit() {
    this.editing.set(null);
    this.images.set([]);
    this.productFormModel.set({
      name: '',
      description: '',
      type: 'COMMERCE',
      saleUnitUUID: '',
      saleCategoryUUID: '',
      saleBrandUUID: '',
      tags: '',
      price: 0,
      status: 1,
      barcode: '',
    });
    this.closeProductDialog();
  }

  get filteredUnits() {
    const value = this.unitSearch().trim().toLowerCase();
    if (!value) return this.units();
    return this.units().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredCategories() {
    const value = this.categorySearch().trim().toLowerCase();
    if (!value) return this.categories();
    return this.categories().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredBrands() {
    const value = this.brandSearch().trim().toLowerCase();
    if (!value) return this.brands();
    return this.brands().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterUnits() {
    const value = this.filterUnitSearch().trim().toLowerCase();
    if (!value) return this.units();
    return this.units().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterCategories() {
    const value = this.filterCategorySearch().trim().toLowerCase();
    if (!value) return this.categories();
    return this.categories().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  get filteredFilterBrands() {
    const value = this.filterBrandSearch().trim().toLowerCase();
    if (!value) return this.brands();
    return this.brands().filter((item) => (item.label ?? '').toLowerCase().includes(value));
  }

  onUnitOpened(opened: boolean) {
    if (opened) {
      this.unitSearch.set('');
    }
  }

  onCategoryOpened(opened: boolean) {
    if (opened) {
      this.categorySearch.set('');
    }
  }

  onBrandOpened(opened: boolean) {
    if (opened) {
      this.brandSearch.set('');
    }
  }

  onFilterUnitOpened(opened: boolean) {
    if (opened) {
      this.filterUnitSearch.set('');
    }
  }

  onFilterCategoryOpened(opened: boolean) {
    if (opened) {
      this.filterCategorySearch.set('');
    }
  }

  onFilterBrandOpened(opened: boolean) {
    if (opened) {
      this.filterBrandSearch.set('');
    }
  }

  async saveProduct(closeAfterSave = true) {
    if (!this.productForm().valid()) return;

    const payload = this.productFormModel();
    const data = {
      name: payload.name.trim(),
      description: payload.description.trim(),
      type: payload.type,
      saleUnitUUID: payload.saleUnitUUID,
      saleCategoryUUID: payload.saleCategoryUUID,
      saleBrandUUID: payload.saleBrandUUID,
      tags: payload.tags?.trim() || null,
      price: Number(payload.price),
      status: Number(payload.status),
      barcode: payload.barcode?.trim() || null,
    };

    if (
      !data.name ||
      !data.description ||
      !data.type ||
      !data.saleUnitUUID ||
      !data.saleCategoryUUID ||
      !data.saleBrandUUID
    )
      return;

    this.saving.set(true);
    this.error.set(null);

    try {
      const editing = this.editing();
      if (editing) {
        await this.api.put<any>(`sale/products/${editing.SprUUID}`, data);
        this.productsResource.reload();
        this.cancelEdit();
        return;
      }

      await this.api.post<any>('sale/products', data);
      this.productsResource.reload();

      if (closeAfterSave) {
        this.cancelEdit();
      } else {
        this.resetCreateForm();
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to save product.'));
    } finally {
      this.saving.set(false);
    }
  }

  async saveAndNew() {
    if (this.editing()) return;
    await this.saveProduct(false);
  }

  async deleteProduct(product: ProductItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete product',
        message: 'Are you sure you want to delete this product?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`sale/products/${product.SprUUID}`);
      this.productsResource.reload();
      if (this.editing()?.SprUUID === product.SprUUID) {
        this.cancelEdit();
      }
    } catch (err: any) {
      this.error.set(this.extractErrorMessage(err, 'Failed to delete product.'));
    }
  }

  async fetchImages(productUUID: string) {
    try {
      const response = await this.api.get<any>(`sale/products/${productUUID}/images`);
      this.images.set(response?.data?.items ?? []);
    } catch (err) {
      console.error('Failed to load product images.', err);
    }
  }

  async uploadImages(event: Event) {
    const product = this.editing();
    if (!product) return;

    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      try {
        const response = await this.api.post<any>(
          `sale/products/${product.SprUUID}/images`,
          formData,
        );
        const item = response?.data?.item ?? null;
        if (item) {
          this.images.update((items) => [item, ...items]);
        }
      } catch (err) {
        console.error('Failed to upload image.', err);
      }
    }

    input.value = '';
  }

  async deleteImage(image: ProductImageItem) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete image',
        message: 'Are you sure you want to delete this image?',
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete(`sale/products/images/${image.SpiUUID}`);
      this.images.update((items) => items.filter((row) => row.SpiUUID !== image.SpiUUID));
    } catch (err) {
      console.error('Failed to delete image.', err);
    }
  }

  async setCover(image: ProductImageItem) {
    try {
      await this.api.put(`sale/products/images/${image.SpiUUID}/cover`, {});
      this.images.update((items) =>
        items.map((row) => ({ ...row, SpiIsCover: row.SpiUUID === image.SpiUUID ? 1 : 0 })),
      );
      const editing = this.editing();
      if (editing) {
        this.products.update((items) =>
          items.map((row) =>
            row.SprUUID === editing.SprUUID ? { ...row, CoverUrl: image.SpiUrl } : row,
          ),
        );
        this.dataSource.data = [...this.products()];
      }
    } catch (err) {
      console.error('Failed to set cover image.', err);
    }
  }

  private readonly cleanupOnDestroy = inject(DestroyRef).onDestroy(() => {
    this.closeProductDialog();
  });

  private openProductDialog() {
    const productFormDialog = this.productFormDialog();
    if (!productFormDialog || this.productFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      productFormDialog,
      'sale-product-form-dialog',
    );
    this.productFormDialogRef = this.dialogBinding.ref;
    bindDialogEscape(this.productFormDialogRef, () => {
      this.cancelEdit();
    });
  }

  private closeProductDialog() {
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.productFormDialogRef?.close();
    this.productFormDialogRef = null;
  }

  private resetCreateForm() {
    this.images.set([]);
    this.productFormModel.set({
      name: '',
      description: '',
      type: 'COMMERCE',
      saleUnitUUID: '',
      saleCategoryUUID: '',
      saleBrandUUID: '',
      tags: '',
      price: 0,
      status: 1,
      barcode: '',
    });
    this.error.set(null);
  }

  statusLabel(status: number) {
    return status === 1 ? 'ACTIVE' : 'INACTIVE';
  }

  typeLabel(value: string | null | undefined) {
    const match = PRODUCT_TYPES.find((type) => type.value === value);
    return match?.label ?? value ?? '-';
  }

  private extractErrorMessage(err: any, fallback: string) {
    return err?.error?.error || err?.error?.message || err?.message || fallback;
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
}
