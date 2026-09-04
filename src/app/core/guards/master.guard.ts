import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const masterGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.user();
  const permissions = user?.permissions ?? [];
  return user?.role === 'MASTER' || permissions.includes('platform.master.access')
    ? true
    : router.parseUrl('/dashboard');
};
