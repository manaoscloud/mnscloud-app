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

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { lastValueFrom } from 'rxjs';

import { ApiService } from '../../../services/api.service';
import { AppI18nService, isAppLanguage } from '../../../services/app-i18n.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../../../shared/refresh-button/refresh-button';

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
  voipPabxRecordingStorageMode: 'filesystem' | 'storage' | '';
  voipPabxRecordingStorageAccountUUID: string;
  voipPabxRecordingStorageIsActive: boolean;
  voipPabxMediaStorageMode: 'filesystem' | 'storage' | '';
  voipPabxMediaStorageAccountUUID: string;
  voipPabxMediaStorageIsActive: boolean;
  voipPabxMediaDeliveryMode: 'online' | 'offline' | '';
  voipPabxMediaDeliveryModeIsActive: boolean;
  voipPabxRemoteCommandExecutor: 'agent' | 'esl_ami' | '';
  voipPabxRemoteCommandExecutorIsActive: boolean;
  voipPabxAutoDomainEnabled: boolean;
  voipPabxAutoDomainBase: string;
  voipPabxAutoDomainLabelMode: 'uuid_short';
  voipPabxAutoDomainUuidLength: number;
  voipPabxAutoDomainSetDefault: boolean;
  voipPabxAutoDomainDnsMode: 'identity_only';
  voipPabxAutoDomainIsActive: boolean;
  billingSignupTrialEnabled: boolean;
  billingSignupTrialAmount: number;
  billingSignupTrialCurrency: string;
  billingSignupTrialExpiresDays: number;
  billingSignupTrialRequireEmailVerified: boolean;
  signupCaptchaEnabled: boolean;
  signupCaptchaProvider: 'turnstile' | 'hcaptcha' | '';
  signupCaptchaSiteKey: string;
  signupCaptchaSecret: string;
  signupMaxAccountsPerIpDay: number;
  loginCaptchaEnabled: boolean;
  authRememberMeEnabled: boolean;
  authSessionHours: number;
  authRememberMeHours: number;
};

type StorageAccountItem = {
  HsaUUID: string;
  HsaName: string;
  HspName?: string | null;
  HspProvider?: string | null;
};

type ParametersSnapshot = {
  item: SystemParametersItem;
  storageAccounts: StorageAccountItem[];
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
  environment: 'dsv', origin: '', suborigin: '', referenciado: '', isActive: false,
  credentialsConfigured: false, credentialsUpdatedAt: null, credential: null,
};

const DEFAULT_SIAD_CREDENTIALS: BradescoSiadCredentials = {
  clientId: '', clientSecret: '',
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
  voipPabxRecordingStorageMode: '',
  voipPabxRecordingStorageAccountUUID: '',
  voipPabxRecordingStorageIsActive: true,
  voipPabxMediaStorageMode: '',
  voipPabxMediaStorageAccountUUID: '',
  voipPabxMediaStorageIsActive: true,
  voipPabxMediaDeliveryMode: '',
  voipPabxMediaDeliveryModeIsActive: true,
  voipPabxRemoteCommandExecutor: '',
  voipPabxRemoteCommandExecutorIsActive: true,
  voipPabxAutoDomainEnabled: true,
  voipPabxAutoDomainBase: 'pabx.publichost.cloud',
  voipPabxAutoDomainLabelMode: 'uuid_short',
  voipPabxAutoDomainUuidLength: 12,
  voipPabxAutoDomainSetDefault: true,
  voipPabxAutoDomainDnsMode: 'identity_only',
  voipPabxAutoDomainIsActive: true,
  billingSignupTrialEnabled: false,
  billingSignupTrialAmount: 0,
  billingSignupTrialCurrency: 'BRL',
  billingSignupTrialExpiresDays: 15,
  billingSignupTrialRequireEmailVerified: true,
  signupCaptchaEnabled: false,
  signupCaptchaProvider: '',
  signupCaptchaSiteKey: '',
  signupCaptchaSecret: '',
  signupMaxAccountsPerIpDay: 3,
  loginCaptchaEnabled: false,
  authRememberMeEnabled: true,
  authSessionHours: 12,
  authRememberMeHours: 720,
};

