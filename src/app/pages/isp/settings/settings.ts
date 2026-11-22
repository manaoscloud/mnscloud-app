import { Component, ViewEncapsulation, inject, resource } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { injectSettingsForm } from '../../../shared/pages/settings-form';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';

type IspSettingsForm = {
  revision: number | null;
  reduceAfterDays: string;
  trustUnlockDays: string;
  trustUnlockMax30: string;
  blockProfileUUID: string;
};
type FieldKey = 'reduceAfterDays' | 'trustUnlockDays' | 'trustUnlockMax30';

const ENDPOINT = 'isp/settings';

const inRange = (value: string, min: number, max: number) => {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) && number >= min && number <= max;
};

/** Empty (no reduction stage) or a whole number of days from 1 to 365. */
export function validReduceAfterDays(value: string): boolean {
  return !value.trim() || inRange(value, 1, 365);
}

/**
 * ISP › Settings: dunning policy of the subscriptions of the tenant (reduction stage, block
 * profile and trust unlock limits). One record per tenant, created by the first read.
 */
@Component({
  selector: 'app-isp-settings',
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
  template: `
    <mns-settings-page
      [title]="'Parameters'"
      [description]="'Delinquency policy of your subscriptions: reduction stage, block profile and trust unlock.'"
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
          <mat-label>{{ 'Reduce after (days overdue)' | transloco }}</mat-label>
          <input
            matInput
            type="number"
            min="1"
            max="365"
            data-field-key="reduceAfterDays"
            [value]="form().reduceAfterDays"
            [mnsInvalid]="invalid('reduceAfterDays')"
            (input)="update({ reduceAfterDays: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Reduce after (days overdue)' | transloco"
            [text]="'isp.reduceAfterHelp' | transloco"
          />
          <mat-error>{{
            'Enter a number between 1 and 365, or leave empty.' | transloco
          }}</mat-error>
        </mat-form-field>

        <mns-search-select-field
          fieldClass="span-1"
          data-field-key="blockProfileUUID"
          [label]="'isp.blockProfile' | transloco"
          [options]="profileOptions()"
          [clearable]="true"
          [value]="form().blockProfileUUID"
          [help]="'isp.blockProfileHelp' | transloco"
          (valueChange)="update({ blockProfileUUID: $any($event) ?? '' })"
        />

        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'Trust unlock (days)' | transloco }}</mat-label>
          <input
            matInput
            type="number"
            min="1"
            max="7"
            data-field-key="trustUnlockDays"
            [value]="form().trustUnlockDays"
            [mnsInvalid]="invalid('trustUnlockDays')"
            (input)="update({ trustUnlockDays: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Trust unlock (days)' | transloco"
            [text]="'isp.trustUnlockDaysHelp' | transloco"
          />
          <mat-error>{{ 'Enter a number between 1 and 7.' | transloco }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-1">
          <mat-label>{{ 'Trust unlocks per 30 days' | transloco }}</mat-label>
          <input
            matInput
            type="number"
            min="0"
            max="30"
            data-field-key="trustUnlockMax30"
            [value]="form().trustUnlockMax30"
            [mnsInvalid]="invalid('trustUnlockMax30')"
            (input)="update({ trustUnlockMax30: value($event) })"
          />
          <mns-field-help
            matIconSuffix
            [label]="'Trust unlocks per 30 days' | transloco"
            [text]="'isp.trustUnlockMaxHelp' | transloco"
          />
          <mat-error>{{ 'Enter a number between 0 and 30.' | transloco }}</mat-error>
        </mat-form-field>
      </form>
    </mns-settings-page>
  `,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'app-fade-in-host' },
})
export class IspSettingsPage {
  private readonly api = inject(ApiService);
  private readonly settings = injectSettingsForm<IspSettingsForm, FieldKey>({
    endpoint: ENDPOINT,
    initial: {
      revision: null,
      reduceAfterDays: '',
      trustUnlockDays: '3',
      trustUnlockMax30: '1',
      blockProfileUUID: '',
    },
    read: (item) => ({
      revision: item['IstRevision'] === undefined ? null : Number(item['IstRevision']),
      reduceAfterDays: String(item['IstReduceAfterDays'] ?? ''),
      trustUnlockDays: String(item['IstTrustUnlockDays'] ?? '3'),
      trustUnlockMax30: String(item['IstTrustUnlockMax30'] ?? '1'),
      blockProfileUUID: String(item['IstBlockAuthenticationProfileAapUUID'] ?? ''),
    }),
    payload: (form) => ({
      revision: form.revision,
      reduceAfterDays: form.reduceAfterDays.trim() ? Number(form.reduceAfterDays) : null,
      trustUnlockDays: Number(form.trustUnlockDays),
      trustUnlockMax30: Number(form.trustUnlockMax30),
      blockAuthenticationProfileUUID: form.blockProfileUUID || null,
    }),
    rules: (form) => ({
      reduceAfterDays: () => validReduceAfterDays(form().reduceAfterDays),
      trustUnlockDays: () => inRange(form().trustUnlockDays, 1, 7),
      trustUnlockMax30: () => inRange(form().trustUnlockMax30, 0, 30),
    }),
  });

  private readonly profiles = resource({
    loader: async () =>
      (
        await this.api.get<{ data?: { items?: Record<string, unknown>[] } }>(
          'authentication/profiles?limit=200',
        )
      )?.data?.items ?? [],
  });

  readonly form = this.settings.form;
  readonly loading = this.settings.loading;
  readonly saving = this.settings.saving;
  readonly feedback = this.settings.feedback;
  readonly success = this.settings.success;
  readonly hasChanges = this.settings.hasChanges;

  profileOptions() {
    return (this.profiles.value() ?? []).map((item) => ({
      value: String(item['AapUUID']),
      label: String(item['AapName'] ?? item['AapUUID']),
    }));
  }

  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  update(patch: Partial<IspSettingsForm>) {
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
