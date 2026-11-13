import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from './configurable-crud-page-base';

/**
 * Optional location scope of a resale account member or Customer Portal grant (HR accounts): the
 * person sees only the employees assigned to the chosen locations; none chosen means the whole
 * account. The API takes `locationUUIDs` (absent keeps the list, `[]` clears it) and returns
 * `LocationUUIDs`.
 */
export const LOCATION_SCOPE_FIELD: ConfigurableCrudField = {
  key: 'locationUUIDs',
  source: 'LocationUUIDs',
  payloadKey: 'locationUUIDs',
  label: 'accountScope.locations',
  help: 'accountScope.locationsHelp',
  type: 'search-select',
  multiple: true,
  breakBefore: true,
  quickCreate: false,
  quickCreateExemptReason: 'Locations are managed in Registry > Locations.',
  remoteLookup: {
    endpoint: 'registry/locations',
    uuidField: 'LocationUUID',
    labelField: 'Name',
  },
  fromRecord: (value) => locationUuids(value),
};

export function locationUuids(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** List column: how many locations limit the person, or the whole account. */
export const LOCATION_SCOPE_COLUMN: ConfigurableCrudColumn = {
  id: 'locations',
  label: 'accountScope.locations',
  field: 'LocationUUIDs',
  value: (row: ConfigurableCrudRecord, t: (key: string) => string) => {
    const count = locationUuids(row['LocationUUIDs']).length;
    return count ? `${count} ${t(count === 1 ? 'location' : 'locations')}` : t('Whole account');
  },
};
