import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/blacklists',
    uuidField: 'VbkUUID',
    pageTitle: 'Blacklists',
    pageDescription: 'Manage reusable blacklist policies for PABX call routing.',
    createTitle: 'New blacklist',
    editTitle: 'Edit blacklist',
    dialogDescription: 'Maintain the blacklist identity and lifecycle status.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No blacklists found.',
    deleteTitle: 'Delete blacklist',
    deleteMessage: 'Delete this blacklist?',
    deleteSelectedTitle: 'Delete selected blacklists',
    deleteSelectedMessage: 'Delete {count} selected blacklists?',
    savedMessage: 'Blacklist saved successfully.',
    deletedMessage: 'Blacklist deleted successfully.',
    deleteFailedMessage: 'Failed to delete blacklist.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    initialValues: {
      VbkEnabled: 1,
      VbkName: '',
      VbkDescription: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'VbkName', uuidField: 'VbkUUID' },
      { id: 'description', label: 'Description', field: 'VbkDescription' },
      { id: 'numbers', label: 'Numbers', kind: 'number', field: 'NumberCount' },
      { id: 'activeNumbers', label: 'Active numbers', kind: 'number', field: 'ActiveNumberCount' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VbkEnabled' },
    ],
    fields: [
      { key: 'VbkEnabled', source: 'VbkEnabled', label: 'Status', type: 'status', span: 1 },
      { key: 'VbkName', source: 'VbkName', label: 'Name', required: true, span: 1 },
      {
        key: 'VbkDescription',
        source: 'VbkDescription',
        label: 'Description',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-blacklist-list',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxBlacklistListPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config());
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      name: text(payload['VbkName']) ?? '',
      description: text(payload['VbkDescription']) ?? '',
      enabled: Number(payload['VbkEnabled']) === 1,
    };
  }
}

@Component({
  selector: 'app-voip-pabx-blacklist-list-quick-create-host',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: [
    '../../../../../shared/crud/configurable-crud/configurable-crud-page.scss',
    '../../../../erp/customer/customer-quick-create-host.scss',
  ],
})
export class VoipPabxBlacklistListQuickCreateHostComponent extends VoipPabxBlacklistListPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<
      VoipPabxBlacklistListQuickCreateHostComponent,
      ConfigurableCrudQuickCreateResult
    >,
  );
  private savingFromQuickCreate = false;

  constructor() {
    super();
    queueMicrotask(() => this.startCreate());
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    this.savingFromQuickCreate = true;
    try {
      await super.saveItem(saveAndNew);
    } finally {
      this.savingFromQuickCreate = false;
    }
  }

  override closeDialog(): void {
    super.closeDialog();
    if (!this.savingFromQuickCreate) {
      this.quickDialogRef.close({ option: null });
    }
  }

  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    await super.afterSave(context);
    if (context.mode !== 'create') return;
    this.quickDialogRef.close({
      option: blacklistOptionFromResponse(context.response, context.payload),
      response: context.response,
      payload: context.payload,
    });
  }
}

function blacklistOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractRecord(response) ?? payload;
  const uuid = text(record['VbkUUID']);
  const label = text(record['VbkName']) ?? text(payload['name']) ?? uuid;
  if (!uuid || !label) return null;
  const description = text(record['VbkDescription']) ?? text(payload['description']) ?? '';
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
  return candidates.find(isRecord) ?? null;
}

function isRecord(value: unknown): value is ConfigurableCrudRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
