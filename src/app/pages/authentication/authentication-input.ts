import type {
  ConfigurableCrudField,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
export const AUTHENTICATION_BOOLEAN_OPTIONS = [
  { value: 0, label: 'No' },
  { value: 1, label: 'Yes' },
] as const;
export function authenticationPayload(
  values: ConfigurableCrudRecord,
  editing: boolean,
): ConfigurableCrudRecord {
  const payload = { ...values };
  if (!editing) delete payload['revision'];
  if (editing)
    for (const field of ['secret', 'password'])
      if (payload[field] == null || payload[field] === '') delete payload[field];
  for (const field of [
    'status',
    'revision',
    'published',
    'authLog',
    'authLogRetentionDays',
    'authPort',
    'acctPort',
    'interimInterval',
    'idleTimeout',
    'sessionTimeout',
    'uploadKbps',
    'downloadKbps',
    'burstUploadKbps',
    'burstDownloadKbps',
    'burstThresholdUploadKbps',
    'burstThresholdDownloadKbps',
    'burstTimeSeconds',
    'priority',
    'minUploadKbps',
    'minDownloadKbps',
  ]) {
    if (field in payload && payload[field] != null && payload[field] !== '')
      payload[field] = Number(payload[field]);
  }
  // The date/time picker works in local time; the API expects an explicit UTC timestamp.
  if ('expiresAt' in payload) payload['expiresAt'] = localInputToUtc(payload['expiresAt']);
  return payload;
}

/** `YYYY-MM-DDTHH:mm` from the browser picker (local time) -> `YYYY-MM-DDTHH:mm:ssZ`, or null. */
export function localInputToUtc(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date.toISOString().replace(/\.\d{3}Z$/, 'Z') : text;
}

/** Stored UTC `YYYY-MM-DD HH:mm:ss` -> local `YYYY-MM-DDTHH:mm` for the picker. */
export function utcToLocalInput(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const date = new Date(
    text.replace(' ', 'T') + (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? '' : 'Z'),
  );
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Hidden optimistic-lock revision and the notes tab shared by every authentication record. */
export function authenticationRecordFields(prefix: string): ConfigurableCrudField[] {
  return [
    {
      key: 'revision',
      source: `${prefix}Revision`,
      label: 'Revision',
      type: 'number',
      hidden: true,
    },
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
