import { inject } from '@angular/core';

import { hasEffectivePermission } from '../../core/guards/permission.guard';
import { AuthService } from '../../services/auth.service';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudOption,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollectionColumn,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * Network (Rede) module: shared option lists and helpers of the sites and devices pages. Tenant
 * pages call `/network/*`; their platform twins (`/system/network/*`, master only) manage the
 * platform rows. The endpoint comes only from the route scope (app.md "Master pages and tenant
 * data").
 */
export function networkBase(platform: boolean): string {
  return platform ? 'system/network' : 'network';
}

/** Static options whose labels are the `<prefix>.<value>` translation keys. */
function enumOptions(prefix: string, values: readonly string[]): readonly ConfigurableCrudOption[] {
  return values.map((value) => ({ value, label: `${prefix}.${value}` }));
}

export const SITE_KIND_OPTIONS: readonly ConfigurableCrudOption[] = enumOptions(
  'network.siteKind',
  ['internal', 'customer', 'datacenter', 'pop', 'partner_pop', 'office'],
);

/** Platform sites never belong to a customer. */
export const PLATFORM_SITE_KIND_OPTIONS: readonly ConfigurableCrudOption[] =
  SITE_KIND_OPTIONS.filter((option) => option.value !== 'customer');

export const DEVICE_CLASS_OPTIONS: readonly ConfigurableCrudOption[] = enumOptions(
  'network.deviceClass',
  ['router', 'switch', 'olt', 'firewall', 'server', 'hypervisor', 'ap', 'other'],
);

export const NETWORK_PATH_OPTIONS: readonly ConfigurableCrudOption[] = enumOptions('network.path', [
  'public',
  'mgmt_vpn',
  'connector',
]);

export const LIFECYCLE_OPTIONS: readonly ConfigurableCrudOption[] = enumOptions(
  'network.lifecycle',
  ['planned', 'active', 'retired'],
);

export const ACCESS_METHOD_OPTIONS: readonly ConfigurableCrudOption[] = enumOptions(
  'network.method',
  ['ssh', 'routeros_api', 'telnet', 'winrm', 'https_api', 'snmp_ro'],
);

export const YES_NO_OPTIONS: readonly ConfigurableCrudOption[] = [
  { value: 1, label: 'Yes' },
  { value: 0, label: 'No' },
];

/** Default port of each access method (the API answers it in `device-types` too). */
export const ACCESS_DEFAULT_PORTS: Readonly<Record<string, number>> = {
  ssh: 22,
  routeros_api: 8729,
  telnet: 23,
  winrm: 5986,
  https_api: 443,
  snmp_ro: 161,
};

export type NetworkAccessProfile = {
  methods: string[];
  shellDialect?: string;
  safeChange?: string;
  commentField?: string;
  changeLog?: string;
  exportCommand?: string;
};

/** One entry of `GET <base>/device-types`. */
export type NetworkDeviceType = {
  code: string;
  label: string;
  versions: string[];
  automation: string;
  deviceClasses: string[];
  access: NetworkAccessProfile;
  versionAccess?: Record<string, Partial<NetworkAccessProfile>>;
  roles: string[];
};

export type NetworkDeviceTypeCatalog = {
  items?: NetworkDeviceType[];
  accessMethods?: { code: string; defaultPort: number }[];
};

/** Trimmed text of a form value, or null when empty. */
export function formText(value: unknown): string | null {
  return String(value ?? '').trim() || null;
}

/** 0/1 flag of a form value. */
export function formFlag(value: unknown, fallback: 0 | 1): 0 | 1 {
  return Number(value ?? fallback) === 1 ? 1 : 0;
}

/** Text fields of a form, each trimmed or null (PUT replaces them: the whole form is sent). */
export function formTexts(
  values: ConfigurableCrudRecord,
  keys: readonly string[],
): ConfigurableCrudRecord {
  return Object.fromEntries(keys.map((key) => [key, formText(values[key])]));
}

/** Notes, status and the revision of an update, common to every Network record. */
export function recordState(values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  return {
    notes: formText(values['notes']),
    status: formFlag(values['status'], 1),
    ...(values['revision'] ? { revision: String(values['revision']) } : {}),
  };
}

/** Status, hidden revision and Notes tab fields of a record with the given column prefix. */
export function statusField(prefix: string): ConfigurableCrudField {
  return { key: 'status', source: `${prefix}Status`, label: 'Status', type: 'status', span: 1 };
}

export function stateFields(prefix: string): ConfigurableCrudField[] {
  return [
    { key: 'revision', source: `${prefix}Revision`, label: 'Revision', hidden: true },
    {
      key: 'notes',
      source: `${prefix}Notes`,
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ];
}

/** Column showing the translated label of a static option value (list or related collection). */
export function optionColumn<C extends { id: string; field?: string }>(
  column: C,
  options: readonly ConfigurableCrudOption[],
): C & { value: (row: ConfigurableCrudRecord, translate: (key: string) => string) => string } {
  const field = column.field ?? column.id;
  return {
    ...column,
    value: (row, translate) =>
      translate(optionLabel(options, row[field]) || String(row[field] ?? '')),
  };
}

/**
 * Permission check of a Network page; call in an injection context. Platform pages are master
 * only (route guard); tenant actions follow the permissions. UX only: the API authorizes.
 */
export function injectNetworkPermission(platform: boolean): (permission: string) => boolean {
  const auth = inject(AuthService);
  return (permission) =>
    platform || hasEffectivePermission(auth.user()?.permissions ?? [], permission);
}

/**
 * Dialog and message texts of a Network CRUD page (`network.new<Entity>`, ...) and its list
 * defaults. Title and description stay in the page (the app catalog reads them there).
 */
export function crudTexts(
  entity: 'Site' | 'Device',
): Pick<
  ConfigurableCrudConfig,
  | 'createTitle'
  | 'editTitle'
  | 'dialogDescription'
  | 'searchPlaceholder'
  | 'emptyLabel'
  | 'deleteTitle'
  | 'deleteMessage'
  | 'savedMessage'
  | 'deletedMessage'
  | 'deleteFailedMessage'
  | 'serverSidePagination'
  | 'initialPageSize'
> {
  const lower = entity.toLowerCase();
  return {
    createTitle: `network.new${entity}`,
    editTitle: `network.edit${entity}`,
    dialogDescription: `network.${lower}DialogDescription`,
    searchPlaceholder: `network.${lower}Search`,
    emptyLabel: `network.no${entity}s`,
    deleteTitle: `network.delete${entity}`,
    deleteMessage: `network.delete${entity}Message`,
    savedMessage: `network.${lower}Saved`,
    deletedMessage: `network.${lower}Deleted`,
    deleteFailedMessage: `network.${lower}DeleteFailed`,
    serverSidePagination: true,
    initialPageSize: 50,
  };
}

/** Create/edit/delete rights and the revision delete of a Network resource. */
export function crudRights(
  can: (permission: string) => boolean,
  resource: 'sites' | 'devices',
  revisionField: string,
): Partial<ConfigurableCrudConfig> {
  return {
    deletePayload: (row) => ({ revision: row[revisionField] }),
    canCreate: can(`tenant.network.${resource}.write`),
    canEdit: can(`tenant.network.${resource}.write`),
    canDelete: can(`tenant.network.${resource}.delete`),
  };
}

/** Label of a static option value, translated by the caller. */
export function optionLabel(options: readonly ConfigurableCrudOption[], value: unknown): string {
  return options.find((option) => String(option.value) === String(value ?? ''))?.label ?? '';
}

function majorVersion(osVersion: unknown): string | null {
  const match = /^\s*v?(\d+)/i.exec(String(osVersion ?? ''));
  return match ? match[1] : null;
}

/**
 * Access methods a device type accepts, with the differences of the device's major OS version
 * (RouterOS 6 has no REST API). Without a known version every method of the type is offered, as
 * the API accepts. UX only: the API validates the method again.
 */
export function accessMethodsFor(
  type: NetworkDeviceType | undefined,
  osVersion: unknown,
): readonly ConfigurableCrudOption[] {
  if (!type) return ACCESS_METHOD_OPTIONS;
  const major = majorVersion(osVersion);
  const methods = (major && type.versionAccess?.[major]?.methods) || type.access.methods;
  return ACCESS_METHOD_OPTIONS.filter((option) => methods.includes(String(option.value)));
}

/** Choosing a method fills its default port while the port is empty or still a default port. */
export function accessFieldChange(
  key: string,
  value: unknown,
  current: ConfigurableCrudRecord,
): ConfigurableCrudRecord {
  if (key !== 'method') return current;
  const port = String(current['port'] ?? '').trim();
  const isDefault = !port || Object.values(ACCESS_DEFAULT_PORTS).includes(Number(port));
  const next = ACCESS_DEFAULT_PORTS[String(value ?? '')];
  return isDefault && next !== undefined ? { ...current, port: next } : current;
}

/** Access method form (device form tab and the access dialog of devices managed in Hosting). */
export function accessFields(
  methodOptions?: readonly ConfigurableCrudOption[],
): ConfigurableCrudField[] {
  return [
    statusField('Nwe'),
    {
      key: 'method',
      source: 'NweMethod',
      label: 'network.accessMethod',
      type: 'select',
      required: true,
      span: 1,
      ...(methodOptions ? { options: methodOptions } : {}),
      help: 'network.accessMethodHelp',
    },
    {
      key: 'port',
      source: 'NwePort',
      label: 'network.port',
      type: 'number',
      span: 1,
      help: 'network.portHelp',
    },
    {
      key: 'host',
      source: 'NweHost',
      label: 'network.accessHost',
      span: 1,
      help: 'network.accessHostHelp',
    },
    {
      key: 'isPrimary',
      source: 'NweIsPrimary',
      label: 'network.primary',
      type: 'select',
      options: YES_NO_OPTIONS,
      span: 1,
      help: 'network.primaryHelp',
    },
    ...stateFields('Nwe'),
  ];
}

export const ACCESS_INITIAL_VALUES: ConfigurableCrudRecord = {
  status: 1,
  method: 'ssh',
  port: 22,
  host: '',
  isPrimary: 0,
  revision: null,
  notes: '',
};

/** Whole access form: PUT replaces the text fields, so every field is sent. */
export function accessPayload(values: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const port = String(values['port'] ?? '').trim();
  return {
    method: values['method'],
    port: port ? Number(port) : null,
    host: formText(values['host']),
    isPrimary: formFlag(values['isPrimary'], 0),
    ...recordState(values),
  };
}

export const ACCESS_COLUMNS: ConfigurableCrudRelatedCollectionColumn[] = [
  optionColumn(
    { id: 'method', label: 'network.accessMethod', field: 'NweMethod' },
    ACCESS_METHOD_OPTIONS,
  ),
  { id: 'port', label: 'network.port', field: 'NwePort', kind: 'number' },
  { id: 'host', label: 'network.accessHost', field: 'EffectiveHost' },
  {
    id: 'primary',
    label: 'network.primary',
    field: 'NweIsPrimary',
    value: (row, translate) => translate(Number(row['NweIsPrimary']) === 1 ? 'Yes' : 'No'),
  },
  { id: 'status', label: 'Status', field: 'NweStatus', kind: 'status' },
];
