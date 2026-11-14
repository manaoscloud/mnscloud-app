/**
 * Support remote AI copilot (ST-F): REST contract of the assistant routes of `/support/remote/*`
 * (mnscloud-api), and the pure helpers that turn the session timeline into the chat, the "thinking"
 * state and the change proposal results. Records keep the database column names.
 */
import { Injectable, inject } from '@angular/core';

import { ApiService } from '../../../services/api.service';
import { REMOTE_BASE, RemoteEvent, RemoteRecord, eventData, text, unwrap } from './remote-session';

export type AssistMode = 'manual' | 'copilot';

export type SafeChange = 'routeros_safe_mode' | 'vrp5_schedule_reboot' | 'systemd_deadman';

export type ProposalStatus =
  | 'proposed'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'applying'
  | 'applied'
  | 'rolled_back'
  | 'failed'
  | 'blocked';

export type RemoteProposal = {
  SrpUUID: string;
  NetworkDeviceNwdUUID?: string | null;
  DeviceName?: string | null;
  SrpTitle: string;
  SrpJustification?: string | null;
  SrpCommands: string[];
  SrpVerify: string[];
  SrpRollback: string[];
  SrpSafeChange: SafeChange | string;
  SrpRisk: 'low' | 'medium' | 'high' | string;
  SrpStatus: ProposalStatus | string;
  CreatedByName?: string | null;
  DecidedByName?: string | null;
  SrpDecidedAt?: string | null;
  SrpDecisionNote?: string | null;
  SrpExpiresAt?: string | null;
  SrpRevision: number;
  [key: string]: unknown;
};

export type SettingsRecord = {
  commentPrefix: string | null;
  effectivePrefix: string;
  revision: number;
  updatedAt?: string | null;
};

/** Events that make the proposal list stale. */
export function isProposalEvent(kind: string): boolean {
  return kind.startsWith('proposal_') || kind.startsWith('change_');
}

const AI_KINDS = new Set(['ai_request', 'ai_reply', 'ai_error', 'ai_exec']);
export function isAssistantEvent(kind: string): boolean {
  return AI_KINDS.has(kind);
}

/** Server error code of a failed request (`{ error: { code } }`), empty when absent. */
export function errorCode(error: unknown): string {
  const body = (error as { error?: { code?: unknown } } | null)?.error;
  return typeof body?.code === 'string' ? body.code : '';
}

export function errorStatus(error: unknown): number {
  return Number((error as { status?: number } | null)?.status) || 0;
}

/** Translation key for an AI failure code (ai_error events and failed assistant calls). */
export function aiErrorKey(code: string): string {
  switch (code) {
    case 'AI_NO_CREDIT':
      return 'support.remote.ai.error.AI_NO_CREDIT';
    case 'AI_NOT_ENTITLED':
      return 'support.remote.ai.error.AI_NOT_ENTITLED';
    case 'AI_BILLING_UNAVAILABLE':
      return 'support.remote.ai.error.AI_BILLING_UNAVAILABLE';
    case 'MAX_STEPS_EXCEEDED':
      return 'support.remote.ai.error.MAX_STEPS_EXCEEDED';
    case 'AI_RATE_LIMIT':
      return 'support.remote.ai.error.rateLimited';
    case 'AI_NOT_CONFIGURED':
      return 'support.remote.ai.error.AI_NOT_CONFIGURED';
    case 'AI_REFUSAL':
      return 'support.remote.ai.error.AI_REFUSAL';
    case 'AI_INTERRUPTED':
      return 'support.remote.ai.error.AI_INTERRUPTED';
    case 'AI_TIMEOUT':
      return 'support.remote.ai.error.AI_TIMEOUT';
    case 'SUPPORT_REMOTE_AI_UNAVAILABLE':
    case 'PROVIDER_ERROR':
      return 'support.remote.ai.error.PROVIDER_ERROR';
    default:
      return 'support.remote.ai.error.unknown';
  }
}

/** Translation key for a failed assistant/proposal request, or '' to keep the generic toast. */
export function assistRequestErrorKey(error: unknown): string {
  const code = errorCode(error);
  switch (code) {
    case 'SUPPORT_REMOTE_ASSIST_BUSY':
      return 'support.remote.ai.busy';
    case 'SUPPORT_REMOTE_CHANGE_UNSUPPORTED':
      return 'support.remote.proposal.error.unsupported';
    case 'SUPPORT_REMOTE_PROPOSAL_EXPIRED':
    case 'SUPPORT_REMOTE_PROPOSAL_NOT_PENDING':
      return 'support.remote.proposal.error.notPending';
    case 'SUPPORT_REMOTE_REVISION_CONFLICT':
    case 'REVISION_CONFLICT':
      return 'support.remote.error.revision';
    case 'SUPPORT_REMOTE_EXEC_LIVE':
      return 'support.remote.proposal.error.execLive';
    case 'ACCESS_GATEWAY_PRODUCTION_RESTRICTED':
      return 'support.remote.proposal.error.productionRestricted';
    case 'ACCESS_GATEWAY_UNAVAILABLE':
      return 'support.remote.proposal.error.gateway';
    case 'AI_NO_CREDIT':
    case 'AI_NOT_ENTITLED':
    case 'AI_BILLING_UNAVAILABLE':
    case 'AI_RATE_LIMIT':
    case 'AI_NOT_CONFIGURED':
    case 'SUPPORT_REMOTE_AI_UNAVAILABLE':
      return aiErrorKey(code);
    default:
      break;
  }
  const status = errorStatus(error);
  if (status === 403) return 'support.remote.error.forbidden';
  if (status === 409) return 'support.remote.error.conflict';
  if (status === 402) return aiErrorKey('AI_NO_CREDIT');
  if (status === 429) return 'support.remote.ai.error.rateLimited';
  if (status === 502 || status === 503) return aiErrorKey('PROVIDER_ERROR');
  return '';
}

