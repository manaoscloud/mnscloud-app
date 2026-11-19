import { REMOTE_CONTEXT } from './remote-context';
/**
 * Support remote runbooks and credential rotation (ST-H): REST contract of the `/support/remote/runbooks*`,
 * `runbook-runs` and `credential-rotation*` routes of mnscloud-api, and the pure helpers behind the
 * runbook editor, the parameter form of a run, the run/rotation cards and the error messages.
 * Records keep the database column names.
 */
import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';
import { NetworkDeviceType, NetworkDeviceTypeCatalog } from '../../network/network-options';
import { assistRequestErrorKey, errorCode, errorStatus } from './remote-assistant';
import { REMOTE_BASE, RemoteEvent, RemoteRecord, eventData, text, unwrap } from './remote-session';

export const RUNBOOK_BASE = `${REMOTE_BASE}/runbooks`;
export const RUNBOOK_DIALECTS = ['routeros', 'vrp', 'linux', 'proxmox'] as const;
export const RUNBOOK_STATUSES = ['draft', 'active', 'disabled'] as const;
export const RUNBOOK_PARAM_TYPES = ['word', 'int', 'ipv4', 'cidr'] as const;
export const RUNBOOK_STEP_KINDS = ['read', 'change'] as const;
/** Successful supervised runs of the current version before autonomy can be enabled. */
export const RUNBOOK_HISTORY_REQUIRED = 3;
export const RUNBOOK_LIMITS = {
  params: 10,
  preconditions: 10,
  steps: 20,
  commands: 27,
  verify: 10,
  name: 120,
  description: 2000,
  stepTitle: 120,
  contains: 200,
} as const;

export type RunbookDialect = (typeof RUNBOOK_DIALECTS)[number];
export type RunbookStatus = (typeof RUNBOOK_STATUSES)[number];
export type RunbookParamType = (typeof RUNBOOK_PARAM_TYPES)[number];
export type RunbookStepKind = (typeof RUNBOOK_STEP_KINDS)[number];

export type RunbookParam = {
  name: string;
  label: string;
  type: RunbookParamType;
  required: boolean;
};
export type RunbookPrecondition = { command: string; contains: string; negate: boolean };
export type RunbookStep = {
  title: string;
  kind: RunbookStepKind;
  commands: string[];
  verify: string[];
  rollback: string[];
};
export type RunbookDefinition = {
  name: string;
  description: string | null;
  dialect: RunbookDialect;
  status: RunbookStatus;
  params: RunbookParam[];
  preconditions: RunbookPrecondition[];
  steps: RunbookStep[];
};

export type RunMode = 'supervised' | 'autonomous';
export type RunStatus =
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'rolled_back'
  | 'needs_attention'
  | 'cancelled';
export type RotationState =
  'staging' | 'rotating' | 'promoting' | 'done' | 'failed' | 'rolled_back' | 'needs_attention';

const ACTIVE_RUN: readonly string[] = ['running', 'waiting_approval'];
const ACTIVE_ROTATION: readonly string[] = ['staging', 'rotating', 'promoting'];

// ---------------------------------------------------------------- parameter values (mirror of the API)

const OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const PARAM_NAME = /^[a-z][a-z0-9_]{0,31}$/;
const WORD = /^[A-Za-z0-9._-]{1,64}$/;
const INT = /^-?\d{1,9}$/;
const IPV4 = new RegExp(`^(${OCTET}\\.){3}${OCTET}$`);
const CIDR = new RegExp(`^(${OCTET}\\.){3}${OCTET}/(3[0-2]|[12]?[0-9])$`);
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

export function isParamName(value: string): boolean {
  return PARAM_NAME.test(value);
}

/** Whether a run parameter value is acceptable for its declared type. */
export function paramValueValid(type: string, value: string): boolean {
  switch (type) {
    case 'word':
      return WORD.test(value);
    case 'int':
      return INT.test(value);
    case 'ipv4':
      return IPV4.test(value);
    case 'cidr':
      return CIDR.test(value);
    default:
      return false;
  }
}