@Component({
  selector: 'app-settings-parameters',
  standalone: true,
  imports: [
    RefreshButtonComponent,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTabsModule,
    TranslocoPipe,
    MatSelectModule,
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
  readonly voipPabxRecordingStoragePlaceholder = computed(() =>
    this.isMaster() ? 'Filesystem' : 'Master recording storage',
  );
  readonly voipPabxMediaStoragePlaceholder = computed(() =>
    this.isMaster() ? 'Filesystem' : 'Master media file storage',
  );
  readonly voipPabxMediaDeliveryPlaceholder = computed(() =>
    this.isMaster() ? 'Offline' : 'Master media file delivery',
  );
  readonly voipPabxRemoteCommandExecutorPlaceholder = computed(() =>
    this.isMaster() ? 'Agent' : 'Master remote command executor',
  );
  readonly voipPabxAutoDomainBasePlaceholder = computed(() =>
    this.isMaster() ? 'pabx.publichost.cloud' : 'Master PABX SIP realm base',
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
    defaultValue: {
      item: { ...DEFAULT_ITEM },
      storageAccounts: [],
    } as ParametersSnapshot,
    loader: ({ params }) => this.loadParametersSnapshot(params.endpoint, params.isMaster),
  });

  private readonly siadResource = resource({
    params: () => this.isMaster() ? undefined : true,
    defaultValue: { ...DEFAULT_SIAD_ITEM },
    loader: () => this.loadSiad(),
  });

  readonly loading = computed(() => this.parametersResource.isLoading() || (!this.isMaster() && this.siadResource.isLoading()));
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly showGoogleMapsEmbedApiKey = signal(false);
  readonly showMapboxToken = signal(false);
  readonly showSignalWireRepoToken = signal(false);
  readonly showSignupCaptchaSecret = signal(false);
  readonly item = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly baselineItem = signal<SystemParametersItem>({ ...DEFAULT_ITEM });
  readonly storageAccounts = signal<StorageAccountItem[]>([]);
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
    () => this.buildSignature(this.item()) !== this.baselineSignature()
      || (!this.isMaster() && this.buildSiadSignature(this.siadItem()) !== this.baselineSiadSignature())
      || (!this.isMaster() && Object.values(this.siadCredentials()).some((value) => value.trim() !== '')),
  );

  constructor() {
    effect(() => {
      const snapshot = this.parametersResource.value();
      if (!snapshot) return;
      this.storageAccounts.set(snapshot.storageAccounts);
      this.item.set(snapshot.item);
      this.baselineItem.set({ ...snapshot.item });
      this.baselineSignature.set(this.buildSignature(snapshot.item));
    });

    effect(() => {
      if (this.isMaster()) return;
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
      this.storageAccounts.set([]);
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
    this.feedback.set(null);
    this.success.set(null);
    this.parametersResource.reload();
    if (!this.isMaster()) this.siadResource.reload();
  }

  updateItem(patch: Partial<SystemParametersItem>) {
    this.item.set({ ...this.item(), ...patch });
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
    if (!this.hasChanges()) return;

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
        const siadChanged = this.buildSiadSignature(this.siadItem()) !== this.baselineSiadSignature();
        let savedSiad = this.siadItem();
        if (siadChanged) {
          const result = await this.api.put<any>('settings/integrations/bradesco/siad', this.siadItem());
          savedSiad = this.readSiad(result);
        }
        const certificate = this.siadCertificateFile();
        const privateKey = this.siadPrivateKeyFile();
        const hasCredentialInput = Object.values(this.siadCredentials()).some((value) => value.trim() !== '') || certificate || privateKey;
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
            this.api.postFormWithProgress<any>('settings/integrations/bradesco/siad/credentials', formData),
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
    const direct = result?.data?.item;
    if (direct && typeof direct === 'object') {
      return this.normalizeIncoming(direct);
    }

    const items = Array.isArray(result?.data?.items)
      ? result.data.items
      : Array.isArray(result)
        ? result
        : [];

    return this.fromLegacyItems(items);
  }

  private fromLegacyItems(items: any[]): SystemParametersItem {
    const item: SystemParametersItem = { ...DEFAULT_ITEM };

    for (const row of items) {
      const key = String(row?.SprKey ?? '').toUpperCase();
      const value =
        row?.SprValue === null || row?.SprValue === undefined ? '' : String(row.SprValue);
      const isActive = Number(row?.SprIsActive ?? 1) === 1;

      if (key === 'GOOGLE_MAPS_EMBED_API_KEY') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.googleMapsEmbedApiKey = value;
        item.googleMapsEmbedApiKeyIsActive = isActive;
      } else if (key === 'MAPBOX_TOKEN') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.mapboxToken = value;
        item.mapboxTokenIsActive = isActive;
      } else if (key === 'SIGNALWIRE_REPO_TOKEN') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.signalWireRepoToken = value;
        item.signalWireRepoTokenIsActive = isActive;
      } else if (key === 'DEFAULT_CURRENCY') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultCurrency = value || 'BRL';
        item.defaultCurrencyIsActive = isActive;
      } else if (key === 'DEFAULT_LANGUAGE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultLanguage = value || 'pt-BR';
        item.defaultLanguageIsActive = isActive;
      } else if (key === 'DEFAULT_TIMEZONE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.defaultTimezone = value;
        item.defaultTimezoneIsActive = isActive;
      } else if (key === 'VOIP_PABX_RECORDING_STORAGE_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRecordingStorageMode = this.normalizeStorageMode(value);
        item.voipPabxRecordingStorageIsActive = isActive;
      } else if (key === 'VOIP_PABX_RECORDING_STORAGE_ACCOUNT') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRecordingStorageAccountUUID = value;
      } else if (key === 'VOIP_PABX_MEDIA_STORAGE_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaStorageMode = this.normalizeStorageMode(value);
        item.voipPabxMediaStorageIsActive = isActive;
      } else if (key === 'VOIP_PABX_MEDIA_STORAGE_ACCOUNT') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaStorageAccountUUID = value;
      } else if (key === 'VOIP_PABX_MEDIA_DELIVERY_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxMediaDeliveryMode = this.normalizeDeliveryMode(value);
        item.voipPabxMediaDeliveryModeIsActive = isActive;
      } else if (key === 'VOIP_PABX_REMOTE_COMMAND_EXECUTOR') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxRemoteCommandExecutor = this.normalizeRemoteCommandExecutor(value);
        item.voipPabxRemoteCommandExecutorIsActive = isActive;
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_ENABLED') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainEnabled = value === '' ? true : Number(value) !== 0;
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_BASE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainBase = value || DEFAULT_ITEM.voipPabxAutoDomainBase;
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_LABEL_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainLabelMode = this.normalizePabxAutoDomainLabelMode(value);
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_UUID_LENGTH') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainUuidLength = this.clampInteger(value || 12, 8, 32);
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_SET_DEFAULT') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainSetDefault = value === '' ? true : Number(value) !== 0;
      } else if (key === 'VOIP_PABX_AUTO_DOMAIN_DNS_MODE') {
        item.sprUUID = item.sprUUID || String(row?.SprUUID ?? '');
        item.voipPabxAutoDomainDnsMode = this.normalizePabxAutoDomainDnsMode(value);
        item.voipPabxAutoDomainIsActive = isActive;
      }
    }

    return item;
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
      voipPabxRecordingStorageMode: this.normalizeStorageMode(raw?.voipPabxRecordingStorageMode),
      voipPabxRecordingStorageAccountUUID: String(raw?.voipPabxRecordingStorageAccountUUID ?? ''),
      voipPabxRecordingStorageIsActive: raw?.voipPabxRecordingStorageIsActive !== false,
      voipPabxMediaStorageMode: this.normalizeStorageMode(raw?.voipPabxMediaStorageMode),
      voipPabxMediaStorageAccountUUID: String(raw?.voipPabxMediaStorageAccountUUID ?? ''),
      voipPabxMediaStorageIsActive: raw?.voipPabxMediaStorageIsActive !== false,
      voipPabxMediaDeliveryMode: this.normalizeDeliveryMode(raw?.voipPabxMediaDeliveryMode),
      voipPabxMediaDeliveryModeIsActive: raw?.voipPabxMediaDeliveryModeIsActive !== false,
      voipPabxRemoteCommandExecutor: this.normalizeRemoteCommandExecutor(
        raw?.voipPabxRemoteCommandExecutor,
      ),
      voipPabxRemoteCommandExecutorIsActive: raw?.voipPabxRemoteCommandExecutorIsActive !== false,
      voipPabxAutoDomainEnabled: raw?.voipPabxAutoDomainEnabled !== false,
      voipPabxAutoDomainBase:
        String(raw?.voipPabxAutoDomainBase ?? DEFAULT_ITEM.voipPabxAutoDomainBase).trim() ||
        DEFAULT_ITEM.voipPabxAutoDomainBase,
      voipPabxAutoDomainLabelMode: this.normalizePabxAutoDomainLabelMode(
        raw?.voipPabxAutoDomainLabelMode,
      ),
      voipPabxAutoDomainUuidLength: this.clampInteger(
        raw?.voipPabxAutoDomainUuidLength ?? 12,
        8,
        32,
      ),
      voipPabxAutoDomainSetDefault: raw?.voipPabxAutoDomainSetDefault !== false,
      voipPabxAutoDomainDnsMode: this.normalizePabxAutoDomainDnsMode(
        raw?.voipPabxAutoDomainDnsMode,
      ),
      voipPabxAutoDomainIsActive: raw?.voipPabxAutoDomainIsActive !== false,
      billingSignupTrialEnabled: raw?.billingSignupTrialEnabled === true,
      billingSignupTrialAmount: this.normalizeNumber(raw?.billingSignupTrialAmount, 0),
      billingSignupTrialCurrency: String(raw?.billingSignupTrialCurrency ?? 'BRL') || 'BRL',
      billingSignupTrialExpiresDays: this.normalizeInteger(raw?.billingSignupTrialExpiresDays, 15),
      billingSignupTrialRequireEmailVerified: raw?.billingSignupTrialRequireEmailVerified !== false,
      signupCaptchaEnabled: raw?.signupCaptchaEnabled === true,
      signupCaptchaProvider: this.normalizeCaptchaProvider(raw?.signupCaptchaProvider),
      signupCaptchaSiteKey: String(raw?.signupCaptchaSiteKey ?? ''),
      signupCaptchaSecret: String(raw?.signupCaptchaSecret ?? ''),
      signupMaxAccountsPerIpDay: this.normalizeInteger(raw?.signupMaxAccountsPerIpDay, 3),
      loginCaptchaEnabled: raw?.loginCaptchaEnabled === true,
      authRememberMeEnabled: raw?.authRememberMeEnabled !== false,
      authSessionHours: this.normalizeInteger(raw?.authSessionHours, 12),
      authRememberMeHours: this.normalizeInteger(raw?.authRememberMeHours, 720),
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
      voipPabxRecordingStorageMode: value.voipPabxRecordingStorageMode,
      voipPabxRecordingStorageAccountUUID:
        value.voipPabxRecordingStorageMode === 'storage'
          ? value.voipPabxRecordingStorageAccountUUID
          : '',
      voipPabxMediaStorageMode: value.voipPabxMediaStorageMode,
      voipPabxMediaStorageAccountUUID:
        value.voipPabxMediaStorageMode === 'storage' ? value.voipPabxMediaStorageAccountUUID : '',
      voipPabxMediaDeliveryMode: value.voipPabxMediaDeliveryMode,
      voipPabxRemoteCommandExecutor: value.voipPabxRemoteCommandExecutor,
      voipPabxAutoDomainBase:
        value.voipPabxAutoDomainBase.trim().toLowerCase().replace(/^\.+|\.+$/g, '') ||
        DEFAULT_ITEM.voipPabxAutoDomainBase,
      voipPabxAutoDomainLabelMode: this.normalizePabxAutoDomainLabelMode(
        value.voipPabxAutoDomainLabelMode,
      ),
      voipPabxAutoDomainUuidLength: this.clampInteger(value.voipPabxAutoDomainUuidLength, 8, 32),
      voipPabxAutoDomainDnsMode: this.normalizePabxAutoDomainDnsMode(
        value.voipPabxAutoDomainDnsMode,
      ),
      billingSignupTrialAmount: Math.max(Number(value.billingSignupTrialAmount || 0), 0),
      billingSignupTrialCurrency: (value.billingSignupTrialCurrency.trim() || 'BRL').toUpperCase(),
      billingSignupTrialExpiresDays: this.clampInteger(value.billingSignupTrialExpiresDays, 1, 365),
      signupCaptchaProvider: value.signupCaptchaProvider,
      signupCaptchaSiteKey: value.signupCaptchaSiteKey.trim(),
      signupCaptchaSecret: value.signupCaptchaSecret.trim(),
      signupMaxAccountsPerIpDay: this.clampInteger(value.signupMaxAccountsPerIpDay, 1, 100),
      authSessionHours: this.clampInteger(value.authSessionHours, 1, 168),
      authRememberMeHours: this.clampInteger(value.authRememberMeHours, 1, 2160),
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
      voipPabxRecordingStorageMode: value.voipPabxRecordingStorageMode,
      voipPabxRecordingStorageAccountUUID: value.voipPabxRecordingStorageAccountUUID,
      voipPabxRecordingStorageIsActive: value.voipPabxRecordingStorageIsActive,
      voipPabxMediaStorageMode: value.voipPabxMediaStorageMode,
      voipPabxMediaStorageAccountUUID: value.voipPabxMediaStorageAccountUUID,
      voipPabxMediaStorageIsActive: value.voipPabxMediaStorageIsActive,
      voipPabxMediaDeliveryMode: value.voipPabxMediaDeliveryMode,
      voipPabxMediaDeliveryModeIsActive: value.voipPabxMediaDeliveryModeIsActive,
      voipPabxRemoteCommandExecutor: value.voipPabxRemoteCommandExecutor,
      voipPabxRemoteCommandExecutorIsActive: value.voipPabxRemoteCommandExecutorIsActive,
      voipPabxAutoDomainEnabled: value.voipPabxAutoDomainEnabled,
      voipPabxAutoDomainBase: value.voipPabxAutoDomainBase,
      voipPabxAutoDomainLabelMode: value.voipPabxAutoDomainLabelMode,
      voipPabxAutoDomainUuidLength: value.voipPabxAutoDomainUuidLength,
      voipPabxAutoDomainSetDefault: value.voipPabxAutoDomainSetDefault,
      voipPabxAutoDomainDnsMode: value.voipPabxAutoDomainDnsMode,
      voipPabxAutoDomainIsActive: value.voipPabxAutoDomainIsActive,
      billingSignupTrialEnabled: value.billingSignupTrialEnabled,
      billingSignupTrialAmount: value.billingSignupTrialAmount,
      billingSignupTrialCurrency: value.billingSignupTrialCurrency,
      billingSignupTrialExpiresDays: value.billingSignupTrialExpiresDays,
      billingSignupTrialRequireEmailVerified: value.billingSignupTrialRequireEmailVerified,
      signupCaptchaEnabled: value.signupCaptchaEnabled,
      signupCaptchaProvider: value.signupCaptchaProvider,
      signupCaptchaSiteKey: value.signupCaptchaSiteKey,
      signupCaptchaSecret: value.signupCaptchaSecret,
      signupMaxAccountsPerIpDay: value.signupMaxAccountsPerIpDay,
      loginCaptchaEnabled: value.loginCaptchaEnabled,
      authRememberMeEnabled: value.authRememberMeEnabled,
      authSessionHours: value.authSessionHours,
      authRememberMeHours: value.authRememberMeHours,
    });
  }

  private buildSiadSignature(value: BradescoSiadItem): string {
    return JSON.stringify({ environment: value.environment, origin: value.origin, suborigin: value.suborigin, referenciado: value.referenciado, isActive: value.isActive });
  }

  private async loadSiad(): Promise<BradescoSiadItem> {
    return this.readSiad(await this.api.get<any>('settings/integrations/bradesco/siad'));
  }

  private readSiad(result: any): BradescoSiadItem {
    const raw = result?.data?.item ?? result?.item ?? result ?? {};
    const environment = String(raw?.environment ?? 'dsv').toLowerCase();
    return {
      environment: environment === 'hml' || environment === 'prd' ? environment : 'dsv',
      origin: String(raw?.origin ?? ''), suborigin: String(raw?.suborigin ?? ''),
      referenciado: String(raw?.referenciado ?? ''), isActive: raw?.isActive === true,
      credentialsConfigured: raw?.credentialsConfigured === true,
      credentialsUpdatedAt: raw?.credentialsUpdatedAt ? String(raw.credentialsUpdatedAt) : null,
      credential: raw?.credential && typeof raw.credential === 'object'
        ? {
          certificateFilename: String(raw.credential.certificateFilename ?? ''),
          certificateFingerprintSha256: String(raw.credential.certificateFingerprintSha256 ?? ''),
          certificateNotAfter: String(raw.credential.certificateNotAfter ?? ''),
        }
        : null,
    };
  }

  private async loadParametersSnapshot(
    endpoint: string,
    isMaster: boolean,
  ): Promise<ParametersSnapshot> {
    const [parametersResult, storageAccounts] = await Promise.all([
      this.api.get<any>(endpoint),
      this.fetchStorageAccounts(isMaster),
    ]);

    return {
      item: this.readItem(parametersResult),
      storageAccounts,
    };
  }

  private async fetchStorageAccounts(isMaster: boolean): Promise<StorageAccountItem[]> {
    const endpoint = isMaster ? 'system/hosting/storage/accounts' : 'hosting/storage/accounts';
    try {
      const response = await this.api.get<any>(endpoint);
      const rows = Array.isArray(response?.data) ? response.data : (response?.data?.items ?? []);
      return rows as StorageAccountItem[];
    } catch {
      return [];
    }
  }

  private normalizeStorageMode(value: unknown): 'filesystem' | 'storage' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'filesystem' || normalized === 'storage' ? normalized : '';
  }

  private normalizeDeliveryMode(value: unknown): 'online' | 'offline' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'online' || normalized === 'offline' ? normalized : '';
  }

  private normalizeRemoteCommandExecutor(value: unknown): 'agent' | 'esl_ami' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'agent' || normalized === 'esl_ami' ? normalized : '';
  }

  private normalizePabxAutoDomainLabelMode(_value: unknown): 'uuid_short' {
    return 'uuid_short';
  }

  private normalizePabxAutoDomainDnsMode(_value: unknown): 'identity_only' {
    return 'identity_only';
  }

  private normalizeCaptchaProvider(value: unknown): 'turnstile' | 'hcaptcha' | '' {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();
    return normalized === 'turnstile' || normalized === 'hcaptcha' ? normalized : '';
  }

  private normalizeNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
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
