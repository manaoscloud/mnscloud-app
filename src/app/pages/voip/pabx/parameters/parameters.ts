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
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { apiErrorFields } from '../../../../services/api-error-fields';
import { SettingsPageComponent } from '../../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { dnsPolicySelector } from '../../service-domain/dns-policy-selector';
import { VoipPabxRetentionOperationsComponent } from './retention-operations';

type StorageMode = '' | 'filesystem' | 'storage';
type DeliveryMode = '' | 'online' | 'offline';
type DnsMode = 'identity_only' | 'managed_dns';

/** Editable values; '' / null mean "inherit" (tenant) or "built-in default" (platform). */
type PabxParameterForm = {
  recordingStorageMode: StorageMode;
  recordingStorageBucketUUID: string;
  mediaStorageMode: StorageMode;
  mediaStorageBucketUUID: string;
  mediaDeliveryMode: DeliveryMode;
  realmSource: 'own' | 'inherit';
  autoDomainEnabled: boolean;
  autoDomainDnsMode: DnsMode;
  autoDomainBase: string;
  autoDomainUuidLength: number | null;
  autoDomainSetDefault: boolean;
  dnsPolicyUUID: string;
  cdrRetentionDays: number | null;
  recordingRetentionDays: number | null;
  orphanRetentionDays: number | null;
  extensionOfflineAlertMinutes: number | null;
};

type PabxParameterInfo = {
  dnsPolicyBase: string | null;
  dnsPolicyZoneName: string | null;
  dnsPolicyEligible: boolean | null;
  dnsPolicyError: string | null;
  platform: {
    recordingStorageMode: 'filesystem' | 'storage';
    mediaStorageMode: 'filesystem' | 'storage';
    mediaDeliveryMode: 'online' | 'offline';
    cdrRetentionDays: number;
    recordingRetentionDays: number;
    extensionOfflineAlertMinutes: number;
    dnsMode: DnsMode;
    base: string | null;
    zoneName: string | null;
    dnsPolicyEligible: boolean | null;
    dnsPolicyError: string | null;
  };
};

type FieldKey = Exclude<keyof PabxParameterForm, 'autoDomainEnabled' | 'autoDomainSetDefault'>;

const DEFAULT_BASE = 'pabx.publichost.cloud';
const FQDN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const TABS: Record<number, readonly FieldKey[]> = {
  0: [
    'recordingStorageMode',
    'recordingStorageBucketUUID',
    'mediaStorageMode',
    'mediaStorageBucketUUID',
  ],
  1: ['mediaDeliveryMode'],
  2: [
    'realmSource',
    'autoDomainDnsMode',
    'dnsPolicyUUID',
    'autoDomainBase',
    'autoDomainUuidLength',
  ],
  3: ['cdrRetentionDays', 'recordingRetentionDays', 'orphanRetentionDays'],
  4: ['extensionOfflineAlertMinutes'],
};

const EMPTY_FORM: PabxParameterForm = {
  recordingStorageMode: '',
  recordingStorageBucketUUID: '',
  mediaStorageMode: '',
  mediaStorageBucketUUID: '',
  mediaDeliveryMode: '',
  realmSource: 'inherit',
  autoDomainEnabled: true,
  autoDomainDnsMode: 'identity_only',
  autoDomainBase: DEFAULT_BASE,
  autoDomainUuidLength: 12,
  autoDomainSetDefault: true,
  dnsPolicyUUID: '',
  cdrRetentionDays: null,
  recordingRetentionDays: null,
  orphanRetentionDays: null,
  extensionOfflineAlertMinutes: null,
};

const EMPTY_INFO: PabxParameterInfo = {
  dnsPolicyBase: null,
  dnsPolicyZoneName: null,
  dnsPolicyEligible: null,
  dnsPolicyError: null,
  platform: {
    recordingStorageMode: 'filesystem',
    mediaStorageMode: 'filesystem',
    mediaDeliveryMode: 'offline',
    cdrRetentionDays: 0,
    recordingRetentionDays: 0,
    extensionOfflineAlertMinutes: 0,
    dnsMode: 'identity_only',
    base: DEFAULT_BASE,
    zoneName: null,
    dnsPolicyEligible: null,
    dnsPolicyError: null,
  },
};

function days(value: unknown): number | null {
  return value === null || value === undefined || value === '' ? null : Number(value);
}

