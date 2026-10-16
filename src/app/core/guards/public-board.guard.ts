import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * The public idea board (`/ideas`, `/ideas/:code`) is for visitors. Signed-in users go to the same
 * board inside the App (`/support/ideas`), where they can also propose and vote.
 */
export const publicBoardGuard: CanActivateFn = (route) => {
  if (!inject(AuthService).isLoggedIn()) return true;
  const code = route.paramMap.get('code');
  return inject(Router).createUrlTree(['/support/ideas'], code ? { queryParams: { code } } : {});
};
