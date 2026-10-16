import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required } from '@angular/forms/signals';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { openQuickCreate } from '../../../shared/crud/configurable-crud/configurable-crud-quick-create-host';
import { quickCreateRegistryEntry } from '../../../shared/crud/configurable-crud/quick-create';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { SettingsPageComponent } from '../../../shared/pages/settings-page';

/** One row of GET system/support/ai/settings. */
export interface SupportAiSettings {
  Enabled: number;
  EnabledAt: string | null;
  ProviderUUID: string | null;
  ProviderName: string | null;
  ProviderModel: string | null;
  AutoReplyMinConfidence: number | string;
  BugMinConfidence: number | string;
  MaxAutoReplies: number;
  MaxTriagesPerHour: number;
  IncludeDiagnostics: number;
  EmailPromptToTeam: number;
  BugReplyMessage: string;
  TriagesLastHour: number;
  Revision: number;
}

type SettingsForm = {
  enabled: string;
  providerUUID: string;
  autoReplyPercent: number;
  bugPercent: number;
  maxAutoReplies: number;
  maxTriagesPerHour: number;
  includeDiagnostics: string;
  emailPromptToTeam: string;
  bugReplyMessage: string;
};

const EMPTY_FORM: SettingsForm = {
  enabled: '0',
  providerUUID: '',
  autoReplyPercent: 80,
  bugPercent: 70,
  maxAutoReplies: 2,
  maxTriagesPerHour: 60,
  includeDiagnostics: '1',
  emailPromptToTeam: '1',
  bugReplyMessage: '',
};

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
    MatFormFieldModule,
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
  private readonly dialog = inject(MatDialog);

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

  private readonly providersResource = resource({
    loader: async () => {
      const response = await this.api.get<{
        data?: { items?: Array<Record<string, unknown>> };
      }>('system/support/ai/providers?status=1&limit=200&offset=0');
      return response.data?.items ?? [];
    },
  });

  readonly loading = computed(
    () => this.settingsResource.isLoading() || this.providersResource.isLoading(),
  );
  readonly saving = signal(false);
  readonly apiError = signal<string | null>(null);
  readonly settings = signal<SupportAiSettings | null>(null);
  private readonly createdProviders = signal<Array<{ value: string; label: string }>>([]);

  readonly providerOptions = computed(() => {
    const listed = (this.providersResource.value() ?? []).map((row) => ({
      value: String(row['SupportAiProviderUUID'] ?? ''),
      label: `${String(row['Name'] ?? '')} · ${String(row['Model'] ?? '')}`,
      description: Number(row['ApiKeyConfigured']) === 1 ? undefined : this.i18n.t('No API key'),
    }));
    const known = new Set(listed.map((option) => option.value));
    return [...listed, ...this.createdProviders().filter((option) => !known.has(option.value))];
  });

  readonly model = signal<SettingsForm>({ ...EMPTY_FORM });
  private readonly baseline = signal<SettingsForm>({ ...EMPTY_FORM });

  readonly settingsForm = form(this.model, (schema) => {
    required(schema.providerUUID, { when: ({ valueOf }) => valueOf(schema.enabled) === '1' });
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
    const error = this.settingsResource.error() ?? this.providersResource.error();
    if (error) this.apiError.set(this.errorMessage(error));
  });

  reload(): void {
    this.apiError.set(null);
    this.settingsResource.reload();
    this.providersResource.reload();
  }

  cancel(): void {
    this.model.set({ ...this.baseline() });
  }

  /** FK quick-create: the canonical AI provider form, keeping everything typed here. */
  async createProvider(): Promise<void> {
    const entry = quickCreateRegistryEntry('SupportAiProviderSapUUID');
    if (!entry) return;
    const result = await openQuickCreate(this.dialog, {
      loadComponent: entry.loadComponent,
      routeData: entry.routeData,
    });
    const option = result?.option;
    if (!option) return;
    const value = String(option.value);
    this.createdProviders.update((list) => [...list, { value, label: String(option.label) }]);
    this.model.update((current) => ({ ...current, providerUUID: value }));
    this.providersResource.reload();
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
          providerUUID: value.providerUUID || null,
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
      this.apply(response.data ?? null);
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
          providerUUID: settings.ProviderUUID ?? '',
          autoReplyPercent: toPercent(settings.AutoReplyMinConfidence, 80),
          bugPercent: toPercent(settings.BugMinConfidence, 70),
          maxAutoReplies: Number(settings.MaxAutoReplies ?? 2),
          maxTriagesPerHour: Number(settings.MaxTriagesPerHour ?? 60),
          includeDiagnostics: String(settings.IncludeDiagnostics ?? 1),
          emailPromptToTeam: String(settings.EmailPromptToTeam ?? 1),
          bugReplyMessage: settings.BugReplyMessage ?? '',
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