/** Per parameter: '' when fine, otherwise the translation key of the problem. */
export function paramFieldError(param: RunbookParam, raw: unknown): string {
  const value = text(raw).trim();
  if (!value) return param.required ? 'support.remote.runbooks.run.paramRequired' : '';
  return paramValueValid(param.type, value)
    ? ''
    : `support.remote.runbooks.run.invalid.${param.type}`;
}

/** Errors of the whole parameter form, keyed by parameter name (only the ones with a problem). */
export function paramFormErrors(
  params: readonly RunbookParam[],
  values: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const param of params) {
    const key = paramFieldError(param, values[param.name]);
    if (key) errors[param.name] = key;
  }
  return errors;
}

/** Values sent to the API: trimmed, empty optional parameters left out. */
export function runParamValues(
  params: readonly RunbookParam[],
  values: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const param of params) {
    const value = text(values[param.name]).trim();
    if (value) out[param.name] = value;
  }
  return out;
}

/** Names used as `{{name}}` in a text. */
export function placeholdersOf(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

// ---------------------------------------------------------------- editor model

/** One command per line, empty lines dropped. */
export function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
export function joinLines(lines: readonly string[] | null | undefined): string {
  return (lines ?? []).join('\n');
}

export function emptyStep(): RunbookStep {
  return { title: '', kind: 'read', commands: [], verify: [], rollback: [] };
}

/** Rollback commands exist only for linux/proxmox change steps (the API keeps the same rule). */
export function rollbackAllowed(dialect: string, kind: string): boolean {
  return kind === 'change' && (dialect === 'linux' || dialect === 'proxmox');
}

/** Problems of a runbook definition before sending it; translation keys, empty when valid. */
export function definitionProblems(def: RunbookDefinition): string[] {
  const problems: string[] = [];
  const add = (key: string) => {
    if (!problems.includes(key)) problems.push(key);
  };
  if (!def.name.trim()) add('support.remote.runbooks.problem.name');
  if (!def.steps.length) add('support.remote.runbooks.problem.steps');
  const names = new Set<string>();
  for (const param of def.params) {
    if (!isParamName(param.name) || names.has(param.name) || !param.label.trim()) {
      add('support.remote.runbooks.problem.params');
    }
    names.add(param.name);
  }
  for (const pre of def.preconditions) {
    if (!pre.command.trim() || !pre.contains.trim()) {
      add('support.remote.runbooks.problem.preconditions');
    }
  }
  for (const step of def.steps) {
    if (!step.title.trim() || !step.commands.length) add('support.remote.runbooks.problem.step');
    if (step.kind === 'change' && !step.verify.length)
      add('support.remote.runbooks.problem.verify');
    if (
      rollbackAllowed(def.dialect, step.kind) &&
      (!step.rollback.length || step.rollback.length > RUNBOOK_LIMITS.commands)
    ) {
      add('support.remote.runbooks.problem.rollback');
    }
  }
  const used = new Set<string>();
  for (const step of def.steps) {
    for (const line of [...step.commands, ...step.verify, ...step.rollback]) {
      for (const name of placeholdersOf(line)) used.add(name);
    }
  }
  for (const pre of def.preconditions) {
    for (const name of [...placeholdersOf(pre.command), ...placeholdersOf(pre.contains)]) {
      used.add(name);
    }
  }
  for (const name of used) {
    if (!names.has(name)) add('support.remote.runbooks.problem.placeholder');
  }
  return problems;
}

/** Body of POST/PUT: rollback only where the dialect allows it, empty description sent as null. */
export function definitionBody(def: RunbookDefinition): Record<string, unknown> {
  return {
    name: def.name.trim(),
    description: def.description?.trim() ? def.description.trim() : null,
    dialect: def.dialect,
    status: def.status,
    params: def.params.map((p) => ({
      name: p.name.trim(),
      label: p.label.trim(),
      type: p.type,
      required: p.required,
    })),
    preconditions: def.preconditions.map((p) => ({
      command: p.command.trim(),
      contains: p.contains.trim(),
      negate: p.negate,
    })),
    steps: def.steps.map((s) => ({
      title: s.title.trim(),
      kind: s.kind,
      commands: s.commands,
      verify: s.kind === 'change' ? s.verify : [],
      rollback: rollbackAllowed(def.dialect, s.kind) ? s.rollback : [],
    })),
  };
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
function lines(value: unknown): string[] {
  return asArray(value).map(text);
}

/** Editor model of a runbook record (JSON columns arrive as arrays, a JSON string is accepted too). */
export function definitionOf(record: RemoteRecord | null): RunbookDefinition {
  if (!record) {
    return {
      name: '',
      description: null,
      dialect: 'routeros',
      status: 'draft',
      params: [],
      preconditions: [],
      steps: [emptyStep()],
    };
  }
  const dialect = text(record['SrbDialect']);
  const status = text(record['SrbStatus']);
  return {
    name: text(record['SrbName']),
    description: text(record['SrbDescription']) || null,
    dialect: (RUNBOOK_DIALECTS as readonly string[]).includes(dialect)
      ? (dialect as RunbookDialect)
      : 'routeros',
    status: (RUNBOOK_STATUSES as readonly string[]).includes(status)
      ? (status as RunbookStatus)
      : 'draft',
    params: asArray(record['SrbParams']).map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      const type = text(row['type']);
      return {
        name: text(row['name']),
        label: text(row['label']),
        type: (RUNBOOK_PARAM_TYPES as readonly string[]).includes(type)
          ? (type as RunbookParamType)
          : 'word',
        required: row['required'] === true || row['required'] === 1,
      };
    }),
    preconditions: asArray(record['SrbPreconditions']).map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        command: text(row['command']),
        contains: text(row['contains']),
        negate: row['negate'] === true || row['negate'] === 1,
      };
    }),
    steps: asArray(record['SrbSteps']).map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        title: text(row['title']),
        kind: text(row['kind']) === 'change' ? 'change' : 'read',
        commands: lines(row['commands']),
        verify: lines(row['verify']),
        rollback: lines(row['rollback']),
      };
    }),
  };
}