/**
 * VoIP › PABX › Parameters: platform defaults (master) or tenant overrides that inherit the
 * platform. Storage, media delivery, SIP realm and retention of PABX accounts.
 */
@Component({
  selector: 'app-voip-pabx-parameters',
  standalone: true,
  imports: [
    SettingsPageComponent,
    MnsSearchSelectFieldComponent,
    FieldHelpComponent,
    FieldInvalidDirective,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTabsModule,
    TranslocoPipe,
    VoipPabxRetentionOperationsComponent,
  ],
  templateUrl: './parameters.html',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class VoipPabxParametersPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly endpoint = computed(() =>
    this.isMaster() ? 'system/voip/pabx/parameters' : 'voip/pabx/parameters',
  );
  readonly pageDescription = computed(() =>
    this.isMaster()
      ? 'Platform defaults of PABX accounts: recording and media storage, media delivery, SIP realm and retention. Tenants inherit them unless they set their own value.'
      : 'PABX settings of this tenant. Empty values inherit the platform defaults.',
  );

  readonly form = signal<PabxParameterForm>({ ...EMPTY_FORM });
  readonly baseline = signal('');
  readonly info = signal<PabxParameterInfo>(EMPTY_INFO);
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly selectedTab = signal(0);
  readonly serverInvalid = signal<ReadonlySet<string>>(new Set());
  readonly hasChanges = computed(() => JSON.stringify(this.form()) !== this.baseline());

  readonly dns = dnsPolicySelector(
    () => this.endpoint(),
    () => ({
      uuid: this.form().dnsPolicyUUID || null,
      zoneName: this.info().dnsPolicyZoneName,
      base: this.info().dnsPolicyBase,
      eligible: this.info().dnsPolicyEligible,
    }),
    'SIP realm base',
  );

  private readonly parameters = resource({
    params: () => this.endpoint(),
    loader: async ({ params }) => (await this.api.get<any>(params))?.data?.item ?? {},
  });
  private readonly storageAccounts = resource({
    params: () => (this.isMaster() ? 'system/hosting/storage/buckets' : 'hosting/storage/buckets'),
    defaultValue: [] as Array<Record<string, any>>,
    loader: async ({ params }) => {
      const result = await this.api.get<any>(`${params}?status=1&limit=500`);
      return (result?.data?.items ?? []) as Array<Record<string, any>>;
    },
  });
  readonly loading = computed(() => this.parameters.isLoading());

  readonly storageModeOptions = computed(() => [
    { value: '', label: this.isMaster() ? 'Default' : 'Inherit platform value' },
    { value: 'filesystem', label: 'Filesystem' },
    { value: 'storage', label: 'Storage' },
  ]);
  readonly deliveryModeOptions = computed(() => [
    { value: '', label: this.isMaster() ? 'Offline (default)' : 'Inherit platform value' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
  ]);
  readonly realmSourceOptions = [
    { value: 'inherit', label: 'Inherit platform configuration' },
    { value: 'own', label: 'Use own configuration' },
  ];
  readonly dnsModeOptions = [
    { value: 'identity_only', label: 'SIP identity without DNS publication' },
    { value: 'managed_dns', label: 'Managed DNS publication' },
  ];
  readonly storageBucketOptions = computed(() =>
    this.storageAccounts.value().map((account) => ({
      value: String(account['HsbUUID']),
      label: [account['HsbName'], account['HspProvider'] || account['HspName']]
        .filter(Boolean)
        .join(' · '),
    })),
  );
  readonly ownRealm = computed(() => this.isMaster() || this.form().realmSource === 'own');
  readonly managedDns = computed(
    () => this.ownRealm() && this.form().autoDomainDnsMode === 'managed_dns',
  );
  readonly selectedPolicyError = computed(() => {
    const form = this.form();
    if (!this.managedDns() || !form.dnsPolicyUUID) return null;
    const policy = this.dns.find(form.dnsPolicyUUID);
    if (policy && policy.status && policy.eligible !== false) return null;
    return this.info().dnsPolicyError ?? (policy ? 'The selected DNS policy is invalid.' : null);
  });
  readonly inheritedRealmLabel = computed(() => {
    const platform = this.info().platform;
    const base = platform.base || DEFAULT_BASE;
    return platform.dnsMode === 'managed_dns' && platform.zoneName
      ? `${platform.zoneName} — ${base}`
      : base;
  });

  readonly rules = new FieldRules<FieldKey>({
    recordingStorageMode: () => true,
    recordingStorageBucketUUID: () =>
      this.form().recordingStorageMode !== 'storage' || !!this.form().recordingStorageBucketUUID,
    mediaStorageMode: () => true,
    mediaStorageBucketUUID: () => true,
    mediaDeliveryMode: () => true,
    realmSource: () => true,
    autoDomainDnsMode: () => true,
    dnsPolicyUUID: () => !this.managedDns() || !!this.form().dnsPolicyUUID,
    autoDomainBase: () =>
      !this.ownRealm() ||
      this.form().autoDomainDnsMode !== 'identity_only' ||
      FQDN.test(this.normalizedBase()),
    autoDomainUuidLength: () => {
      const length = this.form().autoDomainUuidLength;
      return (
        !this.ownRealm() ||
        (length !== null && Number.isInteger(length) && length >= 8 && length <= 32)
      );
    },
    cdrRetentionDays: () => this.validDays(this.form().cdrRetentionDays, 36500),
    recordingRetentionDays: () => this.validDays(this.form().recordingRetentionDays, 36500),
    orphanRetentionDays: () => this.validDays(this.form().orphanRetentionDays, 3650),
    extensionOfflineAlertMinutes: () =>
      this.validDays(this.form().extensionOfflineAlertMinutes, 1440),
  });

  constructor() {
    effect(() => {
      if (!this.parameters.hasValue()) return;
      this.apply(this.parameters.value());
    });
    effect(() => {
      const error = this.parameters.error();
      if (error) this.feedback.set(this.message(error, 'Failed to load parameters.'));
    });
  }

  update(patch: Partial<PabxParameterForm>) {
    this.form.update((value) => ({ ...value, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((key) => this.serverInvalid().has(key))) {
      this.serverInvalid.update((set) => new Set([...set].filter((key) => !keys.includes(key))));
    }
  }

  invalid(key: FieldKey): boolean {
    return this.rules.invalid(key) || this.serverInvalid().has(key);
  }

  modeLabel(mode: string): string {
    return mode ? mode.charAt(0).toUpperCase() + mode.slice(1) : '';
  }

  numberValue(event: Event): number | null {
    const value = (event.target as HTMLInputElement).value.trim();
    return value === '' ? null : Number(value);
  }

  selectDnsPolicy(value: unknown) {
    const uuid = String(value ?? '');
    const policy = this.dns.find(uuid);
    this.update({ dnsPolicyUUID: uuid });
    this.info.update((info) => ({
      ...info,
      dnsPolicyBase: policy?.base ?? null,
      dnsPolicyZoneName: policy?.zoneName ?? null,
      dnsPolicyEligible: policy ? policy.eligible !== false : null,
      dnsPolicyError: null,
    }));
  }

  async createStorageBucket(key: 'recordingStorageBucketUUID' | 'mediaStorageBucketUUID') {
    const { openQuickCreate } =
      await import('../../../../shared/crud/configurable-crud/configurable-crud-quick-create-host');
    const { loadComponent, routeData } = quickCreateFor('HostingStorageBucketHsbUUID');
    const result = await openQuickCreate(this.dialog, { loadComponent, routeData });
    if (!result?.option) return;
    this.storageAccounts.reload();
    this.update({ [key]: String(result.option.value) });
  }

  refresh() {
    if (this.saving()) return;
    this.feedback.set(null);
    this.success.set(null);
    this.parameters.reload();
    this.storageAccounts.reload();
  }

  cancel() {
    this.form.set(JSON.parse(this.baseline()));
    this.rules.reset();
    this.serverInvalid.set(new Set());
    this.feedback.set(null);
    this.success.set(null);
  }

  async save() {
    if (this.saving() || this.loading()) return;
    this.feedback.set(null);
    this.success.set(null);
    if (!this.rules.check()) return this.reveal();
    this.saving.set(true);
    try {
      const form = this.form();
      const result = await this.api.put<any>(this.endpoint(), {
        recordingStorageMode: form.recordingStorageMode || null,
        recordingStorageBucketUUID:
          form.recordingStorageMode === 'storage' ? form.recordingStorageBucketUUID || null : null,
        mediaStorageMode: form.mediaStorageMode || null,
        mediaStorageBucketUUID:
          form.mediaStorageMode === 'storage' ? form.mediaStorageBucketUUID || null : null,
        mediaDeliveryMode: form.mediaDeliveryMode || null,
        realmSource: this.isMaster() ? 'own' : form.realmSource,
        autoDomainEnabled: form.autoDomainEnabled,
        autoDomainDnsMode: form.autoDomainDnsMode,
        autoDomainBase: this.managedDns() ? null : this.normalizedBase(),
        autoDomainUuidLength: form.autoDomainUuidLength,
        autoDomainSetDefault: form.autoDomainSetDefault,
        dnsPolicyUUID: this.managedDns() ? form.dnsPolicyUUID : null,
        cdrRetentionDays: form.cdrRetentionDays,
        recordingRetentionDays: form.recordingRetentionDays,
        orphanRetentionDays: this.isMaster() ? form.orphanRetentionDays : null,
        extensionOfflineAlertMinutes: form.extensionOfflineAlertMinutes,
      });
      this.apply(result?.data?.item ?? {});
      this.rules.reset();
      this.success.set('Parameters saved successfully.');
    } catch (error) {
      const fields = apiErrorFields(error);
      if (fields.length) {
        this.serverInvalid.set(new Set(fields));
        this.reveal(fields as FieldKey[]);
      }
      this.feedback.set(this.message(error, 'Failed to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  private reveal(keys?: readonly FieldKey[]) {
    const invalid =
      keys ?? (Object.values(TABS).flat() as FieldKey[]).filter((key) => this.invalid(key));
    const tab = Object.entries(TABS).find(([, fields]) =>
      fields.some((key) => invalid.includes(key)),
    );
    if (tab) this.selectedTab.set(Number(tab[0]));
    setTimeout(() => this.revealInvalid());
  }

  private apply(item: Record<string, any>) {
    const form: PabxParameterForm = {
      recordingStorageMode: (item['recordingStorageMode'] ?? '') as StorageMode,
      recordingStorageBucketUUID: String(item['recordingStorageBucketUUID'] ?? ''),
      mediaStorageMode: (item['mediaStorageMode'] ?? '') as StorageMode,
      mediaStorageBucketUUID: String(item['mediaStorageBucketUUID'] ?? ''),
      mediaDeliveryMode: (item['mediaDeliveryMode'] ?? '') as DeliveryMode,
      realmSource: item['realmSource'] === 'own' || this.isMaster() ? 'own' : 'inherit',
      autoDomainEnabled: item['autoDomainEnabled'] !== false,
      autoDomainDnsMode:
        item['autoDomainDnsMode'] === 'managed_dns' ? 'managed_dns' : 'identity_only',
      autoDomainBase: String(item['autoDomainBase'] ?? DEFAULT_BASE),
      autoDomainUuidLength: Number(item['autoDomainUuidLength'] ?? 12),
      autoDomainSetDefault: item['autoDomainSetDefault'] !== false,
      dnsPolicyUUID: String(item['dnsPolicyUUID'] ?? ''),
      cdrRetentionDays: days(item['cdrRetentionDays']),
      recordingRetentionDays: days(item['recordingRetentionDays']),
      orphanRetentionDays: this.isMaster() ? days(item['orphanRetentionDays']) : null,
      extensionOfflineAlertMinutes: days(item['extensionOfflineAlertMinutes']),
    };
    this.form.set(form);
    this.baseline.set(JSON.stringify(form));
    this.serverInvalid.set(new Set());
    this.info.set({
      dnsPolicyBase: item['dnsPolicyBase'] ?? null,
      dnsPolicyZoneName: item['dnsPolicyZoneName'] ?? null,
      dnsPolicyEligible: item['dnsPolicyEligible'] ?? null,
      dnsPolicyError: item['dnsPolicyError'] ?? null,
      platform: { ...EMPTY_INFO.platform, ...(item['platform'] ?? {}) },
    });
  }

  private normalizedBase(): string {
    return (
      this.form()
        .autoDomainBase.trim()
        .toLowerCase()
        .replace(/^\.+|\.+$/g, '') || DEFAULT_BASE
    );
  }

  private validDays(value: number | null, max: number): boolean {
    return value === null || (Number.isInteger(value) && value >= 0 && value <= max);
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    const raw = (error as any)?.message;
    return typeof raw === 'string' && raw.trim() ? raw : fallback;
  }
}
