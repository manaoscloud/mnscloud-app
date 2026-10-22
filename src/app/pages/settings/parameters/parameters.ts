import {
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';

import { ActivatedRoute } from '@angular/router';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { lastValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { AppI18nService, isAppLanguage } from '../../../services/app-i18n.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { buildTimezoneOptions } from '../../../shared/i18n/timezones';

type SystemParametersItem = {
  sprUUID: string | null;
  googleMapsEmbedApiKey: string;
  googleMapsEmbedApiKeyIsActive: boolean;
  mapboxToken: string;
  mapboxTokenIsActive: boolean;
  signalWireRepoToken: string;
  signalWireRepoTokenIsActive: boolean;
  defaultCurrency: string;
  defaultCurrencyIsActive: boolean;
  defaultLanguage: string;
  defaultLanguageIsActive: boolean;
  defaultTimezone: string;
  defaultTimezoneIsActive: boolean;
  signupCaptchaEnabled: boolean;
  signupCaptchaProvider: 'turnstile' | 'hcaptcha' | '';
  signupCaptchaSiteKey: string;
  signupCaptchaSecret: string;
  signupMaxAccountsPerIpDay: number;
  loginCaptchaEnabled: boolean;
  authRememberMeEnabled: boolean;
  authSessionHours: number;
  authRememberMeHours: number;
  posSessionIdleHours: number;
  posSessionMaxHours: number;
};

type BradescoSiadItem = {
  environment: 'dsv' | 'hml' | 'prd';
  origin: string;
  suborigin: string;
  referenciado: string;
  isActive: boolean;
  credentialsConfigured: boolean;
  credentialsUpdatedAt: string | null;
  credential: {
    certificateFilename: string;
    certificateFingerprintSha256: string;
    certificateNotAfter: string;
  } | null;
};

type BradescoSiadCredentials = {
  clientId: string;
  clientSecret: string;
};

const DEFAULT_SIAD_ITEM: BradescoSiadItem = {
  environment: 'dsv',
  origin: '',
  suborigin: '',
  referenciado: '',
  isActive: false,
  credentialsConfigured: false,
  credentialsUpdatedAt: null,
  credential: null,
};

const DEFAULT_SIAD_CREDENTIALS: BradescoSiadCredentials = {
  clientId: '',
  clientSecret: '',
};

const DEFAULT_ITEM: SystemParametersItem = {
  sprUUID: null,
  googleMapsEmbedApiKey: '',
  googleMapsEmbedApiKeyIsActive: true,
  mapboxToken: '',
  mapboxTokenIsActive: true,
  signalWireRepoToken: '',
  signalWireRepoTokenIsActive: true,
  defaultCurrency: 'BRL',
  defaultCurrencyIsActive: true,
  defaultLanguage: 'pt-BR',
  defaultLanguageIsActive: true,
  defaultTimezone: '',
  defaultTimezoneIsActive: true,
  signupCaptchaEnabled: false,
  signupCaptchaProvider: '',
  signupCaptchaSiteKey: '',
  signupCaptchaSecret: '',
  signupMaxAccountsPerIpDay: 3,
  loginCaptchaEnabled: false,
  authRememberMeEnabled: true,
  authSessionHours: 12,
  authRememberMeHours: 720,
  posSessionIdleHours: 12,
  posSessionMaxHours: 168,
};

@Component({
  selector: 'app-settings-parameters',
  standalone: true,
  imports: [
    SettingsPageComponent,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTabsModule,
    TranslocoPipe,
    MatSelectModule,
    MatDialogModule,
    FieldHelpComponent,
    MnsSearchSelectFieldComponent,
  ],
  templateUrl: './parameters.html',
  styleUrls: ['./parameters.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class SettingsParametersPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(AppI18nService);

  readonly scope = signal<string>(this.route.snapshot.data?.['scope'] ?? 'tenant');
  readonly isMaster = computed(() => this.scope() === 'master');
  readonly pageTitle = computed(() => (this.isMaster() ? 'System Parameters' : 'Parameters'));
  readonly pageSubtitle = computed(() =>
    this.isMaster()
      ? 'Single master record with global default values.'
      : 'Single tenant record. Empty tenant values fallback to master defaults.',
  );
  readonly defaultTimezonePlaceholder = computed(() =>
    this.isMaster() ? 'UTC' : 'Master timezone',
  );
  readonly timezoneOptions = computed(() =>
    buildTimezoneOptions({
      fallbackLabel: this.isMaster() ? 'System default (UTC)' : 'Master default timezone',
      currentValue: this.item().defaultTimezone,
    }),
  );
  readonly baseEndpoint = computed(() =>
    this.isMaster() ? 'system/parameters' : 'settings/parameters',
  );
  readonly languageOptions = this.i18n.availableLanguages;

  private readonly parametersResource = resource({
    params: () => ({
      endpoint: this.baseEndpoint(),
      isMaster: this.isMaster(),
    }),
    defaultValue: { ...DEFAULT_ITEM },
    loader: async ({ params }) => this.readItem(await this.api.get<any>(params.endpoint)),
  });

  private readonly siadResource = resource({
    params: () => (this.isMaster() ? undefined : true),
    defaultValue: { ...DEFAULT_SIAD_ITEM },
    loader: () => this.loadSiad(),
  });

  readonly loading = computed(
    () =>
      this.parametersResource.isLoading() || (!this.isMaster() && this.siadResource.isLoading()),
  );
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly showGoogleMapsEmbedApiKey = signal(false);
  readonly showMapboxToken = signal(false);
  readonly showSignalWireRepoToken = signal(false);
  readonly showSignupCaptchaSecret = signal(false);
  readonly item = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly baselineItem = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly baselineSignature = signal('');
  readonly siadItem = signal<BradescoSiadItem>({ ...DEFAULT_SIAD_ITEM });
  readonly baselineSiad = signal<BradescoSiadItem>({ ...DEFAULT_SIAD_ITEM });
  readonly siadCredentials = signal<BradescoSiadCredentials>({ ...DEFAULT_SIAD_CREDENTIALS });
  readonly siadCertificateFile = signal<File | null>(null);
  readonly siadPrivateKeyFile = signal<File | null>(null);
  readonly baselineSiadSignature = signal('');
  readonly showSiadClientSecret = signal(false);
  readonly showSiadPrivateKey = signal(false);
  readonly hasChanges = computed(
    () =>
      this.buildSignature(this.item()) !== this.baselineSignature() ||
      (!this.isMaster() &&
        this.buildSiadSignature(this.siadItem()) !== this.baselineSiadSignature()) ||
      (!this.isMaster() &&
        Object.values(this.siadCredentials()).some((value) => value.trim() !== '')),
  );

  constructor() {
    effect(() => {
      const item = this.parametersResource.hasValue() ? this.parametersResource.value() : undefined;
      if (!item) return;
      this.item.set(item);
      this.baselineItem.set({ ...item });
      this.baselineSignature.set(this.buildSignature(item));
    });

    effect(() => {
      if (this.isMaster()) return;
      if (!this.siadResource.hasValue()) return;
      const item = this.siadResource.value();
      this.siadItem.set(item);
      this.baselineSiad.set({ ...item });
      this.baselineSiadSignature.set(this.buildSiadSignature(item));
      this.siadCredentials.set({ ...DEFAULT_SIAD_CREDENTIALS });
    });

    effect(() => {
      const error = this.parametersResource.error();
      if (!error) return;
      this.feedback.set(this.friendlyError(error, 'Failed to load parameters.'));
      this.item.set({ ...DEFAULT_ITEM });
      this.baselineItem.set({ ...DEFAULT_ITEM });
      this.baselineSignature.set(this.buildSignature(DEFAULT_ITEM));
    });

    effect(() => {
      if (this.isMaster()) return;
      const error = this.siadResource.error();
      if (!error) return;
      this.feedback.set(this.friendlyError(error, 'Failed to load SIAD integration.'));
    });
  }

  refreshItems() {
    if (this.hasChanges() || this.saving()) return;
    this.feedback.set(null);
    this.success.set(null);
    this.parametersResource.reload();
    if (!this.isMaster()) this.siadResource.reload();
  }

  updateItem(patch: Partial<SystemParametersItem>) {
    this.item.set({ ...this.item(), ...patch });
  }

  updateTimezone(value: unknown) {
    this.updateItem({ defaultTimezone: typeof value === 'string' ? value.trim() : '' });
  }

  updateSiad(patch: Partial<BradescoSiadItem>) {
    this.siadItem.set({ ...this.siadItem(), ...patch });
  }

  updateSiadCredentials(patch: Partial<BradescoSiadCredentials>) {
    this.siadCredentials.set({ ...this.siadCredentials(), ...patch });
  }

  selectSiadCertificate(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.siadCertificateFile.set(file);
    input.value = '';
  }

  selectSiadPrivateKey(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.siadPrivateKeyFile.set(file);
    input.value = '';
  }

  cancelChanges() {
    this.item.set({ ...this.baselineItem() });
    this.siadItem.set({ ...this.baselineSiad() });
    this.siadCredentials.set({ ...DEFAULT_SIAD_CREDENTIALS });
    this.siadCertificateFile.set(null);
    this.siadPrivateKeyFile.set(null);
    this.feedback.set(null);
    this.success.set(null);
  }

  async saveAll() {
    if (!this.hasChanges() || this.saving() || this.loading()) return;

    this.saving.set(true);
    this.feedback.set(null);
    this.success.set(null);

    try {
      const parameterChanged = this.buildSignature(this.item()) !== this.baselineSignature();
      if (parameterChanged) {
        const payload = this.normalizeForSave(this.item());
        const result = await this.api.put<any>(this.baseEndpoint(), { item: payload });
        const savedItem = this.readItem(result);
        this.item.set(savedItem);
        this.baselineItem.set({ ...savedItem });
        this.baselineSignature.set(this.buildSignature(savedItem));
        if (savedItem.defaultLanguageIsActive && isAppLanguage(savedItem.defaultLanguage)) {
          this.i18n.applyResolvedSystemLanguage(savedItem.defaultLanguage, true);
        }
      }
      if (!this.isMaster()) {
        const siadChanged =
          this.buildSiadSignature(this.siadItem()) !== this.baselineSiadSignature();
        let savedSiad = this.siadItem();
        if (siadChanged) {
          const result = await this.api.put<any>(
            'settings/integrations/bradesco/siad',
            this.siadItem(),
          );
          savedSiad = this.readSiad(result);
        }
        const certificate = this.siadCertificateFile();
        const privateKey = this.siadPrivateKeyFile();
        const hasCredentialInput =
          Object.values(this.siadCredentials()).some((value) => value.trim() !== '') ||
          certificate ||
          privateKey;
        if (hasCredentialInput) {
          if (!certificate || !privateKey) {
            throw new Error('Select both the SIAD certificate and private key.');
          }
          const formData = new FormData();
          formData.set('clientId', this.siadCredentials().clientId);
          formData.set('clientSecret', this.siadCredentials().clientSecret);
          formData.set('certificate', certificate, certificate.name);
          formData.set('privateKey', privateKey, privateKey.name);
          const progress = await lastValueFrom(
            this.api.postFormWithProgress<any>(
              'settings/integrations/bradesco/siad/credentials',
              formData,
            ),
          );
          savedSiad = this.readSiad(progress.response);
        }
        this.siadItem.set(savedSiad);
        this.baselineSiad.set({ ...savedSiad });
        this.baselineSiadSignature.set(this.buildSiadSignature(savedSiad));
        this.siadCredentials.set({ ...DEFAULT_SIAD_CREDENTIALS });
        this.siadCertificateFile.set(null);
        this.siadPrivateKeyFile.set(null);
      }
      this.success.set('Parameters saved successfully.');
    } catch (error) {
      this.feedback.set(this.friendlyError(error, 'Failed to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  private readItem(result: any): SystemParametersItem {
    const item = result?.data?.item;
    return this.normalizeIncoming(item && typeof item === 'object' ? item : {});
  }

  private normalizeIncoming(raw: any): SystemParametersItem {
    return {
      sprUUID: typeof raw?.sprUUID === 'string' && raw.sprUUID.trim() ? raw.sprUUID : null,
      googleMapsEmbedApiKey: String(raw?.googleMapsEmbedApiKey ?? ''),
      googleMapsEmbedApiKeyIsActive: raw?.googleMapsEmbedApiKeyIsActive !== false,
      mapboxToken: String(raw?.mapboxToken ?? ''),
      mapboxTokenIsActive: raw?.mapboxTokenIsActive !== false,
      signalWireRepoToken: String(raw?.signalWireRepoToken ?? ''),
      signalWireRepoTokenIsActive: raw?.signalWireRepoTokenIsActive !== false,
      defaultCurrency: String(raw?.defaultCurrency ?? 'BRL') || 'BRL',
      defaultCurrencyIsActive: raw?.defaultCurrencyIsActive !== false,
      defaultLanguage: String(raw?.defaultLanguage ?? 'pt-BR') || 'pt-BR',
      defaultLanguageIsActive: raw?.defaultLanguageIsActive !== false,
      defaultTimezone: String(raw?.defaultTimezone ?? ''),
      defaultTimezoneIsActive: raw?.defaultTimezoneIsActive !== false,
      signupCaptchaEnabled: raw?.signupCaptchaEnabled === true,
      signupCaptchaProvider: this.normalizeCaptchaProvider(raw?.signupCaptchaProvider),
      signupCaptchaSiteKey: String(raw?.signupCaptchaSiteKey ?? ''),
      signupCaptchaSecret: String(raw?.signupCaptchaSecret ?? ''),
      signupMaxAccountsPerIpDay: this.normalizeInteger(raw?.signupMaxAccountsPerIpDay, 3),
      loginCaptchaEnabled: raw?.loginCaptchaEnabled === true,
      authRememberMeEnabled: raw?.authRememberMeEnabled !== false,
      authSessionHours: this.normalizeInteger(raw?.authSessionHours, 12),
      authRememberMeHours: this.normalizeInteger(raw?.authRememberMeHours, 720),
      posSessionIdleHours: this.normalizeInteger(raw?.posSessionIdleHours, 12),
      posSessionMaxHours: this.normalizeInteger(raw?.posSessionMaxHours, 168),
    };
  }

  private normalizeForSave(value: SystemParametersItem): SystemParametersItem {
    return {
      ...value,
      googleMapsEmbedApiKey: value.googleMapsEmbedApiKey.trim(),
      mapboxToken: value.mapboxToken.trim(),
      signalWireRepoToken: this.isMaster() ? value.signalWireRepoToken.trim() : '',
      defaultCurrency: (value.defaultCurrency.trim() || 'BRL').toUpperCase(),
      defaultLanguage: isAppLanguage(value.defaultLanguage) ? value.defaultLanguage : 'pt-BR',
      defaultTimezone: value.defaultTimezone.trim(),
      signupCaptchaProvider: value.signupCaptchaProvider,
      signupCaptchaSiteKey: value.signupCaptchaSiteKey.trim(),
      signupCaptchaSecret: value.signupCaptchaSecret.trim(),
      signupMaxAccountsPerIpDay: this.clampInteger(value.signupMaxAccountsPerIpDay, 1, 100),
      authSessionHours: this.clampInteger(value.authSessionHours, 1, 168),
      authRememberMeHours: this.clampInteger(value.authRememberMeHours, 1, 2160),
      posSessionIdleHours: this.clampInteger(value.posSessionIdleHours, 1, 168),
      posSessionMaxHours: this.clampInteger(value.posSessionMaxHours, 1, 720),
    };
  }

  private buildSignature(value: SystemParametersItem): string {
    return JSON.stringify({
      googleMapsEmbedApiKey: value.googleMapsEmbedApiKey,
      googleMapsEmbedApiKeyIsActive: value.googleMapsEmbedApiKeyIsActive,
      mapboxToken: value.mapboxToken,
      mapboxTokenIsActive: value.mapboxTokenIsActive,
      signalWireRepoToken: value.signalWireRepoToken,
      signalWireRepoTokenIsActive: value.signalWireRepoTokenIsActive,
      defaultCurrency: value.defaultCurrency,
      defaultCurrencyIsActive: value.defaultCurrencyIsActive,
      defaultLanguage: value.defaultLanguage,
      defaultLanguageIsActive: value.defaultLanguageIsActive,
      defaultTimezone: value.defaultTimezone,
      defaultTimezoneIsActive: value.defaultTimezoneIsActive,
      signupCaptchaEnabled: value.signupCaptchaEnabled,
      signupCaptchaProvider: value.signupCaptchaProvider,
      signupCaptchaSiteKey: value.signupCaptchaSiteKey,
      signupCaptchaSecret: value.signupCaptchaSecret,
      signupMaxAccountsPerIpDay: value.signupMaxAccountsPerIpDay,
      loginCaptchaEnabled: value.loginCaptchaEnabled,
      authRememberMeEnabled: value.authRememberMeEnabled,
      authSessionHours: value.authSessionHours,
      authRememberMeHours: value.authRememberMeHours,
      posSessionIdleHours: value.posSessionIdleHours,
      posSessionMaxHours: value.posSessionMaxHours,
    });
  }

  private buildSiadSignature(value: BradescoSiadItem): string {
    return JSON.stringify({
      environment: value.environment,
      origin: value.origin,
      suborigin: value.suborigin,
      referenciado: value.referenciado,
      isActive: value.isActive,
    });
  }

  private async loadSiad(): Promise<BradescoSiadItem> {
    return this.readSiad(await this.api.get<any>('settings/integrations/bradesco/siad'));
  }

  private readSiad(result: any): BradescoSiadItem {
    const raw = result?.data?.item ?? result?.item ?? result ?? {};
    const environment = String(raw?.environment ?? 'dsv').toLowerCase();
    return {
      environment: environment === 'hml' || environment === 'prd' ? environment : 'dsv',
      origin: String(raw?.origin ?? ''),
      suborigin: String(raw?.suborigin ?? ''),
      referenciado: String(raw?.referenciado ?? ''),
      isActive: raw?.isActive === true,
      credentialsConfigured: raw?.credentialsConfigured === true,
      credentialsUpdatedAt: raw?.credentialsUpdatedAt ? String(raw.credentialsUpdatedAt) : null,
      credential:
        raw?.credential && typeof raw.credential === 'object'
          ? {
              certificateFilename: String(raw.credential.certificateFilename ?? ''),
              certificateFingerprintSha256: String(
                raw.credential.certificateFingerprintSha256 ?? '',
              ),
              certificateNotAfter: String(raw.credential.certificateNotAfter ?? ''),
            }
          : null,
    };
  }

  private normalizeCaptchaProvider(value: unknown): 'turnstile' | 'hcaptcha' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'turnstile' || normalized === 'hcaptcha' ? normalized : '';
  }

  private normalizeInteger(value: unknown, fallback: number): number {
    const parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private clampInteger(value: unknown, min: number, max: number): number {
    const parsed = this.normalizeInteger(value, min);
    return Math.min(Math.max(parsed, min), max);
  }

  private friendlyError(error: unknown, fallback: string) {
    const message = (error as any)?.error?.error;
    if (typeof message === 'string' && message.trim()) return message;
    const raw = (error as any)?.message;
    if (typeof raw === 'string' && raw.trim()) return raw;
    return fallback;
  }
}
