import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { signinUrlTree } from '../navigation/return-url';
import { ApiService } from '../../services/api.service';

export const userResolver: ResolveFn<Promise<boolean>> = async (_route, state) => {
  const auth = inject(AuthService);
  const api = inject(ApiService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    void router.navigateByUrl(signinUrlTree(router, state?.url));
    return false;
  }

  const okProfile = await auth.loadUserFromApi(api);

  if (!okProfile) {
    void router.navigateByUrl(signinUrlTree(router, state?.url));
    return false;
  }

  // ✅ garante role/env para menu/guards no refresh
  await auth.loadMeFromApi(api);

  return true;
};
