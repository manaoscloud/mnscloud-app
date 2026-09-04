export const ENV_STORAGE_KEY = 'mc_current_env';

export type EnvironmentAccess = {
  EnvironmentUUID?: string | null;
  EnvironmentName?: string | null;
  RoleCode?: string | null;
  RoleName?: string | null;
  Status?: number | string | null;
  IsDefault?: number | string | null;
  Master?: number | string | null;
};

export type NormalizedEnvironmentAccess = {
  EnvironmentUUID: string;
  EnvironmentName: string;
  RoleCode: string;
  RoleName: string;
  Status: number;
  IsDefault: number;
  Master: number;
};

type EnvironmentAccessResponse = {
  data?: {
    access?: unknown[];
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COMPACT_UUID_RE = /^[0-9a-f]{32}$/i;

export function normalizeEnvironmentUUID(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  if (!COMPACT_UUID_RE.test(trimmed)) return null;

  const compact = trimmed.toLowerCase();
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(
    16,
    20,
  )}-${compact.slice(20)}`;
}

export function readStoredEnvironmentUUID(): string | null {
  if (typeof localStorage === 'undefined') return null;

  const raw = localStorage.getItem(ENV_STORAGE_KEY);
  const normalized = normalizeEnvironmentUUID(raw);

  if (raw && !normalized) {
    localStorage.removeItem(ENV_STORAGE_KEY);
  }

  return normalized;
}

export function writeStoredEnvironmentUUID(value: string | null | undefined): string | null {
  if (typeof localStorage === 'undefined') return normalizeEnvironmentUUID(value);

  const normalized = normalizeEnvironmentUUID(value);
  if (normalized) {
    localStorage.setItem(ENV_STORAGE_KEY, normalized);
  } else {
    localStorage.removeItem(ENV_STORAGE_KEY);
  }

  return normalized;
}

export function extractEnvironmentAccess(response: EnvironmentAccessResponse | null | undefined) {
  const access = Array.isArray(response?.data?.access) ? response.data.access : [];

  return access
    .map((item) => {
      const raw = item as EnvironmentAccess;
      const EnvironmentUUID = normalizeEnvironmentUUID(raw.EnvironmentUUID);
      if (!EnvironmentUUID) return null;

      return {
        ...raw,
        EnvironmentUUID,
        EnvironmentName: raw.EnvironmentName ?? '',
        RoleCode: raw.RoleCode ?? '',
        RoleName: raw.RoleName ?? raw.RoleCode ?? '',
        Status: Number(raw.Status ?? 0),
        IsDefault: Number(raw.IsDefault ?? 0),
        Master: Number(raw.Master ?? 0),
      };
    })
    .filter((item): item is NormalizedEnvironmentAccess => !!item);
}

export function resolveSelectedEnvironmentUUID(
  access: Pick<EnvironmentAccess, 'EnvironmentUUID' | 'IsDefault'>[],
  preferred?: string | null,
): string | null {
  const normalizedPreferred = normalizeEnvironmentUUID(preferred);
  const byUuid = (uuid: string | null) =>
    uuid ? access.find((item) => item.EnvironmentUUID?.toLowerCase() === uuid.toLowerCase()) : null;

  return (
    byUuid(normalizedPreferred)?.EnvironmentUUID ??
    access.find((item) => Number(item.IsDefault ?? 0) === 1)?.EnvironmentUUID ??
    access[0]?.EnvironmentUUID ??
    null
  );
}
