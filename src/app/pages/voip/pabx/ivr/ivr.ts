import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxAccountQuickCreateHostComponent } from '../account/account';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/ivrs',
    uuidField: 'VpiUUID',
    pageTitle: 'IVRs',
    pageDescription: 'Manage PABX interactive voice response menus.',
    createTitle: 'New IVR',
    editTitle: 'Edit IVR',
    dialogDescription: 'Maintain IVR identity, greeting media and retry behavior.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No IVRs found.',
    deleteTitle: 'Delete IVR',
    deleteMessage: 'Delete this IVR? This also removes its options.',
    deleteSelectedTitle: 'Delete selected IVRs',
    deleteSelectedMessage: 'Delete {count} selected IVRs?',
    savedMessage: 'IVR saved successfully.',
    deletedMessage: 'IVR deleted successfully.',
    deleteFailedMessage: 'Failed to delete IVR.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      routing: 'Routing',
      notes: 'Notes',
    },
    initialValues: {
      enabled: 1,
      pabxUUID: '',
      name: '',
      mediaFileUUID: '',
      timeoutSeconds: 10,
      invalidRetries: 3,
      greetingText: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VpiName', uuidField: 'VpiUUID' },
      {
        id: 'pabx',
        label: 'PABX',
        kind: 'related',
        uuidField: 'VoipPabxAccountVpaUUID',
        lookupKey: 'pabxUUID',
      },
      { id: 'media', label: 'Media file', kind: 'related', field: 'VoipPabxMediaFileVmfUUID', lookupKey: 'mediaFileUUID' },
      { id: 'timeout', label: 'Timeout', kind: 'number', field: 'VpiTimeoutSeconds' },
      { id: 'retries', label: 'Invalid retries', kind: 'number', field: 'VpiInvalidRetries' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VpiEnabled' },
    ],
    fields: [
      { key: 'enabled', source: 'VpiEnabled', payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'pabxUUID',
        source: 'VoipPabxAccountVpaUUID',
        payloadKey: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        required: true,
        span: 1,
        quickCreate: { label: 'Create PABX', component: VoipPabxAccountQuickCreateHostComponent },
      },
      { key: 'name', source: 'VpiName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'mediaFileUUID',
        source: 'VoipPabxMediaFileVmfUUID',
        payloadKey: 'mediaFileUUID',
        label: 'Media file',
        type: 'search-select',
        tab: 'routing',
        span: 1,
      },
      {
        key: 'timeoutSeconds',
        source: 'VpiTimeoutSeconds',
        payloadKey: 'timeoutSeconds',
        label: 'Timeout seconds',
        type: 'number',
        tab: 'routing',
        span: 1,
      },
      {
        key: 'invalidRetries',
        source: 'VpiInvalidRetries',
        payloadKey: 'invalidRetries',
        label: 'Invalid retries',
        type: 'number',
        tab: 'routing',
        span: 1,
      },
      {
        key: 'greetingText',
        source: 'VpiGreetingText',
        payloadKey: 'greetingText',
        label: 'Greeting text',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-ivr',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxIvrPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly mediaFileOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'mediaFileUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'mediaFileUUID') return [{ value: '', label: 'None' }, ...this.mediaFileOptions()];
    return [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      mediaFileUUID: payload['mediaFileUUID'] || null,
      greetingText: text(payload['greetingText']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [pabxs, mediaFiles] = await Promise.all([
        this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('voip/pabx/media-files?status=1', (row) =>
          option(row.uuid ?? row.VmfUUID, row.name ?? row.VmfName, [row.PabxName]),
        ),
      ]);
      this.pabxOptions.set(pabxs);
      this.mediaFileOptions.set(mediaFiles);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async fetchPaged(
    endpoint: string,
    mapItem: (row: any) => ConfigurableCrudOption | null,
  ): Promise<ConfigurableCrudOption[]> {
    const options: ConfigurableCrudOption[] = [];
    for (let offset = 0; offset < 5000; offset += 500) {
      const separator = endpoint.includes('?') ? '&' : '?';
      const response = await this.rawApi.get<any>(
        `${endpoint}${separator}limit=500&offset=${offset}`,
      );
      const rows = extractItems(response);
      options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
      if (rows.length < 500) break;
    }
    return options.sort((left, right) => left.label.localeCompare(right.label));
  }
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function option(
  value: unknown,
  label: unknown,
  descriptionParts: unknown[] = [],
): ConfigurableCrudOption | null {
  const normalizedValue = String(value ?? '').trim();
  const normalizedLabel = String(label ?? '').trim();
  if (!normalizedValue || !normalizedLabel) return null;
  const description = descriptionParts
    .map((item) => String(item ?? '').trim())
    .filter(Boolean)
    .join(' - ');
  return { value: normalizedValue, label: normalizedLabel, description, searchText: `${normalizedLabel} ${description} ${normalizedValue}` };
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
