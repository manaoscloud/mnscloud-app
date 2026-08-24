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

const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/dial-plans',
    uuidField: 'uuid',
    pageTitle: 'Dial Plans',
    pageDescription: 'Manage reusable dialing plans for PABX accounts and extensions.',
    createTitle: 'New dial plan',
    editTitle: 'Edit dial plan',
    dialogDescription: 'Maintain the dialing plan identity and default behavior.',
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
    initialValues: {
      enabled: 1,
      isDefault: 0,
      name: '',
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      { id: 'isDefault', label: 'Default', kind: 'boolean', field: 'isDefault' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'isDefault',
        source: 'isDefault',
        label: 'Default',
        type: 'select',
        options: yesNo,
        span: 1,
      },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'description',
        source: 'description',
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
  selector: 'app-voip-pabx-dial-plan-plan',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxDialPlanPlanPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config());
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      isDefault: Number(payload['isDefault']) === 1,
    };
  }
}

@Component({
  selector: 'app-voip-pabx-dial-plan-plan-quick-create-host',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: [
    '../../../../../shared/crud/configurable-crud/configurable-crud-page.scss',
    '../../../../erp/customer/customer-quick-create-host.scss',
  ],
})
export class VoipPabxDialPlanPlanQuickCreateHostComponent extends VoipPabxDialPlanPlanPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<
      VoipPabxDialPlanPlanQuickCreateHostComponent,
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
      option: dialPlanOptionFromResponse(context.response, context.payload),
      response: context.response,
      payload: context.payload,
    });
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
  return normalized || null;
}
