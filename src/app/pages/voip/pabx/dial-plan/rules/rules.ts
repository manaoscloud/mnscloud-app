import { Component, inject, signal } from '@angular/core';

import { ApiService } from '../../../../../services/api.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];
const directions: ConfigurableCrudOption[] = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'internal', label: 'Internal' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'service', label: 'Service' },
];
const operators: ConfigurableCrudOption[] = [
  { value: 'regex', label: 'Regex' },
  { value: 'prefix', label: 'Prefix' },
  { value: 'exact', label: 'Exact' },
];
const resultTypes: ConfigurableCrudOption[] = [
  { value: 'outbound', label: 'Outbound' },
  { value: 'extension', label: 'Extension' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'feature_code', label: 'Feature code' },
];
const callerIdModes: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'anonymous', label: 'Anonymous' },
  { value: 'passthrough', label: 'Passthrough' },
];
const yesNo: ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/dial-plan-rules',
    uuidField: 'uuid',
    pageTitle: 'Dial Plan Rules',
    pageDescription: 'Manage matching, number transformation, and routing rules for dial plans.',
    createTitle: 'New dial plan rule',
    editTitle: 'Edit dial plan rule',
    dialogDescription: 'Maintain the dial plan rule match, transformation, and routing behavior.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No dial plan rules found.',
    deleteTitle: 'Delete dial plan rule',
    deleteMessage: 'Delete this dial plan rule?',
    deleteSelectedTitle: 'Delete selected dial plan rules',
    deleteSelectedMessage: 'Delete {count} selected dial plan rules?',
    savedMessage: 'Dial plan rule saved successfully.',
    deletedMessage: 'Dial plan rule deleted successfully.',
    deleteFailedMessage: 'Failed to delete dial plan rule.',
    statusMode: 'number',
    activeValue: 1,
    inactiveValue: 0,
    statusOptions: statuses,
    bulkDelete: true,
    tabLabels: { match: 'Match and Transform', network: 'Routing' },
    initialValues: {
      enabled: 1,
      dialPlanUUID: '',
      name: '',
      direction: 'outbound',
      operator: 'regex',
      pattern: '',
      replacement: '',
      stripDigits: 0,
      prepend: '',
      priority: 100,
      caseSensitive: 0,
      resultType: 'outbound',
      trunkUUID: '',
      callerIdMode: 'extension',
      callerIdValue: '',
      fallbackTrunks: '',
      engineConfig: '',
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      {
        id: 'dialPlan',
        label: 'Dial Plan',
        kind: 'related',
        field: 'dialPlanUUID',
        lookupKey: 'dialPlanUUID',
      },
      { id: 'direction', label: 'Direction', field: 'direction' },
      { id: 'operator', label: 'Rule operator', field: 'operator' },
      { id: 'pattern', label: 'Expression', field: 'pattern' },
      { id: 'priority', label: 'Priority', field: 'priority' },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    listFilters: [{ key: 'dialPlanUUID', label: 'Dial Plan', type: 'search-select', span: 1 }],
    fields: [
      { key: 'enabled', source: 'enabled', label: 'Status', type: 'status', span: 1 },
      {
        key: 'dialPlanUUID',
        source: 'dialPlanUUID',
        label: 'Dial Plan',
        type: 'search-select',
        required: true,
        span: 1,
      },
      {
        key: 'priority',
        source: 'priority',
        label: 'Priority',
        type: 'number',
        required: true,
        span: 1,
      },
      { key: 'name', source: 'name', label: 'Name', required: true, span: 1 },
      {
        key: 'direction',
        source: 'direction',
        label: 'Direction',
        type: 'select',
        options: directions,
        required: true,
        span: 1,
        tab: 'match',
      },
      {
        key: 'operator',
        source: 'operator',
        label: 'Rule operator',
        type: 'select',
        options: operators,
        required: true,
        span: 1,
        tab: 'match',
      },
      {
        key: 'pattern',
        source: 'pattern',
        label: 'Expression',
        required: true,
        span: 2,
        tab: 'match',
      },
      {
        key: 'resultType',
        source: 'resultType',
        label: 'Result',
        type: 'select',
        options: resultTypes,
        required: true,
        span: 1,
        tab: 'match',
      },
      {
        key: 'stripDigits',
        source: 'stripDigits',
        label: 'Strip digits',
        type: 'number',
        span: 1,
        tab: 'match',
      },
      { key: 'prepend', source: 'prepend', label: 'Prepend', span: 1, tab: 'match' },
      { key: 'replacement', source: 'replacement', label: 'Replacement', span: 1, tab: 'match' },
      {
        key: 'caseSensitive',
        source: 'caseSensitive',
        label: 'Case sensitive',
        type: 'select',
        options: yesNo,
        span: 1,
        tab: 'match',
      },
      {
        key: 'trunkUUID',
        source: 'trunkUUID',
        label: 'Trunk',
        type: 'search-select',
        span: 2,
        tab: 'network',
        requiredWhen: ({ values }) =>
          values['direction'] === 'outbound' && values['resultType'] === 'outbound',
      },
      {
        key: 'callerIdMode',
        source: 'callerIdMode',
        label: 'Caller ID mode',
        type: 'select',
        options: callerIdModes,
        span: 1,
        tab: 'network',
      },
      {
        key: 'callerIdValue',
        source: 'callerIdValue',
        label: 'Caller ID value',
        span: 1,
        tab: 'network',
        hiddenWhen: ({ values }) => values['callerIdMode'] !== 'fixed',
      },
      {
        key: 'fallbackTrunks',
        source: 'fallbackTrunks',
        label: 'Fallback trunks',
        span: 4,
        tab: 'network',
      },
      {
        key: 'engineConfig',
        source: 'engineConfig',
        label: 'Engine config',
        type: 'textarea',
        format: 'json',
        span: 4,
        rows: 4,
        tab: 'network',
      },
      {
        key: 'description',
        source: 'description',
        label: 'Description',
        type: 'textarea',
        span: 4,
        rows: 4,
        tab: 'notes',
      },
    ],
  };
}

