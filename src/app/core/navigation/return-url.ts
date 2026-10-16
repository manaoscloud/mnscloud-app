import { Router, UrlTree } from '@angular/router';

/** Query parameter that carries the page to open after sign-in (e-mail deep links). */
export const RETURN_URL_PARAM = 'returnUrl';

const MAX_RETURN_URL = 2000;

/**
 * Accepts only an App-internal path: one leading slash, no scheme, host, backslash or control
 * characters, never the sign-in page itself. Anything else is dropped (no open redirect).
 */
export function safeReturnUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const url = value.trim();
  if (!url || url.length > MAX_RETURN_URL) return null;
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) return null;
  if (/[\u0000-\u001f\u007f]/.test(url) || /^\/[a-z][a-z0-9+.-]*:/i.test(url)) return null;
  if (/^\/signin(?:[/?#]|$)/.test(url)) return null;
  return url;
}

/** Sign-in page that returns to `url` (when safe) after a successful login. */
export function signinUrlTree(router: Router, url?: string | null): UrlTree {
  const returnUrl = safeReturnUrl(url);
  return router.createUrlTree(
    ['/signin'],
    returnUrl ? { queryParams: { [RETURN_URL_PARAM]: returnUrl } } : {},
  );
}
