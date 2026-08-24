import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const runtimeStatuses: ConfigurableCrudOption[] = [
  { value: 'LOGGED_OUT', label: 'Logged out' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'PAUSED', label: 'Paused' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/queue-agents',
    uuidField: 'VqaUUID',
    pageTitle: 'Queue agents',
    pageDescription: 'Manage PABX queue agent identities and runtime state.',
    createTitle: 'New queue agent',
    editTitle: 'Edit queue agent',
    dialogDescription: 'Maintain employee, extension, login and runtime defaults.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No queue agents found.',
    deleteTitle: 'Delete queue agent',
    deleteMessage: 'Delete this queue agent?',
    deleteSelectedTitle: 'Delete selected queue agents',
    deleteSelectedMessage: 'Delete {count} selected queue agents?',
    savedMessage: 'Queue agent saved successfully.',
    deletedMessage: 'Queue agent deleted successfully.',
    deleteFailedMessage: 'Failed to delete queue agent.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: {
      record: 'Registration',
      monitoring: 'Monitoring',
      notes: 'Notes',
    },
    listFilters: [
      {
        key: 'runtimeStatus',
        paramKey: 'runtimeStatus',
        label: 'Runtime status',
        type: 'select',
        span: 1,
        options: runtimeStatuses,
        translateOptions: true,
      },
    ],
    rowActions: [
      { key: 'login', label: 'Login', icon: 'login' },
      { key: 'logout', label: 'Logout', icon: 'logout' },
      { key: 'pause', label: 'Pause', icon: 'pause_circle' },
      { key: 'unpause', label: 'Unpause', icon: 'play_circle' },
    ],
    initialValues: {
      enabled: 1,
      employeeUUID: '',
      extensionUUID: '',
      loginCode: '',
      displayName: '',
      runtimeStatus: 'LOGGED_OUT',
      pauseReason: '',
    },
    columns: [
      { id: 'loginCode', label: 'Login code', kind: 'identity', field: 'VqaLoginCode', uuidField: 'VqaUUID' },
      {
        id: 'employee',
        label: 'Employee',
        kind: 'related',
        uuidField: 'ErpHrEmployeeEmpUUID',
        lookupKey: 'employeeUUID',
      },
      {
        id: 'extension',
        label: 'Extension',
        kind: 'related',
        uuidField: 'VoipPabxExtensionVpeUUID',
        lookupKey: 'extensionUUID',
      },
      {
        id: 'runtime',
        label: 'Runtime',
        kind: 'text',
        field: 'VqaRuntimeStatus',
        translateValue: true,
      },
      { id: 'status', label: 'Status', kind: 'status', field: 'VqaEnabled' },
      { id: 'lastStatus', label: 'Last status', kind: 'datetime', field: 'VqaLastStatusAt' },
    ],
    fields: [
      {
        key: 'enabled',
        source: 'VqaEnabled',
        payloadKey: 'enabled',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'employeeUUID',
        source: 'ErpHrEmployeeEmpUUID',
        payloadKey: 'employeeUUID',
        label: 'Employee',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'extensionUUID',
        source: 'VoipPabxExtensionVpeUUID',
        payloadKey: 'extensionUUID',
        label: 'Extension',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'loginCode',
        source: 'VqaLoginCode',
        payloadKey: 'loginCode',
        label: 'Login code',
        required: true,
        span: 1,
        breakBefore: true,
      },
      {
        key: 'displayName',
        source: 'VqaDisplayName',
        payloadKey: 'displayName',
        label: 'Display name',
        span: 1,
      },
      {
        key: 'runtimeStatus',
        source: 'VqaRuntimeStatus',
        payloadKey: 'runtimeStatus',
        label: 'Runtime status',
        type: 'select',
        options: runtimeStatuses,
        translateOptions: true,
        tab: 'monitoring',
        span: 1,
      },
      {
        key: 'pauseReason',
        source: 'VqaPauseReason',
        payloadKey: 'pauseReason',
        label: 'Pause reason',
        tab: 'notes',
        type: 'textarea',
        span: 4,
        rows: 4,
        hiddenWhen: ({ values }) => values['runtimeStatus'] !== 'PAUSED',
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-queue-agent',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxQueueAgentPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly employeeOptions = signal<ConfigurableCrudOption[]>([]);
  readonly extensionOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['employeeUUID', 'extensionUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'employeeUUID') return this.employeeOptions();
    if (key === 'extensionUUID') return this.extensionOptions();
    return [];
  }

  override rowActions(row: ConfigurableCrudRecord): readonly ConfigurableCrudRowAction[] {
    const runtime = String(row['VqaRuntimeStatus'] ?? 'LOGGED_OUT');
    if (runtime === 'AVAILABLE') {
      return [
        { key: 'pause', label: 'Pause', icon: 'pause_circle' },
        { key: 'logout', label: 'Logout', icon: 'logout' },
      ];
    }
    if (runtime === 'PAUSED') {
      return [
        { key: 'unpause', label: 'Unpause', icon: 'play_circle' },
        { key: 'logout', label: 'Logout', icon: 'logout' },
      ];
    }
    return [{ key: 'login', label: 'Login', icon: 'login' }];
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    const uuid = String(row['VqaUUID'] ?? '');
    if (!uuid) return;
    this.mutating.set(true);
    try {
      await this.rawApi.post(`voip/pabx/queue-agents/${uuid}/${action.key}`, {
        pauseReason: action.key === 'pause' ? 'Manual pause' : undefined,
      });
      this.snack.success(this.t('Queue agent status updated successfully.'));
      this.refreshList();
    } catch (error) {
      this.snack.error(this.errorMessage(error) || this.t('Failed to update queue agent status.'));
    } finally {
      this.mutating.set(false);
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      displayName: text(payload['displayName']),
      pauseReason: payload['runtimeStatus'] === 'PAUSED' ? text(payload['pauseReason']) : null,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [employees, extensions] = await Promise.all([
        this.fetchPaged('erp/human-resources/employees', (row) =>
          option(row.EmployeeUUID ?? row.EmpUUID, row.Name ?? row.EmployeeName ?? row.EmpName, [
            row.Email ?? row.EmployeeEmail ?? row.EmpEmail,
          ]),
        ),
        this.fetchPaged('voip/pabx/extensions?status=1', (row) =>
          option(row.VpeUUID, row.VpeUsername, [row.PabxName, row.DomainName]),
        ),
      ]);
      this.employeeOptions.set(employees);
      this.extensionOptions.set(extensions);
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
  return {
    value: normalizedValue,
    label: normalizedLabel,
    description,
    searchText: `${normalizedLabel} ${description} ${normalizedValue}`,
  };
}

function text(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized || null;
}
