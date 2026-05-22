import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import {
    extractEnvironmentAccess,
    normalizeEnvironmentUUID,
    readStoredEnvironmentUUID,
    resolveSelectedEnvironmentUUID,
    writeStoredEnvironmentUUID,
} from '../environment/environment-context';

type EnvironmentAccessResponse = {
    data?: {
        access?: unknown[];
    };
};

async function recoverEnvironment(api: ApiService, auth: AuthService): Promise<string | null> {
    try {
        const response = await api.get<EnvironmentAccessResponse>('user/access');
        const access = extractEnvironmentAccess(response);
        const selected = resolveSelectedEnvironmentUUID(
            access,
            readStoredEnvironmentUUID() ?? auth.user()?.EnvironmentUUID,
        );
        if (!selected) return null;

        writeStoredEnvironmentUUID(selected);
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
    const envFromStorage = readStoredEnvironmentUUID();
    const env = envFromStorage || envFromUser;

    // ✅ Acesso ao tenant exige EnvironmentUUID ativo (até mesmo para MASTER)
    if (env) return true;

    const recovered = await recoverEnvironment(api, auth);
    if (recovered) return true;

    // sem env → manda pro dashboard (ou uma tela “select environment” se você criar)
    return router.parseUrl('/dashboard');
};
