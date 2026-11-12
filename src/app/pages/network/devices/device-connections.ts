import { MatDialog } from '@angular/material/dialog';

import { ApiService } from '../../../services/api.service';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  DataViewerDetail,
  DataViewerSection,
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';
import { optionColumn, optionLabel } from '../network-options';

/**
 * Console connections of a device (Rede › Equipamentos › Conexões): history, timeline, recording
 * and the "Testar acesso" result. Everything comes from `/network/connections*` (or the platform
 * twin): the API owns scope, states and the signed recording URLs.
 */

type Translate = (key: string, params?: Record<string, string | number>) => string;

function enumOptions(prefix: string, values: readonly string[]): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

export const CONNECTION_STATE_OPTIONS = enumOptions('network.connection.state', [
  'requested',
  'assigned',
  'connecting',
  'open',
  'closed',
  'failed',
  'blocked',
]);
export const CONNECTION_PURPOSE_OPTIONS = enumOptions('network.connection.purpose', [
  'console',
  'test',
]);
export const CONNECTION_METHOD_OPTIONS = enumOptions('network.connection.method', [
  'ssh',
  'routeros_api',
]);
const HOST_KEY_RESULT_OPTIONS = enumOptions('network.connection.hostKeyResult', [
  'matched',
  'mismatch',
  'unpinned',
  'pinned',
]);
const BLOCK_REASON_OPTIONS = enumOptions('network.connection.blockReason', [
  'host_key_mismatch',
  'host_key_unpinned',
  'tls_mismatch',
  'tls_unpinned',
  'destination_refused',
  'method_refused',
]);
const EVENT_KIND_OPTIONS = enumOptions('network.connection.eventKind', [
  'command',
  'verdict',
  'confirm',
  'deny',
  'state',
  'hostkey',
]);
const EVENT_VERDICT_OPTIONS = enumOptions('network.connection.verdict', [
  'allow',
  'confirm',
  'double_confirm',
  'block',
]);
const EVENT_CLASS_OPTIONS = enumOptions('network.console.class', [
  'read',
  'write_reversible',
  'write_risky',
  'destructive',
  'secret_read',
  'pivot',
  'unknown',
]);

const LIVE_STATES = ['requested', 'assigned', 'connecting', 'open'];
const FINAL_STATES = ['closed', 'failed', 'blocked'];

/** Translation keys of the API codes of the console routes; other errors keep the API text. */
const ERROR_KEYS: Record<string, string> = {
  ACCESS_GATEWAY_UNAVAILABLE: 'network.console.error.unavailable',
  ACCESS_GATEWAY_PRODUCTION_RESTRICTED: 'network.console.error.productionRestricted',
  ACCESS_GATEWAY_DESTINATION_REFUSED: 'network.console.error.destinationRefused',
  ACCESS_GATEWAY_METHOD_UNSUPPORTED: 'network.console.error.methodUnsupported',
  ACCESS_GATEWAY_PATH_UNSUPPORTED: 'network.console.error.pathUnsupported',
  ACCESS_GATEWAY_CREDENTIAL_REQUIRED: 'network.console.error.credentialRequired',
  ACCESS_GATEWAY_HOST_REQUIRED: 'network.console.error.hostRequired',
  ACCESS_GATEWAY_STORAGE_UNAVAILABLE: 'network.console.error.storageUnavailable',
  ACCESS_GATEWAY_RECORDING_NOT_FOUND: 'network.console.error.recordingNotFound',
  NETWORK_FORBIDDEN: 'network.console.error.forbidden',
};

export function accessGatewayErrorMessage(error: unknown): string {
  const body = (error as { error?: { code?: unknown; error?: unknown; message?: unknown } } | null)
    ?.error;
  const code = typeof body?.code === 'string' ? body.code : '';
  if (ERROR_KEYS[code]) return ERROR_KEYS[code];
  const text = body?.error ?? body?.message;
  return typeof text === 'string' && text.trim() ? text.trim() : 'network.console.openFailed';
}

