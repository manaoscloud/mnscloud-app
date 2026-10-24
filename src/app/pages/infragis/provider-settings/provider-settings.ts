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
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { apiErrorFields } from '../../../services/api-error-fields';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../shared/forms/reveal-invalid-fields';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';

type Provider = 'style' | 'pmtiles' | 'mapbox' | 'none';
type ProviderForm = {
  provider: Provider;
  styleUrl: string;
  pmtilesUrl: string;
  attribution: string;
  centerLatitude: number | null;
  centerLongitude: number | null;
  zoom: number | null;
};
type FieldKey =
  'provider' | 'styleUrl' | 'pmtilesUrl' | 'centerLatitude' | 'centerLongitude' | 'zoom';

const ENDPOINT = 'system/infragis/provider-settings';
/** Canonical providers of the map base (labels translated by the select). */
export const MAP_PROVIDER_OPTIONS: { value: Provider; label: string }[] = [
  { value: 'style', label: 'MapLibre style' },
  { value: 'pmtiles', label: 'Own PMTiles file' },
  { value: 'mapbox', label: 'Mapbox' },
  { value: 'none', label: 'No base map' },
];
const HTTPS = /^https:\/\/\S+$/i;
const EMPTY: ProviderForm = {
  provider: 'style',
  styleUrl: '',
  pmtilesUrl: '',
  attribution: '',
  centerLatitude: -14.235,
  centerLongitude: -51.9253,
  zoom: 3.5,
};

const inRange = (value: number | null, min: number, max: number) =>
  value !== null && Number.isFinite(value) && value >= min && value <= max;

/**
 * System › InfraGIS › Base map (platform only): provider of the base map every tenant map uses,
 * its attribution and the initial view. Built-in default: the OpenFreeMap style over Brazil.
 */
@Component({
  selector: 'app-infragis-provider-settings',
  standalone: true,
  imports: [
    SettingsPageComponent,
    MnsSearchSelectFieldComponent,
    FieldHelpComponent,
    FieldInvalidDirective,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  templateUrl: './provider-settings.html',
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class InfraGisProviderSettingsPage {
  private readonly api = inject(ApiService);
  private readonly revealInvalid = injectRevealInvalidFields();
  readonly providers = MAP_PROVIDER_OPTIONS;

  readonly form = signal<ProviderForm>({ ...EMPTY });
  readonly baseline = signal('');
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly serverInvalid = signal<ReadonlySet<string>>(new Set());
  readonly hasChanges = computed(() => JSON.stringify(this.form()) !== this.baseline());
  readonly needsStyle = computed(() => ['style', 'mapbox'].includes(this.form().provider));
  readonly needsPmtiles = computed(() => this.form().provider === 'pmtiles');

  private readonly settings = resource({
    loader: async () => (await this.api.get<any>(ENDPOINT))?.data?.item ?? {},
  });
  readonly loading = computed(() => this.settings.isLoading());

  readonly rules = new FieldRules<FieldKey>({
    provider: () => this.providers.some((option) => option.value === this.form().provider),
    styleUrl: () =>
      this.needsStyle()
        ? HTTPS.test(this.form().styleUrl.trim())
        : !this.form().styleUrl.trim() || HTTPS.test(this.form().styleUrl.trim()),
    pmtilesUrl: () =>
      this.needsPmtiles()
        ? HTTPS.test(this.form().pmtilesUrl.trim())
        : !this.form().pmtilesUrl.trim() || HTTPS.test(this.form().pmtilesUrl.trim()),
    centerLatitude: () => inRange(this.form().centerLatitude, -90, 90),
    centerLongitude: () => inRange(this.form().centerLongitude, -180, 180),
    zoom: () => inRange(this.form().zoom, 0, 22),
  });

  constructor() {
    effect(() => {
      if (this.settings.hasValue()) this.apply(this.settings.value());
    });
    effect(() => {
      const error = this.settings.error();
      if (error) this.feedback.set(this.message(error, 'Failed to load the map settings.'));
    });
  }

  update(patch: Partial<ProviderForm>) {
    this.form.update((value) => ({ ...value, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((key) => this.serverInvalid().has(key))) {
      this.serverInvalid.update((set) => new Set([...set].filter((key) => !keys.includes(key))));
    }
  }

  invalid(key: FieldKey): boolean {
    return this.rules.invalid(key) || this.serverInvalid().has(key);
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  numberValue(event: Event): number | null {
    const value = (event.target as HTMLInputElement).value.trim();
    return value === '' ? null : Number(value);
  }

  refresh() {
    if (this.saving()) return;
    this.feedback.set(null);
    this.success.set(null);
    this.settings.reload();
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
      const result = await this.api.put<any>(ENDPOINT, {
        provider: form.provider,
        styleUrl: form.styleUrl.trim() || null,
        pmtilesUrl: form.pmtilesUrl.trim() || null,
        attribution: form.attribution.trim() || null,
        centerLatitude: form.centerLatitude,
        centerLongitude: form.centerLongitude,
        zoom: form.zoom,
      });
      this.apply(result?.data?.item ?? {});
      this.rules.reset();
      this.success.set('Map settings saved successfully.');
    } catch (error) {
      const fields = apiErrorFields(error);
      if (fields.length) {
        this.serverInvalid.set(new Set(fields));
        this.revealInvalid();
      }
      this.feedback.set(this.message(error, 'Failed to save the map settings.'));
    } finally {
      this.saving.set(false);
    }
  }

  private apply(item: Record<string, any>) {
    const number = (value: unknown, fallback: number) => {
      const parsed = Number(value);
      return value === null || value === undefined || !Number.isFinite(parsed) ? fallback : parsed;
    };
    const form: ProviderForm = {
      provider: (item['ImsProvider'] ?? 'style') as Provider,
      styleUrl: String(item['ImsStyleUrl'] ?? ''),
      pmtilesUrl: String(item['ImsPmtilesUrl'] ?? ''),
      attribution: String(item['ImsAttribution'] ?? ''),
      centerLatitude: number(item['ImsCenterLatitude'], EMPTY.centerLatitude as number),
      centerLongitude: number(item['ImsCenterLongitude'], EMPTY.centerLongitude as number),
      zoom: number(item['ImsZoom'], EMPTY.zoom as number),
    };
    this.form.set(form);
    this.baseline.set(JSON.stringify(form));
    this.serverInvalid.set(new Set());
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    const raw = (error as any)?.message;
    return typeof raw === 'string' && raw.trim() ? raw : fallback;
  }
}
