import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * The public changelog (`/release-notes`) is for visitors. Signed-in users go to App › Novidades
 * (`/user/release-notes`), filtered by their modules and with the weekly digest option.
 */
export const publicReleaseNotesGuard: CanActivateFn = () =>
  inject(AuthService).isLoggedIn() ? inject(Router).createUrlTree(['/user/release-notes']) : true;
