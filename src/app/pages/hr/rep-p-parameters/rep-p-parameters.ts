import { Component, ViewEncapsulation } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { injectSettingsForm } from '../../../shared/pages/settings-form';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';

type RepForm = {
  inpiNumber: string;
  developerDocument: string;
  developerName: string;
  developerEmail: string;
};
type FieldKey = keyof RepForm;

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

/** Developer e-mail of the AEJ record 08: empty or an address of at most 50 characters. */
export function validDeveloperEmail(value: string): boolean {
  const text = value.trim();
  return !text || (text.length <= 50 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text));
}

/**
 * HR › REP-P (platform only, master): INPI registration number of the Pulse REP-P program and the
 * developer CNPJ/CPF written in every AFD header, and the developer name and e-mail of the PTRP
 * written in every AEJ. Without them the AFD and the AEJ are provisional.
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
      [description]="'Identification of the Pulse time recording program (REP-P) written in every AFD and AEJ. Without the INPI registration number the files are provisional.'"
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
        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'Developer name' | transloco }}</mat-label>
          <input
            matInput
            name="developerName"
            data-field-key="developerName"
            maxlength="150"
            [mnsInvalid]="invalid('developerName')"
            [value]="form().developerName"
            (input)="update({ developerName: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Developer name' | transloco"
            [text]="'Legal name of the developer of the program (AEJ record 08).' | transloco"
          />
        </mat-form-field>
        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'Developer e-mail' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            name="developerEmail"
            data-field-key="developerEmail"
            maxlength="50"
            [mnsInvalid]="invalid('developerEmail')"
            [value]="form().developerEmail"
            (input)="update({ developerEmail: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Developer e-mail' | transloco"
            [text]="'Contact e-mail of the developer of the program (AEJ record 08).' | transloco"
          />
          <mat-error>{{ 'Use a valid e-mail of at most 50 characters.' | transloco }}</mat-error>
        </mat-form-field>
      </form>
    </mns-settings-page>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class HrRepParametersPage {
  private readonly settings = injectSettingsForm<RepForm, FieldKey>({
    endpoint: ENDPOINT,
    initial: { inpiNumber: '', developerDocument: '', developerName: '', developerEmail: '' },
    read: (item) => ({
      inpiNumber: String(item['inpiNumber'] ?? ''),
      developerDocument: String(item['developerDocument'] ?? ''),
      developerName: String(item['developerName'] ?? ''),
      developerEmail: String(item['developerEmail'] ?? ''),
    }),
    payload: (form) => ({
      inpiNumber: digits(form.inpiNumber) || null,
      developerDocument: form.developerDocument.toUpperCase().replace(/[^0-9A-Z]/g, '') || null,
      developerName: form.developerName.trim() || null,
      developerEmail: form.developerEmail.trim() || null,
    }),
    rules: (form) => ({
      inpiNumber: () => validInpi(form().inpiNumber),
      developerDocument: () => validDeveloperDocument(form().developerDocument),
      developerName: () => form().developerName.trim().length <= 150,
      developerEmail: () => validDeveloperEmail(form().developerEmail),
    }),
  });

  readonly form = this.settings.form;
  readonly loading = this.settings.loading;
  readonly saving = this.settings.saving;
  readonly feedback = this.settings.feedback;
  readonly success = this.settings.success;
  readonly hasChanges = this.settings.hasChanges;

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  update(patch: Partial<RepForm>) {
    this.settings.update(patch);
  }

  invalid(key: FieldKey): boolean {
    return this.settings.invalid(key);
  }

  refresh() {
    this.settings.refresh();
  }

  cancel() {
    this.settings.cancel();
  }

  save() {
    return this.settings.save();
  }
}
