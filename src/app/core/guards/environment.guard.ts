import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

type EnvironmentAccess = {
    EnvironmentUUID?: string | null;
    IsDefault?: number | string | null;
};

type EnvironmentAccessResponse = {
    data?: {
        access?: EnvironmentAccess[];
    };
};

const ENV_STORAGE_KEY = 'mc_current_env';

function normalizeEnvironmentUUID(value: string | null | undefined): string | null {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        .test(trimmed)
        ? trimmed
        : null;
}

function storedEnvironmentUUID(): string | null {
    return typeof localStorage !== 'undefined'
        ? normalizeEnvironmentUUID(localStorage.getItem(ENV_STORAGE_KEY))
        : null;
}

async function recoverEnvironment(api: ApiService, auth: AuthService): Promise<string | null> {
    try {
        const response = await api.get<EnvironmentAccessResponse>('user/access');
        const access = response?.data?.access ?? [];
        const valid = access
            .map((item) => ({
                uuid: normalizeEnvironmentUUID(item.EnvironmentUUID),
                isDefault: Number(item.IsDefault ?? 0) === 1,
            }))
            .filter((item): item is { uuid: string; isDefault: boolean } => !!item.uuid);

        const selected = valid.find((item) => item.isDefault)?.uuid ?? valid[0]?.uuid ?? null;
        if (!selected) return null;

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(ENV_STORAGE_KEY, selected);
        }
        auth.updateUser({ EnvironmentUUID: selected });
        return selected;
    } catch {
        return null;
    }
}

export const environmentGuard: CanActivateFn = async () => {
    const auth = inject(AuthService);
    const api = inject(ApiService);
    const router = inject(Router);

    const user = auth.user();
    const envFromUser = normalizeEnvironmentUUID(user?.EnvironmentUUID);
    const envFromStorage = storedEnvironmentUUID();
    const env = envFromStorage || envFromUser;

    // ✅ Acesso ao tenant exige EnvironmentUUID ativo (até mesmo para MASTER)
    if (env) return true;

    const recovered = await recoverEnvironment(api, auth);
    if (recovered) return true;

    // sem env → manda pro dashboard (ou uma tela “select environment” se você criar)
    return router.parseUrl('/dashboard');
};
