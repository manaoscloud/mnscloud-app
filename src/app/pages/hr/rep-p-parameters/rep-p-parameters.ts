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

type RepForm = { inpiNumber: string; developerDocument: string };
type FieldKey = 'inpiNumber' | 'developerDocument';

const ENDPOINT = 'system/hr/rep-p/parameters';
const digits = (value: string) => value.replace(/\D/g, '');

/** INPI number: empty (not registered yet) or up to 17 digits. */
export function validInpi(value: string): boolean {
  const text = digits(value);
  return !value.trim() || (text.length >= 1 && text.length <= 17);
}

/** Developer document: empty, CPF (11 digits) or CNPJ (14, alphanumeric since July 2026). */
export function validDeveloperDocument(value: string): boolean {
  const text = value.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return !value.trim() || /^\d{11}$/.test(text) || /^[0-9A-Z]{12}\d{2}$/.test(text);
}

/**
 * HR › REP-P (platform only, master): INPI registration number of the Pulse REP-P program and the
 * developer CNPJ/CPF written in every AFD header. Without the INPI number the AFD is provisional.
 */
@Component({
  selector: 'app-hr-rep-p-parameters',
  standalone: true,
  imports: [
    SettingsPageComponent,
    FieldHelpComponent,
    FieldInvalidDirective,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe,
  ],
  template: `
    <mns-settings-page
      [title]="'REP-P parameters'"
      [description]="'Identification of the Pulse time recording program (REP-P) written in every AFD. Without the INPI registration number the AFD is provisional.'"
      [loading]="loading()"
      [saving]="saving()"
      [dirty]="hasChanges()"
      [error]="feedback()"
      [success]="success()"
      (refresh)="refresh()"
      (cancel)="cancel()"
      (save)="save()"
    >
      <form class="form-grid">
        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'INPI registration number' | transloco }}</mat-label>
          <input
            matInput
            name="inpiNumber"
            data-field-key="inpiNumber"
            inputmode="numeric"
            maxlength="40"
            [mnsInvalid]="invalid('inpiNumber')"
            [value]="form().inpiNumber"
            (input)="update({ inpiNumber: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'INPI registration number' | transloco"
            [text]="
              'Number of the registration of the program at INPI (digits only). Leave empty while the registration is pending.'
                | transloco
            "
          />
          <mat-error>{{ 'Use at most 17 digits.' | transloco }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'Developer CNPJ or CPF' | transloco }}</mat-label>
          <input
            matInput
            name="developerDocument"
            data-field-key="developerDocument"
            inputmode="numeric"
            maxlength="40"
            [mnsInvalid]="invalid('developerDocument')"
            [value]="form().developerDocument"
            (input)="update({ developerDocument: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Developer CNPJ or CPF' | transloco"
            [text]="'Company that develops the REP-P (AFD header, fields 12 and 13).' | transloco"
          />
          <mat-error>{{ 'Use a CNPJ (14 digits) or a CPF (11 digits).' | transloco }}</mat-error>
        </mat-form-field>
      </form>
    </mns-settings-page>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class HrRepParametersPage {
  private readonly api = inject(ApiService);
  private readonly revealInvalid = injectRevealInvalidFields();

  readonly form = signal<RepForm>({ inpiNumber: '', developerDocument: '' });
  readonly baseline = signal('');
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly serverInvalid = signal<ReadonlySet<string>>(new Set());
  readonly hasChanges = computed(() => JSON.stringify(this.form()) !== this.baseline());

  private readonly parameters = resource({
    loader: async () => (await this.api.get<any>(ENDPOINT))?.data?.item ?? {},
  });
  readonly loading = computed(() => this.parameters.isLoading());

  readonly rules = new FieldRules<FieldKey>({
    inpiNumber: () => validInpi(this.form().inpiNumber),
    developerDocument: () => validDeveloperDocument(this.form().developerDocument),
  });

  constructor() {
    effect(() => {
      if (this.parameters.hasValue()) this.apply(this.parameters.value());
    });
    effect(() => {
      const error = this.parameters.error();
      if (error) this.feedback.set(this.message(error, 'Failed to load parameters.'));
    });
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  update(patch: Partial<RepForm>) {
    this.form.update((current) => ({ ...current, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((key) => this.serverInvalid().has(key))) {
      this.serverInvalid.update((set) => new Set([...set].filter((key) => !keys.includes(key))));
    }
  }

  invalid(key: FieldKey): boolean {
    return this.rules.invalid(key) || this.serverInvalid().has(key);
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
      const result = await this.api.put<any>(ENDPOINT, {
        inpiNumber: digits(form.inpiNumber) || null,
        developerDocument: form.developerDocument.toUpperCase().replace(/[^0-9A-Z]/g, '') || null,
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
    const form: RepForm = {
      inpiNumber: String(item['inpiNumber'] ?? ''),
      developerDocument: String(item['developerDocument'] ?? ''),
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
