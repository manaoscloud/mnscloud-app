import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoService } from '@jsverse/transloco';
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
  ConfigurableCrudSaveContext,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { quickCreateFor } from '../../../../shared/crud/configurable-crud/quick-create';
import { openCrudComponentDialog } from '../../../../shared/dialog/crud-dialog.util';
import { openTemplatePickerDialog } from '../../../../shared/template-picker-dialog/template-picker-dialog';

type Translate = (key: string) => string;

const statuses: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

/** Custom is excluded on purpose: the database refuses Custom fallbacks to avoid fallback loops. */
const fallbackRouteTypes: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'group', label: 'Group' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
  { value: 'hangup', label: 'Hangup' },
];

export const STEP_ACTION_TYPES: ConfigurableCrudOption[] = [
  { value: 'playback', label: 'Play audio' },
  { value: 'collect_dtmf', label: 'Collect digits' },
  { value: 'api_request', label: 'Integration request' },
  { value: 'notification', label: 'Notification webhook' },
  { value: 'route', label: 'Transfer' },
  { value: 'hangup', label: 'Hang up' },
];

export const STEP_FAILURE_MODES: ConfigurableCrudOption[] = [
  { value: 'continue', label: 'Continue' },
  { value: 'fallback', label: 'Fallback' },
];

export const API_HTTP_METHODS: ConfigurableCrudOption[] = [
  { value: 'POST', label: 'POST' },
  { value: 'GET', label: 'GET' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
];

export const NOTIFICATION_HTTP_METHODS: ConfigurableCrudOption[] = [
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
];

export const STEP_ROUTE_TYPES: ConfigurableCrudOption[] = [
  { value: 'extension', label: 'Extension' },
  { value: 'group', label: 'Group' },
  { value: 'queue', label: 'Queue' },
  { value: 'ivr', label: 'IVR' },
  { value: 'custom', label: 'Custom' },
];

export const HANGUP_CAUSES: ConfigurableCrudOption[] = [
  { value: 'normal', label: 'Normal clearing' },
  { value: 'busy', label: 'User busy' },
  { value: 'rejected', label: 'Call rejected' },
  { value: 'unavailable', label: 'Unavailable' },
];

const STEP_STATUS_OPTIONS: ConfigurableCrudOption[] = [
  { value: 1, label: 'Active' },
  { value: 0, label: 'Inactive' },
];

const ENGINE_LABELS: Record<string, string> = { asterisk: 'Asterisk', freeswitch: 'FreeSWITCH' };

const QUEUE_STRATEGY_LABELS: Record<string, string> = {
  ring_all: 'Ring all',
  round_robin: 'Round robin',
  least_recent: 'Least recent',
  fewest_calls: 'Fewest calls',
  random: 'Random',
};

const GROUP_STRATEGY_LABELS: Record<string, string> = {
  simultaneous: 'Simultaneous',
  sequence: 'Sequence',
};

const ROUTE_TARGET_ENDPOINTS: Record<string, string> = {
  extension: 'voip/pabx/extensions',
  group: 'voip/pabx/groups',
  queue: 'voip/pabx/queues',
  ivr: 'voip/pabx/ivrs',
  custom: 'voip/pabx/customs',
};

/** Placeholders resolved by the API when it executes integration steps. */
export const STEP_PLACEHOLDERS =
  '{{caller}} {{did}} {{input}} {{callId}} {{customUUID}} {{pabxUUID}}';

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

function joinParts(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((part): part is string => !!part && part.trim() !== '').join(' • ');
}

function engineLabel(engine: unknown): string {
  const key = String(engine ?? '').toLowerCase();
  return ENGINE_LABELS[key] ?? (key ? key : '');
}

function compactUUID(value: unknown): string {
  return String(value ?? '')
    .replaceAll('-', '')
    .toUpperCase();
}

function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return options.find((option) => option.value === value)?.label ?? String(value ?? '');
}

/** PABX option with engine, domain and customer so tenants can tell PABXs apart. */
function pabxOption(row: any): ConfigurableCrudOption {
  return {
    value: row.VpaUUID ?? row.uuid,
    label: row.VpaName ?? row.name,
    description: joinParts(engineLabel(row.ServerEngine), row.DomainName, row.CustomerName),
  };
}

