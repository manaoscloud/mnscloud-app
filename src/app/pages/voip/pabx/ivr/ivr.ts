import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
  ConfigurableCrudRelatedCollectionColumn,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { VoipPabxAccountQuickCreateHostComponent } from '../account/account';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const routeTypes: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'ivr', label: 'IVR' },
  { value: 'queue', label: 'Queue' },
  { value: 'group', label: 'Group' },
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
    relatedCollections: [
      {
        key: 'ivrOptions',
        label: 'Options',
        emptyLabel: 'No options linked',
        addLabel: 'Add',
        endpoint: (ivrUUID) => `voip/pabx/ivrs/${ivrUUID}/options`,
        deleteEndpoint: (ivrUUID, row) => `voip/pabx/ivrs/${ivrUUID}/options/${row['VioUUID']}`,
        uuidField: 'VioUUID',
        initialValues: {
          enabled: 1,
          digit: '',
          routeType: 'extension',
          routeTargetUUID: '',
          description: '',
        },
        fields: [
          { key: 'enabled', payloadKey: 'enabled', label: 'Status', type: 'status', span: 1 },
          { key: 'digit', payloadKey: 'digit', label: 'Digit', required: true, span: 1 },
          {
            key: 'routeType',
            payloadKey: 'routeType',
            label: 'Route type',
            type: 'select',
            options: routeTypes,
            translateOptions: true,
            required: true,
            span: 1,
          },
          {
            key: 'routeTargetUUID',
            payloadKey: 'routeTargetUUID',
            label: 'Destination',
            type: 'search-select',
            span: 1,
          },
          {
            key: 'description',
            payloadKey: 'description',
            label: 'Description',
            span: 4,
          },
        ],
        columns: [
          { id: 'digit', label: 'Digit', field: 'VioDigit' },
          { id: 'route', label: 'Route type', field: 'VioRouteType' },
          { id: 'destination', label: 'Destination', field: 'VioRouteTargetUUID', kind: 'related', lookupKey: 'routeTargetUUID' },
          { id: 'description', label: 'Description', field: 'VioDescription' },
          { id: 'status', label: 'Status', field: 'VioEnabled', kind: 'status' },
        ],
        payload: (values) => ({
          digit: text(values['digit']),
          routeType: text(values['routeType']),
          routeTargetUUID: text(values['routeTargetUUID']),
          description: text(values['description']),
          enabled: Number(values['enabled']) === 1,
        }),
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
  readonly extensionOptions = signal<ConfigurableCrudOption[]>([]);
  readonly ivrOptions = signal<ConfigurableCrudOption[]>([]);
  readonly queueOptions = signal<ConfigurableCrudOption[]>([]);
  readonly groupOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'mediaFileUUID', 'routeTargetUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'mediaFileUUID') return [{ value: '', label: 'None' }, ...this.mediaFileOptions()];
    if (key === 'routeTargetUUID') return this.routeTargetOptions();
    return [];
  }

  protected override afterRelatedFieldChange(
    collection: ConfigurableCrudRelatedCollection,
    field: ConfigurableCrudField,
    _value: unknown,
  ): void {
    if (collection.key !== 'ivrOptions' || field.key !== 'routeType') return;
    this.setRelatedCollectionFieldValue(collection, { key: 'routeTargetUUID', label: 'Destination' }, '');
  }

  override relatedCollectionColumnValue(
    row: ConfigurableCrudRecord,
    column: ConfigurableCrudRelatedCollectionColumn,
  ): string {
    if (column.id !== 'destination') return super.relatedCollectionColumnValue(row, column);
    const value = String(row['VioRouteTargetUUID'] ?? '').trim();
    if (!value) return String(row['VioRouteTargetValue'] ?? '').trim() || '-';
    const routeType = String(row['VioRouteType'] ?? 'extension').toLowerCase();
    const options =
      routeType === 'ivr'
        ? this.ivrOptions()
        : routeType === 'queue'
          ? this.queueOptions()
          : routeType === 'group'
            ? this.groupOptions()
            : this.extensionOptions();
    return options.find((option) => String(option.value) === value)?.label ?? value;
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
      const [pabxs, mediaFiles, extensions, ivrs, queues, groups] = await Promise.all([
        this.fetchPaged('voip/pabx/accounts', (row) =>
          option(row.VpaUUID, row.VpaName, [row.CustomerName, row.DomainName]),
        ),
        this.fetchPaged('voip/pabx/media-files?status=1', (row) =>
          option(row.uuid ?? row.VmfUUID, row.name ?? row.VmfName, [row.PabxName]),
        ),
        this.fetchPaged('voip/pabx/extensions?status=1', (row) =>
          option(row.VpeUUID, row.VpeUsername, [row.PabxName, row.CustomerName]),
        ),
        this.fetchPaged('voip/pabx/ivrs?status=1', (row) =>
          option(row.VpiUUID, row.VpiName, [row.PabxName]),
        ),
        this.fetchPaged('voip/pabx/queues?status=1', (row) =>
          option(row.VpqUUID, row.VpqName, [row.PabxName]),
        ),
        this.fetchPaged('voip/pabx/groups?status=1', (row) =>
          option(row.VpgUUID, row.VpgName, [row.PabxName]),
        ),
      ]);
      this.pabxOptions.set(pabxs);
      this.mediaFileOptions.set(mediaFiles);
      this.extensionOptions.set(extensions);
      this.ivrOptions.set(ivrs);
      this.queueOptions.set(queues);
      this.groupOptions.set(groups);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private routeTargetOptions(): ConfigurableCrudOption[] {
    const routeType = String(this.relatedForms()['ivrOptions']?.['routeType'] ?? 'extension');
    if (routeType === 'ivr') return this.ivrOptions();
    if (routeType === 'queue') return this.queueOptions();
    if (routeType === 'group') return this.groupOptions();
    return this.extensionOptions();
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
