import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { ApiService } from '../../../../services/api.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudFilterAction,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const fallbackRouteTypes: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'group', label: 'Group' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
  { value: 'hangup', label: 'Hangup' },
];

export const STEP_ACTION_TYPES: ConfigurableCrudOption[] = [
  { value: 'playback', label: 'Playback' },
  { value: 'api_request', label: 'API Request' },
  { value: 'collect_dtmf', label: 'Collect DTMF' },
  { value: 'set_variable', label: 'Set Variable' },
  { value: 'notification', label: 'Notification' },
  { value: 'callback', label: 'Callback' },
  { value: 'route', label: 'Route' },
  { value: 'hangup', label: 'Hangup' },
];

export const STEP_FAILURE_MODES: ConfigurableCrudOption[] = [
  { value: 'continue', label: 'Continue' },
  { value: 'fallback', label: 'Fallback' },
];

export const HTTP_METHODS: ConfigurableCrudOption[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
];

export const HANGUP_CAUSES: ConfigurableCrudOption[] = [
  { value: 'NORMAL_CLEARING', label: 'Normal clearing' },
  { value: 'USER_BUSY', label: 'User busy' },
  { value: 'CALL_REJECTED', label: 'Call rejected' },
];

export type VoipCustomStep = {
  uuid?: string;
  id?: string;
  order: number;
  actionType: string;
  config: Record<string, any>;
  onFailure: string;
  enabled: boolean | number;
};

export type VoipCustomTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  timeoutSeconds: number;
  fallbackRouteType: string;
  steps: VoipCustomStep[];
};

function config(): ConfigurableCrudConfig {
  return {
    endpoint: 'voip/pabx/customs',
    uuidField: 'uuid',
    pageTitle: 'Custom',
    pageDescription: 'Manage custom action pipelines for advanced call routing and self-service.',
    createTitle: 'New custom',
    editTitle: 'Edit custom',
    dialogDescription:
      'Maintain custom action pipeline identity, timeout, fallback route, and execution steps.',
    searchPlaceholder: 'Search',
    emptyLabel: 'No custom action pipelines found.',
    deleteTitle: 'Delete custom',
    deleteMessage: 'Delete this custom? This will also remove configured steps.',
    deleteSelectedTitle: 'Delete selected customs',
    deleteSelectedMessage: 'Delete {count} selected customs?',
    savedMessage: 'Custom saved successfully.',
    deletedMessage: 'Custom deleted successfully.',
    deleteFailedMessage: 'Failed to delete custom.',
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
      timeoutSeconds: 30,
      fallbackRouteType: 'hangup',
      fallbackRouteTargetUUID: '',
      description: '',
    },
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'name', uuidField: 'uuid' },
      {
        id: 'pabx',
        label: 'PABX',
        kind: 'related',
        uuidField: 'pabxUUID',
        lookupKey: 'pabxUUID',
      },
      { id: 'steps', label: 'Steps', kind: 'number', field: 'stepCount' },
      { id: 'timeout', label: 'Timeout', kind: 'number', field: 'timeoutSeconds' },
      {
        id: 'fallbackRoute',
        label: 'Fallback route',
        field: 'fallbackRouteType',
        translateValue: true,
      },
      { id: 'status', label: 'Status', kind: 'status', field: 'enabled' },
    ],
    fields: [
      {
        key: 'enabled',
        source: 'enabled',
        payloadKey: 'enabled',
        label: 'Status',
        type: 'status',
        span: 1,
      },
      {
        key: 'pabxUUID',
        source: 'pabxUUID',
        payloadKey: 'pabxUUID',
        label: 'PABX',
        type: 'search-select',
        quickCreate: quickCreateFor('VoipPabxAccountVpaUUID'),
        required: true,
        span: 1,
      },
      {
        key: 'name',
        source: 'name',
        payloadKey: 'name',
        label: 'Name',
        required: true,
        span: 1,
      },
      {
        key: 'timeoutSeconds',
        source: 'timeoutSeconds',
        payloadKey: 'timeoutSeconds',
        label: 'Timeout seconds',
        type: 'number',
        span: 1,
      },
      {
        key: 'fallbackRouteType',
        source: 'fallbackRouteType',
        payloadKey: 'fallbackRouteType',
        label: 'Fallback route',
        type: 'select',
        options: fallbackRouteTypes,
        translateOptions: true,
        required: true,
        tab: 'routing',
        span: 1,
      },
      {
        key: 'fallbackRouteTargetUUID',
        source: 'fallbackRouteTargetUUID',
        payloadKey: 'fallbackRouteTargetUUID',
        label: 'Destination',
        type: 'search-select',
        quickCreate: false,
        quickCreateExemptReason:
          'Route target is polymorphic and depends on the selected fallback route type.',
        tab: 'routing',
        span: 1,
        hiddenWhen: ({ values }) => values['fallbackRouteType'] === 'hangup',
      },
      {
        key: 'description',
        source: 'description',
        payloadKey: 'description',
        label: 'Description',
        type: 'textarea',
        tab: 'notes',
        span: 4,
        rows: 4,
      },
    ],
    filterActions: [
      {
        key: 'templates',
        label: 'Templates',
        icon: 'auto_awesome',
        tooltip: 'Explore pre-built custom pipeline templates',
      },
    ],
    rowActions: [
      {
        key: 'steps',
        label: 'Pipeline Steps',
        icon: 'account_tree',
        tooltip: 'Configure sequential action steps',
      },
    ],
  };
}