/** Route target option with the details that identify the destination. */
export function routeTargetOption(type: string, row: any, t: Translate): ConfigurableCrudOption {
  switch (type) {
    case 'extension': {
      const callerName = String(row.VpeCallerIdName ?? '').trim();
      return {
        value: row.VpeUUID,
        label: callerName ? `${row.VpeUsername} - ${callerName}` : String(row.VpeUsername ?? ''),
        description: joinParts(
          row.DomainName,
          row.VpeCallerIdNumber ? `${t('Caller ID')}: ${row.VpeCallerIdNumber}` : '',
        ),
      };
    }
    case 'group':
      return {
        value: row.VpgUUID,
        label: String(row.VpgName ?? ''),
        description: joinParts(
          row.VpgRingStrategy
            ? `${t('Ring strategy')}: ${t(GROUP_STRATEGY_LABELS[row.VpgRingStrategy] ?? row.VpgRingStrategy)}`
            : '',
          row.VpgRingTimeoutSeconds ? `${t('Ring timeout')}: ${row.VpgRingTimeoutSeconds}s` : '',
        ),
      };
    case 'queue':
      return {
        value: row.VpqUUID,
        label: String(row.VpqName ?? ''),
        description: joinParts(
          row.VpqStrategy
            ? `${t('Strategy')}: ${t(QUEUE_STRATEGY_LABELS[row.VpqStrategy] ?? row.VpqStrategy)}`
            : '',
          row.VpqMaxWaitSeconds ? `${t('Max wait')}: ${row.VpqMaxWaitSeconds}s` : '',
        ),
      };
    case 'ivr':
      return {
        value: row.VpiUUID,
        label: String(row.VpiName ?? ''),
        description: joinParts(
          row.MediaFileName ? `${t('Audio')}: ${row.MediaFileName}` : '',
          row.VpiTimeoutSeconds ? `${t('Timeout')}: ${row.VpiTimeoutSeconds}s` : '',
        ),
      };
    default:
      return {
        value: row.uuid,
        label: String(row.name ?? ''),
        description: `${Number(row.stepCount ?? 0)} ${t('Steps')}`,
      };
  }
}

/** Fallback target name for the list; hangup has no target. */
function fallbackTargetDetail(row: ConfigurableCrudRecord, translate: Translate): string {
  if (row['fallbackRouteType'] === 'hangup') return '';
  const name = String(row['fallbackRouteTargetName'] ?? '').trim();
  return name ? name : translate('Destination not found');
}

/** Loads every page of a list endpoint (canonical items envelope). */
async function fetchAllItems(api: ApiService, endpoint: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; offset < 5000; offset += 500) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const res = await api.get<any>(`${endpoint}${separator}limit=500&offset=${offset}`);
    const page = Array.isArray(res?.data?.items) ? res.data.items : [];
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