export function safeChangeKey(value: unknown): string {
  switch (text(value)) {
    case 'routeros_safe_mode':
    case 'vrp5_schedule_reboot':
    case 'systemd_deadman':
      return `support.remote.proposal.safe.${text(value)}`;
    default:
      return 'support.remote.proposal.safe.unknown';
  }
}

export function riskChipClass(risk: unknown): string {
  switch (text(risk)) {
    case 'high':
      return 'chip-danger';
    case 'medium':
      return 'chip-warning';
    default:
      return 'chip-success';
  }
}

export function proposalChipClass(status: unknown): string {
  switch (text(status)) {
    case 'applied':
    case 'approved':
      return 'chip-success';
    case 'proposed':
    case 'applying':
    case 'rolled_back':
      return 'chip-warning';
    case 'failed':
    case 'blocked':
      return 'chip-danger';
    default:
      return 'chip-skipped';
  }
}

/** Approve is offered while proposed, and again when approved but the apply did not start. */
export function canApprove(proposal: RemoteProposal): boolean {
  return proposal.SrpStatus === 'proposed' || proposal.SrpStatus === 'approved';
}
export function canReject(proposal: RemoteProposal): boolean {
  return proposal.SrpStatus === 'proposed';
}

export type ChangeResult = {
  proposalUUID: string;
  status: string;
  rollbackMethod: string;
  rollbackFired: boolean;
  pendingReboot: boolean;
  errorCode: string;
  errorMessage: string;
};

/** Latest change_* event of each proposal. */
export function changeResults(events: readonly RemoteEvent[]): Map<string, ChangeResult> {
  const results = new Map<string, ChangeResult>();
  for (const event of events) {
    if (!event.SreKind.startsWith('change_')) continue;
    const data = eventData(event);
    const proposalUUID = text(data['proposalUUID']);
    if (!proposalUUID) continue;
    const rollback = (data['rollback'] ?? {}) as Record<string, unknown>;
    const error = (data['error'] ?? null) as Record<string, unknown> | null;
    results.set(proposalUUID, {
      proposalUUID,
      status: text(data['status']) || event.SreKind.replace('change_', ''),
      rollbackMethod: text(rollback['method']),
      rollbackFired: rollback['fired'] === true,
      pendingReboot: rollback['pendingReboot'] === true,
      errorCode: text(error?.['code']),
      errorMessage: text(error?.['message']),
    });
  }
  return results;
}

export type ExecCommand = {
  command: string;
  class: string;
  verdict: string;
  exitCode: number | null;
  truncated: boolean;
  output: string;
  /** The API omitted the output (viewer without device console permission). */
  hidden: boolean;
};

export type AssistEntry =
  | { type: 'request'; seq: number; date: string; text: string; actor: string }
  | { type: 'reply'; seq: number; date: string; text: string }
  | { type: 'error'; seq: number; date: string; code: string; text: string }
  | {
      type: 'exec';
      seq: number;
      date: string;
      device: string;
      status: string;
      error: string;
      commands: ExecCommand[];
      omitted: number;
    };

function execCommands(raw: unknown): ExecCommand[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = (item ?? {}) as Record<string, unknown>;
    const exit = row['exitCode'];
    return {
      command: text(row['command']),
      class: text(row['class']),
      verdict: text(row['verdict']),
      exitCode: typeof exit === 'number' ? exit : null,
      truncated: row['truncated'] === true,
      output: text(row['output']),
      hidden: !('output' in row) || row['output'] == null,
    };
  });
}

/** The chat as the technician reads it, in timeline order. Text is data, never markup. */
export function assistEntries(events: readonly RemoteEvent[]): AssistEntry[] {
  const entries: AssistEntry[] = [];
  for (const event of events) {
    const base = { seq: Number(event.SreSeq), date: text(event.SreDateCreated) };
    const data = eventData(event);
    switch (event.SreKind) {
      case 'ai_request':
        entries.push({
          ...base,
          type: 'request',
          text: text(event.SreText),
          actor: text(event.ActorName),
        });
        break;
      case 'ai_reply':
        entries.push({ ...base, type: 'reply', text: text(event.SreText) });
        break;
      case 'ai_error':
        entries.push({
          ...base,
          type: 'error',
          code: text(data['code']),
          text: text(event.SreText),
        });
        break;
      case 'ai_exec':
        entries.push({
          ...base,
          type: 'exec',
          device: text(data['device']) || text(event.DeviceName),
          status: text(data['status']),
          error: text(data['error']),
          commands: execCommands(data['commands']),
          omitted: Number(data['omitted']) || 0,
        });
        break;
      default:
        break;
    }
  }
  return entries;
}

