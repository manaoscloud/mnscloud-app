import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { aiModelOptions, aiProviderKindLabel } from '../ai-providers/ai-providers';

/** AI features of the platform (catalog of the API, `GET system/ai/features`). */
export const AI_FEATURE_OPTIONS = [{ value: 'support.triage', label: 'Support ticket triage' }];

/** Prompt cache of a feature: the gateway decides per provider when it pays (`auto`). */
export const PROMPT_CACHE_OPTIONS = [
  { value: 'auto', label: 'Automatic' },
  { value: 'off', label: 'Off' },
];
export const PROMPT_CACHE_TTL_OPTIONS = [
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
];

export function aiFeatureLabel(feature: unknown): string {
  return (
    AI_FEATURE_OPTIONS.find((option) => option.value === feature)?.label ?? String(feature ?? '')
  );
}

const config = defineCrud({
  endpoint: 'system/ai/feature-bindings',
  uuidField: 'AiFeatureBindingUUID',
  pageTitle: 'AI features',
  pageDescription:
    'Which AI provider and model each platform feature uses, with its hourly cost limit.',
  createTitle: 'Configure AI feature',
  editTitle: 'Edit AI feature',
  dialogDescription:
    'Changes apply to the next call of the feature. Without a model the provider default model is used.',
  searchPlaceholder: 'Feature, provider or model',
  emptyLabel: 'No AI features configured.',
  deleteTitle: 'Remove AI feature configuration',
  deleteMessage:
    'Remove this configuration? The feature stops calling AI until it is configured again.',
  savedMessage: 'AI feature saved successfully.',
  deletedMessage: 'AI feature configuration removed.',
  deleteFailedMessage: 'Failed to remove the AI feature configuration.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    feature: 'support.triage',
    AiProviderAipUUID: '',
    model: '',
    maxOutputTokens: '',
    maxCallsPerHour: 120,
    promptCache: 'auto',
    promptCacheTtl: '5m',
  },
  columns: [
    {
      id: 'feature',
      field: 'Feature',
      label: 'Feature',
      kind: 'identity',
      value: (row, translate) => translate(aiFeatureLabel(row['Feature'])),
      detail: (row) => String(row['Feature'] ?? ''),
    },
    {
      id: 'provider',
      field: 'ProviderName',
      label: 'Provider',
      kind: 'related',
      detail: (row, translate) => translate(aiProviderKindLabel(row['ProviderKind'])),
    },
    { id: 'model', field: 'EffectiveModel', label: 'Model' },
    {
      id: 'usage',
      field: 'CallsLastHour',
      label: 'Calls in the last hour',
      value: (row) =>
        `${Number(row['CallsLastHour'] ?? 0)} / ${Number(row['MaxCallsPerHour'] ?? 0)}`,
    },
    {
      id: 'cache',
      field: 'PromptCache',
      label: 'Prompt cache',
      value: (row, translate) =>
        row['PromptCache'] === 'off'
          ? translate('Off')
          : `${translate('Automatic')} · ${translate(
              PROMPT_CACHE_TTL_OPTIONS.find((o) => o.value === row['PromptCacheTtl'])?.label ??
                '5 minutes',
            )}`,
    },
    { id: 'ready', field: 'Ready', label: 'Ready', kind: 'boolean' },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'feature',
      source: 'Feature',
      payloadKey: 'feature',
      label: 'Feature',
      type: 'search-select',
      options: AI_FEATURE_OPTIONS,
      translateOptions: true,
      required: true,
      help: 'Each feature has one configuration.',
      span: 3,
    },
    {
      key: 'AiProviderAipUUID',
      source: 'AiProviderAipUUID',
      payloadKey: 'AiProviderAipUUID',
      label: 'AI provider',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'system/ai/providers',
        uuidField: 'AiProviderUUID',
        labelField: 'Name',
        descriptionField: 'DefaultModel',
        selectedLabelField: 'ProviderName',
      },
      help: 'Active platform provider. Feature data is sent to it on every call.',
      span: 2,
    },
    {
      key: 'model',
      source: 'Model',
      payloadKey: 'model',
      label: 'Model',
      type: 'search-select',
      help: 'Models listed by the selected provider. Leave empty to use its default model.',
      span: 2,
    },
    {
      key: 'maxOutputTokens',
      source: 'MaxOutputTokens',
      payloadKey: 'maxOutputTokens',
      label: 'Max output tokens',
      type: 'number',
      help: 'Leave empty to use the provider limit (256 to 32000).',
      span: 1,
    },
    {
      key: 'maxCallsPerHour',
      source: 'MaxCallsPerHour',
      payloadKey: 'maxCallsPerHour',
      label: 'Calls per hour',
      type: 'number',
      required: true,
      help: 'Cost control: calls above this limit fail until the hour rolls over.',
      span: 1,
    },
    {
      key: 'promptCache',
      source: 'PromptCache',
      payloadKey: 'promptCache',
      label: 'Prompt cache',
      type: 'search-select',
      options: PROMPT_CACHE_OPTIONS,
      translateOptions: true,
      required: true,
      help: 'The provider reuses the fixed instructions of the feature at about 10% of the input price. Automatic only uses it when the feature is busy enough to pay off; OpenAI and Gemini also cache on their own.',
      span: 1,
    },
    {
      key: 'promptCacheTtl',
      source: 'PromptCacheTtl',
      payloadKey: 'promptCacheTtl',
      label: 'Cache duration',
      type: 'search-select',
      options: PROMPT_CACHE_TTL_OPTIONS,
      translateOptions: true,
      hiddenWhen: ({ values }) => values['promptCache'] === 'off',
      help: 'Anthropic: 5 minutes for steady traffic; 1 hour for calls spread over the hour (the cache write costs more).',
      span: 1,
    },
  ],
  payload: (values) => ({
    status: Number(values['status'] ?? 1),
    feature: values['feature'],
    AiProviderAipUUID: values['AiProviderAipUUID'],
    model: values['model'] || null,
    maxOutputTokens: values['maxOutputTokens'] ? Number(values['maxOutputTokens']) : null,
    maxCallsPerHour: Number(values['maxCallsPerHour'] || 120),
    promptCache: values['promptCache'] || 'auto',
    promptCacheTtl: values['promptCacheTtl'] || '5m',
  }),
});

