import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { CONFIGURABLE_CRUD_QUICK_CREATE } from './quick-create';

/**
 * Resolve the commerce account once when opening a Sales page (`accountUUID` query parameter);
 * nested forms and quick-create inherit the captured client. Null when the page is not scoped.
 */
export function commerceAccountApi(endpoint: string): ApiService | null {
  const session = inject(CONFIGURABLE_CRUD_QUICK_CREATE, { optional: true });
  if (session?.requestApi) return session.requestApi;
  if (!ApiService.isCommerceAccountEndpoint(endpoint)) return null;
  const route = inject(ActivatedRoute, { optional: true });
  const page = route?.snapshot.routeConfig?.path ?? '';
  const account = ApiService.isCommerceAccountEndpoint(page)
    ? route?.snapshot.queryParamMap.get('accountUUID')
    : null;
  return account ? inject(ApiService).withCommerceAccount(account) : null;
}
