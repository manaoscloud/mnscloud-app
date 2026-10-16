// src/app/core/guards/redirect-if-logged.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RETURN_URL_PARAM, safeReturnUrl } from '../navigation/return-url';

export const redirectIfLoggedGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    // Already signed in: honour an e-mail deep link instead of the dashboard.
    const returnUrl = safeReturnUrl(route?.queryParamMap?.get(RETURN_URL_PARAM));
    return router.parseUrl(returnUrl ?? '/dashboard');
  }

  return true;
};
