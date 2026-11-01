import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { CONFIGURABLE_CRUD_QUICK_CREATE } from './quick-create';

/** App pages that open in a commerce account: Sales and shop resources, and the POS pages. */
export function isCommerceAccountPage(page: string): boolean {
  return ApiService.isCommerceAccountEndpoint(page) || /^point-of-sale\//.test(page);
}

/**
 * Resolve the commerce account once when opening a scoped page (`accountUUID` and `workspaceUUID`
 * query parameters); nested forms and quick-create inherit the captured client, whose Registry
 * workspace scopes the company lookups. Null when the page is not scoped.
 */
export function commerceAccountApi(endpoint: string): ApiService | null {
  const session = inject(CONFIGURABLE_CRUD_QUICK_CREATE, { optional: true });
  if (session?.requestApi) return session.requestApi;
  if (!ApiService.isCommerceAccountEndpoint(endpoint)) return null;
  const route = inject(ActivatedRoute, { optional: true });
  const page = route?.snapshot.routeConfig?.path ?? '';
  const query = isCommerceAccountPage(page) ? route?.snapshot.queryParamMap : null;
  const account = query?.get('accountUUID');
  return account
    ? inject(ApiService).withCommerceAccount(account, query?.get('workspaceUUID'))
    : null;
}
