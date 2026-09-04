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

  const normalizedRequired = permission.toLowerCase();
  const permissions = auth.user()?.permissions ?? [];
  const allowed = permissions.some((currentPermission) => {
    const normalizedPermission = String(currentPermission ?? '').toLowerCase();
    if (normalizedPermission === normalizedRequired) return true;
    if (
      normalizedPermission === 'platform.master.access' &&
      normalizedRequired.startsWith('platform.')
    ) {
      return true;
    }
    if (normalizedPermission === 'tenant.*' && normalizedRequired.startsWith('tenant.'))
      return true;
    if (!normalizedPermission.includes('*')) return false;
    const pattern = `^${normalizedPermission
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')}$`;
    return new RegExp(pattern).test(normalizedRequired);
  });

  return allowed ? true : router.parseUrl('/dashboard');
};
