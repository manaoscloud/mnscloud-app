import { Component, signal } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  providerHealthColumns,
  providerStatusNameFields,
  runProviderConnectionTest,
} from '../platform-provider-crud';

/** Platform AI providers. Official endpoints only; the API seals the key and never returns it. */
export const AI_PROVIDER_KIND_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
] as const;

export function aiProviderKindLabel(kind: unknown): string {
  return (
    AI_PROVIDER_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? String(kind ?? '')
  );
}

/** A typed key long enough to be a real provider key (the API validates the rest). */
const MIN_KEY_LENGTH = 8;

type AiModelOption = { id: string; label: string };

/** Options of a model select: the provider catalog plus the current value when it left the list. */
export function aiModelOptions(
  models: readonly AiModelOption[],
  selected: unknown,
): ConfigurableCrudOption[] {
  const options: ConfigurableCrudOption[] = models.map((model) => ({
    value: model.id,
    label: model.label,
    ...(model.label !== model.id ? { description: model.id } : {}),
  }));
  const current = String(selected ?? '').trim();
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: current });
  }
  return options;
}

const config = defineCrud({
  endpoint: 'system/ai/providers',
  uuidField: 'AiProviderUUID',
  pageTitle: 'AI providers',
  pageDescription:
    'Language model providers of the platform, shared by every AI feature (support, chat, CRM and others).',
  createTitle: 'New AI provider',
  editTitle: 'Edit AI provider',
  dialogDescription:
    'The API key is encrypted by the platform and never shown again; leave it blank to keep the stored key.',
  searchPlaceholder: 'Name, provider or model',
  emptyLabel: 'No AI providers found.',
  deleteTitle: 'Delete AI provider',
  deleteMessage: 'Delete this AI provider? Its stored API key is erased.',
  savedMessage: 'AI provider saved successfully.',
  deletedMessage: 'AI provider deleted successfully.',
  deleteFailedMessage: 'Failed to delete AI provider.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: {
    status: 1,
    name: '',
    kind: 'anthropic',
    apiKey: '',
    defaultModel: '',
    maxOutputTokens: 4000,
    timeoutSeconds: 60,
  },
  rowActions: [
    {
      key: 'test',
      label: 'Test connection',
      icon: 'network_check',
      tooltip:
        'Sends a minimal request with the stored key and default model and records the result.',
    },
  ],
  columns: [
    {
      id: 'name',
      field: 'Name',
      label: 'Name',
      kind: 'identity',
      detail: (row) => String(row['DefaultModel'] ?? ''),
    },
    {
      // Text, not a status chip: the mobile card header keeps the record status chip.
      id: 'kind',
      field: 'Kind',
      label: 'Provider',
      value: (row, translate) => translate(aiProviderKindLabel(row['Kind'])),
    },
    { id: 'key', field: 'ApiKeyConfigured', label: 'API key', kind: 'boolean' },
    { id: 'features', field: 'FeatureCount', label: 'AI features', kind: 'number' },
    ...providerHealthColumns(),
  ],
  fields: [
    ...providerStatusNameFields(),
    {
      key: 'kind',
      source: 'Kind',
      payloadKey: 'kind',
      label: 'Provider',
      type: 'search-select',
      options: [...AI_PROVIDER_KIND_OPTIONS],
      translateOptions: true,
      required: true,
      help: 'Official Anthropic, OpenAI or Google Gemini API. Changing the provider requires a new API key.',
      span: 1,
    },
    {
      key: 'defaultModel',
      source: 'DefaultModel',
      payloadKey: 'defaultModel',
      label: 'Default model',
      type: 'search-select',
      required: true,
      help: 'Models listed by the provider for this key. Each AI feature may use another model of the same provider.',
      span: 1,
      suffixButtons: [
        {
          icon: 'refresh',
          tooltip: 'Reload the models of the provider',
          onClick: (_context, host) => void (host as AiProvidersPage).loadModels(true),
        },
      ],
    },
    {
      key: 'apiKey',
      payloadKey: 'apiKey',
      label: 'API key',
      type: 'password',
      autocomplete: 'new-password',
      requiredWhen: ({ editing }) => !editing,
      helpWhen: ({ editing }) =>
        editing
          ? 'Leave blank to keep the stored key. A new key replaces it.'
          : 'Stored encrypted and never shown again. The models of the provider load once the key is filled in.',
      span: 2,
    },
    {
      key: 'maxOutputTokens',
      source: 'MaxOutputTokens',
      payloadKey: 'maxOutputTokens',
      label: 'Max output tokens',
      type: 'number',
      help: 'Default upper bound of each answer (256 to 32000). Limits cost per call.',
      span: 1,
    },
    {
      key: 'timeoutSeconds',
      source: 'TimeoutSeconds',
      payloadKey: 'timeoutSeconds',
      label: 'Timeout (seconds)',
      type: 'number',
      help: 'A slower answer fails and is retried by the feature (5 to 300 seconds).',
      span: 1,
    },
  ],
  payload: (values) => ({
    status: Number(values['status'] ?? 1),
    name: values['name'],
    kind: values['kind'],
    defaultModel: values['defaultModel'],
    apiKey: values['apiKey'] || null,
    maxOutputTokens: Number(values['maxOutputTokens'] || 4000),
    timeoutSeconds: Number(values['timeoutSeconds'] || 60),
  }),
});

