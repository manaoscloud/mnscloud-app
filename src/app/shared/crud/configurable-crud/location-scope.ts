import type { ApiService } from '../../../services/api.service';
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
const LOCATION_SCOPE_BASE: ConfigurableCrudField = {
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

/**
 * The scope field of one HR account: only locations of the companies of the account's workspace
 * are offered, so a pick outside the account is never possible (the API refuses it too).
 */
export function accountLocationScopeField(
  api: ApiService,
  accountUUID: string,
  workspaceUUID: string | null,
): ConfigurableCrudField {
  let companies: Promise<Set<string>> | null = null;
  let allowed = new Set<string>();
  const load = () =>
    (companies ??= api
      .withHrAccount(accountUUID, workspaceUUID)
      .get<{ data?: { items?: ConfigurableCrudRecord[] } }>('hr/companies?limit=500')
      .then((response) => {
        allowed = new Set((response?.data?.items ?? []).map((item) => String(item['RcoUUID'])));
        return allowed;
      })
      .catch((error) => {
        companies = null;
        throw error;
      }));
  return {
    ...LOCATION_SCOPE_BASE,
    remoteLookup: {
      ...LOCATION_SCOPE_BASE.remoteLookup!,
      prepare: async () => void (await load()),
      accept: (item) => allowed.has(String(item['CompanyUUID'] ?? '')),
    },
  };
}

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
