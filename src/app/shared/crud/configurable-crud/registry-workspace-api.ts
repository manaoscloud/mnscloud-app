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
  const path = route?.snapshot.routeConfig?.path ?? '';
  const query = route?.snapshot.queryParamMap;
  // HR pages opened from HR > Accounts: the HR account, plus its workspace for Registry quick-create.
  const hrAccount =
    ApiService.isHrAccountEndpoint(endpoint) && ApiService.isHrAccountEndpoint(path)
      ? query?.get('hrAccountUUID')
      : null;
  if (hrAccount) return api.withHrAccount(hrAccount, query?.get('workspaceUUID'));
  const workspace =
    ApiService.isRegistryWorkspaceEndpoint(endpoint) && ApiService.isRegistryWorkspaceEndpoint(path)
      ? query?.get('workspaceUUID')
      : null;
  return workspace ? api.withRegistryWorkspace(workspace) : api;
}
