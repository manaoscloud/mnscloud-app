/** Callback endpoints return the full URL; legacy string/subclass bases still append the UUID. */
export function crudUpdateUrl<T>(
  endpoint: string | ((row: T) => string) | undefined,
  row: T,
  legacyBase: () => string,
  recordUUID: () => string,
): string {
  return typeof endpoint === 'function' ? endpoint(row) : `${legacyBase()}/${recordUUID()}`;
}
