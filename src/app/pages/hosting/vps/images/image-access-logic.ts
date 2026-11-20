import type {
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import type {
  HostingVpsImageAccessPayload,
  HostingVpsImagePublication,
  HostingVpsImageVisibility,
} from '../vps.types';

export const IMAGES_ENDPOINT = 'system/hosting/vps/images';

export const IMAGE_VISIBILITY_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'platform', label: 'Platform only' },
  { value: 'public', label: 'All customers' },
  { value: 'selected', label: 'Selected environments' },
];

export const IMAGE_PUBLICATION_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'retired', label: 'Retired' },
];

export const IMAGE_SYNC_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'ready', label: 'Synchronized' },
  { value: 'pending', label: 'Pending' },
  { value: 'drift', label: 'Drift detected' },
  { value: 'failed', label: 'Failed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'unmanaged', label: 'Observation only' },
];

export const IMAGE_REPLICA_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'ready', label: 'Ready' },
  { value: 'copying', label: 'Copying' },
  { value: 'pending', label: 'Pending' },
  { value: 'missing', label: 'Missing' },
  { value: 'outdated', label: 'Outdated' },
  { value: 'offline', label: 'Offline' },
  { value: 'drift', label: 'Drift detected' },
  { value: 'failed', label: 'Failed' },
];

export const IMAGE_OPERATION_STATE_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 'pending', label: 'operations.state.queued' },
  { value: 'queued', label: 'operations.state.queued' },
  { value: 'running', label: 'operations.state.running' },
  { value: 'waiting_retry', label: 'operations.state.waitingRetry' },
  { value: 'succeeded', label: 'operations.state.succeeded' },
  { value: 'blocked', label: 'operations.state.blocked' },
  { value: 'failed', label: 'operations.state.failed' },
  { value: 'cancelled', label: 'operations.state.cancelled' },
  { value: 'superseded', label: 'Superseded' },
];

export const VPS_IMAGE_ERROR_TEXTS: Readonly<Record<string, string>> = {
  VPS_IMAGE_PAYLOAD_INVALID: 'Review the image access fields and try again.',
  VPS_IMAGE_GRANT_INVALID: 'Select valid active customer environments.',
  VPS_IMAGE_PUBLICATION_INVALID: 'Review the image publication and selected build.',
  VPS_IMAGE_VERSION_MISMATCH: 'Review the image publication and selected build.',
  VPS_IMAGE_PROVIDER_UNAVAILABLE: 'The image provider is unavailable.',
  VPS_IMAGE_RETRY_EXHAUSTED: 'This operation has reached its retry limit.',
  VPS_IMAGE_PROJECTION_READ_ONLY:
    'Physical visibility tag changes are read-only outside production.',
  VPS_IMAGE_INTERNAL_ONLY: 'Internal platform images cannot be shared with customer environments.',
  VPS_IMAGE_SELECTED_REQUIRES_GRANT:
    'Selected environments access requires at least one authorized environment.',
  VPS_IMAGE_REVISION_CONFLICT:
    'Image access changed since the dialog was opened. Reload and review the current policy.',
  VPS_IMAGE_IDEMPOTENCY_CONFLICT:
    'An access update with different parameters is already registered for this request key.',
  VPS_IMAGE_FLEET_BARRIER_BLOCKED:
    'All API serving nodes must report the image policy capability before changing access.',
  VPS_IMAGE_PROVIDER_NOT_ACTIVE:
    'Provider image policy is still in observation mode and cannot write access yet.',
  VPS_IMAGE_PUBLISH_FORBIDDEN: 'You do not have permission to change image publication.',
  VPS_IMAGE_ACCESS_FORBIDDEN: 'You do not have permission to manage image access.',
  VPS_IMAGE_OPERATION_SUPERSEDED:
    'This operation belongs to an older policy revision and cannot be retried.',
};

const VPS_IMAGE_ERROR_ALIASES: Readonly<Record<string, string>> = {
  VPS_IMAGE_SELECTED_EMPTY: 'VPS_IMAGE_SELECTED_REQUIRES_GRANT',
  VPS_IMAGE_FLEET_BARRIER_REQUIRED: 'VPS_IMAGE_FLEET_BARRIER_BLOCKED',
  VPS_IMAGE_ACTIVATION_NOT_READY: 'VPS_IMAGE_PROVIDER_NOT_ACTIVE',
  VPS_IMAGE_OBSERVATION_REQUIRED: 'VPS_IMAGE_PROVIDER_NOT_ACTIVE',
  VPS_IMAGE_ADMIN_REQUIRED: 'VPS_IMAGE_ACCESS_FORBIDDEN',
  VPS_IMAGE_AUTHORITY_REVOKED: 'VPS_IMAGE_ACCESS_FORBIDDEN',
  VPS_IMAGE_RETRY_CONFLICT: 'VPS_IMAGE_OPERATION_SUPERSEDED',
};