/**
 * Server timestamps are UTC; MariaDB DATETIME strings arrive without a zone (`2026-11-14 12:00:00`),
 * which `Date.parse` would read as local time. Returns epoch ms, or NaN when unparsable.
 */
export function parseServerDate(value: unknown): number {
  const raw = text(value).trim();
  if (!raw) return NaN;
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
  return Date.parse(zoned);
}

/**
 * True while a run is active, from server state only: the session carries an AssistRunUUID whose
 * run has no ai_reply/ai_error yet, or an ai_request without a terminal event is newer than the
 * session record (SrsLastEventSeq), meaning the record was not reloaded yet.
 */
export function assistThinking(
  session: RemoteRecord | null | undefined,
  events: readonly RemoteEvent[],
): boolean {
  const done = new Set<string>();
  const open = new Map<string, number>();
  for (const event of events) {
    const run = text(eventData(event)['runUUID']);
    if (!run) continue;
    if (event.SreKind === 'ai_reply' || event.SreKind === 'ai_error') done.add(run);
    else if (event.SreKind === 'ai_request') open.set(run, Number(event.SreSeq));
  }
  const active = text(session?.['AssistRunUUID']);
  if (active && !done.has(active)) return true;
  const last = Number(session?.['SrsLastEventSeq']);
  if (!Number.isFinite(last)) return false;
  for (const [run, seq] of open) {
    if (!done.has(run) && seq > last) return true;
  }
  return false;
}

export function sessionMode(session: RemoteRecord | null | undefined): AssistMode | 'runbook' {
  const mode = text(session?.['SrsMode']);
  return mode === 'copilot' || mode === 'runbook' ? mode : 'manual';
}

/** Calls of the assistant routes. Kept in one place so a route change is a one-line edit. */
@Injectable({ providedIn: 'root' })
export class RemoteAssistService {
  private readonly api = inject(ApiService);

  async send(sessionUUID: string, message: string): Promise<void> {
    await this.api.post(
      `${REMOTE_BASE}/sessions/${sessionUUID}/assist`,
      { message },
      { silent: true },
    );
  }

  async summary(sessionUUID: string): Promise<string> {
    const response = await this.api.post<unknown>(
      `${REMOTE_BASE}/sessions/${sessionUUID}/assist/summary`,
      {},
      { silent: true },
    );
    return text(unwrap<{ summary?: string }>(response)?.summary).trim();
  }

  async proposals(sessionUUID: string): Promise<RemoteProposal[]> {
    const response = await this.api.get<unknown>(
      `${REMOTE_BASE}/sessions/${sessionUUID}/proposals`,
      { silent: true },
    );
    return unwrap<{ items?: RemoteProposal[] }>(response)?.items ?? [];
  }

  async approve(sessionUUID: string, proposal: RemoteProposal, note: string): Promise<void> {
    await this.api.post(
      `${REMOTE_BASE}/sessions/${sessionUUID}/proposals/${proposal.SrpUUID}/approve`,
      { revision: Number(proposal.SrpRevision), ...(note ? { note } : {}) },
      { silent: true },
    );
  }

  async reject(sessionUUID: string, proposal: RemoteProposal, note: string): Promise<void> {
    await this.api.post(
      `${REMOTE_BASE}/sessions/${sessionUUID}/proposals/${proposal.SrpUUID}/reject`,
      { revision: Number(proposal.SrpRevision), ...(note ? { note } : {}) },
      { silent: true },
    );
  }

  /** Session mode. If the API moves it to a dedicated route, only this call changes. */
  async setMode(sessionUUID: string, revision: number, mode: AssistMode): Promise<void> {
    await this.api.put(
      `${REMOTE_BASE}/sessions/${sessionUUID}/mode`,
      { mode, revision },
      { silent: true },
    );
  }

  async settings(): Promise<SettingsRecord> {
    const response = await this.api.get<unknown>(`${REMOTE_BASE}/settings`, { silent: true });
    const body = unwrap<Partial<SettingsRecord>>(response) ?? {};
    return {
      commentPrefix: typeof body.commentPrefix === 'string' ? body.commentPrefix : null,
      effectivePrefix: text(body.effectivePrefix),
      revision: Number(body.revision) || 0,
      updatedAt: body.updatedAt ?? null,
    };
  }

  async saveSettings(commentPrefix: string | null, revision: number): Promise<SettingsRecord> {
    const response = await this.api.put<unknown>(
      `${REMOTE_BASE}/settings`,
      { commentPrefix, revision },
      { silent: true },
    );
    const body = unwrap<Partial<SettingsRecord>>(response) ?? {};
    return {
      commentPrefix: typeof body.commentPrefix === 'string' ? body.commentPrefix : null,
      effectivePrefix: text(body.effectivePrefix),
      revision: Number(body.revision) || revision + 1,
      updatedAt: body.updatedAt ?? null,
    };
  }
}
