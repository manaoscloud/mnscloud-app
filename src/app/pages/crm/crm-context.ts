import { computed, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';

/** Memory identity only; route scope and API authorization remain authoritative. */
export function injectCrmMemoryScope() {
  const auth = inject(AuthService);
  const tenants = inject(TenantService);
  return computed(
    () =>
      `${auth.user()?.uuid ?? ''}:${auth.user()?.EnvironmentUUID ?? ''}:${tenants.selectedTenant()?.EnvironmentUUID ?? ''}`,
  );
}
