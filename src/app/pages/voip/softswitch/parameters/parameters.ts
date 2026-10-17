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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../../services/api.service';
import { apiErrorFields } from '../../../../services/api-error-fields';
import { SettingsPageComponent } from '../../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { dnsPolicySelector } from '../../service-domain/dns-policy-selector';

type DnsMode = 'identity_only' | 'managed_dns';

type SoftswitchParameterForm = {
  realmSource: 'own' | 'inherit';
  autoDomainEnabled: boolean;
  autoDomainDnsMode: DnsMode;
  autoDomainBase: string;
  autoDomainUuidLength: number | null;
  autoDomainSetDefault: boolean;
  dnsPolicyUUID: string;
};

type SoftswitchParameterInfo = {
  dnsPolicyBase: string | null;
  dnsPolicyZoneName: string | null;
  dnsPolicyEligible: boolean | null;
  dnsPolicyError: string | null;
  platform: {
    dnsMode: DnsMode;
    base: string | null;
    zoneName: string | null;
    dnsPolicyError: string | null;
  };
};

type FieldKey = 'autoDomainBase' | 'autoDomainUuidLength' | 'dnsPolicyUUID';

const DEFAULT_BASE = 'softswitch.publichost.cloud';
const FQDN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const EMPTY_FORM: SoftswitchParameterForm = {
  realmSource: 'inherit',
  autoDomainEnabled: true,
  autoDomainDnsMode: 'identity_only',
  autoDomainBase: DEFAULT_BASE,
  autoDomainUuidLength: 12,
  autoDomainSetDefault: true,
  dnsPolicyUUID: '',
};
const EMPTY_INFO: SoftswitchParameterInfo = {
  dnsPolicyBase: null,
  dnsPolicyZoneName: null,
  dnsPolicyEligible: null,
  dnsPolicyError: null,
  platform: { dnsMode: 'identity_only', base: DEFAULT_BASE, zoneName: null, dnsPolicyError: null },
};

/**
 * VoIP › Softswitch › Parameters: SIP domain generated on Softswitch account creation. Platform
 * defaults (master) or a tenant configuration that inherits the platform.
 */
@Component({
  selector: 'app-voip-softswitch-parameters',
  standalone: true,
  imports: [
    SettingsPageComponent,
    MnsSearchSelectFieldComponent,
    FieldHelpComponent,
    FieldInvalidDirective,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    TranslocoPipe,
  ],
  templateUrl: './parameters.html',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class VoipSoftswitchParametersPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly isMaster = signal(this.route.snapshot.data?.['scope'] === 'master');
  readonly endpoint = computed(() =>
    this.isMaster() ? 'system/voip/softswitch/parameters' : 'voip/softswitch/parameters',
  );
  readonly pageDescription = computed(() =>
    this.isMaster()
      ? 'Platform default of the SIP domain generated for new Softswitch accounts. Tenants inherit it unless they use their own configuration.'
      : 'SIP domain generated for new Softswitch accounts of this tenant, or the inherited platform configuration.',
  );

  readonly form = signal<SoftswitchParameterForm>({ ...EMPTY_FORM });
  readonly baseline = signal('');
  readonly info = signal<SoftswitchParameterInfo>(EMPTY_INFO);
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
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
  readonly loading = computed(() => this.parameters.isLoading());

  readonly realmSourceOptions = [
    { value: 'inherit', label: 'Inherit platform configuration' },
    { value: 'own', label: 'Use own configuration' },
  ];
  readonly dnsModeOptions = [
    { value: 'identity_only', label: 'SIP identity without DNS publication' },
    { value: 'managed_dns', label: 'Managed DNS publication' },
  ];
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

  update(patch: Partial<SoftswitchParameterForm>) {
    this.form.update((value) => ({ ...value, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((key) => this.serverInvalid().has(key))) {
      this.serverInvalid.update((set) => new Set([...set].filter((key) => !keys.includes(key))));
    }
  }

  invalid(key: FieldKey): boolean {
    return this.rules.invalid(key) || this.serverInvalid().has(key);
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

  refresh() {
    if (this.saving()) return;
    this.feedback.set(null);
    this.success.set(null);
    this.parameters.reload();
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
    if (!this.rules.check()) return this.revealInvalid();
    this.saving.set(true);
    try {
      const form = this.form();
      const result = await this.api.put<any>(this.endpoint(), {
        realmSource: this.isMaster() ? 'own' : form.realmSource,
        autoDomainEnabled: form.autoDomainEnabled,
        autoDomainDnsMode: form.autoDomainDnsMode,
        autoDomainBase: this.managedDns() ? null : this.normalizedBase(),
        autoDomainUuidLength: form.autoDomainUuidLength,
        autoDomainSetDefault: form.autoDomainSetDefault,
        dnsPolicyUUID: this.managedDns() ? form.dnsPolicyUUID : null,
      });
      this.apply(result?.data?.item ?? {});
      this.rules.reset();
      this.success.set('Parameters saved successfully.');
    } catch (error) {
      const fields = apiErrorFields(error);
      if (fields.length) {
        this.serverInvalid.set(new Set(fields));
        this.revealInvalid();
      }
      this.feedback.set(this.message(error, 'Failed to save parameters.'));
    } finally {
      this.saving.set(false);
    }
  }

  private apply(item: Record<string, any>) {
    const form: SoftswitchParameterForm = {
      realmSource: item['realmSource'] === 'own' || this.isMaster() ? 'own' : 'inherit',
      autoDomainEnabled: item['autoDomainEnabled'] !== false,
      autoDomainDnsMode:
        item['autoDomainDnsMode'] === 'managed_dns' ? 'managed_dns' : 'identity_only',
      autoDomainBase: String(item['autoDomainBase'] ?? DEFAULT_BASE),
      autoDomainUuidLength: Number(item['autoDomainUuidLength'] ?? 12),
      autoDomainSetDefault: item['autoDomainSetDefault'] !== false,
      dnsPolicyUUID: String(item['dnsPolicyUUID'] ?? ''),
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

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    const raw = (error as any)?.message;
    return typeof raw === 'string' && raw.trim() ? raw : fallback;
  }
}