/** Parameters declared by a runbook record (list items carry SrbParams, never the steps). */
export function runbookParams(record: RemoteRecord | null | undefined): RunbookParam[] {
  return definitionOf(record ?? null).params;
}

export function runbookStatusChip(status: unknown): string {
  switch (text(status)) {
    case 'active':
      return 'chip-success';
    case 'draft':
      return 'chip-warning';
    default:
      return 'chip-skipped';
  }
}

/** Autonomy of a runbook row: on, off, or blocked until enough supervised runs. */
export function autonomyState(row: RemoteRecord): { enabled: boolean; remaining: number } {
  return {
    enabled: Number(row['SrbAutonomous']) === 1 || row['SrbAutonomous'] === true,
    remaining: Math.max(0, Number(row['AutonomyRemaining']) || 0),
  };
}

/** Why autonomy cannot be switched on for the row (translation key), or null when it can. */
export function autonomyBlockReason(row: RemoteRecord): string | null {
  const { enabled, remaining } = autonomyState(row);
  if (enabled) return null;
  if (text(row['SrbStatus']) !== 'active') return 'support.remote.runbooks.autonomy.needsActive';
  return remaining > 0 ? 'support.remote.runbooks.autonomy.history' : null;
}

// ---------------------------------------------------------------- runs and rotations

export type RunbookRun = {
  SrxUUID: string;
  SupportRemoteSessionSrsUUID?: string;
  NetworkDeviceNwdUUID?: string | null;
  DeviceName?: string | null;
  RunbookName?: string | null;
  SupportRemoteRunbookSrbUUID?: string | null;
  StepCount?: number;
  SrxVersion?: number;
  SrxMode: RunMode | string;
  SrxStatus: RunStatus | string;
  SrxStep: number;
  SrxResult?: unknown;
  SrxError?: string | null;
  SrxRevision: number;
  [key: string]: unknown;
};

export type RunStepResult = {
  step: number;
  kind: string;
  status: string;
  proposalUUID: string;
  error: string;
};

export function isRunActive(run: Pick<RunbookRun, 'SrxStatus'>): boolean {
  return ACTIVE_RUN.includes(text(run.SrxStatus));
}

