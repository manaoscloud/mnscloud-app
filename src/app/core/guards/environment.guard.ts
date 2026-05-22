import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

function normalizeEnvironmentUUID(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(trimmed)
        ? trimmed
        : null;
}

export const environmentGuard: CanActivateFn = () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    const user = auth.user();
    const envFromUser = normalizeEnvironmentUUID(user?.EnvironmentUUID);
    const envFromStorage =
        typeof localStorage !== 'undefined'
            ? normalizeEnvironmentUUID(localStorage.getItem('mc_current_env'))
            : null;
    const env = envFromStorage || envFromUser;

    // ✅ Acesso ao tenant exige EnvironmentUUID ativo (até mesmo para MASTER)
    if (env) return true;

    // sem env → manda pro dashboard (ou uma tela “select environment” se você criar)
    return router.parseUrl('/dashboard');
};
