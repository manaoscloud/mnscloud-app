import { Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
import { ConfigurableCrudCollectionDialog } from '../../../../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilterAction,
  ConfigurableCrudListFilter,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../../../shared/crud/configurable-crud/define-crud';
import { openCrudTemplateDialog } from '../../../../../shared/dialog/crud-dialog.util';
import { quickCreateFor } from '../../../../../shared/crud/configurable-crud/quick-create';

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

type DialPatternProfile = {
  profileUUID: string;
  name: string;
  code: string;
};

type DialPatternTemplate = {
  templateUUID: string;
  profileUUID: string;
  profileName?: string;
  name: string;
  code: string;
  direction: string;
  category: string;
  regex: string;
  replacement?: string | null;
  exampleMatches?: string[];
  exampleNonMatches?: string[];
  description?: string;
  safeRegexStatus?: string;
};

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
    tabLabels: { match: 'Criteria', transform: 'Transform', network: 'Routing' },
    filterActions: [
      {
        key: 'regexExamples',
        label: 'Regex examples',
        icon: 'rule',
        tooltip: 'Open reusable dial pattern examples',
      },
    ],
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
      fallbackTrunkUUIDs: [],
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      {
        id: 'dialPlan',
        label: 'Dial Plan',
        kind: 'related',
        field: 'dialPlanName',
        uuidField: 'dialPlanUUID',
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
        quickCreate: quickCreateFor('VoipPabxDialPlanVdpUUID'),
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
        type: 'search-select',
        options: directions,
        required: true,
        span: 1,
        tab: 'match',
      },
      {
        key: 'operator',
        source: 'operator',
        label: 'Rule operator',
        type: 'search-select',
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
        span: 1,
        tab: 'match',
      },
      {
        key: 'resultType',
        source: 'resultType',
        label: 'Result',
        type: 'search-select',
        options: resultTypes,
        required: true,
        span: 1,
        tab: 'match',
      },
      {
        key: 'caseSensitive',
        source: 'caseSensitive',
        label: 'Case sensitive',
        type: 'search-select',
        options: yesNo,
        span: 1,
        tab: 'match',
        hiddenWhen: ({ values }) => values['operator'] === 'regex',
      },
      {
        key: 'stripDigits',
        source: 'stripDigits',
        label: 'Strip digits',
        type: 'number',
        span: 1,
        tab: 'transform',
      },
      { key: 'prepend', source: 'prepend', label: 'Prepend', span: 1, tab: 'transform' },
      {
        key: 'replacement',
        source: 'replacement',
        label: 'Replacement',
        span: 1,
        tab: 'transform',
      },
      {
        key: 'trunkUUID',
        source: 'trunkUUID',
        label: 'Trunk',
        type: 'search-select',
        quickCreate: quickCreateFor('VoipPabxTrunkVptUUID'),
        span: 1,
        tab: 'network',
        requiredWhen: ({ values }) =>
          values['direction'] === 'outbound' && values['resultType'] === 'outbound',
      },
      {
        key: 'callerIdMode',
        source: 'callerIdMode',
        label: 'Caller ID mode',
        type: 'search-select',
        options: callerIdModes,
        span: 1,
        tab: 'network',
      },
      {
        key: 'fallbackTrunkUUIDs',
        source: 'fallbackTrunkUUIDs',
        label: 'Contingency trunks',
        type: 'search-select',
        quickCreate: quickCreateFor('VoipPabxTrunkVptUUID'),
        multiple: true,
        span: 4,
        tab: 'network',
        breakBefore: true,
        fromRecord: (value) => {
          if (Array.isArray(value)) return value;
          if (typeof value === 'string' && value.trim()) {
            try {
              const parsed = JSON.parse(value);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        },
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

const SAFE_REGEX_LABELS: Record<string, string> = {
  safe: 'Safe regex',
  warning: 'Warning',
  blocked: 'Blocked',
};

function regexMatches(regex: unknown, value: unknown): boolean {
  try {
    return new RegExp(String(regex ?? '')).test(String(value ?? '').trim());
  } catch {
    return false;
  }
}

function regexResult(regex: unknown, replacement: unknown, value: unknown): string {
  try {
    return String(value ?? '')
      .trim()
      .replace(new RegExp(String(regex ?? '')), String(replacement ?? ''));
  } catch {
    return '-';
  }
}

/**
 * Reusable dial pattern examples, listed by the global table (collection dialog). `use` opens a
 * new rule prefilled from the chosen example; `copy` copies its regex.
 */
function dialPatternExamplesConfig(
  profiles: readonly DialPatternProfile[],
  actions: {
    use: (template: DialPatternTemplate) => void;
    copy: (regex: string) => Promise<void>;
  },
): ConfigurableCrudConfig {
  const profileName = (uuid: unknown) =>
    profiles.find((profile) => profile.profileUUID === uuid)?.name ?? '';
  return defineCrud({
    endpoint: 'voip/dial-patterns/templates',
    listQuery: { status: '1', limit: '1000' },
    uuidField: 'templateUUID',
    pageTitle: 'Dial pattern examples',
    pageDescription: 'Select a reusable regex example for PABX, SBC, or Softswitch dial rules.',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    emptyLabel: 'No regex examples found.',
    pageSizeOptions: [5, 10, 25],
    listFilters: [
      {
        key: 'profileUUID',
        label: 'Pattern profile',
        type: 'search-select',
        options: profiles.map((profile) => ({ value: profile.profileUUID, label: profile.name })),
        match: (row, value) => row['profileUUID'] === value,
      },
      {
        key: 'direction',
        label: 'Direction',
        type: 'search-select',
        options: directions,
        translateOptions: true,
        match: (row, value) => row['direction'] === value,
      },
      {
        key: 'testNumber',
        label: 'Test number',
        type: 'text',
        match: (row, value) => regexMatches(row['regex'], value),
      },
    ],
    columns: [
      {
        id: 'name',
        label: 'Name',
        kind: 'identity',
        field: 'name',
        uuidField: 'templateUUID',
        detail: (row) => String(row['profileName'] || profileName(row['profileUUID'])),
      },
      { id: 'regex', label: 'Regex', field: 'regex', copyable: true },
      { id: 'replacement', label: 'Replacement', field: 'replacement' },
      {
        id: 'direction',
        label: 'Direction',
        field: 'direction',
        options: directions,
        translateValue: true,
      },
      { id: 'category', label: 'Category', field: 'category' },
      {
        id: 'examples',
        label: 'Examples',
        field: 'exampleMatches',
        value: (row) =>
          (Array.isArray(row['exampleMatches']) ? row['exampleMatches'] : []).join(', '),
        optional: true,
      },
      { id: 'description', label: 'Description', field: 'description', optional: true },
      {
        id: 'test',
        label: 'Test',
        field: 'safeRegexStatus',
        value: (row, t, filters) => {
          const test = String(filters['testNumber'] ?? '').trim();
          if (!test) {
            const status = String(row['safeRegexStatus'] || 'safe').toLowerCase();
            return t(SAFE_REGEX_LABELS[status] ?? status);
          }
          if (!regexMatches(row['regex'], test)) return t('Does not match');
          return row['replacement']
            ? `${t('Matches')} · ${t('Result')}: ${regexResult(row['regex'], row['replacement'], test)}`
            : t('Matches');
        },
      },
    ],
    rowActions: [
      {
        key: 'copyRegex',
        label: 'Copy regex',
        icon: 'content_copy',
        run: (row) => actions.copy(String(row['regex'] ?? '')),
      },
      {
        key: 'useRegex',
        label: 'Open new rule with this regex',
        icon: 'check',
        run: (row) => actions.use(row as unknown as DialPatternTemplate),
      },
    ],
    fields: [],
  });
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
  readonly patternProfiles = signal<DialPatternProfile[]>([]);
  readonly lookupsLoading = signal(false);

  constructor() {
    super(config());
    void this.loadLookups();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      ['dialPlanUUID', 'trunkUUID', 'fallbackTrunkUUIDs'].includes(field.key) &&
      this.lookupsLoading()
    );
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'dialPlanUUID') return this.dialPlans();
    if (key === 'trunkUUID' || key === 'fallbackTrunkUUIDs') return this.trunks();
    return [];
  }

  override listFilterOptions(
    filter: ConfigurableCrudListFilter,
  ): readonly ConfigurableCrudOption[] {
    return filter.key === 'dialPlanUUID' ? this.dialPlans() : super.listFilterOptions(filter);
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'regexExamples') return;
    await this.loadPatternProfiles();
    let chosen: DialPatternTemplate | null = null;
    const binding = openCrudTemplateDialog(
      this.dialog,
      ConfigurableCrudCollectionDialog,
      ['crud-form-dialog', 'crud-collection-dialog'],
      {
        data: {
          ...dialPatternExamplesConfig(this.patternProfiles(), {
            use: (template) => {
              chosen = template;
              binding.ref.close();
            },
            copy: (regex) => this.copyRegex(regex),
          }),
          collectionDialog: true,
          formOnly: false,
        },
      },
    );
    try {
      await firstValueFrom(binding.ref.afterClosed());
    } finally {
      binding.stop();
    }
    if (chosen) this.startRuleFromTemplate(chosen);
  }

  private startRuleFromTemplate(template: DialPatternTemplate): void {
    this.startCreate();
    const nextValues: ConfigurableCrudRecord = {
      operator: 'regex',
      pattern: template.regex,
      name: template.name,
    };
    if (template.replacement) {
      nextValues['replacement'] = template.replacement;
    }
    if (template.direction && template.direction !== 'any') {
      nextValues['direction'] = template.direction;
    }
    if (template.category === 'emergency') {
      nextValues['resultType'] = 'emergency';
    } else if (template.category === 'service') {
      nextValues['resultType'] = 'feature_code';
    } else if (template.direction === 'inbound') {
      nextValues['resultType'] = 'extension';
    }
    this.patchFormValues(nextValues);
    this.snack.success(this.t('Regex applied to a new dial plan rule.'));
  }

  private async copyRegex(regex: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(regex);
      this.snack.success(this.t('Regex copied.'));
    } catch {
      this.snack.error(this.t('Failed to copy regex.'));
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      caseSensitive: Number(payload['caseSensitive']) === 1,
      trunkUUID: payload['trunkUUID'] || null,
      fallbackTrunkUUIDs:
        payload['direction'] === 'outbound' && payload['resultType'] === 'outbound'
          ? Array.from(
              new Set(
                (Array.isArray(payload['fallbackTrunkUUIDs'])
                  ? payload['fallbackTrunkUUIDs']
                  : []
                ).filter((uuid): uuid is string => typeof uuid === 'string' && uuid.length > 0),
              ),
            ).filter((uuid) => uuid !== payload['trunkUUID'])
          : [],
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

  private async loadPatternProfiles(): Promise<void> {
    if (this.patternProfiles().length) return;
    const profiles = await this.rawApi.get<any>(
      'voip/dial-patterns/profiles?status=1&limit=500&offset=0',
    );
    this.patternProfiles.set(profiles?.data?.items ?? []);
  }
}
