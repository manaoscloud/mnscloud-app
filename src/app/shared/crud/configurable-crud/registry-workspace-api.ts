import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../services/api.service';
import { CONFIGURABLE_CRUD_QUICK_CREATE } from './quick-create';

/** Resolve once when opening a page; nested forms inherit the captured client. */
export function registryWorkspaceApi(endpoint: string): ApiService {
  const api = inject(ApiService);
  const session = inject(CONFIGURABLE_CRUD_QUICK_CREATE, { optional: true });
  if (session?.requestApi) return session.requestApi;
  const route = inject(ActivatedRoute, { optional: true });
  const workspace =
    ApiService.isRegistryWorkspaceEndpoint(endpoint) &&
    ApiService.isRegistryWorkspaceEndpoint(route?.snapshot.routeConfig?.path ?? '')
      ? route?.snapshot.queryParamMap.get('workspaceUUID')
      : null;
  return workspace ? api.withRegistryWorkspace(workspace) : api;
}