function stateChip(value: unknown): string {
  const state = String(value ?? '');
  if (state === 'open' || state === 'closed') return 'chip-success';
  if (state === 'failed' || state === 'blocked') return 'chip-failed';
  return 'chip-warning';
}

function bytesText(row: ConfigurableCrudRecord): string {
  const kib = (value: unknown) => `${Math.round(Number(value ?? 0) / 1024)} KiB`;
  return `${kib(row['AgcBytesIn'])} / ${kib(row['AgcBytesOut'])}`;
}

function destination(row: ConfigurableCrudRecord): string {
  const address = String(row['AgcDestinationAddress'] ?? '');
  return address ? `${address}:${String(row['AgcDestinationPort'] ?? '')}` : '';
}

/** UUIDs compare without dashes and case (the API returns hex, the session a dashed form). */
export function sameUUID(a: unknown, b: unknown): boolean {
  const normalize = (value: unknown) =>
    String(value ?? '')
      .replace(/-/g, '')
      .toLowerCase();
  return normalize(a) !== '' && normalize(a) === normalize(b);
}

/** Facts the gateway read in an access test (`AgcTestFacts`, a JSON object), as key/value rows. */
export function testFactDetails(row: ConfigurableCrudRecord): DataViewerDetail[] {
  let facts: unknown = row['AgcTestFacts'];
  if (typeof facts === 'string') {
    const raw = facts;
    try {
      facts = JSON.parse(raw);
    } catch {
      return raw.trim() ? [{ label: 'network.accessTest.facts', value: raw, wide: true }] : [];
    }
  }
  if (!facts || typeof facts !== 'object' || Array.isArray(facts)) return [];
  return Object.entries(facts as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      label: key,
      value: typeof value === 'object' ? JSON.stringify(value) : String(value),
      monospace: true,
    }));
}

function factsSection(row: ConfigurableCrudRecord): DataViewerSection[] {
  const details = testFactDetails(row);
  return details.length ? [{ title: 'network.accessTest.facts', details }] : [];
}

export type ConnectionActions = {
  /** Only the user who opened a connection may close it (the API refuses others). */
  currentUserUUID: () => string;
  canConsole: boolean;
  canReadRecordings: boolean;
  showConnection: (row: ConfigurableCrudRecord) => Promise<void>;
  showRecording: (row: ConfigurableCrudRecord) => Promise<void>;
};