export function vpsImageErrorKey(error: unknown): string | null {
  const body = (error as { error?: { code?: unknown; errorCode?: unknown } } | null)?.error;
  const raw =
    typeof body?.code === 'string'
      ? body.code
      : typeof body?.errorCode === 'string'
        ? body.errorCode
        : typeof (error as { code?: unknown } | null)?.code === 'string'
          ? String((error as { code?: unknown }).code)
          : '';
  const code = raw.trim().toUpperCase();
  return VPS_IMAGE_ERROR_TEXTS[VPS_IMAGE_ERROR_ALIASES[code] ?? code] ?? null;
}

export function normalizeUuidArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    const uuid = String(entry ?? '').trim();
    if (!isImageUuid(uuid) || seen.has(uuid)) continue;
    seen.add(uuid);
    result.push(uuid);
  }
  return result;
}

export function isTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

export function canManageImageRow(row: ConfigurableCrudRecord): boolean {
  return isTruthy(row['canManageAccess']);
}

export function canPublishImageRow(row: ConfigurableCrudRecord): boolean {
  return isTruthy(row['canPublish']);
}

export function buildImageAccessPayload(
  values: ConfigurableCrudRecord,
  current: ConfigurableCrudRecord | null,
): HostingVpsImageAccessPayload {
  const visibility = (String(values['visibility'] ?? current?.['HimVisibility'] ?? 'platform') ||
    'platform') as HostingVpsImageVisibility;
  const isSelected = visibility === 'selected';
  const addSet = new Set(isSelected ? normalizeUuidArray(values['addEnvironmentUUIDs']) : []);
  const removeList = isSelected
    ? normalizeUuidArray(values['removeEnvironmentUUIDs']).filter((uuid) => !addSet.has(uuid))
    : [];
  const payload: HostingVpsImageAccessPayload = {
    revision: String(values['revision'] ?? current?.['HimRevision'] ?? ''),
    visibility,
    addEnvironmentUUIDs: [...addSet],
    removeEnvironmentUUIDs: removeList,
    reason: String(values['reason'] ?? '').trim(),
  };
  const publication = String(values['publication'] ?? '').trim();
  const currentPublication = String(current?.['HimPublication'] ?? '').trim();
  if (
    (publication === 'draft' || publication === 'published' || publication === 'retired') &&
    (!currentPublication || publication !== currentPublication || isTruthy(current?.['canPublish']))
  ) {
    payload.publication = publication as HostingVpsImagePublication;
  }
  const versionUUID = String(values['versionUUID'] ?? '').trim();
  if (versionUUID) {
    payload.versionUUID = versionUUID;
  }
  return payload;
}

export function remainingSelectedGrantsCount(
  payload: ConfigurableCrudRecord,
  current: ConfigurableCrudRecord | null,
  fallbackActiveGrantTotal = 0,
): number {
  const built = buildImageAccessPayload(payload, current);
  const existingCount = Number(
    current?.['activeGrantCount'] ?? current?.['grantCount'] ?? fallbackActiveGrantTotal,
  );
  return (
    Math.max(0, existingCount - built.removeEnvironmentUUIDs.length) +
    built.addEnvironmentUUIDs.length
  );
}

export function visibilityLabel(value: unknown): string {
  return (
    IMAGE_VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? 'Platform only'
  );
}

export function publicationLabel(value: unknown): string {
  return IMAGE_PUBLICATION_OPTIONS.find((option) => option.value === value)?.label ?? 'Draft';
}

export function minimumSpecsSummary(row: ConfigurableCrudRecord): string {
  const cpu = Number(row['cpu'] ?? 0);
  const memoryMb = Number(row['memoryMb'] ?? 0);
  const diskGb = Number(row['diskGb'] ?? 0);
  const parts: string[] = [];
  if (cpu > 0) parts.push(`${cpu} vCPU`);
  if (memoryMb > 0) {
    const gb =
      memoryMb >= 1024 && memoryMb % 1024 === 0 ? `${memoryMb / 1024} GB` : `${memoryMb} MB`;
    parts.push(gb);
  }
  if (diskGb > 0) parts.push(`${diskGb} GB`);
  return parts.join(' · ') || '-';
}

export function replicaAvailabilitySummary(row: ConfigurableCrudRecord): string {
  const ready = Number(row['readyReplicas'] ?? 0);
  const total = Number(row['totalReplicas'] ?? 0);
  if (!Number.isFinite(total) || total <= 0) return `${ready}/0`;
  return `${ready}/${total}`;
}

/** Both UUID encodings accepted by the API; never interpolate unvalidated query values. */
export function isImageUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(value)
  );
}

export function imageUuidSegment(value: unknown): string {
  if (!isImageUuid(value)) throw new Error('Invalid identifier.');
  return encodeURIComponent(value);
}
