import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';

/** One row of GET system/support/ai/settings. */
export interface SupportAiSettings {
  Enabled: number;
  EnabledAt: string | null;
  /** 1 when the platform AI feature support.triage has an active provider (Settings › AI). */
  FeatureReady: number;
  ProviderName: string | null;
  ProviderModel: string | null;
  AutoReplyMinConfidence: number | string;
  BugMinConfidence: number | string;
  MaxAutoReplies: number;
  MaxTriagesPerHour: number;
  IncludeDiagnostics: number;
  EmailPromptToTeam: number;
  BugReplyMessage: string;
  /** Requester attachments the model may read (absent on older APIs). */
  IncludeImages?: number;
  IncludeDocuments?: number;
  IncludeTextFiles?: number;
  MaxAttachments?: number;
  MaxTriagesPerRequesterHour?: number;
  TriagesLastHour: number;
  Revision: number;
}

type SettingsForm = {
  enabled: string;
  autoReplyPercent: number;
  bugPercent: number;
  maxAutoReplies: number;
  maxTriagesPerHour: number;
  includeDiagnostics: string;
  emailPromptToTeam: string;
  bugReplyMessage: string;
  includeImages: string;
  includeDocuments: string;
  includeTextFiles: string;
  maxAttachments: number;
  maxTriagesPerRequesterHour: number;
};

/** Fields saved by PUT system/support/ai/settings/attachments. */
const ATTACHMENT_FIELDS: Array<keyof SettingsForm> = [
  'includeImages',
  'includeDocuments',
  'includeTextFiles',
  'maxAttachments',
  'maxTriagesPerRequesterHour',
];

const EMPTY_FORM: SettingsForm = {
  enabled: '0',
  autoReplyPercent: 80,
  bugPercent: 70,
  maxAutoReplies: 2,
  maxTriagesPerHour: 60,
  includeDiagnostics: '1',
  emailPromptToTeam: '1',
  bugReplyMessage: '',
  includeImages: '1',
  includeDocuments: '1',
  includeTextFiles: '1',
  maxAttachments: 4,
  maxTriagesPerRequesterHour: 10,
};

/** Whether the attachment settings differ from the saved ones (they have their own endpoint). */
export function attachmentSettingsChanged(next: SettingsForm, saved: SettingsForm): boolean {
  return ATTACHMENT_FIELDS.some((field) => String(next[field]) !== String(saved[field]));
}

/** Percent shown in the form; the API stores a 0-1 confidence. */
export function toPercent(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : fallback;
}

/** Singleton configuration of the support AI triage agent (platform desk). */
@Component({
  selector: 'app-support-ai-settings',
  standalone: true,
  imports: [
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatTooltipModule,
    RouterLink,
    MatInputModule,
    TranslocoPipe,
    FieldHelpComponent,
    MnsSearchSelectFieldComponent,
    SettingsPageComponent,
  ],
  templateUrl: './ai-settings.html',
})
export class SupportAiSettingsPage {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly snack = inject(SnackbarService);

  readonly onOffOptions = [
    { value: '1', label: 'On' },
    { value: '0', label: 'Off' },
  ];
  readonly yesNoOptions = [
    { value: '1', label: 'Yes' },
    { value: '0', label: 'No' },
  ];

  private readonly settingsResource = resource({
    loader: async () => {
      const response = await this.api.get<{ data?: SupportAiSettings }>(
        'system/support/ai/settings',
      );
      return response.data ?? null;
    },
  });

  readonly loading = computed(() => this.settingsResource.isLoading());
  readonly saving = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly settings = signal<SupportAiSettings | null>(null);

  /** Provider and model of the support.triage AI feature, read-only here. */
  readonly providerLabel = computed(() => {
    const settings = this.settings();
    if (!settings) return '-';
    if (Number(settings.FeatureReady) !== 1 || !settings.ProviderName) {
      return this.i18n.t('Not configured');
    }
    return `${settings.ProviderName} · ${settings.ProviderModel ?? ''}`;
  });

  readonly model = signal<SettingsForm>({ ...EMPTY_FORM });
  private readonly baseline = signal<SettingsForm>({ ...EMPTY_FORM });