/** Timeline of one connection (redacted command lines, verdicts, confirmations, host key). */
export function connectionEventsConfig(
  base: string,
  connectionUUID: string,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${base}/connections/${connectionUUID}/events`,
    uuidField: 'AgeUUID',
    pageTitle: 'network.connection.events',
    pageDescription: 'network.connection.eventsDescription',
    emptyLabel: 'network.connection.noEvents',
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusFilter: false,
    fields: [],
    columns: [
      { id: 'seq', label: 'network.connection.seq', field: 'AgeSeq', kind: 'number' },
      { id: 'at', label: 'Date', field: 'AgeAt', kind: 'datetime' },
      optionColumn({ id: 'kind', label: 'Type', field: 'AgeKind' }, EVENT_KIND_OPTIONS),
      {
        id: 'command',
        label: 'network.connection.commandLine',
        field: 'AgeCommandLine',
        width: 'xl',
      },
      optionColumn(
        { id: 'class', label: 'network.console.commandClass', field: 'AgeClass' },
        EVENT_CLASS_OPTIONS,
      ),
      optionColumn(
        { id: 'verdict', label: 'network.connection.verdictLabel', field: 'AgeVerdict' },
        EVENT_VERDICT_OPTIONS,
      ),
      { id: 'detail', label: 'network.connection.detail', field: 'AgeDetail', optional: true },
    ],
  });
}

/** Console connections of a device, newest first (history). */
export function connectionHistoryConfig(
  base: string,
  deviceUUID: string,
  actions: ConnectionActions,
): ConfigurableCrudConfig {
  return defineCrud({
    endpoint: `${base}/connections`,
    listQuery: { deviceUUID },
    uuidField: 'AgcUUID',
    pageTitle: 'network.connection.history',
    pageDescription: 'network.connection.historyDescription',
    emptyLabel: 'network.connection.noConnections',
    serverSidePagination: true,
    initialPageSize: 50,
    canCreate: false,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    statusMode: 'string',
    statusOptions: CONNECTION_STATE_OPTIONS,
    // The API filters by `state` (the generic Status filter would send `status`).
    statusFilter: false,
    listFilters: [
      {
        key: 'state',
        label: 'Status',
        paramKey: 'state',
        type: 'select',
        span: 1,
        options: [{ value: '', label: 'All' }, ...CONNECTION_STATE_OPTIONS],
        translateOptions: true,
      },
    ],
    fields: [],
    columns: [
      { id: 'date', label: 'Date', field: 'AgcDateCreated', kind: 'datetime' },
      { id: 'actor', label: 'network.connection.actor', field: 'ActorName' },
      optionColumn(
        { id: 'purpose', label: 'Type', field: 'AgcPurpose' },
        CONNECTION_PURPOSE_OPTIONS,
      ),
      optionColumn(
        {
          id: 'method',
          label: 'network.connection.methodLabel',
          field: 'AgcMethod',
          optional: true,
        },
        CONNECTION_METHOD_OPTIONS,
      ),
      {
        id: 'state',
        label: 'Status',
        field: 'AgcState',
        kind: 'status',
        options: CONNECTION_STATE_OPTIONS,
        chipClass: (value) => stateChip(value),
      },
      optionColumn(
        { id: 'hostKey', label: 'network.hostKey', field: 'AgcHostKeyResult' },
        HOST_KEY_RESULT_OPTIONS,
      ),
      {
        id: 'destination',
        label: 'network.connection.destination',
        field: 'AgcDestinationAddress',
        optional: true,
        value: (row) => destination(row),
      },
      { id: 'gateway', label: 'network.connection.gateway', field: 'GatewayKey', optional: true },
      {
        id: 'bytes',
        label: 'network.connection.bytes',
        field: 'AgcBytesOut',
        optional: true,
        value: (row) => bytesText(row),
      },
      { id: 'events', label: 'network.connection.events', field: 'EventCount', kind: 'number' },
      {
        id: 'ended',
        label: 'network.connection.endedAt',
        field: 'AgcEndedAt',
        kind: 'datetime',
        optional: true,
      },
    ],
    rowActions: [
      {
        key: 'details',
        label: 'network.connection.details',
        icon: 'info',
        run: (row) => actions.showConnection(row),
      },
      {
        key: 'events',
        label: 'network.connection.events',
        icon: 'list_alt',
        visible: () => actions.canReadRecordings,
        collection: (row) => connectionEventsConfig(base, String(row['AgcUUID'])),
      },
      {
        key: 'recording',
        label: 'network.connection.recording',
        icon: 'play_circle',
        visible: () => actions.canReadRecordings,
        disabledReason: (row) =>
          Number(row['RecordingAvailable'] ?? 0) === 1 ? null : 'network.connection.noRecording',
        run: (row) => actions.showRecording(row),
      },
      {
        key: 'close',
        label: 'network.connection.close',
        icon: 'link_off',
        visible: (row) =>
          actions.canConsole &&
          LIVE_STATES.includes(String(row['AgcState'])) &&
          sameUUID(row['AgcActorUUID'], actions.currentUserUUID()),
        request: {
          method: 'delete',
          endpoint: (row) => `${base}/connections/${String(row['AgcUUID'])}`,
          successMessage: 'network.connection.closed',
          confirm: {
            title: 'network.connection.close',
            message: 'network.connection.closeMessage',
            confirmLabel: 'network.connection.close',
          },
        },
      },
    ],
  });
}

type ConnectionEnvelope = { data?: ConfigurableCrudRecord };
type EventsEnvelope = { data?: { items?: ConfigurableCrudRecord[] } };
type RecordingEnvelope = {
  data?: {
    parts?: { part: number; url: string }[];
    bytes?: number;
    finalizedAt?: string | null;
    expiresAt?: string | null;
    urlExpiresInSeconds?: number;
  };
};

export type ConnectionViewerDeps = {
  api: ApiService;
  dialog: MatDialog;
  base: string;
  canReadRecordings: boolean;
};

function tone(state: string): DataViewerTone {
  if (state === 'closed' || state === 'open') return 'success';
  if (state === 'failed' || state === 'blocked') return 'danger';
  return 'info';
}

function connectionDetails(row: ConfigurableCrudRecord): DataViewerDetail[] {
  const label = (options: readonly ConfigurableCrudOption[], value: unknown) =>
    optionLabel(options, value) || String(value ?? '');
  return [
    { label: 'network.connection.device', value: row['DeviceName'] },
    { label: 'Type', value: label(CONNECTION_PURPOSE_OPTIONS, row['AgcPurpose']), translate: true },
    {
      label: 'network.connection.methodLabel',
      value: label(CONNECTION_METHOD_OPTIONS, row['AgcMethod']),
      translate: true,
    },
    { label: 'network.connection.destination', value: destination(row), monospace: true },
    { label: 'network.connection.gateway', value: row['GatewayKey'], monospace: true },
    { label: 'network.connection.actor', value: row['ActorName'] },
    {
      label: 'network.hostKey',
      value: row['AgcHostKeyResult'] ? label(HOST_KEY_RESULT_OPTIONS, row['AgcHostKeyResult']) : '',
      translate: true,
    },
    {
      label: 'network.connection.fingerprint',
      value: [row['AgcHostKeyAlgorithm'], row['AgcHostKeyFingerprint']].filter(Boolean).join(' '),
      monospace: true,
      wide: true,
    },
    {
      label: 'network.connection.blockReasonLabel',
      value: row['AgcBlockReason'] ? label(BLOCK_REASON_OPTIONS, row['AgcBlockReason']) : '',
      translate: true,
      wide: true,
    },
    { label: 'network.connection.errorCode', value: row['AgcErrorCode'], monospace: true },
    { label: 'network.connection.closeReason', value: row['AgcCloseReason'], monospace: true },
    { label: 'network.connection.bytes', value: bytesText(row) },
    { label: 'Date', value: row['AgcDateCreated'], kind: 'datetime' },
    { label: 'network.connection.startedAt', value: row['AgcStartedAt'], kind: 'datetime' },
    { label: 'network.connection.endedAt', value: row['AgcEndedAt'], kind: 'datetime' },
  ];
}

async function eventsSection(
  deps: ConnectionViewerDeps,
  connectionUUID: string,
): Promise<DataViewerSection[]> {
  if (!deps.canReadRecordings) return [];
  const response = await deps.api.get<EventsEnvelope>(
    `${deps.base}/connections/${connectionUUID}/events?limit=200`,
  );
  const rows = (response?.data?.items ?? []).map((event) => ({
    at: event['AgeAt'],
    kind: optionLabel(EVENT_KIND_OPTIONS, event['AgeKind']) || String(event['AgeKind'] ?? ''),
    line: event['AgeCommandLine'] ?? '',
    detail: event['AgeDetail'] ?? '',
  }));
  return [
    {
      title: 'network.connection.events',
      table: {
        columns: [
          { key: 'at', label: 'Date', kind: 'datetime' },
          { key: 'kind', label: 'Type', translate: true },
          { key: 'line', label: 'network.connection.commandLine', monospace: true },
          { key: 'detail', label: 'network.connection.detail', monospace: true },
        ],
        rows,
        emptyLabel: 'network.connection.noEvents',
      },
    },
  ];
}

/** Details and, with recordings permission, the timeline of a connection. */
export async function showConnection(deps: ConnectionViewerDeps, row: ConfigurableCrudRecord) {
  const uuid = String(row['AgcUUID'] ?? '');
  const sections = [...factsSection(row), ...(await eventsSection(deps, uuid))];
  const state = String(row['AgcState'] ?? '');
  openDataViewerDialog(deps.dialog, {
    title: 'network.connection.details',
    description: 'network.connection.detailsDescription',
    status: {
      value: optionLabel(CONNECTION_STATE_OPTIONS, state) || state,
      tone: tone(state),
    },
    details: connectionDetails(row),
    sections,
  });
}

/** Signed part URLs of a recording (asciicast v2), used as the API returned them. */
export async function showRecording(deps: ConnectionViewerDeps, row: ConfigurableCrudRecord) {
  const uuid = String(row['AgcUUID'] ?? '');
  const response = await deps.api.get<RecordingEnvelope>(
    `${deps.base}/connections/${uuid}/recording`,
  );
  const data = response?.data ?? {};
  openDataViewerDialog(deps.dialog, {
    title: 'network.connection.recording',
    description: 'network.connection.recordingDescription',
    details: [
      { label: 'network.connection.device', value: row['DeviceName'] },
      {
        label: 'network.connection.recordingSize',
        value: `${Math.round((data.bytes ?? 0) / 1024)} KiB`,
      },
      { label: 'network.connection.recordingKeptUntil', value: data.expiresAt, kind: 'datetime' },
    ],
    sections: [
      {
        title: 'network.connection.recordingParts',
        table: {
          columns: [
            { key: 'part', label: 'network.connection.part' },
            {
              key: 'url',
              label: 'network.connection.recording',
              kind: 'download',
              filenameKey: 'filename',
              actionLabel: 'Download',
            },
          ],
          rows: (data.parts ?? []).map((part) => ({
            part: part.part + 1,
            url: part.url,
            filename: `console-${uuid}.part-${part.part + 1}.cast`,
          })),
          emptyLabel: 'network.connection.noRecording',
        },
      },
    ],
  });
}

/** Seconds the App follows an access test before showing what it has. */
export const ACCESS_TEST_WAIT_SECONDS = 60;
const ACCESS_TEST_POLL_MS = 1500;

/**
 * "Testar acesso": the gateway connects, checks the pinned host key or API-SSL certificate, logs
 * in, reads the facts and finishes; the App follows the connection until it ends.
 */
export async function runAccessTest(
  deps: ConnectionViewerDeps,
  deviceUUID: string,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<ConfigurableCrudRecord | null> {
  const opened = await deps.api.post<{ data?: { connectionUUID?: string } }>(
    `${deps.base}/devices/${deviceUUID}/access-test`,
    {},
  );
  const uuid = opened?.data?.connectionUUID;
  if (!uuid) return null;
  const deadline = Date.now() + ACCESS_TEST_WAIT_SECONDS * 1000;
  let row: ConfigurableCrudRecord | null = null;
  do {
    await wait(ACCESS_TEST_POLL_MS);
    const response = await deps.api.get<ConnectionEnvelope>(`${deps.base}/connections/${uuid}`, {
      silent: true,
    });
    row = response?.data ?? row;
  } while (!FINAL_STATES.includes(String(row?.['AgcState'] ?? '')) && Date.now() < deadline);
  return row;
}

export async function showAccessTestResult(
  deps: ConnectionViewerDeps,
  row: ConfigurableCrudRecord,
  translate: Translate,
) {
  const state = String(row['AgcState'] ?? '');
  const finished = FINAL_STATES.includes(state);
  const succeeded = state === 'closed' && !row['AgcErrorCode'];
  const sections = [
    ...factsSection(row),
    ...(await eventsSection(deps, String(row['AgcUUID'] ?? ''))),
  ];
  openDataViewerDialog(deps.dialog, {
    title: 'network.accessTest.title',
    description: finished
      ? succeeded
        ? 'network.accessTest.succeeded'
        : 'network.accessTest.failed'
      : 'network.accessTest.stillRunning',
    status: {
      value: translate(optionLabel(CONNECTION_STATE_OPTIONS, state) || state),
      tone: finished ? (succeeded ? 'success' : 'danger') : 'info',
    },
    details: connectionDetails(row),
    sections,
  });
}
