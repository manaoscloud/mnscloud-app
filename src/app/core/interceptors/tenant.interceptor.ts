import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { TenantService } from '../../services/tenant.service';

export const tenantInterceptor: HttpInterceptorFn = (req, next) => {
    const service = inject(TenantService);
    const tenant = service.selectedTenant();

    if (tenant) {
        req = req.clone({
            setHeaders: {
                'X-Environment-UUID': tenant.EnvironmentUUID,
            },
        });
    }

    return next(req);
};