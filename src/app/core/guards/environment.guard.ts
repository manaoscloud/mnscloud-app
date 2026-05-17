import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const environmentGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.user();
    const envFromUser = user?.EnvironmentUUID ?? null;
    const envFromStorage =
        typeof localStorage !== 'undefined' ? localStorage.getItem('mc_current_env') : null;
    const env = envFromUser || envFromStorage;

    // ✅ Acesso ao tenant exige EnvironmentUUID ativo (até mesmo para MASTER)
    if (env) return true;

    // sem env → manda pro dashboard (ou uma tela “select environment” se você criar)
    return router.parseUrl('/dashboard');
};
