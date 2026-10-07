/** Browser datetime-local values become explicit UTC instants at the transport boundary. */
export function crmLocalDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function crmPayload(
  values: Record<string, unknown>,
  editing: boolean,
  revision: string,
  numbers: readonly string[],
  dates: readonly string[],
): Record<string, unknown> {
  const result = { ...values };
  if (!editing) delete result[revision];
  for (const key of numbers)
    if (result[key] !== null && result[key] !== undefined && result[key] !== '')
      result[key] = Number(result[key]);
  for (const key of dates)
    if (result[key]) result[key] = new Date(String(result[key])).toISOString();
  return result;
}