type AiModelOption = { id: string; label: string };

@Component({
  selector: 'app-ai-features',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AiFeatureBindingsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly models = signal<AiModelOption[]>([]);
  private readonly modelsLoading = signal(false);
  private modelsRequest = 0;

  constructor() {
    super(config);
  }

  override startCreate(): void {
    this.models.set([]);
    super.startCreate();
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    this.models.set([]);
    super.startEdit(row);
    void this.loadModels(String(row['AiProviderAipUUID'] ?? ''));
  }

  override fieldOptions(field: ConfigurableCrudField): readonly ConfigurableCrudOption[] {
    if (field.key === 'model') {
      return aiModelOptions(this.models(), this.formValues()['model']);
    }
    return super.fieldOptions(field);
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'model' ? this.modelsLoading() : super.fieldLoading(field);
  }

  protected override onFieldValueChanged(key: string, value: unknown): void {
    if (key !== 'AiProviderAipUUID') return;
    this.patchFormValues({ model: '' });
    void this.loadModels(String(value ?? ''));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }

  private async loadModels(providerUUID: string): Promise<void> {
    const request = ++this.modelsRequest;
    if (!providerUUID) {
      this.models.set([]);
      return;
    }
    this.modelsLoading.set(true);
    try {
      const response = await this.api.get<{ data?: { items?: AiModelOption[] } }>(
        `system/ai/providers/${providerUUID}/models`,
        { silent: true },
      );
      if (request === this.modelsRequest) this.models.set(response.data?.items ?? []);
    } catch (error) {
      if (request !== this.modelsRequest) return;
      this.models.set([]);
      const body = (error as { error?: { error?: string } })?.error;
      this.snack.error(this.t(body?.error || 'Could not load the models of the provider.'));
    } finally {
      if (request === this.modelsRequest) this.modelsLoading.set(false);
    }
  }
}
