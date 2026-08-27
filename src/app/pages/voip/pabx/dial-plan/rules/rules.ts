import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../../services/api.service';
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
import { openCrudComponentDialog } from '../../../../../shared/dialog/crud-dialog.util';

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

@Component({
  selector: 'app-voip-dial-pattern-examples-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  template: `
    <div class="crud-dialog dial-pattern-examples-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Dial pattern examples' | transloco }}</h2>
          <p>
            {{
              'Select a reusable regex example for PABX, SBC, or Softswitch dial rules.' | transloco
            }}
          </p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="examples-content-shell">
          <div class="dialog-filter-grid form-grid">
            <mat-form-field appearance="outline" class="span-1">
              <mat-label>{{ 'Pattern profile' | transloco }}</mat-label>
              <mat-select
                [value]="selectedProfile"
                (selectionChange)="selectedProfile = $event.value"
              >
                <mat-option value="">{{ 'All profiles' | transloco }}</mat-option>
                @for (profile of data.profiles; track profile.profileUUID) {
                  <mat-option [value]="profile.profileUUID">{{ profile.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="span-2">
              <mat-label>{{ 'Search examples' | transloco }}</mat-label>
              <input matInput [value]="search" (input)="search = $any($event.target).value" />
            </mat-form-field>

            <mat-form-field appearance="outline" class="span-1">
              <mat-label>{{ 'Test number' | transloco }}</mat-label>
              <input
                matInput
                [value]="testNumber"
                (input)="testNumber = $any($event.target).value"
              />
            </mat-form-field>
          </div>

          <div class="example-list">
            @for (template of filteredTemplates(); track template.templateUUID) {
              <article class="example-card">
                <div class="example-heading">
                  <div class="example-title">
                    <strong>{{ template.name }}</strong>
                    <span>{{ template.profileName || profileName(template.profileUUID) }}</span>
                  </div>
                  <mat-chip class="status-pill status-chip">{{
                    template.safeRegexStatus || 'safe'
                  }}</mat-chip>
                </div>

                <code>{{ template.regex }}</code>

                <p class="example-description">{{ template.description || '-' }}</p>

                <div class="example-meta">
                  <span>
                    {{ 'Direction' | transloco }}:
                    {{ optionLabel(directions, template.direction) | transloco }}
                  </span>
                  <span>{{ 'Category' | transloco }}: {{ template.category }}</span>
                  @if (testNumber.trim()) {
                    <span>
                      {{ 'Test' | transloco }}:
                      {{
                        matches(template.regex)
                          ? ('Matches' | transloco)
                          : ('Does not match' | transloco)
                      }}
                    </span>
                  }
                </div>

                <div class="example-samples">
                  <span>{{ 'Examples' | transloco }}:</span>
                  <span>{{ (template.exampleMatches ?? []).join(', ') || '-' }}</span>
                </div>

                <div class="example-actions">
                  <button mat-stroked-button type="button" (click)="copy(template.regex)">
                    <mat-icon>content_copy</mat-icon>
                    {{ 'Copy regex' | transloco }}
                  </button>
                  <button mat-flat-button color="primary" type="button" (click)="apply(template)">
                    <mat-icon>check</mat-icon>
                    {{ 'Apply regex' | transloco }}
                  </button>
                </div>
              </article>
            } @empty {
              <div class="empty-state">{{ 'No regex examples found.' | transloco }}</div>
            }
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions"></div>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .dial-pattern-examples-dialog {
        --dial-pattern-dialog-inset: 0.75rem;
        min-height: 0;
      }

      .dial-pattern-examples-dialog .dialog-content {
        gap: 0.75rem;
      }

      .examples-content-shell {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 0.75rem;
        min-height: 0;
        overflow: hidden;
        padding: 0 var(--dial-pattern-dialog-inset);
      }

      .dialog-filter-grid {
        flex: 0 0 auto;
        margin-bottom: 0;
      }

      .example-list {
        display: grid;
        align-content: start;
        gap: 0.75rem;
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
        padding: 0.1rem 0 0.35rem;
        scrollbar-gutter: stable;
      }

      .dial-pattern-examples-dialog .form-actions {
        margin-top: 0 !important;
        padding-left: var(--dial-pattern-dialog-inset) !important;
        padding-right: var(--dial-pattern-dialog-inset) !important;
      }

      .example-card {
        border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
        border-radius: 1rem;
        display: grid;
        gap: 0.65rem;
        min-width: 0;
        padding: 0.9rem;
      }

      .example-heading,
      .example-meta,
      .example-actions {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }

      .example-title {
        display: grid;
        gap: 0.2rem;
        min-width: 0;
      }

      .example-title strong,
      .example-title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .example-heading span,
      .example-meta,
      .example-samples,
      .example-description {
        opacity: 0.78;
      }

      .example-meta,
      .example-samples {
        flex-wrap: wrap;
        font-size: 0.88rem;
      }

      .example-description {
        margin: 0;
      }

      code {
        border-radius: 8px;
        display: block;
        overflow-x: auto;
        padding: 10px;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }

      .empty-state {
        border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
        border-radius: 14px;
        padding: 24px;
        text-align: center;
      }

      @media (max-width: 760px) {
        .dial-pattern-examples-dialog {
          --dial-pattern-dialog-inset: 0.35rem;
        }

        .example-heading,
        .example-actions {
          align-items: stretch;
          flex-direction: column;
        }

        .example-actions button {
          width: 100%;
        }
      }
    `,
  ],
})
export class VoipDialPatternExamplesDialogComponent {
  readonly data = inject<{
    profiles: DialPatternProfile[];
    templates: DialPatternTemplate[];
  }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VoipDialPatternExamplesDialogComponent>);

  readonly directions = directions;
  selectedProfile = '';
  search = '';
  testNumber = '';

  filteredTemplates(): DialPatternTemplate[] {
    const term = this.search.trim().toLowerCase();
    return this.data.templates.filter((template) => {
      const profileMatches = !this.selectedProfile || template.profileUUID === this.selectedProfile;
      const textMatches =
        !term ||
        [template.name, template.code, template.profileName, template.category, template.regex]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      return profileMatches && textMatches;
    });
  }

  profileName(profileUUID: string): string {
    return this.data.profiles.find((profile) => profile.profileUUID === profileUUID)?.name ?? '-';
  }

  optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
    return (
      options.find((option) => String(option.value) === String(value))?.label ??
      String(value ?? '-')
    );
  }

  matches(regex: string): boolean {
    try {
      return new RegExp(regex).test(this.testNumber.trim());
    } catch {
      return false;
    }
  }

  copy(regex: string): void {
    void navigator.clipboard?.writeText(regex);
  }

  apply(template: DialPatternTemplate): void {
    this.dialogRef.close(template);
  }

  close(): void {
    this.dialogRef.close();
  }
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
  readonly patternTemplates = signal<DialPatternTemplate[]>([]);
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
    await this.loadPatternLookups();
    const binding = openCrudComponentDialog(
      this.dialog,
      VoipDialPatternExamplesDialogComponent,
      'crud-form-dialog',
      {
        data: {
          profiles: this.patternProfiles(),
          templates: this.patternTemplates(),
        },
      },
    );
    try {
      const template = (await firstValueFrom(binding.ref.afterClosed())) as
        DialPatternTemplate | undefined;
      if (!template) return;
      this.setFieldValue('operator', 'regex');
      this.setFieldValue('pattern', template.regex);
      if (!String(this.formValues()['name'] ?? '').trim()) {
        this.setFieldValue('name', template.name);
      }
      if (template.direction && template.direction !== 'any') {
        this.setFieldValue('direction', template.direction);
      }
      if (template.category === 'emergency') {
        this.setFieldValue('resultType', 'emergency');
      } else if (template.category === 'service') {
        this.setFieldValue('resultType', 'feature_code');
      }
    } finally {
      binding.stop();
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

  private async loadPatternLookups(): Promise<void> {
    if (this.patternProfiles().length && this.patternTemplates().length) return;
    const [profiles, templates] = await Promise.all([
      this.rawApi.get<any>('voip/dial-patterns/profiles?status=1&limit=500&offset=0'),
      this.rawApi.get<any>('voip/dial-patterns/templates?status=1&limit=1000&offset=0'),
    ]);
    this.patternProfiles.set(profiles?.data?.items ?? []);
    this.patternTemplates.set(templates?.data?.items ?? []);
  }
}