/** Active route targets of one PABX, filtered by the API. */
async function loadRouteTargets(
  api: ApiService,
  pabxUUID: string,
  routeType: string,
  t: Translate,
): Promise<ConfigurableCrudOption[]> {
  const endpoint = ROUTE_TARGET_ENDPOINTS[routeType];
  if (!endpoint || !pabxUUID) return [];
  const rows = await fetchAllItems(
    api,
    `${endpoint}?status=1&pabxUUID=${encodeURIComponent(pabxUUID)}`,
  );
  return rows
    .map((row) => routeTargetOption(routeType, row, t))
    .filter((option) => option.value && option.label);
}

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
        value: (row) => String(row['pabxName'] ?? ''),
        detail: (row) => joinParts(engineLabel(row['serverEngine']), row['domainName'] as string),
      },
      { id: 'steps', label: 'Steps', kind: 'number', field: 'stepCount' },
      { id: 'timeout', label: 'Timeout', kind: 'number', field: 'timeoutSeconds' },
      {
        id: 'fallbackRoute',
        label: 'Fallback route',
        kind: 'related',
        field: 'fallbackRouteType',
        value: (row, t) => t(optionLabel(fallbackRouteTypes, row['fallbackRouteType'] ?? 'hangup')),
        detail: fallbackTargetDetail,
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
        help: 'PABX that runs this Custom. Steps and the fallback can only use audio files and destinations of this PABX.',
      },
      {
        key: 'name',
        source: 'name',
        payloadKey: 'name',
        label: 'Name',
        required: true,
        span: 1,
        help: 'Name shown when choosing this Custom in inbound routes, IVR options and other Customs.',
      },
      {
        key: 'timeoutSeconds',
        source: 'timeoutSeconds',
        payloadKey: 'timeoutSeconds',
        label: 'Timeout seconds',
        type: 'number',
        span: 1,
        help: 'Maximum time for the whole flow (5 to 600 seconds). It is checked between steps: once it has passed, the call goes to the fallback route.',
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
        help: 'Where the call goes when a step fails with the Fallback policy, the timeout passes or the last step ends without a transfer.',
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
        requiredWhen: ({ values }) => values['fallbackRouteType'] !== 'hangup',
        help: 'Active destination of the selected PABX. Choose the PABX first.',
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

export type VoipCustomStepsDialogData = {
  custom: ConfigurableCrudRecord;
  steps: VoipCustomStep[];
};

@Component({
  selector: 'app-voip-custom-steps-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'Pipeline Steps' | transloco }} • {{ customName }}</h2>
          <p>{{ customContext }}</p>
        </div>
      </header>

      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (!editingStep()) {
            <div class="custom-steps-toolbar">
              <span>{{ steps().length }} / {{ maxSteps }} {{ 'Steps' | transloco }}</span>
              <button
                mat-flat-button
                color="primary"
                type="button"
                [disabled]="steps().length >= maxSteps"
                (click)="startAddStep()"
              >
                <mat-icon>add</mat-icon>
                {{ 'Add step' | transloco }}
              </button>
            </div>

            @if (steps().length) {
              <ol class="custom-steps-list">
                @for (
                  step of steps();
                  track step.order;
                  let i = $index;
                  let first = $first;
                  let last = $last
                ) {
                  <li class="custom-step" [class.is-disabled]="!isStepEnabled(step)">
                    <span class="custom-step-order">{{ step.order }}</span>
                    <mat-icon class="custom-step-icon">{{ actionIcon(step.actionType) }}</mat-icon>
                    <div class="custom-step-text">
                      <strong>{{ actionLabel(step.actionType) | transloco }}</strong>
                      <span>{{ stepSummary(step) }}</span>
                    </div>
                    <div class="custom-step-tags">
                      <span
                        class="status-pill status-chip state-chip"
                        [class.is-active]="isStepEnabled(step)"
                        [class.is-inactive]="!isStepEnabled(step)"
                      >
                        {{ (isStepEnabled(step) ? 'Active' : 'Inactive') | transloco }}
                      </span>
                      <span class="custom-step-failure" [matTooltip]="'On failure' | transloco">
                        {{ (step.onFailure === 'continue' ? 'Continue' : 'Fallback') | transloco }}
                      </span>
                    </div>
                    <div class="custom-step-actions">
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
                  </li>
                }
              </ol>
            } @else {
              <p class="custom-steps-empty">
                {{ 'No steps yet. Add the first step of this flow.' | transloco }}
              </p>
            }
          } @else {
            <h3 class="custom-step-editor-title">
              {{ (isNewStep() ? 'Add step' : 'Edit step') | transloco }}
            </h3>
            <div class="form-grid">
              <mns-search-select-field
                fieldClass="span-1"
                [label]="'Action type' | transloco"
                [options]="actionTypes"
                [translateOptions]="true"
                [value]="stepDraft.actionType"
                (valueChange)="onActionTypeChange(String($event))"
              />
              <mns-search-select-field
                fieldClass="span-1"
                [label]="'On failure' | transloco"
                [help]="
                  'Continue goes to the next step. Fallback sends the call to the Custom fallback route.'
                    | transloco
                "
                [options]="failureModes"
                [translateOptions]="true"
                [value]="stepDraft.onFailure"
                (valueChange)="stepDraft.onFailure = String($event)"
              />
              <mns-search-select-field
                fieldClass="span-1"
                [label]="'Status' | transloco"
                [options]="stepStatusOptions"
                [translateOptions]="true"
                [value]="stepDraft.enabled ? 1 : 0"
                (valueChange)="stepDraft.enabled = $event === 1"
              />

              @switch (stepDraft.actionType) {
                @case ('playback') {
                  <mns-search-select-field
                    data-quick-create-exempt="Media files are uploaded in VoIP > PABX > Media files."
                    fieldClass="span-4"
                    [label]="('Audio file' | transloco) + '*'"
                    [options]="mediaFiles()"
                    [loading]="lookupsLoading()"
                    [value]="stepDraft.config['mediaFileUUID'] || ''"
                    (valueChange)="setConfig('mediaFileUUID', $event || '')"
                  />
                }
                @case ('collect_dtmf') {
                  <mns-search-select-field
                    data-quick-create-exempt="Media files are uploaded in VoIP > PABX > Media files."
                    fieldClass="span-4"
                    [label]="'Prompt audio' | transloco"
                    [options]="mediaFiles()"
                    [loading]="lookupsLoading()"
                    [value]="stepDraft.config['promptMediaFileUUID'] || ''"
                    (valueChange)="setConfig('promptMediaFileUUID', $event || null)"
                  />
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>{{ 'Min digits' | transloco }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      max="20"
                      [value]="stepDraft.config['minDigits'] ?? 1"
                      (input)="updateConfigNumber('minDigits', $any($event.target).value)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>{{ 'Max digits' | transloco }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      max="20"
                      [value]="stepDraft.config['maxDigits'] ?? 10"
                      (input)="updateConfigNumber('maxDigits', $any($event.target).value)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>{{ 'Digit timeout (s)' | transloco }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      max="30"
                      [value]="stepDraft.config['timeoutSeconds'] ?? 5"
                      (input)="updateConfigNumber('timeoutSeconds', $any($event.target).value)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>{{ 'Attempts' | transloco }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="1"
                      max="5"
                      [value]="stepDraft.config['maxTries'] ?? 3"
                      (input)="updateConfigNumber('maxTries', $any($event.target).value)"
                    />
                  </mat-form-field>
                  <p class="span-4 custom-step-hint">
                    {{ 'The digits are available to later integration steps as' | transloco }}
                    {{ inputPlaceholder }}
                  </p>
                }
                @case ('api_request') {
                  <mat-form-field appearance="outline" class="span-3">
                    <mat-label>{{ 'HTTPS URL' | transloco }}*</mat-label>
                    <input
                      matInput
                      [value]="stepDraft.config['url'] || ''"
                      (input)="setConfig('url', $any($event.target).value)"
                      placeholder="https://crm.example.com/api/calls/route"
                    />
                  </mat-form-field>
                  <mns-search-select-field
                    fieldClass="span-1"
                    [label]="'Method' | transloco"
                    [options]="apiMethods"
                    [value]="stepDraft.config['method'] || 'POST'"
                    (valueChange)="setConfig('method', $event)"
                  />
                  <mat-form-field appearance="outline" class="span-3">
                    <mat-label>{{ 'Headers (JSON)' | transloco }}</mat-label>
                    <input
                      matInput
                      [value]="headersString()"
                      (input)="updateHeaders($any($event.target).value)"
                      placeholder='{"Content-Type": "application/json"}'
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-1">
                    <mat-label>{{ 'Timeout (ms)' | transloco }}</mat-label>
                    <input
                      matInput
                      type="number"
                      min="500"
                      max="8000"
                      [value]="stepDraft.config['timeoutMs'] ?? 3000"
                      (input)="updateConfigNumber('timeoutMs', $any($event.target).value)"
                    />
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="span-4">
                    <mat-label>{{ 'Request body' | transloco }}</mat-label>
                    <textarea
                      matInput
                      rows="3"
                      [value]="stepDraft.config['body'] || ''"
                      (input)="setConfig('body', $any($event.target).value)"
                      [placeholder]="requestBodyPlaceholder"
                    ></textarea>
                  </mat-form-field>
                  <mat-checkbox
                    class="span-4"
                    [checked]="stepDraft.config['routeFromResponse'] === true"
                    (change)="setConfig('routeFromResponse', $event.checked)"
                  >
                    {{ 'Route using the integration reply' | transloco }}
                  </mat-checkbox>
                  <p class="span-4 custom-step-hint">
                    {{
                      'Runs in the MNSCloud API (public HTTPS only). Non-2xx or timeout is a failure. Placeholders:'
                        | transloco
                    }}
                    {{ placeholders }}
                    @if (stepDraft.config['routeFromResponse'] === true) {
                      <br />
                      {{ 'Expected reply' | transloco }}: {{ routeReplyExample }}
                    }
                  </p>
                }
                @case ('notification') {
                  <mat-form-field appearance="outline" class="span-3">
                    <mat-label>{{ 'HTTPS URL' | transloco }}*</mat-label>
                    <input
                      matInput
                      [value]="stepDraft.config['url'] || ''"
                      (input)="setConfig('url', $any($event.target).value)"
                      placeholder="https://hooks.example.com/pabx/incoming-call"
                    />
                  </mat-form-field>
                  <mns-search-select-field
                    fieldClass="span-1"
                    [label]="'Method' | transloco"
                    [options]="notificationMethods"
                    [value]="stepDraft.config['method'] || 'POST'"
                    (valueChange)="setConfig('method', $event)"
                  />
                  <mat-form-field appearance="outline" class="span-4">
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
                      rows="2"
                      [value]="stepDraft.config['body'] || ''"
                      (input)="setConfig('body', $any($event.target).value)"
                      [placeholder]="requestBodyPlaceholder"
                    ></textarea>
                  </mat-form-field>
                  <p class="span-4 custom-step-hint">
                    {{
                      'Sent by the MNSCloud API without waiting for the reply. Placeholders:'
                        | transloco
                    }}
                    {{ placeholders }}
                  </p>
                }
                @case ('route') {
                  <mns-search-select-field
                    fieldClass="span-2"
                    [label]="'Destination type' | transloco"
                    [options]="routeTypes"
                    [translateOptions]="true"
                    [value]="stepDraft.config['routeType'] || 'extension'"
                    (valueChange)="onRouteChange(String($event))"
                  />
                  <mns-search-select-field
                    data-quick-create-exempt="Route target is polymorphic and depends on the selected destination type."
                    fieldClass="span-2"
                    [label]="('Destination' | transloco) + '*'"
                    [options]="routeDestinations()"
                    [loading]="lookupsLoading()"
                    [value]="stepDraft.config['targetUUID'] || ''"
                    (valueChange)="setConfig('targetUUID', $event || '')"
                  />
                }
                @case ('hangup') {
                  <mns-search-select-field
                    fieldClass="span-4"
                    [label]="'Hangup cause' | transloco"
                    [options]="hangupCauses"
                    [translateOptions]="true"
                    [value]="stepDraft.config['cause'] || 'normal'"
                    (valueChange)="setConfig('cause', $event)"
                  />
                }
              }
              @if (stepError()) {
                <p class="span-4 custom-step-error" role="alert">{{ stepError()! | transloco }}</p>
              }
            </div>

            <div class="custom-step-editor-actions">
              <button mat-stroked-button type="button" (click)="cancelStepEdit()">
                {{ 'Cancel' | transloco }}
              </button>
              <button mat-flat-button color="primary" type="button" (click)="applyStepDraft()">
                {{ 'Apply step' | transloco }}
              </button>
            </div>
          }
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="saving() || editingStep() !== null"
            (click)="saveAllSteps()"
          >
            {{ 'Save steps' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }

      .crud-dialog {
        height: 100%;
        min-height: 0;
      }

      .custom-steps-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        color: var(--mat-sys-color-on-surface-variant);
        font-size: 0.85rem;
      }

      .custom-steps-list {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .custom-step {
        display: grid;
        grid-template-columns: 1.75rem 1.5rem minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 0.75rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--mat-sys-color-outline-variant);
        border-radius: 12px;
        background: var(--mat-sys-color-surface-container);
      }

      .custom-step.is-disabled {
        opacity: 0.6;
      }

      .custom-step-order {
        color: var(--mat-sys-color-on-surface-variant);
        font-weight: 700;
        text-align: right;
      }

      .custom-step-icon {
        color: var(--mat-sys-color-primary);
      }

      .custom-step-text {
        display: grid;
        min-width: 0;

        span {
          overflow: hidden;
          color: var(--mat-sys-color-on-surface-variant);
          font-size: 0.85rem;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .custom-step-tags {
        display: grid;
        grid-template-columns: 5.5rem 6.5rem;
        align-items: center;
        gap: 0.5rem;
      }

      .custom-step-failure {
        color: var(--mat-sys-color-on-surface-variant);
        font-size: 0.8rem;
      }

      .custom-step-actions {
        display: flex;
        align-items: center;
      }

      .custom-steps-empty,
      .custom-step-hint {
        margin: 0;
        color: var(--mat-sys-color-on-surface-variant);
        font-size: 0.85rem;
        word-break: break-word;
      }

      .custom-steps-empty {
        padding: 2rem 0;
        text-align: center;
      }

      .custom-step-editor-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .custom-step-error {
        margin: 0;
        color: var(--mat-sys-color-error);
        font-size: 0.85rem;
      }

      .custom-step-editor-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
      }

      @media (max-width: 900px) {
        .custom-step {
          grid-template-columns: 1.75rem minmax(0, 1fr);
          row-gap: 0.4rem;
        }

        .custom-step-icon {
          grid-column: 1;
          grid-row: 2;
          justify-self: end;
        }

        .custom-step-order {
          grid-column: 1;
          grid-row: 1;
        }

        .custom-step-text {
          grid-column: 2;
          grid-row: 1;
        }

        .custom-step-tags {
          grid-column: 2;
          grid-row: 2;
          display: flex;
        }

        .custom-step-actions {
          grid-column: 1 / -1;
          grid-row: 3;
          justify-content: flex-end;
        }
      }
    `,
  ],
})
export class VoipCustomStepsDialogComponent {
  readonly data = inject<VoipCustomStepsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<VoipCustomStepsDialogComponent>);
  private readonly api = inject(ApiService);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);

  readonly String = String;
  readonly maxSteps = 20;
  readonly actionTypes = STEP_ACTION_TYPES;
  readonly failureModes = STEP_FAILURE_MODES;
  readonly stepStatusOptions = STEP_STATUS_OPTIONS;
  readonly apiMethods = API_HTTP_METHODS;
  readonly notificationMethods = NOTIFICATION_HTTP_METHODS;
  readonly routeTypes = STEP_ROUTE_TYPES;
  readonly hangupCauses = HANGUP_CAUSES;
  readonly placeholders = STEP_PLACEHOLDERS;
  readonly inputPlaceholder = '{{input}}';
  readonly requestBodyPlaceholder = '{"caller":"{{caller}}","did":"{{did}}"}';
  readonly routeReplyExample = '{"route":{"type":"queue","uuid":"<queue UUID>"}}';

  readonly steps = signal<VoipCustomStep[]>([]);
  readonly editingStep = signal<VoipCustomStep | null>(null);
  readonly editingIndex = signal<number>(-1);
  readonly isNewStep = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly stepError = signal<string | null>(null);
  readonly lookupsLoading = signal<boolean>(false);

  readonly mediaFiles = signal<ConfigurableCrudOption[]>([]);
  readonly routeDestinations = signal<ConfigurableCrudOption[]>([]);
  /** Labels of route targets already used by steps, keyed by `<type>:<UUID>`. */
  private readonly targetLabels = signal<Record<string, string>>({});

  stepDraft: VoipCustomStep = this.newStep();

  constructor() {
    const raw = Array.isArray(this.data.steps) ? this.data.steps : [];
    this.steps.set(
      raw.map((step, idx) => ({
        ...step,
        order: idx + 1,
        onFailure: step.onFailure === 'continue' ? 'continue' : 'fallback',
        config: typeof step.config === 'object' && step.config !== null ? { ...step.config } : {},
      })),
    );
    void this.loadMediaFiles();
    void this.loadUsedTargetLabels();
  }

  private get pabxUUID(): string {
    return String(this.data.custom['pabxUUID'] ?? '');
  }

  private t = (key: string): string => this.transloco.translate(key);

  get customName(): string {
    return String(this.data.custom['name'] ?? '');
  }

  /** PABX, engine and domain of the Custom, so the editor shows which PABX the steps belong to. */
  get customContext(): string {
    const custom = this.data.custom;
    return joinParts(
      custom['pabxName'] as string,
      engineLabel(custom['serverEngine']),
      custom['domainName'] as string,
    );
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
      case 'notification':
        return 'notifications';
      case 'route':
        return 'alt_route';
      case 'hangup':
        return 'call_end';
      default:
        return 'help';
    }
  }

  actionLabel(type: string): string {
    return this.actionTypes.find((a) => a.value === type)?.label ?? 'Unsupported step';
  }

  stepSummary(step: VoipCustomStep): string {
    const c: Record<string, any> = step.config || {};
    switch (step.actionType) {
      case 'playback':
        return this.mediaLabel(c['mediaFileUUID']);
      case 'api_request':
      case 'notification':
        return `${c['method'] || 'POST'} ${c['url'] || ''}`;
      case 'collect_dtmf':
        return joinParts(
          `${c['minDigits'] ?? 1}-${c['maxDigits'] ?? 10} ${this.t('digits')}`,
          c['promptMediaFileUUID'] ? this.mediaLabel(c['promptMediaFileUUID']) : '',
        );
      case 'route': {
        const type = String(c['routeType'] ?? 'extension');
        const target = this.targetLabels()[`${type}:${compactUUID(c['targetUUID'])}`];
        return joinParts(
          this.t(optionLabel(STEP_ROUTE_TYPES, type)),
          target ?? this.t('Destination not found'),
        );
      }
      case 'hangup':
        return this.t(optionLabel(HANGUP_CAUSES, c['cause'] ?? 'normal'));
      default:
        return '';
    }
  }

  setConfig(key: string, value: unknown): void {
    this.stepDraft.config[key] = value;
    this.stepError.set(null);
  }

  updateConfigNumber(key: string, value: unknown): void {
    const parsed = Number(value);
    this.setConfig(key, Number.isFinite(parsed) ? Math.trunc(parsed) : null);
  }

  moveStep(index: number, direction: -1 | 1): void {
    const destIndex = index + direction;
    const list = [...this.steps()];
    if (destIndex < 0 || destIndex >= list.length) return;
    [list[index], list[destIndex]] = [list[destIndex], list[index]];
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
  }

  deleteStep(index: number): void {
    const list = this.steps().filter((_, idx) => idx !== index);
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
  }

  startAddStep(): void {
    this.stepDraft = this.newStep();
    this.stepDraft.order = this.steps().length + 1;
    this.isNewStep.set(true);
    this.editingIndex.set(-1);
    this.stepError.set(null);
    this.editingStep.set(this.stepDraft);
  }

  editStep(step: VoipCustomStep, index: number): void {
    this.stepDraft = { ...step, config: { ...(step.config || {}) } };
    this.isNewStep.set(false);
    this.editingIndex.set(index);
    this.stepError.set(null);
    this.editingStep.set(this.stepDraft);
    if (this.stepDraft.actionType === 'route') {
      void this.loadDestinationsForRoute(this.stepDraft.config['routeType'] || 'extension');
    }
  }

  onActionTypeChange(type: string): void {
    this.stepDraft.actionType = type;
    this.stepError.set(null);
    if (type === 'api_request' || type === 'notification') {
      this.stepDraft.config = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(type === 'api_request' ? { timeoutMs: 3000, routeFromResponse: false } : {}),
      };
    } else if (type === 'collect_dtmf') {
      this.stepDraft.config = { minDigits: 1, maxDigits: 10, timeoutSeconds: 5, maxTries: 3 };
    } else if (type === 'route') {
      this.stepDraft.config = { routeType: 'extension', targetUUID: '' };
      void this.loadDestinationsForRoute('extension');
    } else if (type === 'hangup') {
      this.stepDraft.config = { cause: 'normal' };
    } else {
      this.stepDraft.config = { mediaFileUUID: '' };
    }
  }

  onRouteChange(routeType: string): void {
    this.setConfig('routeType', routeType);
    this.setConfig('targetUUID', '');
    void this.loadDestinationsForRoute(routeType);
  }

  headersString(): string {
    const headers = this.stepDraft.config['headers'];
    if (!headers) return '';
    if (typeof headers === 'string') return headers;
    try {
      return JSON.stringify(headers);
    } catch {
      return '';
    }
  }

  updateHeaders(raw: string): void {
    const text = raw.trim();
    if (!text) {
      this.setConfig('headers', {});
      return;
    }
    try {
      const parsed = JSON.parse(text);
      this.setConfig('headers', parsed && typeof parsed === 'object' ? parsed : raw);
    } catch {
      this.setConfig('headers', raw);
    }
  }

  /** Client-side checks mirroring the API contract, so errors show before saving. */
  private draftError(): string | null {
    const c = this.stepDraft.config;
    switch (this.stepDraft.actionType) {
      case 'playback':
        return c['mediaFileUUID'] ? null : 'Select an audio file.';
      case 'collect_dtmf': {
        const min = Number(c['minDigits'] ?? 1);
        const max = Number(c['maxDigits'] ?? 10);
        return min >= 1 && max >= min && max <= 20 ? null : 'Digits must be between 1 and 20.';
      }
      case 'api_request':
      case 'notification': {
        if (!/^https:\/\/[^/\s]+/i.test(String(c['url'] ?? ''))) return 'Use a public HTTPS URL.';
        if (typeof c['headers'] === 'string') return 'Headers must be a JSON object.';
        if (/\$\{/.test(`${c['url'] ?? ''}${c['body'] ?? ''}`)) {
          return 'Use the listed placeholders; dollar-brace expressions are not allowed.';
        }
        return null;
      }
      case 'route':
        return c['targetUUID'] ? null : 'Select a destination.';
      case 'hangup':
        return null;
      default:
        return 'Unsupported step type.';
    }
  }

  applyStepDraft(): void {
    const error = this.draftError();
    if (error) {
      this.stepError.set(error);
      return;
    }
    if (this.stepDraft.actionType === 'route') {
      const target = this.routeDestinations().find(
        (option) => compactUUID(option.value) === compactUUID(this.stepDraft.config['targetUUID']),
      );
      if (target) this.rememberTarget(String(this.stepDraft.config['routeType']), target);
    }
    const list = [...this.steps()];
    if (this.isNewStep()) {
      list.push({ ...this.stepDraft });
    } else {
      const idx = this.editingIndex();
      if (idx >= 0 && idx < list.length) list[idx] = { ...this.stepDraft };
    }
    list.forEach((item, idx) => (item.order = idx + 1));
    this.steps.set(list);
    this.cancelStepEdit();
  }

  cancelStepEdit(): void {
    this.editingStep.set(null);
    this.editingIndex.set(-1);
    this.isNewStep.set(false);
    this.stepError.set(null);
  }

  async saveAllSteps(): Promise<void> {
    const custom = this.data.custom;
    this.saving.set(true);
    try {
      await this.api.put(`voip/pabx/customs/${custom['uuid']}`, {
        pabxUUID: custom['pabxUUID'],
        name: custom['name'],
        description: custom['description'] ?? null,
        timeoutSeconds: custom['timeoutSeconds'],
        fallbackRouteType: custom['fallbackRouteType'],
        fallbackRouteTargetUUID: custom['fallbackRouteTargetUUID'] ?? null,
        enabled: custom['enabled'],
        steps: this.steps().map((step) => ({
          actionType: step.actionType,
          onFailure: step.onFailure,
          enabled: this.isStepEnabled(step),
          config: step.config,
        })),
      });
      this.snack.success('Steps saved successfully.');
      this.dialogRef.close(this.steps());
    } catch (error) {
      const message = (error as any)?.error?.error ?? (error as any)?.message;
      this.snack.error(typeof message === 'string' && message ? message : 'Failed to save steps.');
    } finally {
      this.saving.set(false);
    }
  }

  close(): void {
    this.dialogRef.close();
  }

  private newStep(): VoipCustomStep {
    return {
      order: 1,
      actionType: 'playback',
      config: { mediaFileUUID: '' },
      onFailure: 'continue',
      enabled: true,
    };
  }

  private mediaLabel(value: unknown): string {
    return (
      this.mediaFiles().find((option) => compactUUID(option.value) === compactUUID(value))?.label ??
      ''
    );
  }

  private rememberTarget(routeType: string, option: ConfigurableCrudOption): void {
    this.targetLabels.update((labels) => ({
      ...labels,
      [`${routeType}:${compactUUID(option.value)}`]: option.label,
    }));
  }

  private async loadMediaFiles(): Promise<void> {
    if (!this.pabxUUID) return;
    this.lookupsLoading.set(true);
    try {
      const rows = await fetchAllItems(
        this.api,
        `voip/pabx/media-files?status=1&pabxUUID=${encodeURIComponent(this.pabxUUID)}`,
      );
      this.mediaFiles.set(
        rows
          .map((row) => ({
            value: row.uuid,
            label: row.name,
            description: joinParts(row.originalFilename, row.deliveryMode),
          }))
          .filter((option) => option.value),
      );
    } catch {
      this.mediaFiles.set([]);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  /** Resolves the names of route targets already used, so the list summary shows them. */
  private async loadUsedTargetLabels(): Promise<void> {
    const types = new Set(
      this.steps()
        .filter((step) => step.actionType === 'route')
        .map((step) => String(step.config['routeType'] ?? 'extension')),
    );
    for (const type of types) {
      try {
        for (const option of await loadRouteTargets(this.api, this.pabxUUID, type, this.t)) {
          this.rememberTarget(type, option);
        }
      } catch {
        // The summary falls back to "Destination not found".
      }
    }
  }

  private async loadDestinationsForRoute(routeType: string): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const self = compactUUID(this.data.custom['uuid']);
      const options = await loadRouteTargets(this.api, this.pabxUUID, routeType, this.t);
      this.routeDestinations.set(options.filter((option) => compactUUID(option.value) !== self));
    } catch {
      this.routeDestinations.set([]);
    } finally {
      this.lookupsLoading.set(false);
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

  private readonly translateKey = (key: string): string => this.transloco.translate(key);

  constructor() {
    super(config());
    void this.loadPabxOptions();
  }

  override fieldLoading(field: ConfigurableCrudField): boolean {
    return ['pabxUUID', 'fallbackRouteTargetUUID'].includes(field.key) && this.lookupsLoading();
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key === 'pabxUUID') return this.pabxOptions();
    if (key === 'fallbackRouteTargetUUID') return this.destinationOptions();
    return [];
  }

  protected override onFieldValueChanged(key: string, _value: unknown): void {
    if (key === 'pabxUUID' || key === 'fallbackRouteType') {
      this.patchFormValues({ fallbackRouteTargetUUID: '' });
      void this.loadDestinationOptions();
    }
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      enabled: Number(payload['enabled']) === 1,
      timeoutSeconds: Number(payload['timeoutSeconds']) || 30,
      fallbackRouteType: String(payload['fallbackRouteType'] || 'hangup'),
      fallbackRouteTargetUUID:
        payload['fallbackRouteType'] === 'hangup'
          ? null
          : payload['fallbackRouteTargetUUID'] || null,
    };
  }

  /** After creating from a template, open the step editor so the tenant picks its own resources. */
  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const steps = this.templateDraftSteps;
    this.templateDraftSteps = null;
    if (context.mode !== 'create' || !steps?.length) return;
    const created = (context.response as any)?.data;
    if (!created?.uuid) return;
    await this.openStepsDialog(created, steps);
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
    let templates: VoipCustomTemplate[];
    try {
      const res = await this.rawApi.get<any>('voip/pabx/customs/templates');
      templates = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.items)
          ? res.data.items
          : [];
    } catch {
      this.snack.error('Failed to load custom pipeline templates.');
      return;
    }
    const selectedId = await openTemplatePickerDialog(this.dialog, {
      title: 'Pipeline templates',
      description: 'Choose a turnkey template to quickly bootstrap your custom pipeline.',
      emptyLabel: 'No templates found.',
      items: templates.map((template) => ({
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        meta: [
          { icon: 'timer', label: 'Timeout', value: `${template.timeoutSeconds}s` },
          {
            icon: 'alt_route',
            label: 'Fallback route',
            value: optionLabel(fallbackRouteTypes, template.fallbackRouteType),
          },
          { icon: 'format_list_numbered', label: 'Steps', value: String(template.steps.length) },
        ],
        steps: template.steps.map((step) => ({
          label: optionLabel(STEP_ACTION_TYPES, step.actionType),
          detail: this.templateStepDetail(step),
        })),
      })),
    });
    const selected = templates.find((template) => template.id === selectedId);
    if (!selected) return;

    this.startCreate();
    this.patchFormValues({
      name: this.translateKey(selected.name),
      description: this.translateKey(selected.description),
      timeoutSeconds: selected.timeoutSeconds,
      fallbackRouteType: selected.fallbackRouteType,
    });
    this.templateDraftSteps = selected.steps.map((step, index) => ({ ...step, order: index + 1 }));
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'steps') return;
    try {
      const res = await this.rawApi.get<any>(`voip/pabx/customs/${row['uuid']}`);
      const full = res?.data ?? row;
      await this.openStepsDialog(full, Array.isArray(full.steps) ? full.steps : []);
    } catch {
      this.snack.error('Failed to load custom steps.');
    }
  }

  /** What a template step does, without tenant resources (they are chosen after creation). */
  private templateStepDetail(step: VoipCustomStep): string {
    const c = step.config ?? {};
    switch (step.actionType) {
      case 'collect_dtmf':
        return `${c['minDigits'] ?? 1}-${c['maxDigits'] ?? 10} ${this.translateKey('digits')}`;
      case 'api_request':
        return c['routeFromResponse'] === true
          ? this.translateKey('Routes using the integration reply')
          : `${c['method'] ?? 'POST'} ${c['url'] ?? ''}`.trim();
      case 'notification':
        return `${c['method'] ?? 'POST'} ${c['url'] ?? ''}`.trim();
      case 'route':
        return this.translateKey(optionLabel(STEP_ROUTE_TYPES, c['routeType'] ?? 'extension'));
      case 'hangup':
        return this.translateKey(optionLabel(HANGUP_CAUSES, c['cause'] ?? 'normal'));
      default:
        return '';
    }
  }

  private async openStepsDialog(
    custom: ConfigurableCrudRecord,
    steps: VoipCustomStep[],
  ): Promise<void> {
    const binding = openCrudComponentDialog(
      this.dialog,
      VoipCustomStepsDialogComponent,
      'crud-form-dialog',
      { data: { custom, steps } satisfies VoipCustomStepsDialogData },
    );
    try {
      const savedSteps = await firstValueFrom(binding.ref.afterClosed());
      if (savedSteps) this.itemsResource.reload();
    } finally {
      binding.stop();
    }
  }

  private async loadPabxOptions(): Promise<void> {
    this.lookupsLoading.set(true);
    try {
      const rows = await fetchAllItems(this.rawApi, 'voip/pabx/accounts?status=1');
      this.pabxOptions.set(rows.map(pabxOption).filter((option) => option.value));
    } catch {
      this.pabxOptions.set([]);
    } finally {
      this.lookupsLoading.set(false);
    }
  }

  private async loadDestinationOptions(pabx?: string, routeType?: string): Promise<void> {
    const pabxUUID = pabx ?? String(this.formValues()['pabxUUID'] ?? '');
    const type = routeType ?? String(this.formValues()['fallbackRouteType'] ?? 'hangup');
    if (!pabxUUID || type === 'hangup') {
      this.destinationOptions.set([]);
      return;
    }
    try {
      this.destinationOptions.set(
        await loadRouteTargets(this.rawApi, pabxUUID, type, this.translateKey),
      );
    } catch {
      this.destinationOptions.set([]);
    }
  }
}
