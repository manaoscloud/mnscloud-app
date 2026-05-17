import { inject } from '@angular/core';
import {
    HttpInterceptorFn,
    HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { SnackbarService } from '../../services/snackbar.service';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const router = inject(Router);
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
                const url = error.url ?? '';
                const hasToken = !!auth.getToken();
                const requestUrl = (url || req.url || '').toLowerCase();
                const apiError =
                    typeof error.error?.error === 'string'
                        ? error.error.error.toLowerCase()
                        : '';
                const isSessionEndpoint =
                    requestUrl.includes('/auth/') ||
                    requestUrl.endsWith('/auth') ||
                    requestUrl.includes('/user/me') ||
                    requestUrl.includes('/user/profile');
                const isInvalidToken =
                    apiError.includes('invalid or expired token') ||
                    apiError.includes('missing or invalid authorization header') ||
                    apiError.includes('unauthorized access');

                // Token inválido/expirado deve encerrar a sessão em qualquer endpoint.
                if (!hasToken || isSessionEndpoint || isInvalidToken) {
                    snack.error('Your session has expired. Please sign in again.');
                    auth.logout();
                    if (router.url !== '/signin') {
                        void router.navigate(['/signin']);
                    }
                    return throwError(() => error);
                }

                // Mantém sessão para erros de escopo (ex.: ambiente não selecionado).
                if (hasToken) {
                    snack.error('Unauthorized. Check if you selected an environment and try again.');
                    return throwError(() => error);
                }
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
        })
    );
};