export function runChipClass(status: unknown): string {
  switch (text(status)) {
    case 'succeeded':
      return 'chip-success';
    case 'running':
    case 'waiting_approval':
    case 'rolled_back':
    case 'needs_attention':
    case 'cancelled':
      return 'chip-warning';
    case 'failed':
      return 'chip-danger';
    default:
      return 'chip-skipped';
  }
}

export function stepResults(run: Pick<RunbookRun, 'SrxResult'>): RunStepResult[] {
  return asArray(run.SrxResult).map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>;
    return {
      step: Number(row['step']),
      kind: text(row['kind']),
      status: text(row['status']),
      proposalUUID: text(row['proposalUUID']),
      error: text(row['error']),
    };
  });
}

export function stepChipClass(status: unknown): string {
  switch (text(status)) {
    case 'ok':
    case 'applied':
    case 'succeeded':
      return 'chip-success';
    case 'failed':
    case 'blocked':
    case 'timeout':
      return 'chip-danger';
    case 'running':
    case 'waiting_approval':
    case 'proposed':
    case 'applying':
    case 'rolled_back':
      return 'chip-warning';
    default:
      return 'chip-skipped';
  }
}

export function stepStatusKey(status: unknown): string {
  const value = text(status);
  return [
    'ok',
    'applied',
    'succeeded',
    'failed',
    'blocked',
    'timeout',
    'running',
    'waiting_approval',
    'proposed',
    'applying',
    'rejected',
    'expired',
    'rolled_back',
    'cancelled',
    'skipped',
    'pending',
  ].includes(value)
    ? `support.remote.runbooks.step.status.${value}`
    : 'support.remote.runbooks.step.status.unknown';
}

export type RunCardStep = {
  index: number;
  title: string;
  kind: string;
  status: string;
  current: boolean;
  proposalUUID: string;
  error: string;
};

export type RunCard = {
  run: RunbookRun;
  active: boolean;
  /** Pre-conditions result, when the run reported one. */
  preconditions: RunStepResult | null;
  steps: RunCardStep[];
  /** 1-based number of the step in progress, 0 when none (pre-conditions, finished). */
  currentNumber: number;
  total: number;
  errorKey: string;
};

/** Titles of the steps of a run, from its `runbook_step` / `runbook_finished` timeline events. */
export function runStepTitles(
  events: readonly RemoteEvent[],
  runUUID: string,
): Map<number, { title: string; kind: string }> {
  const titles = new Map<number, { title: string; kind: string }>();
  for (const event of events) {
    const data = eventData(event);
    if (text(data['runUUID']) !== runUUID) continue;
    if (event.SreKind === 'runbook_step' && Number.isFinite(Number(data['step']))) {
      titles.set(Number(data['step']), { title: text(data['title']), kind: text(data['kind']) });
    } else if (event.SreKind === 'runbook_finished') {
      for (const raw of asArray(data['steps'])) {
        const row = (raw ?? {}) as Record<string, unknown>;
        if (!Number.isFinite(Number(row['step']))) continue;
        titles.set(Number(row['step']), { title: text(row['title']), kind: text(row['kind']) });
      }
    }
  }
  return titles;
}

/** Translation key of a run error code (`SrxError`), empty without an error. */
export function runErrorKey(code: unknown): string {
  const value = text(code);
  if (!value) return '';
  const known = [
    'SUPPORT_REMOTE_RUNBOOK_PRECONDITION',
    'SUPPORT_REMOTE_RUNBOOK_STEP_FAILED',
    'SUPPORT_REMOTE_RUNBOOK_STEP_BLOCKED',
    'SUPPORT_REMOTE_RUNBOOK_STEP_ROLLED_BACK',
    'SUPPORT_REMOTE_RUNBOOK_PROPOSAL_REJECTED',
    'SUPPORT_REMOTE_RUNBOOK_PROPOSAL_EXPIRED',
    'SUPPORT_REMOTE_RUNBOOK_EXEC_TIMEOUT',
    'SUPPORT_REMOTE_RUNBOOK_APPLY_FAILED',
    'SUPPORT_REMOTE_RUNBOOK_CANCELLED',
    'SUPPORT_REMOTE_RUNBOOK_INTERRUPTED',
    'SUPPORT_REMOTE_CHANGE_UNSUPPORTED',
  ];
  return known.includes(value)
    ? `support.remote.runbooks.runError.${value}`
    : 'support.remote.runbooks.runError.unknown';
}

