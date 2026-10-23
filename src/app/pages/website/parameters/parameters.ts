import {
  Component,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { apiErrorFields } from '../../../services/api-error-fields';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { dnsPolicySelector } from '../../voip/service-domain/dns-policy-selector';
import { WEBSITE_LOCALE_OPTIONS, isWebsiteLocale } from '../website-content';
import { WEBSITE_PARAMETERS_ENDPOINT } from '../website.service';

type DnsMode = 'identity_only' | 'managed_dns';

export type WebsiteParameterForm = {
  autoDomainEnabled: boolean;
  autoDomainDnsMode: DnsMode;
  autoDomainBase: string;
  autoDomainUuidLength: number | null;
  dnsPolicyUUID: string;
  edgeIPv4: string;
  edgeIPv6: string;
  defaultLocale: string;
};

type FieldKey =
  | 'autoDomainBase'
  | 'autoDomainUuidLength'
  | 'dnsPolicyUUID'
  | 'edgeIPv4'
  | 'edgeIPv6'
  | 'defaultLocale';

const FQDN = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
/** Shape check only (hex groups and `::`); the API parses the address. */
const IPV6 = /^(?=.*:)[0-9a-f:]{2,39}$/i;

const EMPTY_FORM: WebsiteParameterForm = {
  autoDomainEnabled: true,
  autoDomainDnsMode: 'identity_only',
  autoDomainBase: '',
  autoDomainUuidLength: 12,
  dnsPolicyUUID: '',
  edgeIPv4: '',
  edgeIPv6: '',
  defaultLocale: 'pt-BR',
};

export function websiteParameterForm(item: Record<string, unknown>): WebsiteParameterForm {
  const length = Number(item['autoDomainUuidLength'] ?? 12);
  return {
    autoDomainEnabled: item['autoDomainEnabled'] !== false && item['autoDomainEnabled'] !== 0,
    autoDomainDnsMode:
      item['autoDomainDnsMode'] === 'managed_dns' ? 'managed_dns' : 'identity_only',
    autoDomainBase: String(item['autoDomainBase'] ?? ''),
    autoDomainUuidLength: Number.isFinite(length) ? length : 12,
    dnsPolicyUUID: String(item['dnsPolicyUUID'] ?? ''),
    edgeIPv4: String(item['edgeIPv4'] ?? ''),
    edgeIPv6: String(item['edgeIPv6'] ?? ''),
    defaultLocale: isWebsiteLocale(item['defaultLocale']) ? item['defaultLocale'] : 'pt-BR',
  };
}

/** PUT body: the base only in `identity_only`, the policy only in `managed_dns`. */
export function websiteParameterPayload(form: WebsiteParameterForm): Record<string, unknown> {
  const managed = form.autoDomainDnsMode === 'managed_dns';
  return {
    autoDomainEnabled: form.autoDomainEnabled,
    autoDomainDnsMode: form.autoDomainDnsMode,
    autoDomainBase: managed
      ? null
      : form.autoDomainBase
          .trim()
          .toLowerCase()
          .replace(/^\.+|\.+$/g, '') || null,
    autoDomainUuidLength: form.autoDomainUuidLength,
    dnsPolicyUUID: managed ? form.dnsPolicyUUID || null : null,
    edgeIPv4: form.edgeIPv4.trim() || null,
    edgeIPv6: form.edgeIPv6.trim().toLowerCase() || null,
    defaultLocale: form.defaultLocale,
  };
}

/**
 * Website › Parameters (platform only): free automatic address of every new site, its DNS
 * publication under a platform Website DNS policy, the edge addresses those records point to
 * and the default language of new sites.
 */
@Component({
  selector: 'app-website-parameters',
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
export class WebsiteParametersPage {
  private readonly api = inject(ApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly localeOptions = WEBSITE_LOCALE_OPTIONS.map((option) => ({ ...option }));
  readonly dnsModeOptions = [
    { value: 'identity_only', label: 'website.dnsMode.identityOnly' },
    { value: 'managed_dns', label: 'website.dnsMode.managedDns' },
  ];

  readonly form = signal<WebsiteParameterForm>({ ...EMPTY_FORM });
  readonly baseline = signal('');
  readonly policy = signal<{
    base: string | null;
    zoneName: string | null;
    eligible: boolean | null;
    error: string | null;
  }>({ base: null, zoneName: null, eligible: null, error: null });
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly serverInvalid = signal<ReadonlySet<string>>(new Set());
  readonly hasChanges = computed(() => JSON.stringify(this.form()) !== this.baseline());
  readonly managedDns = computed(() => this.form().autoDomainDnsMode === 'managed_dns');

  readonly dns = dnsPolicySelector(
    () => WEBSITE_PARAMETERS_ENDPOINT,
    () => ({
      uuid: this.form().dnsPolicyUUID || null,
      zoneName: this.policy().zoneName,
      base: this.policy().base,
      eligible: this.policy().eligible,
    }),
    'Domain base',
  );

  private readonly parameters = resource({
    loader: async () =>
      ((await this.api.get<any>(WEBSITE_PARAMETERS_ENDPOINT))?.data?.item ?? {}) as Record<
        string,
        unknown
      >,
  });
  readonly loading = computed(() => this.parameters.isLoading());
  readonly policyError = computed(() => {
    const form = this.form();
    if (!this.managedDns() || !form.dnsPolicyUUID) return null;
    const policy = this.policy();
    if (policy.error) return policy.error;
    return policy.eligible === false ? 'The selected DNS policy is invalid.' : null;
  });

  readonly rules = new FieldRules<FieldKey>({
    autoDomainBase: () =>
      this.managedDns() ||
      (!this.form().autoDomainEnabled && !this.form().autoDomainBase.trim()) ||
      FQDN.test(
        this.form()
          .autoDomainBase.trim()
          .toLowerCase()
          .replace(/^\.+|\.+$/g, ''),
      ),
    autoDomainUuidLength: () => {
      const length = this.form().autoDomainUuidLength;
      return length !== null && Number.isInteger(length) && length >= 8 && length <= 32;
    },
    dnsPolicyUUID: () => !this.managedDns() || !!this.form().dnsPolicyUUID,
    edgeIPv4: () => {
      const value = this.form().edgeIPv4.trim();
      // Managed DNS needs at least one public edge address (A and/or AAAA records).
      if (!value) return !this.managedDns() || !!this.form().edgeIPv6.trim();
      return IPV4.test(value);
    },
    edgeIPv6: () => {
      const value = this.form().edgeIPv6.trim();
      return !value || IPV6.test(value);
    },
    defaultLocale: () => isWebsiteLocale(this.form().defaultLocale),
  });

  constructor() {
    effect(() => {
      if (!this.parameters.hasValue()) return;
      this.apply(this.parameters.value());
    });
    effect(() => {
      const error = this.parameters.error();
      if (error) this.feedback.set(this.message(error, 'website.parametersLoadFailed'));
    });
  }

  update(patch: Partial<WebsiteParameterForm>) {
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

  textValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  selectDnsPolicy(value: unknown) {
    const uuid = String(value ?? '');
    const policy = this.dns.find(uuid);
    this.update({ dnsPolicyUUID: uuid });
    this.policy.set({
      base: policy?.base ?? null,
      zoneName: policy?.zoneName ?? null,
      eligible: policy ? policy.eligible !== false : null,
      error: null,
    });
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
      const result = await this.api.put<any>(
        WEBSITE_PARAMETERS_ENDPOINT,
        websiteParameterPayload(this.form()),
      );
      this.apply(result?.data?.item ?? {});
      this.rules.reset();
      this.success.set('Parameters saved successfully.');
    } catch (error) {
      const fields = apiErrorFields(error);
      if (fields.length) {
        this.serverInvalid.set(new Set(fields));
        this.revealInvalid();
      }
      this.feedback.set(this.message(error, 'website.parametersSaveFailed'));
    } finally {
      this.saving.set(false);
    }
  }

  private apply(item: Record<string, unknown>) {
    const form = websiteParameterForm(item);
    this.form.set(form);
    this.baseline.set(JSON.stringify(form));
    this.serverInvalid.set(new Set());
    this.policy.set({
      base: (item['dnsPolicyBase'] as string | null) ?? null,
      zoneName: (item['dnsPolicyZoneName'] as string | null) ?? null,
      eligible: (item['dnsPolicyEligible'] as boolean | null) ?? null,
      error: (item['dnsPolicyError'] as string | null) ?? null,
    });
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    const raw = (error as any)?.message;
    return typeof raw === 'string' && raw.trim() ? raw : this.transloco.translate(fallback);
  }
}
