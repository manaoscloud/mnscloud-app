import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import {
  FormField,
  disabled,
  email,
  form,
  maxLength,
  pattern,
  required,
} from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { TenantService } from '../../../../services/tenant.service';
import { countryOptions } from '../../../../shared/i18n/countries';
import { FieldHelpComponent } from '../../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { SettingsPageComponent } from '../../../../shared/pages/settings-page';

/** One entry of GET /billing/identity/tax-id-types. */
export interface TaxIdType {
  TaxIdType: string;
  CountryCode: string;
  PartyType: 'individual' | 'business' | 'any';
  Label: string;
  Pattern: string;
  DisplayFormat: string | null;
  Prefix: string | null;
  IsRequired: number;
}

export interface TenantIdentity {
  TenantCode: string | null;
  TidUUID: string | null;
  TidCountryCode: string | null;
  TidPartyType: 'individual' | 'business' | null;
  TidTaxIdType: string | null;
  TidTaxId: string | null;
  TaxIdLabel: string | null;
  TaxIdDisplay: string | null;
  TidLegalName: string | null;
  TidTradeName: string | null;
  TidBillingEmail: string | null;
  TidAddressZip: string | null;
  TidAddressStreet: string | null;
  TidAddressNumber: string | null;
  TidAddressComplement: string | null;
  TidAddressDistrict: string | null;
  TidAddressCity: string | null;
  TidAddressState: string | null;
  IsComplete: number;
  CanManage: number;
}

type IdentityForm = {
  countryCode: string;
  partyType: string;
  taxIdType: string;
  taxId: string;
  legalName: string;
  tradeName: string;
  billingEmail: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
};

const ADDRESS_KEYS = [
  'addressZip',
  'addressStreet',
  'addressNumber',
  'addressComplement',
  'addressDistrict',
  'addressCity',
  'addressState',
] as const;

/** Brazilian states (UF codes are not translated). */
const BR_STATE_OPTIONS =
  'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'
    .split(' ')
    .map((value) => ({ value, label: value }));

const EMPTY_FORM: IdentityForm = {
  countryCode: 'BR',
  partyType: 'business',
  taxIdType: 'br_cnpj',
  taxId: '',
  legalName: '',
  tradeName: '',
  billingEmail: '',
  addressZip: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressDistrict: '',
  addressCity: '',
  addressState: '',
};

/** Same normalization as the database (uppercase, no separators, VAT prefix). */
export function normalizeTaxId(value: string, type: TaxIdType | null): string {
  const compact = value.toUpperCase().replace(/[\s.,/-]/g, '');
  const prefix = type?.Prefix ?? '';
  return compact && prefix && !compact.startsWith(prefix) ? prefix + compact : compact;
}

/** Tax ID types allowed for a country and party; "other" only where the catalog has none. */
export function taxIdTypesFor(
  catalog: readonly TaxIdType[],
  country: string,
  party: string,
): TaxIdType[] {
  const ofCountry = catalog.filter((item) => item.CountryCode === country);
  if (!ofCountry.length) return catalog.filter((item) => item.CountryCode === '*');
  return ofCountry.filter((item) => item.PartyType === party || item.PartyType === 'any');
}