/**
 * View model of a run card: one row per step (results first, then the step in progress, then the
 * pending ones), the number of the current step and the translated error key.
 */
export function runCard(run: RunbookRun, events: readonly RemoteEvent[]): RunCard {
  const results = stepResults(run);
  const titles = runStepTitles(events, run.SrxUUID);
  const total = Math.max(
    Number(run.StepCount) || 0,
    titles.size,
    ...results.map((r) => r.step + 1),
  );
  const active = isRunActive(run);
  const current = Number(run.SrxStep);
  const steps: RunCardStep[] = [];
  for (let index = 0; index < total; index++) {
    const result = results.find((item) => item.step === index && item.kind !== 'preconditions');
    const isCurrent = active && index === current && !result;
    const meta = titles.get(index);
    steps.push({
      index,
      title: meta?.title ?? '',
      kind: result?.kind || meta?.kind || '',
      status: result?.status || (isCurrent ? text(run.SrxStatus) : 'pending'),
      current: isCurrent,
      proposalUUID: result?.proposalUUID ?? '',
      error: result?.error ?? '',
    });
  }
  return {
    run,
    active,
    preconditions: results.find((item) => item.kind === 'preconditions') ?? null,
    steps,
    currentNumber: active && current >= 0 && current < total ? current + 1 : 0,
    total,
    errorKey: runErrorKey(run.SrxError),
  };
}

export type CredentialRotation = {
  ScrUUID: string;
  NetworkDeviceNwdUUID?: string | null;
  DeviceName?: string | null;
  CredentialUsername?: string | null;
  ScrState: RotationState | string;
  ScrErrorCode?: string | null;
  PromoteOperationState?: string | null;
  ScrRevision?: number;
  [key: string]: unknown;
};

export type RotationActive = 'current' | 'new';

/** The technician can say which password works only while the rotation needs attention. */
export function canResolveRotation(rotation: Pick<CredentialRotation, 'ScrState'>): boolean {
  return text(rotation.ScrState) === 'needs_attention';
}

export function isRotationActive(rotation: Pick<CredentialRotation, 'ScrState'>): boolean {
  return ACTIVE_ROTATION.includes(text(rotation.ScrState));
}

export function rotationChipClass(state: unknown): string {
  switch (text(state)) {
    case 'done':
      return 'chip-success';
    case 'staging':
    case 'rotating':
    case 'promoting':
    case 'rolled_back':
    case 'needs_attention':
      return 'chip-warning';
    case 'failed':
      return 'chip-danger';
    default:
      return 'chip-skipped';
  }
}

/** Translation key explaining the state of a rotation to the technician. */
export function rotationStateKey(rotation: Pick<CredentialRotation, 'ScrState' | 'ScrErrorCode'>) {
  const state = text(rotation.ScrState);
  const known = [
    'staging',
    'rotating',
    'promoting',
    'done',
    'failed',
    'rolled_back',
    'needs_attention',
  ];
  return known.includes(state)
    ? `support.remote.runbooks.rotation.help.${state}`
    : 'support.remote.runbooks.rotation.help.unknown';
}

/** Translation key of a rotation error code (`ScrErrorCode`: gateway, exec or promote retry codes). */
export function rotationErrorKey(code: unknown): string {
  const value = text(code);
  if (!value) return '';
  if (value.startsWith('SUPPORT_REMOTE_ROTATION_PROMOTE_RETRY')) {
    return 'support.remote.runbooks.rotation.error.promoteRetry';
  }
  if (value === 'CREDENTIAL_UNSAFE' || value === 'CREDENTIAL_MISMATCH') {
    return `support.remote.runbooks.rotation.error.${value}`;
  }
  if (value === 'SUPPORT_REMOTE_ROTATION_EXEC_FAILED' || value.startsWith('EXEC_')) {
    return 'support.remote.runbooks.rotation.error.exec';
  }
  return 'support.remote.runbooks.rotation.error.unknown';
}