@Component({
  selector: 'app-ai-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class AiProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly models = signal<AiModelOption[]>([]);
  private readonly modelsLoading = signal(false);
  private modelsTimer: ReturnType<typeof setTimeout> | undefined;
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
    void this.loadModels(false);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'defaultModel') {
      return aiModelOptions(this.models(), this.formValues()['defaultModel']);
    }
    return [];
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return field.key === 'defaultModel' ? this.modelsLoading() : super.fieldLoading(field);
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    if (key !== 'kind' && key !== 'apiKey') return;
    if (key === 'kind') this.models.set([]);
    clearTimeout(this.modelsTimer);
    this.modelsTimer = setTimeout(() => void this.loadModels(false), 600);
  }

  /** Test connection: shows the provider reason and what to do right away, then refreshes the list. */
  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'test') return;
    try {
      await runProviderConnectionTest(
        { api: this.api, snack: this.snack, t: (key, params) => this.t(key, params) },
        `system/ai/providers/${String(row['AiProviderUUID'])}/test`,
      );
    } finally {
      this.refreshList();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }

  /**
   * Model catalog for the form: the typed key when there is one (nothing is stored), otherwise
   * the stored key of the record being edited while its provider is unchanged.
   */
  async loadModels(refresh: boolean): Promise<void> {
    const values = this.formValues();
    const kind = String(values['kind'] ?? '');
    const apiKey = String(values['apiKey'] ?? '').trim();
    const editing = this.editingRecord();
    const storedUUID =
      editing && String(editing['Kind'] ?? '') === kind ? String(editing['AiProviderUUID']) : '';
    if (!kind || (apiKey.length < MIN_KEY_LENGTH && !storedUUID)) {
      this.models.set([]);
      return;
    }
    const request = ++this.modelsRequest;
    const typedKey = apiKey.length >= MIN_KEY_LENGTH;
    this.modelsLoading.set(true);
    try {
      // The typed-key call reports its own error toast (a rejected key); the stored-key read is silent.
      const response = typedKey
        ? await this.api.post<{ data?: { items?: AiModelOption[] } }>(
            'system/ai/providers/models',
            { kind, apiKey },
          )
        : await this.api.get<{ data?: { items?: AiModelOption[] } }>(
            `system/ai/providers/${storedUUID}/models${refresh ? '?refresh=1' : ''}`,
            { silent: true },
          );
      if (request !== this.modelsRequest) return;
      const items = response.data?.items ?? [];
      this.models.set(items);
      if (!String(this.formValues()['defaultModel'] ?? '') && items.length) {
        this.patchFormValues({ defaultModel: items[0].id });
      }
    } catch (error) {
      if (request !== this.modelsRequest) return;
      this.models.set([]);
      if (!typedKey) {
        const body = (error as { error?: { error?: string } })?.error;
        this.snack.error(this.t(body?.error || 'Could not load the models of the provider.'));
      }
    } finally {
      if (request === this.modelsRequest) this.modelsLoading.set(false);
    }
  }
}