  readonly settingsForm = form(this.model, (schema) => {
    min(schema.autoReplyPercent, 50);
    max(schema.autoReplyPercent, 100);
    min(schema.bugPercent, 50);
    max(schema.bugPercent, 100);
    min(schema.maxAutoReplies, 0);
    max(schema.maxAutoReplies, 5);
    min(schema.maxTriagesPerHour, 1);
    max(schema.maxTriagesPerHour, 1000);
    required(schema.bugReplyMessage);
    maxLength(schema.bugReplyMessage, 2000);
    min(schema.maxAttachments, 0);
    max(schema.maxAttachments, 10);
    min(schema.maxTriagesPerRequesterHour, 1);
    max(schema.maxTriagesPerRequesterHour, 100);
  });

  readonly dirty = computed(() => JSON.stringify(this.model()) !== JSON.stringify(this.baseline()));
  readonly valid = computed(() => this.settingsForm().valid());
  readonly usageLabel = computed(() => {
    const settings = this.settings();
    return settings ? `${settings.TriagesLastHour} / ${settings.MaxTriagesPerHour}` : '-';
  });

  private readonly settingsEffect = effect(() => {
    const settings = this.settingsResource.value();
    if (settings === undefined) return;
    this.apply(settings);
  });

  private readonly errorEffect = effect(() => {
    const error = this.settingsResource.error();
    if (error) this.apiError.set(this.errorMessage(error));
  });

  reload(): void {
    this.apiError.set(null);
    this.settingsResource.reload();
  }

  cancel(): void {
    this.model.set({ ...this.baseline() });
  }

  async save(): Promise<void> {
    if (this.saving() || !this.valid()) return;
    const value = this.model();
    this.saving.set(true);
    this.apiError.set(null);
    try {
      const response = await this.api.put<{ data?: SupportAiSettings }>(
        'system/support/ai/settings',
        {
          enabled: Number(value.enabled),
          autoReplyMinConfidence: Number(value.autoReplyPercent) / 100,
          bugMinConfidence: Number(value.bugPercent) / 100,
          maxAutoReplies: Number(value.maxAutoReplies),
          maxTriagesPerHour: Number(value.maxTriagesPerHour),
          includeDiagnostics: Number(value.includeDiagnostics),
          emailPromptToTeam: Number(value.emailPromptToTeam),
          bugReplyMessage: value.bugReplyMessage.trim(),
          expectedRevision: this.settings()?.Revision ?? null,
        },
      );
      let saved = response.data ?? null;
      if (saved && attachmentSettingsChanged(value, this.baseline())) {
        const attachments = await this.api.put<{ data?: SupportAiSettings }>(
          'system/support/ai/settings/attachments',
          {
            includeImages: Number(value.includeImages),
            includeDocuments: Number(value.includeDocuments),
            includeTextFiles: Number(value.includeTextFiles),
            maxAttachments: Number(value.maxAttachments),
            maxTriagesPerRequesterHour: Number(value.maxTriagesPerRequesterHour),
            expectedRevision: saved.Revision ?? null,
          },
        );
        saved = attachments.data ?? saved;
      }
      this.apply(saved);
      this.snack.success(this.i18n.t('AI assistant settings saved.'));
    } catch (error) {
      const message = this.errorMessage(error);
      this.apiError.set(message);
      this.snack.error(message);
    } finally {
      this.saving.set(false);
    }
  }

  private apply(settings: SupportAiSettings | null): void {
    this.settings.set(settings);
    const next: SettingsForm = settings
      ? {
          enabled: String(settings.Enabled ?? 0),
          autoReplyPercent: toPercent(settings.AutoReplyMinConfidence, 80),
          bugPercent: toPercent(settings.BugMinConfidence, 70),
          maxAutoReplies: Number(settings.MaxAutoReplies ?? 2),
          maxTriagesPerHour: Number(settings.MaxTriagesPerHour ?? 60),
          includeDiagnostics: String(settings.IncludeDiagnostics ?? 1),
          emailPromptToTeam: String(settings.EmailPromptToTeam ?? 1),
          bugReplyMessage: settings.BugReplyMessage ?? '',
          includeImages: String(settings.IncludeImages ?? 1),
          includeDocuments: String(settings.IncludeDocuments ?? 1),
          includeTextFiles: String(settings.IncludeTextFiles ?? 1),
          maxAttachments: Number(settings.MaxAttachments ?? 4),
          maxTriagesPerRequesterHour: Number(settings.MaxTriagesPerRequesterHour ?? 10),
        }
      : { ...EMPTY_FORM };
    this.baseline.set(next);
    this.model.set({ ...next });
  }

  private errorMessage(error: unknown): string {
    const body = (error as { error?: { error?: string } })?.error;
    const message = body?.error ?? (error instanceof Error ? error.message : '');
    return this.i18n.t(message || 'Failed to save AI assistant settings.');
  }
}
