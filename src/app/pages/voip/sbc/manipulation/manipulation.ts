import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const LEG_OPTIONS = [
  { value: 'a', label: 'Leg A' },
  { value: 'b', label: 'Leg B' },
  { value: 'tfps', label: 'TFPS' },
];

const TARGET_OPTIONS = [
  { value: 'from_user', label: 'From user' },
  { value: 'from_domain', label: 'From domain' },
  { value: 'to_user', label: 'To user' },
  { value: 'to_domain', label: 'To domain' },
  { value: 'ruri_user', label: 'R-URI user' },
  { value: 'ruri_domain', label: 'R-URI domain' },
  { value: 'header', label: 'Header' },
];

const OPERATION_OPTIONS = [
  { value: 'set', label: 'Set' },
  { value: 'prepend', label: 'Prepend' },
  { value: 'append', label: 'Append' },
  { value: 'strip', label: 'Strip' },
  { value: 'regex', label: 'Regex' },
];

const MANIPULATION_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'voip/sbc/manipulations',
  uuidField: 'VsmUUID',
  pageTitle: 'SBC manipulations',
  pageDescription: 'Manage SIP header and number manipulations for SBC pipes.',
  createTitle: 'New SBC manipulation',
  editTitle: 'Edit SBC manipulation',
  dialogDescription: 'Maintain leg, target, operation and match rules for pipes.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No SBC manipulations found.',
  deleteTitle: 'Delete SBC manipulation',
  deleteMessage: 'Are you sure you want to delete this SBC manipulation?',
  deleteSelectedTitle: 'Delete selected SBC manipulations',
  deleteSelectedMessage: 'Delete {count} selected SBC manipulations?',
  savedMessage: 'SBC manipulation saved successfully.',
  deletedMessage: 'SBC manipulation deleted successfully.',
  deleteFailedMessage: 'Failed to delete SBC manipulation.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: {
    status: 1,
    pipeUUID: '',
    leg: 'a',
    target: 'ruri_user',
    operation: 'set',
    priority: 100,
    name: '',
    matchPattern: '',
    replacement: '',
  },
  columns: [
    { id: 'name', label: 'Name', kind: 'identity', field: 'VsmName', uuidField: 'VsmUUID' },
    {
      id: 'pipe',
      label: 'Pipe',
      kind: 'related',
      uuidField: 'VoipSbcPipeVbpUUID',
      lookupKey: 'pipeUUID',
    },
    { id: 'leg', label: 'Leg', field: 'VsmLeg' },
    { id: 'target', label: 'Target', field: 'VsmTarget' },
    { id: 'operation', label: 'Operation', field: 'VsmOperation' },
    { id: 'priority', label: 'Priority', field: 'VsmPriority' },
    { id: 'status', label: 'Status', kind: 'status', field: 'VsmStatus', className: 'status-col' },
  ],
  fields: [
    {
      key: 'status',
      source: 'VsmStatus',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'pipeUUID',
      source: 'VoipSbcPipeVbpUUID',
      payloadKey: 'pipeUUID',
      label: 'Pipe',
      type: 'search-select',
      required: true,
      span: 1,
    },
    {
      key: 'leg',
      source: 'VsmLeg',
      payloadKey: 'leg',
      label: 'Leg',
      type: 'select',
      options: LEG_OPTIONS,
      span: 1,
    },
    { key: 'name', source: 'VsmName', payloadKey: 'name', label: 'Name', required: true, span: 1 },
    {
      key: 'target',
      source: 'VsmTarget',
      payloadKey: 'target',
      label: 'Target',
      type: 'select',
      options: TARGET_OPTIONS,
      span: 1,
    },
    {
      key: 'operation',
      source: 'VsmOperation',
      payloadKey: 'operation',
      label: 'Operation',
      type: 'select',
      options: OPERATION_OPTIONS,
      span: 1,
    },
    {
      key: 'matchPattern',
      source: 'VsmMatchPattern',
      payloadKey: 'matchPattern',
      label: 'Match pattern',
      span: 1,
    },
    {
      key: 'replacement',
      source: 'VsmReplacement',
      payloadKey: 'replacement',
      label: 'Replacement',
      span: 1,
    },
    {
      key: 'priority',
      source: 'VsmPriority',
      payloadKey: 'priority',
      label: 'Priority',
      type: 'number',
      span: 1,
    },
  ],
};

@Component({
  selector: 'app-voip-sbc-manipulation',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipSbcManipulationPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pipeOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupLoading = signal(false);

  constructor() {
    super(MANIPULATION_CONFIG);
    void this.loadLookups();
  }

  override fieldLoading(field: { key: string }): boolean {
    return field.key === 'pipeUUID' ? this.lookupLoading() : false;
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    return key === 'pipeUUID' ? this.pipeOptions() : [];
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      priority: Number(payload['priority'] || 0),
      status: Number(payload['status']),
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupLoading.set(true);
    try {
      this.pipeOptions.set(
        await fetchPaged(this.rawApi, 'voip/sbc/pipes?status=1', (row) =>
          option(row.VbpUUID, row.VbpName, [
            row.InterfaceName,
            row.InputPeerName,
            row.VbpOutputHost,
          ]),
        ),
      );
    } finally {
      this.lookupLoading.set(false);
    }
  }
}

async function fetchPaged(
  api: ApiService,
  endpoint: string,
  mapItem: (row: any) => ConfigurableCrudOption | null,
): Promise<ConfigurableCrudOption[]> {
  const options: ConfigurableCrudOption[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const response = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const rows = extractItems(response);
    options.push(...(rows.map(mapItem).filter(Boolean) as ConfigurableCrudOption[]));
    if (rows.length < 500) break;
  }
  return options.sort((left, right) => left.label.localeCompare(right.label));
}

function extractItems(response: any): any[] {
  if (Array.isArray(response?.data?.items)) return response.data.items;
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
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}
