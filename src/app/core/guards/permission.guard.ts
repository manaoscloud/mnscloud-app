import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const permission = route.data?.['permission'];
  if (typeof permission !== 'string' || !permission.trim()) {
    return router.parseUrl('/dashboard');
  }

  const permissions = auth.user()?.permissions ?? [];
  const allowed =
    permissions.includes(permission) ||
    (permission.startsWith('platform.') && permissions.includes('platform.master.access'));

  return allowed ? true : router.parseUrl('/dashboard');
};
