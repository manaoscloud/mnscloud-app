import {
  AfterViewInit,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { SnackbarService } from '../../../../../services/snackbar.service';
import { fadeIn } from '../../../../../shared/animations/fade.animation';
import {
  CrudDialogBinding,
  openCrudTemplateDialog,
} from '../../../../../shared/dialog/crud-dialog.util';
import { SlowConfirmDialogComponent } from '../../../../../shared/slow-confirm-dialog/slow-confirm-dialog';
import { TranslatePipe } from '../../../../../shared/i18n/translate.pipe';

type PaymentGatewayProvider = 'pagarme' | 'asaas' | 'stripe' | 'efi' | 'inter_business';

type PaymentGatewayAccount = {
  EfgUUID: string;
  EfgName: string;
  EfgProvider: PaymentGatewayProvider;
  EfgConfig?: Record<string, unknown> | null;
  EfgIsActive: number;
  EfgIsDefault: number;
};

type ProviderFieldSection = 'config' | 'credentials';
type ProviderFieldKind = 'text' | 'password' | 'textarea' | 'select';

type ProviderFieldDefinition = {
  key: string;
  label: string;
  section: ProviderFieldSection;
  kind?: ProviderFieldKind;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type ProviderFieldView = ProviderFieldDefinition & { controlName: string };

const PROVIDER_FIELD_DEFINITIONS: Record<PaymentGatewayProvider, ProviderFieldDefinition[]> = {
  pagarme: [
    {
      key: 'apiBaseUrl',
      label: 'API Base URL',
      section: 'config',
      placeholder: 'https://api.pagar.me',
    },
    { key: 'apiKey', label: 'API Key', section: 'credentials', required: true, kind: 'password' },
    { key: 'encryptionKey', label: 'Encryption Key', section: 'credentials', kind: 'password' },
  ],
  asaas: [
    {
      key: 'apiBaseUrl',
      label: 'API Base URL',
      section: 'config',
      placeholder: 'https://api.asaas.com',
    },
    { key: 'apiKey', label: 'API Key', section: 'credentials', required: true, kind: 'password' },
  ],
  stripe: [
    {
      key: 'apiBaseUrl',
      label: 'API Base URL',
      section: 'config',
      placeholder: 'https://api.stripe.com',
    },
    {
      key: 'secretKey',
      label: 'Secret Key',
      section: 'credentials',
      required: true,
      kind: 'password',
    },
    { key: 'webhookSecret', label: 'Webhook Secret', section: 'credentials', kind: 'password' },
  ],
  efi: [
    { key: 'apiBaseUrl', label: 'API Base URL', section: 'config' },
    { key: 'clientId', label: 'Client ID', section: 'credentials', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      section: 'credentials',
      required: true,
      kind: 'password',
    },
    { key: 'certificate', label: 'Certificate (PEM)', section: 'credentials', kind: 'textarea' },
    { key: 'privateKey', label: 'Private Key (PEM)', section: 'credentials', kind: 'textarea' },
  ],
  inter_business: [
    {
      key: 'sandbox',
      label: 'Sandbox',
      section: 'config',
      kind: 'select',
      options: [
        { value: 'false', label: 'No' },
        { value: 'true', label: 'Yes' },
      ],
    },
    {
      key: 'scope',
      label: 'OAuth Scope',
      section: 'config',
      required: true,
      placeholder: 'boleto-cobranca.read boleto-cobranca.write',
    },
    {
      key: 'apiBaseUrl',
      label: 'API Base URL',
      section: 'config',
      placeholder: 'https://cdpj.partners.bancointer.com.br',
    },
    {
      key: 'tokenUrl',
      label: 'Token URL',
      section: 'config',
      placeholder: 'https://cdpj.partners.bancointer.com.br/oauth/v2/token',
    },
    {
      key: 'createChargePath',
      label: 'Create Charge Path',
      section: 'config',
      placeholder: '/cobranca/v3/cobrancas',
    },
    {
      key: 'getChargePathTemplate',
      label: 'Get Charge Path Template',
      section: 'config',
      placeholder: '/cobranca/v3/cobrancas/{id}',
    },
    { key: 'clientId', label: 'Client ID', section: 'credentials', required: true },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      section: 'credentials',
      required: true,
      kind: 'password',
    },
    {
      key: 'certPem',
      label: 'Certificate PEM',
      section: 'credentials',
      kind: 'textarea',
      required: true,
    },
    {
      key: 'keyPem',
      label: 'Private Key PEM',
      section: 'credentials',
      kind: 'textarea',
      required: true,
    },
  ],
};

function toProviderControlName(field: ProviderFieldDefinition): string {
  return `${field.section}__${field.key}`;
}

const ALL_PROVIDER_FIELDS: ProviderFieldView[] = Object.values(PROVIDER_FIELD_DEFINITIONS)
  .flat()
  .reduce<ProviderFieldView[]>((acc, field) => {
    const controlName = toProviderControlName(field);
    if (acc.some((item) => item.controlName === controlName)) return acc;
    acc.push({ ...field, controlName });
    return acc;
  }, []);

@Component({
  selector: 'app-financial-payment-gateway',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatMenuModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatTooltipModule,
    MatTabsModule,
    TranslatePipe,
  ],
  templateUrl: './payment-gateway.html',
  styleUrls: ['./payment-gateway.scss'],
  animations: [fadeIn],
  host: {
    '[@fadeIn]': '',
  },
})
export class FinancialPaymentGatewayPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly context = signal<string>(this.route.snapshot.data?.['context'] ?? 'financial');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly pageTitle = computed(() =>
    this.context() === 'system' ? 'System Payment Gateways' : 'Payment Gateways',
  );
  readonly pageSubtitle = computed(() =>
    this.isMaster()
      ? 'Define master payment gateways for global usage.'
      : 'Configure tenant payment gateways for financial workflows.',
  );
  readonly baseEndpoint = computed(() =>
    this.isMaster() ? 'system/payment-gateways' : 'erp/financial/payment/gateways',
  );

  readonly paymentGateways = signal<PaymentGatewayAccount[]>([]);
  readonly loadingGateways = signal<boolean>(false);
  readonly savingGateway = signal<boolean>(false);
  readonly validatingGatewayUUID = signal<string | null>(null);

  readonly advancedJsonMode = signal<boolean>(false);
  readonly selectedGatewayUUIDs = signal<Set<string>>(new Set());

  readonly editingGateway = signal<PaymentGatewayAccount | null>(null);

  readonly gatewayForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    provider: ['pagarme' as PaymentGatewayProvider, [Validators.required]],
    configJson: [''],
    credentialsJson: [''],
    isActive: [true],
    isDefault: [false],
  });
  readonly providerFieldsForm = this.fb.group(
    ALL_PROVIDER_FIELDS.reduce<Record<string, unknown>>((acc, field) => {
      acc[field.controlName] = [''];
      return acc;
    }, {}),
  );

  readonly providerOptions: { value: PaymentGatewayProvider; label: string }[] = [
    { value: 'pagarme', label: 'Pagar.me' },
    { value: 'asaas', label: 'Asaas' },
    { value: 'stripe', label: 'Stripe' },
    { value: 'efi', label: 'Efi' },
    { value: 'inter_business', label: 'Inter Empresas' },
  ];

  dataSource = new MatTableDataSource<PaymentGatewayAccount>([]);
  displayedColumns: string[] = [
    'select',
    'name',
    'provider',
    'config',
    'status',
    'default',
    'actions',
  ];
  search = '';
  searchInput = '';

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('gatewayFormDialog') gatewayFormDialog?: TemplateRef<unknown>;
  private gatewayFormDialogRef: MatDialogRef<unknown> | null = null;
  private dialogBinding: CrudDialogBinding | null = null;

  ngOnInit() {
    this.cancelEditGateway();
    void this.loadPaymentGateways();
  }

  ngOnDestroy() {
    this.closeGatewayDialog();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (data, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'name':
          return data.EfgName ?? '';
        case 'provider':
          return this.providerLabel(data.EfgProvider);
        case 'config':
          return this.configPreview(data);
        case 'status':
          return data.EfgIsActive ?? 0;
        case 'default':
          return data.EfgIsDefault ?? 0;
        default:
          return '';
      }
    };
    this.dataSource.filterPredicate = (data, filter) => {
      const value = filter.trim().toLowerCase();
      if (!value) return true;
      const status = data.EfgIsActive === 1 ? 'active' : 'inactive';
      const isDefault = data.EfgIsDefault === 1 ? 'default' : '';
      return [
        data.EfgName,
        this.providerLabel(data.EfgProvider),
        this.configPreview(data),
        status,
        isDefault,
      ]
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
    void this.loadPaymentGateways();
  }

  applyFilter() {
    this.dataSource.filter = this.search.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  selectedProvider(): PaymentGatewayProvider {
    return this.gatewayForm.controls.provider.value as PaymentGatewayProvider;
  }

  configFieldsForSelectedProvider(): ProviderFieldView[] {
    const provider = this.selectedProvider();
    return PROVIDER_FIELD_DEFINITIONS[provider]
      .filter((field) => field.section === 'config')
      .map((field) => ({ ...field, controlName: toProviderControlName(field) }));
  }

  credentialFieldsForSelectedProvider(): ProviderFieldView[] {
    const provider = this.selectedProvider();
    return PROVIDER_FIELD_DEFINITIONS[provider]
      .filter((field) => field.section === 'credentials')
      .map((field) => ({ ...field, controlName: toProviderControlName(field) }));
  }

  toggleAdvancedJsonMode() {
    const next = !this.advancedJsonMode();
    if (next) {
      const mapped = this.buildConfigAndCredentialsFromProviderFields(
        this.selectedProvider(),
        false,
      );
      this.gatewayForm.patchValue({
        configJson: this.stringifyJson(mapped.config),
        credentialsJson: this.stringifyJson(mapped.credentials),
      });
    }
    this.advancedJsonMode.set(next);
  }

  private normalizeString(value: string | null | undefined): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
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

  private parseJsonObject(
    value: string | null | undefined,
    fieldLabel: string,
  ): Record<string, unknown> | null {
    const trimmed = this.normalizeString(value);
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${fieldLabel} must be a JSON object.`);
      }
      return parsed as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`${fieldLabel} must be valid JSON.`);
    }
  }

  private stringifyJson(value: Record<string, unknown> | null | undefined) {
    if (!value) return '';
    return JSON.stringify(value, null, 2);
  }

  private parseConfig(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object') return value as Record<string, unknown>;
    if (typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  private providerFieldValue(controlName: string): string {
    const control = this.providerFieldsForm.get(controlName);
    const raw = control?.value;
    return typeof raw === 'string' ? raw : '';
  }

  private setProviderFieldValue(controlName: string, value: unknown) {
    const control = this.providerFieldsForm.get(controlName);
    if (!control) return;
    const text = value === undefined || value === null ? '' : String(value);
    control.setValue(text);
  }

  private resetProviderFields() {
    ALL_PROVIDER_FIELDS.forEach((field) => this.setProviderFieldValue(field.controlName, ''));
  }

  private hydrateProviderFields(
    provider: PaymentGatewayProvider,
    config: Record<string, unknown> | null,
    credentials: Record<string, unknown> | null,
  ) {
    this.resetProviderFields();
    const definitions = PROVIDER_FIELD_DEFINITIONS[provider];
    definitions.forEach((field) => {
      const source = field.section === 'config' ? config : credentials;
      this.setProviderFieldValue(toProviderControlName(field), source?.[field.key]);
    });
  }

  private buildConfigAndCredentialsFromProviderFields(
    provider: PaymentGatewayProvider,
    requireRequired: boolean,
  ) {
    const definitions = PROVIDER_FIELD_DEFINITIONS[provider];
    const config: Record<string, unknown> = {};
    const credentials: Record<string, unknown> = {};
    const errors: string[] = [];

    definitions.forEach((field) => {
      const value = this.normalizeString(this.providerFieldValue(toProviderControlName(field)));
      if (requireRequired && field.required && !value) {
        errors.push(`Field '${field.label}' is required for ${this.providerLabel(provider)}.`);
        return;
      }
      if (!value) return;
      if (field.section === 'config') config[field.key] = value;
      else credentials[field.key] = value;
    });

    return { config, credentials, errors };
  }

  gatewayStatusLabel(item: PaymentGatewayAccount) {
    return item.EfgIsActive === 1 ? 'Active' : 'Inactive';
  }

  gatewayStatusChipClass(item: PaymentGatewayAccount) {
    return item.EfgIsActive === 1 ? 'chip-success' : 'chip-skipped';
  }

  gatewayIsDefault(item: PaymentGatewayAccount) {
    return item.EfgIsDefault === 1;
  }

  providerLabel(provider: PaymentGatewayProvider) {
    return this.providerOptions.find((opt) => opt.value === provider)?.label ?? provider;
  }

  configPreview(item: PaymentGatewayAccount) {
    const config = item.EfgConfig ?? {};
    const text = JSON.stringify(config);
    if (!text || text === '{}') return '—';
    return text.length > 140 ? `${text.slice(0, 140)}...` : text;
  }

  selectedGatewayCount() {
    return this.selectedGatewayUUIDs().size;
  }

  isGatewaySelected(item: PaymentGatewayAccount) {
    return this.selectedGatewayUUIDs().has(item.EfgUUID);
  }

  visibleRows(): PaymentGatewayAccount[] {
    const rows = this.dataSource.filteredData.length
      ? this.dataSource.filteredData
      : this.dataSource.data;
    const paginator = this.dataSource.paginator;
    if (!paginator) return rows;
    const start = paginator.pageIndex * paginator.pageSize;
    return rows.slice(start, start + paginator.pageSize);
  }

  allVisibleRowsSelected() {
    const rows = this.visibleRows();
    return rows.length > 0 && rows.every((row) => this.selectedGatewayUUIDs().has(row.EfgUUID));
  }

  someVisibleRowsSelected() {
    const rows = this.visibleRows();
    if (rows.length === 0) return false;
    const selected = rows.filter((row) => this.selectedGatewayUUIDs().has(row.EfgUUID)).length;
    return selected > 0 && selected < rows.length;
  }

  toggleGatewaySelection(item: PaymentGatewayAccount) {
    const next = new Set(this.selectedGatewayUUIDs());
    if (next.has(item.EfgUUID)) next.delete(item.EfgUUID);
    else next.add(item.EfgUUID);
    this.selectedGatewayUUIDs.set(next);
  }

  toggleVisibleSelection() {
    const rows = this.visibleRows();
    const next = new Set(this.selectedGatewayUUIDs());
    const shouldSelect = !this.allVisibleRowsSelected();
    rows.forEach((row) => {
      if (shouldSelect) next.add(row.EfgUUID);
      else next.delete(row.EfgUUID);
    });
    this.selectedGatewayUUIDs.set(next);
  }

  private reconcileSelection() {
    const valid = new Set(this.dataSource.data.map((row) => row.EfgUUID));
    const next = new Set([...this.selectedGatewayUUIDs()].filter((uuid) => valid.has(uuid)));
    this.selectedGatewayUUIDs.set(next);
  }

  async loadPaymentGateways() {
    this.loadingGateways.set(true);
    const start = performance.now();

    try {
      const result = await this.api.get<unknown>(this.baseEndpoint());
      const list = Array.isArray(result)
        ? result
        : Array.isArray((result as any)?.data?.items)
          ? (result as any).data.items
          : [];

      const normalized = list.map((item: any) => ({
        ...item,
        EfgConfig: this.parseConfig(item.EfgConfig),
      })) as PaymentGatewayAccount[];

      this.paymentGateways.set(normalized);
      this.dataSource.data = [...normalized];
      this.reconcileSelection();
      this.applySearchFilters();
    } catch (error) {
      this.showGatewayError(this.friendlyError(error, 'Failed to load payment gateways.'));
      this.paymentGateways.set([]);
      this.dataSource.data = [];
      this.selectedGatewayUUIDs.set(new Set());
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.loadingGateways.set(false), waitMs);
      } else {
        this.loadingGateways.set(false);
      }
    }
  }

  startEditGateway(item: PaymentGatewayAccount) {
    this.editingGateway.set(item);
    this.advancedJsonMode.set(false);
    this.gatewayForm.patchValue({
      name: item.EfgName,
      provider: item.EfgProvider,
      configJson: this.stringifyJson(item.EfgConfig),
      credentialsJson: '',
      isActive: item.EfgIsActive === 1,
      isDefault: item.EfgIsDefault === 1,
    });
    this.hydrateProviderFields(item.EfgProvider, item.EfgConfig ?? null, null);

    this.gatewayForm.controls.credentialsJson.clearValidators();
    this.gatewayForm.controls.credentialsJson.updateValueAndValidity({ emitEvent: false });
  }

  openCreateDialog() {
    this.cancelEditGateway();
    this.openGatewayDialog();
  }

  openEditDialog(item: PaymentGatewayAccount) {
    this.startEditGateway(item);
    this.openGatewayDialog();
  }

  cancelEditGateway() {
    this.editingGateway.set(null);
    this.advancedJsonMode.set(false);
    this.gatewayForm.reset({
      name: '',
      provider: 'pagarme',
      configJson: '',
      credentialsJson: '',
      isActive: true,
      isDefault: false,
    });
    this.resetProviderFields();

    this.gatewayForm.controls.credentialsJson.setValidators([Validators.required]);
    this.gatewayForm.controls.credentialsJson.updateValueAndValidity({ emitEvent: false });
  }

  cancelGatewayForm() {
    this.closeGatewayDialog();
    this.cancelEditGateway();
  }

  async submitGateway(keepOpenForNew = false) {
    if (this.gatewayForm.invalid) {
      this.showGatewayWarning('Please fill all required fields.');
      return;
    }

    this.savingGateway.set(true);

    const values = this.gatewayForm.getRawValue();

    let config: Record<string, unknown> | null = null;
    let credentials: Record<string, unknown> | null = null;

    if (this.advancedJsonMode()) {
      try {
        config = this.parseJsonObject(values.configJson, 'Config');
        credentials = this.parseJsonObject(values.credentialsJson, 'Credentials');
      } catch (error) {
        this.showGatewayError(this.friendlyError(error, 'Invalid JSON data.'));
        this.savingGateway.set(false);
        return;
      }
      if (!this.editingGateway() && !config) {
        this.showGatewayWarning('Config is required for new payment gateways.');
        this.savingGateway.set(false);
        return;
      }
      if (!this.editingGateway() && !credentials) {
        this.showGatewayWarning('Credentials are required for new payment gateways.');
        this.savingGateway.set(false);
        return;
      }
    } else {
      const mapped = this.buildConfigAndCredentialsFromProviderFields(
        values.provider,
        !this.editingGateway(),
      );
      if (mapped.errors.length > 0) {
        this.showGatewayWarning(mapped.errors.join(' '));
        this.savingGateway.set(false);
        return;
      }
      config = mapped.config;
      credentials = mapped.credentials;

      if (!this.editingGateway() && Object.keys(config).length === 0) {
        config = {};
      }
      if (!this.editingGateway() && Object.keys(credentials).length === 0) {
        this.showGatewayWarning('Credentials are required for new payment gateways.');
        this.savingGateway.set(false);
        return;
      }
      if (Object.keys(config).length === 0) config = null;
      if (Object.keys(credentials).length === 0) credentials = null;
    }

    const payload: Record<string, unknown> = {
      name: values.name,
      provider: values.provider,
      isActive: values.isActive,
      isDefault: values.isDefault,
    };

    if (config) payload['config'] = config;
    if (credentials) payload['credentials'] = credentials;

    try {
      if (this.editingGateway()) {
        const uuid = this.editingGateway()!.EfgUUID;
        await this.api.put(`${this.baseEndpoint()}/${uuid}`, payload);
        this.showGatewaySuccess('Payment gateway updated.');
      } else {
        await this.api.post(this.baseEndpoint(), payload);
        this.showGatewaySuccess('Payment gateway created.');
      }

      if (!this.editingGateway() && keepOpenForNew) {
        this.cancelEditGateway();
      } else {
        this.closeGatewayDialog();
        this.cancelEditGateway();
      }
      await this.loadPaymentGateways();
    } catch (error) {
      this.showGatewayError(this.friendlyError(error, 'Failed to save payment gateway.'));
    } finally {
      this.savingGateway.set(false);
    }
  }

  saveAndNewGateway() {
    if (this.editingGateway()) return;
    void this.submitGateway(true);
  }

  async deleteGateway(item: PaymentGatewayAccount) {
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete payment gateway',
        message: `Are you sure you want to delete "${item.EfgName}"?`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      await this.api.delete(`${this.baseEndpoint()}/${item.EfgUUID}`);
      this.showGatewaySuccess('Payment gateway deleted.');
      await this.loadPaymentGateways();
    } catch (error) {
      this.showGatewayError(this.friendlyError(error, 'Failed to delete payment gateway.'));
    }
  }

  async removeManyGateways() {
    const ids = [...this.selectedGatewayUUIDs()];
    if (ids.length === 0) return;

    const selectedRows = this.dataSource.data.filter((row) => ids.includes(row.EfgUUID));
    const sample = selectedRows
      .slice(0, 3)
      .map((row) => row.EfgName)
      .join(', ');
    const suffix = sample ? ` (${sample}${selectedRows.length > 3 ? ', ...' : ''})` : '';

    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete selected payment gateways',
        message: `Delete ${ids.length} selected payment gateway${ids.length === 1 ? '' : 's'}${suffix}?`,
        confirmLabel: 'Delete selected',
      },
      panelClass: 'slow-confirm-dialog',
      disableClose: true,
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    try {
      const response = await this.api.delete<{
        deleted?: string[];
        failed?: { EfgUUID?: string; message?: string }[];
      }>(`${this.baseEndpoint()}/bulk`, { ids });
      const deleted = new Set(response?.deleted ?? []);
      const failed = response?.failed ?? [];

      if (deleted.size > 0) {
        this.selectedGatewayUUIDs.set(
          new Set([...this.selectedGatewayUUIDs()].filter((uuid) => !deleted.has(uuid))),
        );
      }

      await this.loadPaymentGateways();

      if (failed.length > 0) {
        const failedIds = new Set(
          failed.map((item) => item.EfgUUID).filter((uuid): uuid is string => Boolean(uuid)),
        );
        this.selectedGatewayUUIDs.set(failedIds);
        this.showGatewayError(`${failed.length} selected payment gateway(s) could not be deleted.`);
        return;
      }

      this.showGatewaySuccess('Selected payment gateways deleted.');
    } catch (error) {
      this.showGatewayError(
        this.friendlyError(error, 'Failed to delete selected payment gateways.'),
      );
    }
  }

  isValidatingGateway(item: PaymentGatewayAccount) {
    return this.validatingGatewayUUID() === item.EfgUUID;
  }

  async validateGateway(item: PaymentGatewayAccount) {
    this.validatingGatewayUUID.set(item.EfgUUID);

    try {
      const response = await this.api.post<{ message?: string }>(
        `${this.baseEndpoint()}/${item.EfgUUID}/validate`,
        {},
      );
      this.showGatewaySuccess(response?.message ?? 'Payment gateway validated.');
    } catch (error) {
      this.showGatewayError(this.friendlyError(error, 'Failed to validate payment gateway.'));
    } finally {
      this.validatingGatewayUUID.set(null);
    }
  }

  private showGatewaySuccess(message: string) {
    this.snack.success(message);
  }

  private showGatewayError(message: string) {
    this.snack.error(message);
  }

  private showGatewayWarning(message: string) {
    this.snack.warning(message);
  }

  private openGatewayDialog() {
    if (!this.gatewayFormDialog || this.gatewayFormDialogRef) return;
    this.dialogBinding = openCrudTemplateDialog(
      this.dialog,
      this.gatewayFormDialog,
      'crud-dialog-panel',
      {
        onEscape: () => this.cancelGatewayForm(),
      },
    );
    this.gatewayFormDialogRef = this.dialogBinding.ref;
    this.gatewayFormDialogRef.afterClosed().subscribe(() => {
      this.dialogBinding?.stop();
      this.dialogBinding = null;
      this.gatewayFormDialogRef = null;
    });
  }

  private closeGatewayDialog() {
    if (!this.gatewayFormDialogRef) return;
    this.dialogBinding?.stop();
    this.dialogBinding = null;
    this.gatewayFormDialogRef.close();
    this.gatewayFormDialogRef = null;
  }
}