@Component({
  selector: 'app-voip-pabx-dial-plan-rules',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxDialPlanRulesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly dialPlans = signal<ConfigurableCrudOption[]>([]);
  readonly trunks = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['dialPlanUUID', 'trunkUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'dialPlanUUID') return this.dialPlans();
    if (key === 'trunkUUID') return this.trunks();
    return [];
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return filter.key === 'dialPlanUUID' ? this.dialPlans() : super.listFilterOptions(filter);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      caseSensitive: Number(payload['caseSensitive']) === 1,
      trunkUUID: payload['trunkUUID'] || null,
      callerIdValue: payload['callerIdMode'] === 'fixed' ? payload['callerIdValue'] || null : null,
    };
  }

  private async loadLookups(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const [dialPlans, trunks] = await Promise.all([
        this.rawApi.get<any>('voip/pabx/dial-plans?status=1&limit=500&offset=0'),
        this.rawApi.get<any>('voip/pabx/trunks?status=1&limit=500&offset=0'),
      ]);
      this.dialPlans.set(
        (dialPlans?.data?.items ?? []).map((row: any) => ({
          value: row.uuid,
          label: `${row.name}${row.code ? ` (${row.code})` : ''}`,
        })),
      );
      this.trunks.set(
        (trunks?.data?.items ?? [])
          .filter((row: any) =>
            ['outbound', 'both'].includes(String(row.direction ?? '').toLowerCase()),
          )
          .map((row: any) => ({
            value: row.uuid,
            label: `${row.name}${row.host ? ` - ${row.host}` : ''}`,
          })),
      );
    } finally {
      this.lookupsLoading.set(false);
    }
  }
}