@Component({
  selector: 'app-voip-custom-templates-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  template: `
    <div class="crud-dialog custom-templates-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Pipeline templates' | transloco }}</h2>
          <p>{{ 'Choose a turnkey template to quickly bootstrap your custom pipeline.' | transloco }}</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="templates-shell">
          <div class="dialog-filter-grid form-grid">
            <mat-form-field appearance="outline" class="span-4">
              <mat-label>{{ 'Search' | transloco }}</mat-label>
              <input matInput [value]="searchTerm" (input)="setSearch($any($event.target).value)" />
            </mat-form-field>
          </div>

          <div class="templates-grid">
            @for (template of filteredTemplates(); track template.id) {
              <div class="template-card mat-elevation-z2">
                <div class="template-card-header">
                  <div class="template-header-titles">
                    <span class="template-title">{{ template.name }}</span>
                    <span class="template-category">{{ template.category }}</span>
                  </div>
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    (click)="applyTemplate(template)"
                  >
                    <mat-icon>auto_awesome</mat-icon>
                    {{ 'Use template' | transloco }}
                  </button>
                </div>

                <p class="template-description">{{ template.description }}</p>

                <div class="template-meta">
                  <span class="meta-tag">
                    <mat-icon>timer</mat-icon>
                    {{ template.timeoutSeconds }}s
                  </span>
                  <span class="meta-tag">
                    <mat-icon>alt_route</mat-icon>
                    {{ 'Fallback' | transloco }}: {{ template.fallbackRouteType }}
                  </span>
                  <span class="meta-tag">
                    <mat-icon>format_list_numbered</mat-icon>
                    {{ template.steps.length }} {{ 'Steps' | transloco }}
                  </span>
                </div>

                <div class="template-steps-preview">
                  @for (step of template.steps; track step.order) {
                    <div class="step-pill">
                      <span class="step-order">#{{ step.order }}</span>
                      <span class="step-action">{{ step.actionType }}</span>
                    </div>
                  }
                </div>
              </div>
            } @empty {
              <div class="empty-state">{{ 'No custom action pipelines found.' | transloco }}</div>
            }
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer form-actions">
        <button mat-button type="button" (click)="close()">
          {{ 'Close' | transloco }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .custom-templates-dialog {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 90vh;
      }

      .templates-shell {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 0.5rem 0;
      }

      .templates-grid {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
      }

      .template-card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1rem;
        border-radius: 8px;
        background: var(--mat-card-container-color, #1e222d);
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
      }

      .template-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .template-header-titles {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .template-title {
        font-size: 1.05rem;
        font-weight: 600;
      }

      .template-category {
        font-size: 0.75rem;
        padding: 0.2rem 0.55rem;
        border-radius: 12px;
        background: color-mix(in srgb, var(--mns-primary, #6366f1) 20%, transparent);
        color: var(--mns-primary, #818cf8);
        font-weight: 500;
      }

      .template-description {
        margin: 0;
        font-size: 0.88rem;
        color: color-mix(in srgb, currentColor 75%, transparent);
      }

      .template-meta {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .meta-tag {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.8rem;
        color: color-mix(in srgb, currentColor 65%, transparent);

        mat-icon {
          font-size: 1rem;
          width: 1rem;
          height: 1rem;
        }
      }

      .template-steps-preview {
        display: flex;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-top: 0.25rem;
      }

      .step-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        font-size: 0.78rem;
        background: color-mix(in srgb, currentColor 8%, transparent);
      }

      .step-order {
        font-weight: 600;
        opacity: 0.7;
      }

      .step-action {
        font-family: var(--mns-mono-font, 'Roboto Mono', monospace);
        font-size: 0.75rem;
      }

      .empty-state {
        padding: 2rem;
        text-align: center;
        color: color-mix(in srgb, currentColor 60%, transparent);
      }
    `,
  ],
})
export class VoipCustomTemplatesDialogComponent {
  readonly data = inject<{ templates: VoipCustomTemplate[] }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VoipCustomTemplatesDialogComponent>);

  searchTerm = '';

  setSearch(value: string): void {
    this.searchTerm = value;
  }

  filteredTemplates(): VoipCustomTemplate[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.data.templates;
    return this.data.templates.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term),
    );
  }

  applyTemplate(template: VoipCustomTemplate): void {
    this.dialogRef.close(template);
  }

  close(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-voip-custom-steps-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  template: `
    <div class="crud-dialog custom-steps-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Pipeline Steps' | transloco }} • {{ data.customName }}</h2>
          <p>{{ 'Configure sequential action steps' | transloco }}</p>
        </div>
      </div>

      <mat-dialog-content class="dialog-content">
        <div class="steps-shell">
          @if (!editingStep()) {
            <div class="steps-top-actions">
              <button mat-flat-button color="primary" type="button" (click)="startAddStep()">
                <mat-icon>add</mat-icon>
                {{ 'Add step' | transloco }}
              </button>
            </div>

            <div class="steps-list">
              @for (step of steps(); track step.order; let i = $index; let first = $first; let last = $last) {
                <div class="step-row mat-elevation-z1" [class.step-disabled]="!isStepEnabled(step)">
                  <div class="step-left">
                    <span class="step-num">#{{ step.order }}</span>
                    <div class="step-badge" [attr.data-action]="step.actionType">
                      <mat-icon>{{ actionIcon(step.actionType) }}</mat-icon>
                      <span>{{ actionLabel(step.actionType) }}</span>
                    </div>
                    <div class="step-summary">
                      {{ stepSummary(step) }}
                    </div>
                  </div>

                  <div class="step-right">
                    <span class="on-failure-tag" [class.failure-fallback]="step.onFailure === 'fallback'">
                      {{ step.onFailure === 'continue' ? ('Continue' | transloco) : ('Fallback' | transloco) }}
                    </span>
                    <span class="status-pill" [class.active]="isStepEnabled(step)">
                      {{ isStepEnabled(step) ? ('Active' | transloco) : ('Inactive' | transloco) }}
                    </span>
                    <div class="step-actions">
                      <button
                        mat-icon-button
                        type="button"
                        [disabled]="first"
                        [matTooltip]="'Move up' | transloco"
                        (click)="moveStep(i, -1)"
                      >
                        <mat-icon>arrow_upward</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        type="button"
                        [disabled]="last"
                        [matTooltip]="'Move down' | transloco"
                        (click)="moveStep(i, 1)"
                      >
                        <mat-icon>arrow_downward</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        type="button"
                        [matTooltip]="'Edit step' | transloco"
                        (click)="editStep(step, i)"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button
                        mat-icon-button
                        color="warn"
                        type="button"
                        [matTooltip]="'Delete step' | transloco"
                        (click)="deleteStep(i)"
                      >
                        <mat-icon>delete</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <mat-icon>account_tree</mat-icon>
                  <p>{{ 'No custom action pipelines found.' | transloco }}</p>
                  <button mat-stroked-button type="button" (click)="startAddStep()">
                    <mat-icon>add</mat-icon>
                    {{ 'Add step' | transloco }}
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="step-editor-panel mat-elevation-z2">
              <h3>{{ (isNewStep() ? 'Add step' : 'Edit step') | transloco }}</h3>

              <div class="form-grid">
                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>{{ 'Action type' | transloco }}</mat-label>
                  <mat-select
                    [value]="stepDraft.actionType"
                    (selectionChange)="onActionTypeChange($event.value)"
                  >
                    @for (act of actionTypes; track act.value) {
                      <mat-option [value]="act.value">{{ act.label | transloco }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>{{ 'On failure' | transloco }}</mat-label>
                  <mat-select
                    [value]="stepDraft.onFailure"
                    (selectionChange)="stepDraft.onFailure = $event.value"
                  >
                    @for (fail of failureModes; track fail.value) {
                      <mat-option [value]="fail.value">{{ fail.label | transloco }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="span-1">
                  <mat-label>{{ 'Status' | transloco }}</mat-label>
                  <mat-select
                    [value]="stepDraft.enabled ? 1 : 0"
                    (selectionChange)="stepDraft.enabled = $event.value === 1"
                  >
                    <mat-option [value]="1">{{ 'Active' | transloco }}</mat-option>
                    <mat-option [value]="0">{{ 'Inactive' | transloco }}</mat-option>
                  </mat-select>
                </mat-form-field>

                @switch (stepDraft.actionType) {
                  @case ('playback') {
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Prompt audio' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['mediaFileUUID'] || ''"
                        (selectionChange)="stepDraft.config['mediaFileUUID'] = $event.value || null"
                      >
                        <mat-option value="">-- {{ 'None' | transloco }} --</mat-option>
                        @for (file of mediaFiles(); track file.value) {
                          <mat-option [value]="file.value">{{ file.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Description' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['description'] || ''"
                        (input)="stepDraft.config['description'] = $any($event.target).value"
                      />
                    </mat-form-field>
                  }
                  @case ('api_request') {
                    <mat-form-field appearance="outline" class="span-3">
                      <mat-label>{{ 'URL' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['url'] || ''"
                        (input)="stepDraft.config['url'] = $any($event.target).value"
                        placeholder="https://api.example.com/v1/crm/call"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Method' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['method'] || 'POST'"
                        (selectionChange)="stepDraft.config['method'] = $event.value"
                      >
                        @for (m of httpMethods; track m.value) {
                          <mat-option [value]="m.value">{{ m.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Timeout (ms)' | transloco }}</mat-label>
                      <input
                        matInput
                        type="number"
                        [value]="stepDraft.config['timeoutMs'] || 5000"
                        (input)="updateConfigNumber('timeoutMs', $any($event.target).value)"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-3">
                      <mat-label>{{ 'Headers (JSON)' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="headersString()"
                        (input)="updateHeaders($any($event.target).value)"
                        placeholder='{"Content-Type": "application/json"}'
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-4">
                      <mat-label>{{ 'Request body' | transloco }}</mat-label>
                      <textarea
                        matInput
                        rows="3"
                        [value]="stepDraft.config['body'] || ''"
                        (input)="stepDraft.config['body'] = $any($event.target).value"
                        [placeholder]="requestBodyPlaceholder"
                      ></textarea>
                    </mat-form-field>
                  }
                  @case ('collect_dtmf') {
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Min digits' | transloco }}</mat-label>
                      <input
                        matInput
                        type="number"
                        [value]="stepDraft.config['minDigits'] || 1"
                        (input)="updateConfigNumber('minDigits', $any($event.target).value)"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Max digits' | transloco }}</mat-label>
                      <input
                        matInput
                        type="number"
                        [value]="stepDraft.config['maxDigits'] || 10"
                        (input)="updateConfigNumber('maxDigits', $any($event.target).value)"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Timeout seconds' | transloco }}</mat-label>
                      <input
                        matInput
                        type="number"
                        [value]="stepDraft.config['timeoutSeconds'] || 10"
                        (input)="updateConfigNumber('timeoutSeconds', $any($event.target).value)"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Variable name' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['variableName'] || 'collected_digits'"
                        (input)="stepDraft.config['variableName'] = $any($event.target).value"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-4">
                      <mat-label>{{ 'Prompt audio' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['promptMediaUUID'] || ''"
                        (selectionChange)="stepDraft.config['promptMediaUUID'] = $event.value || null"
                      >
                        <mat-option value="">-- {{ 'None' | transloco }} --</mat-option>
                        @for (file of mediaFiles(); track file.value) {
                          <mat-option [value]="file.value">{{ file.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  @case ('set_variable') {
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Variable name' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['key'] || ''"
                        (input)="stepDraft.config['key'] = $any($event.target).value"
                        placeholder="crm_customer_id"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Variable value' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['value'] || ''"
                        (input)="stepDraft.config['value'] = $any($event.target).value"
                        [placeholder]="variableValuePlaceholder"
                      />
                    </mat-form-field>
                  }
                  @case ('notification') {
                    <mat-form-field appearance="outline" class="span-3">
                      <mat-label>{{ 'URL' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['url'] || ''"
                        (input)="stepDraft.config['url'] = $any($event.target).value"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-1">
                      <mat-label>{{ 'Method' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['method'] || 'POST'"
                        (selectionChange)="stepDraft.config['method'] = $event.value"
                      >
                        <mat-option value="POST">POST</mat-option>
                        <mat-option value="PUT">PUT</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-4">
                      <mat-label>{{ 'Request body' | transloco }}</mat-label>
                      <textarea
                        matInput
                        rows="2"
                        [value]="stepDraft.config['body'] || ''"
                        (input)="stepDraft.config['body'] = $any($event.target).value"
                      ></textarea>
                    </mat-form-field>
                  }
                  @case ('callback') {
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Callback' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['callbackNumber'] || defaultCallbackNumber"
                        (input)="stepDraft.config['callbackNumber'] = $any($event.target).value"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Description' | transloco }}</mat-label>
                      <input
                        matInput
                        [value]="stepDraft.config['description'] || ''"
                        (input)="stepDraft.config['description'] = $any($event.target).value"
                      />
                    </mat-form-field>
                  }
                  @case ('route') {
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Fallback route' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['routeType'] || 'extension'"
                        (selectionChange)="onRouteChange($event.value)"
                      >
                        <mat-option value="extension">{{ 'Extension' | transloco }}</mat-option>
                        <mat-option value="group">{{ 'Group' | transloco }}</mat-option>
                        <mat-option value="queue">{{ 'Queue' | transloco }}</mat-option>
                        <mat-option value="ivr">{{ 'IVR' | transloco }}</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="span-2">
                      <mat-label>{{ 'Destination' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['routeTargetUUID'] || ''"
                        (selectionChange)="stepDraft.config['routeTargetUUID'] = $event.value"
                      >
                        @for (dest of routeDestinations(); track dest.value) {
                          <mat-option [value]="dest.value">{{ dest.label }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  @case ('hangup') {
                    <mat-form-field appearance="outline" class="span-4">
                      <mat-label>{{ 'Hangup cause' | transloco }}</mat-label>
                      <mat-select
                        [value]="stepDraft.config['cause'] || 'NORMAL_CLEARING'"
                        (selectionChange)="stepDraft.config['cause'] = $event.value"
                      >
                        @for (cause of hangupCauses; track cause.value) {
                          <mat-option [value]="cause.value">{{ cause.label | transloco }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                }
              </div>

              <div class="editor-actions">
                <button mat-button type="button" (click)="cancelStepEdit()">
                  {{ 'Cancel' | transloco }}
                </button>
                <button mat-flat-button color="primary" type="button" (click)="applyStepDraft()">
                  {{ 'Save' | transloco }}
                </button>
              </div>
            </div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions class="dialog-footer form-actions">
        <button mat-button type="button" (click)="close()">
          {{ 'Close' | transloco }}
        </button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="saving() || editingStep() !== null"
          (click)="saveAllSteps()"
        >
          <mat-icon>save</mat-icon>
          {{ 'Save steps' | transloco }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .custom-steps-dialog {
        display: flex;
        flex-direction: column;
        height: 100%;
        max-height: 90vh;
      }

      .steps-shell {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 0.5rem 0;
      }

      .steps-top-actions {
        display: flex;
        justify-content: flex-end;
      }

      .steps-list {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
      }

      .step-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        background: var(--mat-card-container-color, #1e222d);
        border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
        gap: 1rem;
      }

      .step-row.step-disabled {
        opacity: 0.55;
      }

      .step-left {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        min-width: 0;
        flex: 1 1 auto;
      }

      .step-num {
        font-weight: 700;
        font-size: 0.95rem;
        color: color-mix(in srgb, currentColor 65%, transparent);
        min-width: 28px;
      }

      .step-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.25rem 0.65rem;
        border-radius: 6px;
        font-size: 0.82rem;
        font-weight: 600;
        background: color-mix(in srgb, var(--mns-primary, #6366f1) 20%, transparent);
        color: var(--mns-primary, #818cf8);

        mat-icon {
          font-size: 1.1rem;
          width: 1.1rem;
          height: 1.1rem;
        }
      }

      .step-summary {
        font-size: 0.85rem;
        color: color-mix(in srgb, currentColor 80%, transparent);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .step-right {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        flex: 0 0 auto;
      }

      .on-failure-tag {
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        background: color-mix(in srgb, currentColor 8%, transparent);
        color: color-mix(in srgb, currentColor 75%, transparent);
      }

      .on-failure-tag.failure-fallback {
        background: color-mix(in srgb, #f59e0b 20%, transparent);
        color: #fbbf24;
      }

      .status-pill {
        font-size: 0.75rem;
        padding: 0.15rem 0.5rem;
        border-radius: 4px;
        background: color-mix(in srgb, #ef4444 20%, transparent);
        color: #f87171;
      }

      .status-pill.active {
        background: color-mix(in srgb, #10b981 20%, transparent);
        color: #34d399;
      }

      .step-actions {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }

      .step-editor-panel {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 8px;
        background: var(--mat-card-container-color, #1e222d);
        border: 1px solid color-mix(in srgb, currentColor 15%, transparent);

        h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
      }

      .editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }

      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 3rem 1rem;
        text-align: center;
        color: color-mix(in srgb, currentColor 60%, transparent);

        mat-icon {
          font-size: 2.5rem;
          width: 2.5rem;
          height: 2.5rem;
          opacity: 0.4;
        }

        p {
          margin: 0;
        }
      }
    `,
  ],
})
export class VoipCustomStepsDialogComponent {
  readonly data = inject<{
    customUUID: string;
    customName: string;
    pabxUUID: string;
    steps: VoipCustomStep[];
  }>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VoipCustomStepsDialogComponent>);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);

  readonly actionTypes = STEP_ACTION_TYPES;
  readonly failureModes = STEP_FAILURE_MODES;
  readonly httpMethods = HTTP_METHODS;
  readonly hangupCauses = HANGUP_CAUSES;

  readonly steps = signal<VoipCustomStep[]>([]);
  readonly editingStep = signal<VoipCustomStep | null>(null);
  readonly editingIndex = signal<number>(-1);
  readonly isNewStep = signal<boolean>(false);
  readonly saving = signal<boolean>(false);

  readonly mediaFiles = signal<ConfigurableCrudOption[]>([]);
  readonly routeDestinations = signal<ConfigurableCrudOption[]>([]);

  stepDraft: VoipCustomStep = {
    order: 1,
    actionType: 'playback',
    config: {},
    onFailure: 'continue',
    enabled: true,
  };

  readonly requestBodyPlaceholder = '{"caller": "${CALLER_NUMBER}", "did": "${DESTINATION_NUMBER}"}';
  readonly variableValuePlaceholder = '${API_RESPONSE.customerId}';
  readonly defaultCallbackNumber = '${CALLER_NUMBER}';

  constructor() {
    const raw = Array.isArray(this.data.steps) ? this.data.steps : [];
    this.steps.set(
      raw.map((s, idx) => ({
        ...s,
        order: idx + 1,
        config: typeof s.config === 'object' && s.config !== null ? { ...s.config } : {},
      })),
    );
    void this.loadMediaFiles();
  }

  isStepEnabled(step: VoipCustomStep): boolean {
    return Number(step.enabled) === 1 || step.enabled === true;
  }

  actionIcon(type: string): string {
    switch (type) {
      case 'playback':
        return 'play_circle';
      case 'api_request':
        return 'http';
      case 'collect_dtmf':
        return 'dialpad';
      case 'set_variable':
        return 'data_object';
      case 'notification':
        return 'notifications';
      case 'callback':
        return 'phone_callback';
      case 'route':
        return 'alt_route';
      case 'hangup':
        return 'call_end';
      default:
        return 'settings';
    }
  }

  actionLabel(type: string): string {
    return this.actionTypes.find((a) => a.value === type)?.label ?? type;
  }

  stepSummary(step: VoipCustomStep): string {
    const c: Record<string, any> = step.config || {};
    switch (step.actionType) {
      case 'playback':
        return c['description'] ? `"${c['description']}"` : 'Playback audio';
      case 'api_request':
        return `${c['method'] || 'POST'} ${c['url'] || ''}`;
      case 'collect_dtmf': {
        const varName = c['variableName'] || 'collected_digits';
        return `${c['minDigits'] || 1}-${c['maxDigits'] || 10} digits -> \${${varName}}`;
      }
      case 'set_variable':
        return `${c['key'] || 'key'} = ${c['value'] || 'value'}`;
      case 'notification':
        return `Webhook ${c['method'] || 'POST'} ${c['url'] || ''}`;
      case 'callback': {
        const cbNum = c['callbackNumber'] || '${CALLER_NUMBER}';
        return `Callback to ${cbNum}`;
      }
      case 'route':
        return `Route to ${c['routeType'] || 'extension'}`;
      case 'hangup':
        return `Cause: ${c['cause'] || 'NORMAL_CLEARING'}`;
      default:
        return '';
    }
  }

  updateConfigNumber(key: string, value: unknown): void {
    this.stepDraft.config[key] = Number(value) || 0;
  }

  moveStep(index: number, direction: -1 | 1): void {
    const destIndex = index + direction;
    const list = [...this.steps()];
    if (destIndex < 0 || destIndex >= list.length) return;
    const temp = list[index];
    list[index] = list[destIndex];
    list[destIndex] = temp;
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
  }

  deleteStep(index: number): void {
    const list = this.steps().filter((_, idx) => idx !== index);
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
  }

  startAddStep(): void {
    this.stepDraft = {
      order: this.steps().length + 1,
      actionType: 'playback',
      config: {},
      onFailure: 'continue',
      enabled: true,
    };
    this.isNewStep.set(true);
    this.editingIndex.set(-1);
    this.editingStep.set(this.stepDraft);
  }

  editStep(step: VoipCustomStep, index: number): void {
    this.stepDraft = {
      ...step,
      config: { ...(step.config || {}) },
    };
    this.isNewStep.set(false);
    this.editingIndex.set(index);
    this.editingStep.set(this.stepDraft);
    if (this.stepDraft.actionType === 'route') {
      void this.loadDestinationsForRoute(this.stepDraft.config['routeType'] || 'extension');
    }
  }

  onActionTypeChange(type: string): void {
    this.stepDraft.actionType = type;
    if (type === 'api_request') {
      this.stepDraft.config = {
        method: 'POST',
        timeoutMs: 5000,
        headers: { 'Content-Type': 'application/json' },
      };
    } else if (type === 'collect_dtmf') {
      this.stepDraft.config = {
        minDigits: 1,
        maxDigits: 10,
        timeoutSeconds: 10,
        variableName: 'collected_digits',
      };
    } else if (type === 'route') {
      this.stepDraft.config = { routeType: 'extension' };
      void this.loadDestinationsForRoute('extension');
    } else if (type === 'hangup') {
      this.stepDraft.config = { cause: 'NORMAL_CLEARING' };
    } else {
      this.stepDraft.config = {};
    }
  }

  onRouteChange(routeType: string): void {
    this.stepDraft.config['routeType'] = routeType;
    this.stepDraft.config['routeTargetUUID'] = '';
    void this.loadDestinationsForRoute(routeType);
  }

  headersString(): string {
    const h = this.stepDraft.config['headers'];
    if (!h) return '';
    if (typeof h === 'string') return h;
    try {
      return JSON.stringify(h);
    } catch {
      return '';
    }
  }

  updateHeaders(raw: string): void {
    try {
      this.stepDraft.config['headers'] = JSON.parse(raw);
    } catch {
      this.stepDraft.config['headers'] = raw;
    }
  }

  applyStepDraft(): void {
    const list = [...this.steps()];
    if (this.isNewStep()) {
      this.stepDraft.order = list.length + 1;
      list.push({ ...this.stepDraft });
    } else {
      const idx = this.editingIndex();
      if (idx >= 0 && idx < list.length) {
        list[idx] = { ...this.stepDraft };
      }
    }
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
    this.cancelStepEdit();
  }

  cancelStepEdit(): void {
    this.editingStep.set(null);
    this.editingIndex.set(-1);
    this.isNewStep.set(false);
  }

  async saveAllSteps(): Promise<void> {
    this.saving.set(true);
    try {
      await this.api.put(`voip/pabx/customs/${this.data.customUUID}`, {
        steps: this.steps(),
      });
      this.snack.success('Steps saved successfully.');
      this.dialogRef.close(this.steps());
    } catch {
      this.snack.error('Failed to delete custom.');
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private async loadMediaFiles(): Promise<void> {
    try {
      const res = await this.api.get<any>('voip/pabx/media-files?status=1&limit=500');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      this.mediaFiles.set(
        items.map((row: any) => ({
          value: row.uuid ?? row.VmfUUID,
          label: row.name ?? row.VmfName,
        })),
      );
    } catch {
      this.mediaFiles.set([]);
    }
  }

  private async loadDestinationsForRoute(routeType: string): Promise<void> {
    const pabxUUID = this.data.pabxUUID;
    const endpoint =
      routeType === 'group'
        ? 'groups'
        : routeType === 'queue'
          ? 'queues'
          : routeType === 'ivr'
            ? 'ivrs'
            : 'extensions';
    try {
      const res = await this.api.get<any>(
        `voip/pabx/${endpoint}?status=1&limit=500&pabxUUID=${encodeURIComponent(pabxUUID)}`,
      );
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      this.routeDestinations.set(
        items.map((row: any) => ({
          value: row.uuid ?? row.VpeUUID ?? row.VpgUUID ?? row.VpqUUID ?? row.VpiUUID,
          label: row.name ?? row.username ?? row.VpeUsername ?? row.VpgName ?? row.VpqName ?? row.VpiName,
        })),
      );
    } catch {
      this.routeDestinations.set([]);
    }
  }
}

@Component({
  selector: 'app-voip-pabx-custom',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class VoipPabxCustomPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly rawApi = inject(ApiService);
  readonly pabxOptions = signal<ConfigurableCrudOption[]>([]);
  readonly destinationOptions = signal<ConfigurableCrudOption[]>([]);
  readonly lookupsLoading = signal<boolean>(false);

  templateDraftSteps: VoipCustomStep[] | null = null;

  constructor() {
    super(config());
    void this.loadPabxOptions();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return (
      ['pabxUUID', 'fallbackRouteTargetUUID'].includes(field.key) && this.lookupsLoading()
    );
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'fallbackRouteTargetUUID') return this.destinationOptions();
    return [];
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    if (key === 'pabxUUID') {
      this.patchFormValues({ fallbackRouteTargetUUID: '' });
      void this.loadDestinationOptions();
    }
    if (key === 'fallbackRouteType') {
      this.patchFormValues({ fallbackRouteTargetUUID: '' });
      void this.loadDestinationOptions();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const result: ConfigurableCrudRecord = {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      timeoutSeconds: Number(payload['timeoutSeconds']) || 30,
      fallbackRouteType: String(payload['fallbackRouteType'] || 'hangup'),
      fallbackRouteTargetUUID:
        payload['fallbackRouteType'] === 'hangup'
          ? null
          : payload['fallbackRouteTargetUUID'] || null,
    };
    if (this.templateDraftSteps && this.templateDraftSteps.length > 0) {
      result['steps'] = this.templateDraftSteps;
      this.templateDraftSteps = null;
    }
    return result;
  }

  override startEdit(row: ConfigurableCrudRecord): void {
    super.startEdit(row);
    void this.loadDestinationOptions(
      String(row['pabxUUID'] ?? ''),
      String(row['fallbackRouteType'] ?? 'hangup'),
    );
  }

  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'templates') return;
    try {
      const res = await this.rawApi.get<any>('voip/pabx/customs/templates');
      const templates: VoipCustomTemplate[] = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
          ? res.data.items
          : [];
      const binding = openCrudComponentDialog(
        this.dialog,
        VoipCustomTemplatesDialogComponent,
        'crud-form-dialog',
        {
          data: { templates },
        },
      );
      const selected = (await firstValueFrom(binding.ref.afterClosed())) as
        | VoipCustomTemplate
        | undefined;
      if (!selected) return;

      this.startCreate();
      this.patchFormValues({
        name: selected.name,
        description: selected.description,
        timeoutSeconds: selected.timeoutSeconds,
        fallbackRouteType: selected.fallbackRouteType,
      });
      this.templateDraftSteps = selected.steps;
    } catch (err) {
      this.snack.error('Failed to load custom pipeline templates.');
    }
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'steps') return;
    try {
      const res = await this.rawApi.get<any>(`voip/pabx/customs/${row['uuid']}`);
      const full = res?.data ?? row;
      const binding = openCrudComponentDialog(
        this.dialog,
        VoipCustomStepsDialogComponent,
        'crud-form-dialog',
        {
          data: {
            customUUID: row['uuid'],
            customName: row['name'],
            pabxUUID: row['pabxUUID'],
            steps: full.steps || [],
          },
        },
      );
      const savedSteps = await firstValueFrom(binding.ref.afterClosed());
      if (savedSteps) {
        this.itemsResource.reload();
      }
    } catch (err) {
      this.snack.error('Failed to load custom steps.');
    }
  }

  private async loadPabxOptions(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const res = await this.rawApi.get<any>('voip/pabx/accounts?limit=500');
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      this.pabxOptions.set(
        items.map((row: any) => ({
          value: row.VpaUUID ?? row.uuid,
          label: row.VpaName ?? row.name,
        })),
      );
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async loadDestinationOptions(pabx?: string, routeType?: string): Promise<void> {
    const pUUID = pabx ?? String(this.formValues()['pabxUUID'] ?? '');
    const rType = routeType ?? String(this.formValues()['fallbackRouteType'] ?? 'hangup');
    if (!pUUID || rType === 'hangup') {
      this.destinationOptions.set([]);
      return;
    }
    const endpoint =
      rType === 'group'
        ? 'groups'
        : rType === 'queue'
          ? 'queues'
          : rType === 'ivr'
            ? 'ivrs'
            : 'extensions';
    try {
      const res = await this.rawApi.get<any>(
        `voip/pabx/${endpoint}?status=1&limit=500&pabxUUID=${encodeURIComponent(pUUID)}`,
      );
      const items = Array.isArray(res?.data?.items) ? res.data.items : [];
      this.destinationOptions.set(
        items.map((row: any) => ({
          value: row.uuid ?? row.VpeUUID ?? row.VpgUUID ?? row.VpqUUID ?? row.VpiUUID,
          label: row.name ?? row.username ?? row.VpeUsername ?? row.VpgName ?? row.VpqName ?? row.VpiName,
        })),
      );
    } catch {
      this.destinationOptions.set([]);
    }
  }
}
