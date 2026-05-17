import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

export const userResolver: ResolveFn<Promise<boolean>> = async () => {
    const auth = inject(AuthService);
    const api = inject(ApiService);
    const router = inject(Router);

    const jwt = auth.getJwt();
    if (!jwt) {
        router.navigate(['/signin']);
        return false;
    }

    const okProfile = await auth.loadUserFromApi(api);

    // ✅ garante role/env para menu/guards no refresh
    await auth.loadMeFromApi(api);

    if (!okProfile) {
        router.navigate(['/signin']);
        return false;
    }

    return true;
};