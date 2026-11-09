/** Datetime-local input is an instant in the operator browser's timezone. */
export function capacityExpiryInstant(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!parts) return undefined;
  const [year, month, day, hour, minute, second] = parts.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  )
    return undefined;
  return date.toISOString();
}
