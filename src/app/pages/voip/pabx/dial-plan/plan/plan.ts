import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

function optionalText(value: unknown): string {
  if (value === null || value === undefined) return '';
  const normalized = String(value).trim();
  if (!normalized || ['null', 'undefined'].includes(normalized.toLowerCase())) return '';
  return normalized;
}

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/dial-plans',
    uuidField: 'uuid',
    pageTitle: 'Dial Plans',
    pageDescription: 'Manage reusable dialing plans for PABX accounts and extensions.',
    createTitle: 'New dial plan',
    editTitle: 'Edit dial plan',
    dialogDescription: 'Maintain the dialing plan name, status and observations.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No dial plans found.',
    deleteTitle: 'Delete dial plan',
    deleteMessage: 'Delete this dial plan?',
    deleteSelectedTitle: 'Delete selected dial plans',
    deleteSelectedMessage: 'Delete {count} selected dial plans?',
    savedMessage: 'Dial plan saved successfully.',
    deletedMessage: 'Dial plan deleted successfully.',
    deleteFailedMessage: 'Failed to delete dial plan.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      notes: 'Notes',
    },
    initialValues: {
      enabled: 1,
      name: '',
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'description',
        source: 'description',
        label: 'Description',
        fromRecord: (value) => optionalText(value),
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-dial-plan-plan',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxDialPlanPlanPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  protected override async quickCreateOption(
    response: unknown,
    payload: ConfigurableCrudRecord,
  ): Promise<ConfigurableCrudOption | null> {
    return (
      dialPlanOptionFromResponse(response, payload) ?? super.quickCreateOption(response, payload)
    );
  }

  constructor() {
    super(config());
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
    };
  }
}

function dialPlanOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractRecord(response) ?? payload;
  const uuid = text(record['uuid']) ?? text(record['VdpUUID']);
  const label = text(record['name']) ?? text(record['VdpName']) ?? text(payload['name']) ?? uuid;
  if (!uuid || !label) return null;
  const description = text(record['description']) ?? text(record['VdpDescription']) ?? '';
  return {
    value: uuid,
    label,
    description,
    searchText: `${label} ${description} ${uuid}`,
  };
}

function extractRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const candidates = [
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).item,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).record,
    value?.data && (value.data as { item?: unknown; record?: unknown; data?: unknown }).data,
    value?.data,
    value?.item,
    value?.record,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object') return candidate as ConfigurableCrudRecord;
  }
  return null;
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (['null', 'undefined'].includes(normalized.toLowerCase())) return null;
  return normalized || null;
}