@Component({
  selector: 'app-billing-tenant-identity',
  standalone: true,
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    TranslocoPipe,
    FieldHelpComponent,
    MnsSearchSelectFieldComponent,
    SettingsPageComponent,
  ],
  templateUrl: './identity.html',
  styleUrls: ['./identity.scss'],
})
export class BillingTenantIdentityPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);
  private readonly tenants = inject(TenantService);

  private readonly catalogResource = resource({
    loader: async () => {
      const response = await this.api.get<{ data?: { items?: TaxIdType[] } }>(
        'billing/identity/tax-id-types',
      );
      return response.data?.items ?? [];
    },
  });

  private readonly identityResource = resource({
    loader: async () => {
      const response = await this.api.get<{ data?: { item?: TenantIdentity } }>('billing/identity');
      return response.data?.item ?? null;
    },
  });

  readonly loading = computed(
    () => this.catalogResource.isLoading() || this.identityResource.isLoading(),
  );
  readonly saving = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly identity = signal<TenantIdentity | null>(null);
  readonly canManage = computed(() => this.identity()?.CanManage === 1);

  readonly model = signal<IdentityForm>({ ...EMPTY_FORM });
  private readonly baseline = signal<IdentityForm>({ ...EMPTY_FORM });

  readonly identityForm = form(this.model, (schema) => {
    required(schema.countryCode);
    required(schema.partyType);
    required(schema.legalName);
    maxLength(schema.legalName, 200);
    maxLength(schema.tradeName, 150);
    email(schema.billingEmail);
    required(schema.addressStreet);
    required(schema.addressCity);
    // Brazilian addresses need CEP and UF and follow the bank payer limits (checked by the API too).
    required(schema.addressZip, { when: ({ valueOf }) => valueOf(schema.countryCode) === 'BR' });
    required(schema.addressState, { when: ({ valueOf }) => valueOf(schema.countryCode) === 'BR' });
    pattern(schema.addressZip, /^(\d{5}-?\d{3})?$/, {
      when: ({ valueOf }) => valueOf(schema.countryCode) === 'BR',
    });
    maxLength(schema.addressStreet, 100);
    maxLength(schema.addressNumber, 10);
    maxLength(schema.addressComplement, 30);
    maxLength(schema.addressDistrict, 60);
    maxLength(schema.addressCity, 60);
    const locked = () => !this.canManage();
    disabled(schema.countryCode, locked);
    disabled(schema.partyType, locked);
    disabled(schema.taxIdType, locked);
    disabled(schema.taxId, locked);
    disabled(schema.legalName, locked);
    disabled(schema.tradeName, locked);
    disabled(schema.billingEmail, locked);
    for (const key of ADDRESS_KEYS) disabled(schema[key], locked);
  });

  readonly countryOptions = computed(() => countryOptions(this.i18n.language()));
  readonly stateOptions = BR_STATE_OPTIONS;
  readonly isBrazil = computed(() => this.model().countryCode === 'BR');
  readonly searchingZip = signal(false);
  readonly partyOptions = [
    { value: 'business', label: 'Business (company)' },
    { value: 'individual', label: 'Individual (person)' },
  ];

  readonly typeChoices = computed(() =>
    taxIdTypesFor(
      this.catalogResource.value() ?? [],
      this.model().countryCode,
      this.model().partyType,
    ),
  );
  readonly taxIdRequired = computed(() => this.typeChoices().some((item) => item.IsRequired));
  readonly typeOptions = computed(() => {
    const options = this.typeChoices().map((item) => ({
      value: item.TaxIdType,
      label: item.TaxIdType === 'other' ? this.i18n.t('Tax ID') : item.Label,
    }));
    return this.taxIdRequired()
      ? options
      : [{ value: '', label: this.i18n.t('Not informed') }, ...options];
  });
  readonly selectedType = computed(
    () => this.typeChoices().find((item) => item.TaxIdType === this.model().taxIdType) ?? null,
  );
  readonly taxIdPlaceholder = computed(() => {
    const type = this.selectedType();
    if (type?.DisplayFormat) return type.DisplayFormat.replace(/#/g, '0');
    return type?.Prefix ? `${type.Prefix}…` : '';
  });

  /** Format check only; check digits are validated by the API. */
  readonly taxIdError = computed(() => {
    const { taxIdType, taxId } = this.model();
    const type = this.selectedType();
    if (!taxIdType) {
      return this.taxIdRequired() || taxId.trim() ? 'Select the tax ID type.' : null;
    }
    if (!taxId.trim()) return 'Enter the tax ID.';
    if (!type) return null;
    return new RegExp(type.Pattern, 'u').test(normalizeTaxId(taxId, type))
      ? null
      : 'Tax ID format is invalid.';
  });

  readonly dirty = computed(() => JSON.stringify(this.model()) !== JSON.stringify(this.baseline()));
  readonly valid = computed(() => this.identityForm().valid() && !this.taxIdError());

  private readonly identityEffect = effect(() => {
    const identity = this.identityResource.value();
    if (identity === undefined) return;
    this.applyIdentity(identity);
  });

  private readonly errorEffect = effect(() => {
    const error = this.identityResource.error() ?? this.catalogResource.error();
    if (error) this.apiError.set(this.errorMessage(error));
  });

  /** Keeps the tax ID type consistent with the selected country and party type. */
  private readonly typeEffect = effect(() => {
    const choices = this.typeChoices();
    if (!this.catalogResource.value()) return;
    const current = this.model().taxIdType;
    if (current === '' && !this.taxIdRequired()) return;
    if (choices.some((item) => item.TaxIdType === current)) return;
    const next = this.taxIdRequired() ? (choices[0]?.TaxIdType ?? '') : '';
    this.model.update((value) => ({ ...value, taxIdType: next, taxId: '' }));
  });

  reload(): void {
    this.apiError.set(null);
    this.identityResource.reload();
    this.catalogResource.reload();
  }

  cancel(): void {
    this.model.set({ ...this.baseline() });
  }

  async save(): Promise<void> {
    if (this.saving() || !this.valid() || !this.canManage()) return;
    const value = this.model();
    this.saving.set(true);
    this.apiError.set(null);
    try {
      const response = await this.api.put<{ data?: { item?: TenantIdentity } }>(
        'billing/identity',
        {
          countryCode: value.countryCode,
          partyType: value.partyType,
          taxIdType: value.taxIdType || null,
          taxId: value.taxId.trim() || null,
          legalName: value.legalName.trim(),
          tradeName: value.tradeName.trim() || null,
          billingEmail: value.billingEmail.trim() || null,
          ...Object.fromEntries(ADDRESS_KEYS.map((key) => [key, value[key].trim() || null])),
        },
      );
      this.applyIdentity(response.data?.item ?? null);
      this.tenants.notifyAccessChanged();
      this.snack.success(this.i18n.t('Tax identity saved.'));
    } catch (error) {
      const message = this.errorMessage(error);
      this.apiError.set(message);
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  async copyTenantCode(): Promise<void> {
    const code = this.identity()?.TenantCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      this.snack.success(this.i18n.t('Data copied.'));
    } catch {
      this.snack.error(this.i18n.t('Failed to copy data.'));
    }
  }

  /** Fills street, district, city and state from the CEP (platform postal-code lookup). */
  async searchZip(): Promise<void> {
    const zip = this.model().addressZip.replace(/\D/g, '');
    if (zip.length !== 8) {
      this.snack.warning(this.i18n.t('Invalid postal code. Provide 8 digits.'));
      return;
    }
    this.searchingZip.set(true);
    try {
      const response = await this.api.get<{ data?: { item?: Record<string, string | null> } }>(
        `postal-codes/${zip}`,
      );
      const item = response?.data?.item ?? {};
      this.model.update((current) => ({
        ...current,
        addressZip: zip,
        addressStreet: item['street'] || current.addressStreet,
        addressDistrict: item['district'] || current.addressDistrict,
        addressCity: item['city'] || current.addressCity,
        addressState: item['state'] || current.addressState,
      }));
    } catch (error) {
      this.snack.error(this.errorMessage(error));
    } finally {
      this.searchingZip.set(false);
    }
  }

  private applyIdentity(identity: TenantIdentity | null): void {
    this.identity.set(identity);
    const next: IdentityForm = identity?.TidUUID
      ? {
          countryCode: identity.TidCountryCode ?? 'BR',
          partyType: identity.TidPartyType ?? 'business',
          taxIdType: identity.TidTaxIdType ?? '',
          taxId: identity.TidTaxId ?? identity.TaxIdDisplay ?? '',
          legalName: identity.TidLegalName ?? '',
          tradeName: identity.TidTradeName ?? '',
          billingEmail: identity.TidBillingEmail ?? '',
          addressZip: identity.TidAddressZip ?? '',
          addressStreet: identity.TidAddressStreet ?? '',
          addressNumber: identity.TidAddressNumber ?? '',
          addressComplement: identity.TidAddressComplement ?? '',
          addressDistrict: identity.TidAddressDistrict ?? '',
          addressCity: identity.TidAddressCity ?? '',
          addressState: identity.TidAddressState ?? '',
        }
      : { ...EMPTY_FORM };
    this.baseline.set(next);
    this.model.set({ ...next });
  }

  private errorMessage(error: unknown): string {
    const body = (error as { error?: { error?: string } })?.error;
    const message = body?.error ?? (error instanceof Error ? error.message : '');
    return this.i18n.t(message || 'Failed to save tax identity.');
  }
}
