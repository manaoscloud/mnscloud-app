/** Local calendar controls are combined into one explicit UTC instant at the API boundary. */
export function crmLocalDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export const crmLocalDate = (value: unknown): string => crmLocalDateTime(value).slice(0, 10);
export const crmLocalTime = (value: unknown): string => crmLocalDateTime(value).slice(11, 16);

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
  for (const key of dates) {
    const date = result[key];
    const time = result[key + 'Time'];
    delete result[key + 'Time'];
    if (!date && !time) {
      result[key] = null;
      continue;
    }
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(date)) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))
    ) {
      throw new Error('CRM_INVALID_DATE');
    }
    const local = `${date}T${time}`;
    const instant = new Date(local);
    if (!Number.isFinite(instant.getTime()) || crmLocalDateTime(instant.toISOString()) !== local) {
      throw new Error('CRM_INVALID_DATE');
    }
    result[key] = instant.toISOString();
  }
  for (const key of Object.keys(result)) {
    if (key.endsWith('Currency') || key === 'currency') {
      result[key] =
        String(result[key] ?? '')
          .trim()
          .toUpperCase() || null;
    }
  }
  return result;
}