/** Passwords of the device the rotation can be applied to (metadata rows from the credentials list). */
export function passwordCredentials(rows: readonly RemoteRecord[]): RemoteRecord[] {
  return rows.filter(
    (row) => text(row['NwcKind']) === 'password' && text(row['NwcState']) === 'stored',
  );
}

export function credentialLabel(row: RemoteRecord): string {
  const user = text(row['NwcUsername']);
  const id = text(row['NwcID']);
  return [user, id].filter(Boolean).join(' · ') || text(row['NwcUUID']).slice(0, 8);
}

export function sessionLevelAllowsRotation(session: RemoteRecord | null | undefined): boolean {
  return text(session?.['SrsLevel']) === 'n3';
}

const RUNBOOK_EVENT_KINDS: ReadonlySet<string> = new Set([
  'runbook_started',
  'runbook_step',
  'runbook_finished',
  'credential_rotation_started',
  'credential_rotated',
  'credential_rotation_failed',
]);

/** Highest runbook_* / credential_rotation* sequence: a new one reloads the runs and rotations. */
export function runbookMark(events: readonly RemoteEvent[]): number {
  return events.reduce(
    (max, event) =>
      RUNBOOK_EVENT_KINDS.has(event.SreKind) ? Math.max(max, Number(event.SreSeq)) : max,
    0,
  );
}

// ---------------------------------------------------------------- errors

/** Translation key for a failed runbook/rotation request, '' to keep the generic message. */
export function runbookRequestErrorKey(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case 'SUPPORT_REMOTE_RUNBOOK_NOT_FOUND':
      return 'support.remote.runbooks.error.notFound';
    case 'SUPPORT_REMOTE_RUNBOOK_INVALID':
      return 'support.remote.runbooks.error.invalid';
    case 'SUPPORT_REMOTE_RUNBOOK_PARAM_INVALID':
      return 'support.remote.runbooks.error.paramInvalid';
    case 'SUPPORT_REMOTE_RUNBOOK_HISTORY_REQUIRED':
      return 'support.remote.runbooks.error.historyRequired';
    case 'SUPPORT_REMOTE_RUNBOOK_INACTIVE':
      return 'support.remote.runbooks.error.inactive';
    case 'SUPPORT_REMOTE_RUNBOOK_BUSY':
      return 'support.remote.runbooks.error.busy';
    case 'SUPPORT_REMOTE_RUNBOOK_DIALECT_MISMATCH':
      return 'support.remote.runbooks.error.dialectMismatch';
    case 'SUPPORT_REMOTE_RUNBOOK_NAME_EXISTS':
      return 'support.remote.runbooks.error.nameExists';
    case 'SUPPORT_REMOTE_RUN_NOT_FOUND':
      return 'support.remote.runbooks.error.runNotFound';
    case 'SUPPORT_REMOTE_RUN_FINISHED':
      return 'support.remote.runbooks.error.runFinished';
    case 'SUPPORT_REMOTE_ROTATION_LEVEL':
      return 'support.remote.runbooks.error.rotationLevel';
    case 'SUPPORT_REMOTE_ROTATION_UNSUPPORTED':
      return 'support.remote.runbooks.error.rotationUnsupported';
    case 'SUPPORT_REMOTE_ROTATION_BUSY':
      return 'support.remote.runbooks.error.rotationBusy';
    case 'SUPPORT_REMOTE_ROTATION_NOT_READY':
      return 'support.remote.runbooks.error.rotationNotReady';
    case 'SUPPORT_REMOTE_ROTATION_FINISHED':
      return 'support.remote.runbooks.error.rotationFinished';
    case 'SUPPORT_REMOTE_ROTATION_NOT_FOUND':
      return 'support.remote.runbooks.error.rotationNotFound';
    case 'SUPPORT_REMOTE_CREDENTIAL_NOT_FOUND':
      return 'support.remote.runbooks.error.credentialNotFound';
    default:
      break;
  }
  const generic = assistRequestErrorKey(error);
  if (generic) return generic;
  return errorStatus(error) === 400 ? 'support.remote.runbooks.error.invalid' : '';
}

// ---------------------------------------------------------------- service

/** Calls of the runbook, run and rotation routes, kept in one place like RemoteAssistService. */
@Injectable()
export class RemoteRunbookService {
  private readonly api = inject(ApiService);
  private readonly context = inject(REMOTE_CONTEXT);

