/** Canonical record UUIDs, with or without dashes (for example `VpeUUID`). */
const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
/** Visible prefix of a UUID line; the full value stays in the tooltip and the copy action. */
const UUID_SHORT_LENGTH = 8;

export function isRecordUUID(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

/** Short one-line label for a record UUID; any other value is returned unchanged. */
export function shortRecordUUID(value: string): string {
  const trimmed = value.trim();
  return isRecordUUID(trimmed) ? `${trimmed.slice(0, UUID_SHORT_LENGTH)}…` : value;
}
