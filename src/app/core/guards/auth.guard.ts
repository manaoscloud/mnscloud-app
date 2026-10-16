import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { signinUrlTree } from '../navigation/return-url';

export const authGuard: CanActivateChildFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // Keep the requested page (e-mail links) so sign-in returns to it.
  return signinUrlTree(router, state?.url);
};