  async list(query: { status?: string; dialect?: string } = {}): Promise<RemoteRecord[]> {
    const params = new URLSearchParams({ limit: '200', offset: '0' });
    if (query.status) params.set('status', query.status);
    if (query.dialect) params.set('dialect', query.dialect);
    const response = await this.api.get<unknown>(
      `${this.context.base}/runbooks?${params.toString()}`,
      {
        silent: true,
      },
    );
    return unwrap<{ items?: RemoteRecord[] }>(response)?.items ?? [];
  }

  async get(uuid: string): Promise<RemoteRecord> {
    const response = await this.api.get<unknown>(`${this.context.base}/runbooks/${uuid}`, {
      silent: true,
    });
    return unwrap<{ runbook?: RemoteRecord }>(response)?.runbook ?? {};
  }

  async create(def: RunbookDefinition): Promise<void> {
    await this.api.post(`${this.context.base}/runbooks`, definitionBody(def), { silent: true });
  }

  async update(uuid: string, revision: number, def: RunbookDefinition): Promise<void> {
    await this.api.put(
      `${this.context.base}/runbooks/${uuid}`,
      { ...definitionBody(def), revision },
      { silent: true },
    );
  }

  async startRun(
    sessionUUID: string,
    body: {
      runbookUUID: string;
      deviceUUID: string;
      params: Record<string, string>;
      mode: RunMode;
    },
  ): Promise<void> {
    await this.api.post(`${this.context.base}/sessions/${sessionUUID}/runbook-runs`, body, {
      silent: true,
    });
  }

  async runs(sessionUUID: string): Promise<RunbookRun[]> {
    const response = await this.api.get<unknown>(
      `${this.context.base}/sessions/${sessionUUID}/runbook-runs`,
      { silent: true },
    );
    return unwrap<{ items?: RunbookRun[] }>(response)?.items ?? [];
  }

  async cancelRun(sessionUUID: string, run: RunbookRun): Promise<void> {
    await this.api.post(
      `${this.context.base}/sessions/${sessionUUID}/runbook-runs/${run.SrxUUID}/cancel`,
      { revision: Number(run.SrxRevision) },
      { silent: true },
    );
  }

  async startRotation(
    sessionUUID: string,
    deviceUUID: string,
    credentialUUID: string | null,
  ): Promise<void> {
    await this.api.post(
      `${this.context.base}/sessions/${sessionUUID}/devices/${deviceUUID}/credential-rotation`,
      credentialUUID ? { credentialUUID } : {},
      { silent: true },
    );
  }

  /** Technician's answer for a rotation in needs_attention: which password the device accepts. */
  async resolveRotation(
    sessionUUID: string,
    rotation: Pick<CredentialRotation, 'ScrUUID' | 'ScrRevision'>,
    active: RotationActive,
  ): Promise<void> {
    await this.api.post(
      `${this.context.base}/sessions/${sessionUUID}/credential-rotations/${rotation.ScrUUID}/resolve`,
      { active, revision: Number(rotation.ScrRevision) },
      { silent: true },
    );
  }

  async rotations(sessionUUID: string): Promise<CredentialRotation[]> {
    const response = await this.api.get<unknown>(
      `${this.context.base}/sessions/${sessionUUID}/credential-rotations`,
      { silent: true },
    );
    return unwrap<{ items?: CredentialRotation[] }>(response)?.items ?? [];
  }

  /** Device type catalog (codes and shell dialect per type). */
  async deviceTypes(): Promise<NetworkDeviceType[]> {
    const response = await this.api.get<{ data?: NetworkDeviceTypeCatalog }>(
      'network/device-types',
      { silent: true },
    );
    return response?.data?.items ?? [];
  }

  /** Credentials metadata of a device (password kind only is kept by the caller). */
  async deviceCredentials(deviceUUID: string): Promise<RemoteRecord[]> {
    const response = await this.api.get<unknown>(
      `${this.context.network}/devices/${deviceUUID}/credentials`,
      {
        silent: true,
      },
    );
    return unwrap<{ items?: RemoteRecord[] }>(response)?.items ?? [];
  }
}
