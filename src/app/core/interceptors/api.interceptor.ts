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

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  if (isExternalRequest(req.url)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const snack = inject(SnackbarService);

  const token = auth.getToken();
  const authReq = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

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
      const rawMessage =
        (error.error && (error.error.error || error.error.message)) ||
        error.message ||
        'Unexpected error occurred.';
      let apiMessage = 'Unexpected error occurred.';
      if (typeof rawMessage === 'string') {
        apiMessage = rawMessage;
      } else if (rawMessage !== null && rawMessage !== undefined) {
        try {
          apiMessage = JSON.stringify(rawMessage);
        } catch {
          apiMessage = String(rawMessage);
        }
      }
      if (error.status === 429) {
        apiMessage = 'Too many requests. Please wait a moment and try again.';
      }

      snack.error(apiMessage);

      return throwError(() => error);
    }),
  );
};
