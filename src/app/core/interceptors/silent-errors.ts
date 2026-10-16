import { HttpContext, HttpContextToken } from '@angular/common/http';

/**
 * Background reads (menu badges, counters) set this so a failure never shows an error toast;
 * session expiry (401) is still handled globally.
 */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export function silentErrorsContext(): HttpContext {
  return new HttpContext().set(SILENT_ERRORS, true);
}
