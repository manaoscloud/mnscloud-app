import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

/** LLM providers of the support AI agent (platform desk). The API seals the key; it never returns. */
export const AI_PROVIDER_KIND_OPTIONS = [
  { value: 'anthropic', label: 'Anthropic (Claude)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai_compatible', label: 'OpenAI-compatible' },
  { value: 'mock', label: 'Test provider (DEV only)' },
] as const;

const HEALTH_OPTIONS = [
  { value: 'unknown', label: 'Not tested' },
  { value: 'healthy', label: 'Connected' },
  { value: 'failed', label: 'Connection failed' },
];

const config = defineCrud({
  endpoint: 'system/support/ai/providers',
  uuidField: 'SupportAiProviderUUID',
  pageTitle: 'AI providers',
  pageDescription:
    'Language models the support assistant uses to classify and answer platform tickets.',
  createTitle: 'New AI provider',
  editTitle: 'Edit AI provider',
  dialogDescription:
    'The API key is encrypted by the platform and never shown again; leave it blank to keep the stored key.',
  searchPlaceholder: 'Name, kind or model',
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
    model: 'claude-sonnet-5-5',
    baseUrl: '',
    apiKey: '',
    maxOutputTokens: 4000,
    timeoutSeconds: 60,
  },
  rowActions: [
    {
      key: 'test',
      label: 'Test connection',
      icon: 'network_check',
      tooltip: 'Sends a minimal request with the stored key and records the result.',
      request: {
        method: 'post',
        endpoint: (row) =>
          `system/support/ai/providers/${String(row['SupportAiProviderUUID'])}/test`,
        successMessage: 'Connection test finished. Check the connection column.',
      },
    },
  ],
  columns: [
    {
      id: 'name',
      field: 'Name',
      label: 'Name',
      kind: 'identity',
      detail: (row) => String(row['Model'] ?? ''),
    },
    {
      // Text, not a status chip: the mobile card header keeps the record status chip.
      id: 'kind',
      field: 'Kind',
      label: 'Provider',
      value: (row, translate) =>
        translate(
          AI_PROVIDER_KIND_OPTIONS.find((option) => option.value === row['Kind'])?.label ??
            String(row['Kind'] ?? ''),
        ),
    },
    { id: 'key', field: 'ApiKeyConfigured', label: 'API key', kind: 'boolean' },
    {
      id: 'active',
      field: 'IsActiveProvider',
      label: 'In use by the assistant',
      kind: 'boolean',
    },
    {
      id: 'health',
      field: 'LastHealthStatus',
      label: 'Connection',
      kind: 'status',
      options: HEALTH_OPTIONS,
      translateValue: true,
      chipClass: (value) =>
        value === 'healthy' ? 'chip-success' : value === 'failed' ? 'chip-failed' : 'chip-skipped',
      detail: (row) => String(row['LastHealthError'] ?? ''),
    },
    { id: 'tested', field: 'LastHealthAt', label: 'Last test', kind: 'datetime', optional: true },
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
    { key: 'name', source: 'Name', payloadKey: 'name', label: 'Name', required: true, span: 3 },
    {
      key: 'kind',
      source: 'Kind',
      payloadKey: 'kind',
      label: 'Provider',
      type: 'search-select',
      options: [...AI_PROVIDER_KIND_OPTIONS],
      translateOptions: true,
      required: true,
      help: 'OpenAI-compatible covers self-hosted or third-party servers that speak the Chat Completions API.',
      span: 2,
    },
    {
      key: 'model',
      source: 'Model',
      payloadKey: 'model',
      label: 'Model',
      required: true,
      help: 'Model identifier at the provider, for example claude-sonnet-5-5 or claude-haiku-5-5.',
      span: 2,
    },
    {
      key: 'apiKey',
      payloadKey: 'apiKey',
      label: 'API key',
      type: 'password',
      autocomplete: 'new-password',
      helpWhen: ({ editing }) =>
        editing
          ? 'Leave blank to keep the stored key. A new key replaces it.'
          : 'Required except for the test provider. Stored encrypted and never shown again.',
      span: 2,
    },
    {
      key: 'baseUrl',
      source: 'BaseUrl',
      payloadKey: 'baseUrl',
      label: 'Base URL',
      help: 'Required only for OpenAI-compatible providers. Public https:// address; internal addresses are refused.',
      span: 2,
    },
    {
      key: 'maxOutputTokens',
      source: 'MaxOutputTokens',
      payloadKey: 'maxOutputTokens',
      label: 'Max output tokens',
      type: 'number',
      help: 'Upper bound of each answer (256 to 32000). Limits cost per ticket.',
      span: 1,
    },
    {
      key: 'timeoutSeconds',
      source: 'TimeoutSeconds',
      payloadKey: 'timeoutSeconds',
      label: 'Timeout (seconds)',
      type: 'number',
      help: 'A slower answer is retried later (5 to 300 seconds).',
      span: 1,
    },
  ],
  payload: (values) => ({
    status: Number(values['status'] ?? 1),
    name: values['name'],
    kind: values['kind'],
    model: values['model'],
    baseUrl: values['baseUrl'] || null,
    apiKey: values['apiKey'] || null,
    maxOutputTokens: Number(values['maxOutputTokens'] || 4000),
    timeoutSeconds: Number(values['timeoutSeconds'] || 60),
  }),
});

@Component({
  selector: 'app-support-ai-providers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SupportAiProvidersPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }
}
