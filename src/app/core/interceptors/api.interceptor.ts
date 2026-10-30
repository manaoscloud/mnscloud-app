import { registryWorkspaceErrorMessage } from '../../shared/registry/registry-workspace-error';
import { isRuntimeTokenReplaceConfirmationRequired } from '../../shared/install-command-dialog/runtime-install-token';
import { payErrorMessage } from '../../shared/payment/pay-error';
import { billingErrorMessage } from '../../shared/billing/billing-error';
import { Injector, inject } from '@angular/core';
import {
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { catchError, tap, throwError } from 'rxjs';
import { SILENT_ERRORS } from './silent-errors';

import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';
import { ClientDiagnosticsService } from '../../services/client-diagnostics.service';
import { APP_BUILD_INFO } from '../../app-build-info';
import { AppUpdateService } from '../../services/app-update.service';
import { resolveApiBaseUrl } from '../../shared/runtime/app-runtime-config';

/** Client identity sent to the API (versions in use metric). */
export const CLIENT_VERSION_HEADER = 'X-Mns-Client';
/** App version installed on every App node, announced by the API on each response. */
export const APP_VERSION_HEADER = 'X-Mns-App-Version';

function isApiRequest(url: string) {
  return url.startsWith(`${resolveApiBaseUrl()}/`);
}

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

const SUPPORT_REPORT_ENDPOINT = /\/help\/tickets(?:[/?]|$)/;

function requestPath(url: string): string {
  try {
    const parsed = new URL(
      url,
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
    );
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function recordFailure(
  diagnostics: ClientDiagnosticsService,
  req: HttpRequest<unknown>,
  error: HttpErrorResponse,
  message: string | null,
) {
  const body = error.error && typeof error.error === 'object' ? error.error : null;
  diagnostics.recordFailedRequest({
    method: req.method,
    url: requestPath(req.urlWithParams),
    status: error.status,
    requestId:
      error.headers?.get('X-Correlation-ID') ??
      (typeof body?.correlationId === 'string' ? body.correlationId : null),
    message,
  });
}

/** Server and network failures offer "Report problem" with the failed call already described. */
function offersProblemReport(req: HttpRequest<unknown>, error: HttpErrorResponse) {
  return (error.status === 0 || error.status >= 500) && !SUPPORT_REPORT_ENDPOINT.test(req.url);
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (isExternalRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const snack = inject(SnackbarService);
  const diagnostics = inject(ClientDiagnosticsService);
  const injector = inject(Injector);
  const reportProblem = () => {
    const failure = diagnostics.lastFailedRequest();
    // Lazy: the report dialog stack is loaded only when the user asks for it.
    void import('../../services/support-report.service').then(({ SupportReportService }) => {
      const reports = injector.get(SupportReportService);
      const prefill = reports.draft().description
        ? {}
        : {
            typeCode: 'bug',
            priorityCode: 'high',
            description: failure
              ? `${failure.method} ${failure.url} → ${failure.status}${
                  failure.requestId ? ` (correlation ${failure.requestId})` : ''
                }\n\n`
              : '',
          };
      void reports.openReportDialog(prefill);
    });
  };

  const csrfToken = isMutatingRequest(req.method) ? cookieValue('mnscloud_csrf') : null;
  const bootstrapToken = auth.sessionBootstrapToken();
  const setHeaders: Record<string, string> = {};
  const apiRequest = isApiRequest(req.url);
  if (apiRequest) {
    setHeaders[CLIENT_VERSION_HEADER] = `${APP_BUILD_INFO.product}/${APP_BUILD_INFO.version}`;
  }
  if (csrfToken) setHeaders['X-CSRF-Token'] = csrfToken;
  if (bootstrapToken && !req.headers.has('Authorization')) {
    setHeaders['Authorization'] = `Bearer ${bootstrapToken}`;
  }

  const authReq = req.clone({
    withCredentials: true,
    ...(Object.keys(setHeaders).length ? { setHeaders } : {}),
  });

  const appUpdate = apiRequest ? injector.get(AppUpdateService) : null;
  return next(authReq).pipe(
    tap((event) => {
      if (appUpdate && event instanceof HttpResponse) {
        appUpdate.hint(event.headers.get(APP_VERSION_HEADER));
      }
    }),
    catchError((error: HttpErrorResponse) => {
      appUpdate?.hint(error.headers?.get(APP_VERSION_HEADER));
      // Background reads stay quiet; an expired session is still handled below.
      if (req.context.get(SILENT_ERRORS) && error.status !== 401) {
        return throwError(() => error);
      }
      // Offline / erro de rede
      if (error.status === 0) {
        recordFailure(diagnostics, req, error, 'Network error');
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

      // Interactive confirmation (not a failure): the caller asks the operator and retries.
      if (isRuntimeTokenReplaceConfirmationRequired(error)) {
        return throwError(() => error);
      }

      // Outros erros (422, 400, 500 etc.)
      // Billing codes first: their requiredEntitlement must not fall into the generic entitlement text.
      const commercialMessage =
        registryWorkspaceErrorMessage(error) ??
        payErrorMessage(error) ??
        billingErrorMessage(error) ??
        entitlementErrorMessage(error);
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

      recordFailure(diagnostics, req, error, apiMessage);
      const parsedMessage = parseSnackParams(apiMessage);
      if (offersProblemReport(req, error)) {
        snack.errorWithAction(
          parsedMessage.key,
          'Report problem',
          reportProblem,
          8000,
          parsedMessage.params,
        );
      } else {
        snack.error(parsedMessage.key, 3000, parsedMessage.params);
      }

      return throwError(() => error);
    }),
  );
};
