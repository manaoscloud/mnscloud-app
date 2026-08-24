import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialogRef } from '@angular/material/dialog';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudQuickCreateResult,
  ConfigurableCrudRecord,
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statusOptions: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const purposeOptions: ConfigurableCrudOption[] = [
  { value: 'pabx', label: 'PABX' },
  { value: 'softswitch', label: 'Softswitch' },
  { value: 'sbc', label: 'SBC' },
];

function domainConfig(scope: 'tenant' | 'master'): ConfigurableCrudConfig {
  const master = scope === 'master';
  return {
    endpoint: master ? 'system/voip/domains' : 'voip/domains',
    uuidField: 'VdmUUID',
    pageTitle: 'VoIP Domains',
    pageDescription: 'Manage canonical VoIP domains by purpose.',
    createTitle: 'New VoIP domain',
    editTitle: 'Edit VoIP domain',
    dialogDescription: 'Register the canonical SIP domain and its service purpose.',
    searchPlaceholder: 'Search domains',
    emptyLabel: 'No domains found.',
    deleteTitle: 'Delete domain',
    deleteMessage: 'Delete this VoIP domain?',
    deleteSelectedTitle: 'Delete selected domains',
    deleteSelectedMessage: 'Delete {count} selected VoIP domains?',
    savedMessage: 'VoIP domain saved successfully.',
    deletedMessage: 'VoIP domain deleted successfully.',
    deleteFailedMessage: 'Failed to delete VoIP domain.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions,
    initialValues: { name: '', purpose: 'pabx', status: 1 },
    columns: [
      { id: 'name', label: 'Domain', kind: 'identity', field: 'VdmName', uuidField: 'VdmUUID' },
      { id: 'purpose', label: 'Purpose', kind: 'text', field: 'VdmPurpose' },
      { id: 'status', label: 'Status', kind: 'status', field: 'VdmStatus' },
    ],
    fields: [
      {
        key: 'status',
        source: 'VdmStatus',
        payloadKey: 'status',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'purpose',
        source: 'VdmPurpose',
        payloadKey: 'purpose',
        label: 'Purpose',
        type: 'select',
        options: purposeOptions,
        required: true,
        span: 1,
      },
      {
        key: 'name',
        source: 'VdmName',
        payloadKey: 'name',
        label: 'Domain',
        type: 'text',
        required: true,
        placeholder: 'pbx.example.com',
        span: 1,
      },
    ],
  };
}

@Component({
  selector: 'app-voip-domain',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipDomainPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const route = inject(ActivatedRoute);
    super(domainConfig(route.snapshot.data['scope'] === 'master' ? 'master' : 'tenant'));
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      name: String(payload['name'] ?? '').trim(),
      purpose: String(payload['purpose'] ?? '').trim(),
      status: Number(payload['status']) === 1,
    };
  }
}

@Component({
  selector: 'app-voip-domain-quick-create-host',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: [
    '../../../shared/crud/configurable-crud/configurable-crud-page.scss',
    '../../erp/customer/customer-quick-create-host.scss',
  ],
})
export class VoipDomainQuickCreateHostComponent extends VoipDomainPage {
  private readonly quickDialogRef = inject(
    MatDialogRef<VoipDomainQuickCreateHostComponent, ConfigurableCrudQuickCreateResult>,
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
      option: voipDomainOptionFromResponse(context.response, context.payload),
      response: context.response,
      payload: context.payload,
    });
  }
}

function voipDomainOptionFromResponse(
  response: unknown,
  payload: ConfigurableCrudRecord,
): ConfigurableCrudOption | null {
  const record = extractRecord(response) ?? payload;
  const uuid = text(record['VdmUUID']) ?? text(record['uuid']);
  const label = text(record['VdmName']) ?? text(record['name']) ?? text(payload['name']) ?? uuid;
  if (!uuid || !label) return null;
  const purpose = text(record['VdmPurpose']) ?? text(record['purpose']) ?? text(payload['purpose']);
  return {
    value: uuid,
    label,
    description: purpose ?? '',
    searchText: `${label} ${purpose ?? ''} ${uuid}`,
  };
}

function extractRecord(response: unknown): ConfigurableCrudRecord | null {
  const value = response as { data?: unknown; item?: unknown; record?: unknown } | null | undefined;
  const data = value?.data as { item?: unknown; record?: unknown; data?: unknown } | undefined;
  const candidates = [
    data?.item,
    data?.record,
    data?.data,
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
