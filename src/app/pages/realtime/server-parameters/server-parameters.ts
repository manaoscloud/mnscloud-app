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
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { apiErrorFields } from '../../../services/api-error-fields';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { dnsPolicySelector } from '../../voip/service-domain/dns-policy-selector';

type ServerParameterForm = {
  autoDomainEnabled: boolean;
  dnsPolicyUUID: string;
  autoDomainUuidLength: number | null;
};

type FieldKey = 'dnsPolicyUUID' | 'autoDomainUuidLength';

/** Realtime server kind of the page, from the route `data.serverKind`. */
export type RealtimeServerKind = 'media' | 'turn' | 'webrtc';

type ServerParameterConfig = {
  endpoint: string;
  title: string;
  description: string;
  toggle: string;
  policyLabel: string;
  policyHelp: string;
  labelHelp: string;
};

const CONFIGS: Record<RealtimeServerKind, ServerParameterConfig> = {
  media: {
    endpoint: 'system/realtime/media/parameters',
    title: 'RTP media parameters',
    description:
      'Automatic managed domain of new media servers, published under an enabled platform RTP DNS policy.',
    toggle: 'Generate media server domain automatically',
    policyLabel: 'RTP DNS policy',
    policyHelp:
      'Enabled platform policy of the RTP DNS tab of a DNS zone. Each new media server gets its own managed domain under its base, published with the server IPv4 (A) and IPv6 (AAAA).',
    labelHelp: 'Prefix of the media server UUID; it never changes when the server is renamed.',
  },
  turn: {
    endpoint: 'system/realtime/turn/parameters',
    title: 'TURN/STUN parameters',
    description:
      'Automatic managed domain of new TURN/STUN servers, published under an enabled platform Realtime DNS policy and secured with a free certificate.',
    toggle: 'Generate TURN/STUN server domain automatically',
    policyLabel: 'Realtime DNS policy',
    policyHelp:
      'Enabled platform policy of the Realtime DNS tab of a DNS zone. Each new TURN/STUN server gets its own managed domain under its base: it is the coturn realm and the platform TURN domain, published with the advertised IPv4 (A) and issued a Let’s Encrypt certificate by the server.',
    labelHelp: 'Prefix of the TURN/STUN server UUID; it never changes when the server is renamed.',
  },
  webrtc: {
    endpoint: 'system/realtime/webrtc/domain-parameters',
    title: 'WebRTC domain parameters',
    description:
      'Automatic managed primary domain of new WebRTC servers, published under an enabled platform Realtime DNS policy and secured with a free certificate.',
    toggle: 'Generate WebRTC server domain automatically',
    policyLabel: 'Realtime DNS policy',
    policyHelp:
      'Enabled platform policy of the Realtime DNS tab of a DNS zone. Each new WebRTC server gets its own managed primary domain under its base, published with the server IPv4 (A) and IPv6 (AAAA) and issued a Let’s Encrypt certificate by the edge.',
    labelHelp: 'Prefix of the WebRTC server UUID; it never changes when the server is renamed.',
  },
};
const EMPTY_FORM: ServerParameterForm = {
  autoDomainEnabled: false,
  dnsPolicyUUID: '',
  autoDomainUuidLength: 12,
};

/**
 * Realtime › Media › Parameters, Realtime › TURN/STUN › Parameters and Realtime › WebRTC ›
 * Automatic DNS (platform only): automatic managed domain of new servers of that kind under an
 * enabled platform Realtime DNS policy.
 */
@Component({
  selector: 'app-realtime-server-parameters',
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
  templateUrl: './server-parameters.html',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class RealtimeServerParametersPage {
  private readonly api = inject(ApiService);
  readonly config =
    CONFIGS[
      (inject(ActivatedRoute).snapshot.data['serverKind'] as RealtimeServerKind | undefined) ??
        'media'
    ];
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly form = signal<ServerParameterForm>({ ...EMPTY_FORM });
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

  readonly dns = dnsPolicySelector(
    () => this.config.endpoint,
    () => ({
      uuid: this.form().dnsPolicyUUID || null,
      zoneName: this.policy().zoneName,
      base: this.policy().base,
      eligible: this.policy().eligible,
    }),
    'Domain base',
  );

  private readonly parameters = resource({
    loader: async () => (await this.api.get<any>(this.config.endpoint))?.data?.item ?? {},
  });
  readonly loading = computed(() => this.parameters.isLoading());
  readonly policyError = computed(() => {
    const form = this.form();
    if (!form.dnsPolicyUUID) return null;
    const policy = this.policy();
    if (policy.error) return policy.error;
    return policy.eligible === false ? 'The selected DNS policy is invalid.' : null;
  });

  readonly rules = new FieldRules<FieldKey>({
    dnsPolicyUUID: () => !this.form().autoDomainEnabled || !!this.form().dnsPolicyUUID,
    autoDomainUuidLength: () => {
      const length = this.form().autoDomainUuidLength;
      return length !== null && Number.isInteger(length) && length >= 8 && length <= 32;
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

  update(patch: Partial<ServerParameterForm>) {
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
      const form = this.form();
      const result = await this.api.put<any>(this.config.endpoint, {
        autoDomainEnabled: form.autoDomainEnabled,
        dnsPolicyUUID: form.dnsPolicyUUID || null,
        autoDomainUuidLength: form.autoDomainUuidLength,
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
    const form: ServerParameterForm = {
      autoDomainEnabled: item['autoDomainEnabled'] === true,
      dnsPolicyUUID: String(item['dnsPolicyUUID'] ?? ''),
      autoDomainUuidLength: Number(item['autoDomainUuidLength'] ?? 12),
    };
    this.form.set(form);
    this.baseline.set(JSON.stringify(form));
    this.serverInvalid.set(new Set());
    this.policy.set({
      base: item['dnsPolicyBase'] ?? null,
      zoneName: item['dnsPolicyZoneName'] ?? null,
      eligible: item['dnsPolicyEligible'] ?? null,
      error: item['dnsPolicyError'] ?? null,
    });
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    const raw = (error as any)?.message;
    return typeof raw === 'string' && raw.trim() ? raw : fallback;
  }
}
