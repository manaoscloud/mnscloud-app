import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

function isExternalRequest(url: string) {
  if (!/^https?:\/\//i.test(url)) return false;
  if (typeof window === 'undefined') return true;
  try {
    return new URL(url).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function cookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

function isMutatingRequest(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}

function valueAsString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return null;
}

function moduleLabelKey(moduleCode: string | null): string | null {
  if (!moduleCode) return null;
  return `commercial.module.${moduleCode}`;
}

function entitlementErrorMessage(error: HttpErrorResponse): string | null {
  const body = error.error;
  if (!body || typeof body !== 'object') return null;

  const code = valueAsString(body.code);
  const decision = valueAsString(body.decision);
  const entitlementCode =
    valueAsString(body.requiredEntitlement) ?? valueAsString(body.entitlementCode);

  if (
    error.status !== 402 &&
    code !== 'COMMERCIAL_ENTITLEMENT_REQUIRED' &&
    !entitlementCode &&
    !decision?.startsWith('DENIED_')
  ) {
    return null;
  }

  const requiredModule = valueAsString(body.requiredModule) ?? valueAsString(body.module);
  const moduleKey = moduleLabelKey(requiredModule);
  const moduleLabel = moduleKey ? `i18n:${moduleKey}` : requiredModule || entitlementCode || '-';

  if (decision === 'DENIED_POLICY_MISSING') {
    return `commercial.entitlement.policyMissing|module=${moduleLabel}`;
  }

  if (decision === 'DENIED_TENANT_REQUIRED') {
    return `commercial.entitlement.tenantRequired|module=${moduleLabel}`;
  }

  if (entitlementCode) {
    return `commercial.entitlement.required|module=${moduleLabel}|entitlement=${entitlementCode}`;
  }

  return `commercial.entitlement.requiredModule|module=${moduleLabel}`;
}

function parseSnackParams(message: string): { key: string; params?: Record<string, unknown> } {
  const [key, ...parts] = message.split('|');
  if (parts.length === 0) return { key: message };
  const params: Record<string, unknown> = {};
  for (const part of parts) {
    const [name, ...valueParts] = part.split('=');
    if (!name) continue;
    let value = valueParts.join('=');
    params[name] = value;
  }
  return { key, params };
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (isExternalRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const snack = inject(SnackbarService);

  const csrfToken = isMutatingRequest(req.method) ? cookieValue('mnscloud_csrf') : null;
  const bootstrapToken = auth.sessionBootstrapToken();
  const setHeaders: Record<string, string> = {};
  if (csrfToken) setHeaders['X-CSRF-Token'] = csrfToken;
  if (bootstrapToken && !req.headers.has('Authorization')) {
    setHeaders['Authorization'] = `Bearer ${bootstrapToken}`;
  }

  const authReq = req.clone({
    withCredentials: true,
    ...(Object.keys(setHeaders).length ? { setHeaders } : {}),
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Offline / erro de rede
      if (error.status === 0) {
        snack.error('You appear to be offline. Some actions may not be saved.');
        return throwError(() => error);
      }

      // Sessão expirada / não autorizado
      if (error.status === 401) {
        if (!auth.isLoggedIn()) {
          return throwError(() => error);
        }
        auth.expireSession();
        snack.error('Your session has expired. Please sign in again.');
        return throwError(() => error);
      }

      // Outros erros (422, 400, 500 etc.)
      const commercialMessage = entitlementErrorMessage(error);
      const rawMessage =
        (error.error && (error.error.error || error.error.message)) ||
        error.message ||
        'Unexpected error occurred.';
      let apiMessage = commercialMessage ?? 'Unexpected error occurred.';
      if (!commercialMessage && typeof rawMessage === 'string') {
        apiMessage = rawMessage;
      } else if (!commercialMessage && rawMessage !== null && rawMessage !== undefined) {
        try {
          apiMessage = JSON.stringify(rawMessage);
        } catch {
          apiMessage = String(rawMessage);
        }
      }
      if (error.status === 429) {
        apiMessage = 'Too many requests. Please wait a moment and try again.';
      }

      const parsedMessage = parseSnackParams(apiMessage);
      snack.error(parsedMessage.key, 3000, parsedMessage.params);

      return throwError(() => error);
    }),
  );
};
