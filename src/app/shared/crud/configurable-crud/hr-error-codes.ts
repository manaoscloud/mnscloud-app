/** Stable API codes of the HR employment, location and location scope rules, and their texts. */
const HR_ERROR_TEXTS: Record<string, string> = {
  HR_LOCATION_SCOPE_EXPORT_FORBIDDEN:
    'AFD/AEJ export is not available for operators limited to locations.',
  REGISTRY_LOCATION_IN_USE:
    'The location is in use by employments or access scopes and cannot be changed this way.',
  HR_EMPLOYMENT_PUNCHES_OUTSIDE:
    'The employment has punches outside the new dates or company. Adjust the dates so they stay covered.',
  HR_LOCATION_SCOPE_INVALID:
    'Some of the chosen locations do not belong to the companies of this account.',
};

/** Code of an API error (`{ error, code }` body), or '' when there is none. */
export function apiErrorCode(error: unknown): string {
  const body = (error as { error?: { code?: unknown } } | null)?.error;
  return typeof body?.code === 'string' ? body.code : '';
}

/** Translation key of a known HR error code, or '' for any other error. */
export function hrErrorText(error: unknown | string): string {
  const code = typeof error === 'string' ? error : apiErrorCode(error);
  return HR_ERROR_TEXTS[code] ?? '';
}
