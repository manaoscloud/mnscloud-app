/**
 * Per-browser table view preferences for a CRUD page (row density and visible columns).
 * They are local conveniences only: unreadable or blocked storage falls back to the defaults.
 */
export type CrudDensity = 'comfortable' | 'compact';

export type CrudViewPreferences = {
  density: CrudDensity;
  /** Columns the user hid although they are shown by default. */
  hidden: readonly string[];
  /** Optional columns the user chose to show. */
  shown: readonly string[];
};

type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const DEFAULT_CRUD_VIEW: CrudViewPreferences = {
  density: 'comfortable',
  hidden: [],
  shown: [],
};

const RECORD_ID_SEGMENT =
  /^([0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|\d+)$/i;

/** One key per resource: parent record ids in child collection endpoints are normalized. */
export function crudViewStorageKey(endpoint: string): string {
  const resource = endpoint
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((segment) => (RECORD_ID_SEGMENT.test(segment) ? ':id' : segment))
    .join('/');
  return `mns.crud.view.${resource}`;
}

function idList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && !!item))]
    : [];
}

export function parseCrudViewPreferences(raw: string | null | undefined): CrudViewPreferences {
  if (!raw) return DEFAULT_CRUD_VIEW;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object') return DEFAULT_CRUD_VIEW;
    return {
      density: value['density'] === 'compact' ? 'compact' : 'comfortable',
      hidden: idList(value['hidden']),
      shown: idList(value['shown']),
    };
  } catch {
    return DEFAULT_CRUD_VIEW;
  }
}

export function isCrudColumnVisible(
  preferences: CrudViewPreferences,
  id: string,
  optional: boolean,
): boolean {
  if (preferences.hidden.includes(id)) return false;
  if (preferences.shown.includes(id)) return true;
  return !optional;
}

export function setCrudColumnVisible(
  preferences: CrudViewPreferences,
  id: string,
  optional: boolean,
  visible: boolean,
): CrudViewPreferences {
  const hidden = preferences.hidden.filter((item) => item !== id);
  const shown = preferences.shown.filter((item) => item !== id);
  if (visible && optional) shown.push(id);
  if (!visible && !optional) hidden.push(id);
  return { ...preferences, hidden, shown };
}

export function isDefaultCrudView(preferences: CrudViewPreferences): boolean {
  return (
    preferences.density === DEFAULT_CRUD_VIEW.density &&
    !preferences.hidden.length &&
    !preferences.shown.length
  );
}

function browserStorage(): PreferenceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readCrudViewPreferences(
  key: string,
  storage: PreferenceStorage | null = browserStorage(),
): CrudViewPreferences {
  try {
    return parseCrudViewPreferences(storage?.getItem(key));
  } catch {
    return DEFAULT_CRUD_VIEW;
  }
}

export function writeCrudViewPreferences(
  key: string,
  preferences: CrudViewPreferences,
  storage: PreferenceStorage | null = browserStorage(),
): void {
  try {
    if (isDefaultCrudView(preferences)) storage?.removeItem(key);
    else storage?.setItem(key, JSON.stringify(preferences));
  } catch {
    // Private windows or blocked site data: the view still works for this session.
  }
}
