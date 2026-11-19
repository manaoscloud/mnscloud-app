import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { InjectionToken, inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { injectPlatformScope } from '../../../core/scope/route-scope';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';

/** Immutable context chosen by the owning route, never by query inputs or permissions. */
export function remoteContext(platform: boolean) {
  const base = platform ? 'system/support/remote' : 'support/remote';
  return Object.freeze({
    platform,
    base,
    network: platform ? 'system/network' : 'network',
    tickets: platform ? 'system/support/tickets' : 'support/tickets',
    console: `/${base}/console`,
  });
}
export type RemoteContext = ReturnType<typeof remoteContext>;
export const REMOTE_CONTEXT = new InjectionToken<RemoteContext>('Support remote context');
export const REMOTE_PAGE_CONTEXT = {
  provide: REMOTE_CONTEXT,
  useFactory: () => remoteContext(injectPlatformScope()),
};
/** Dialog callers explicitly carry the immutable page context in their data. */
export const REMOTE_DIALOG_CONTEXT = {
  provide: REMOTE_CONTEXT,
  useFactory: () => inject<{ context: RemoteContext }>(MAT_DIALOG_DATA).context,
};
export function canRemote(platform: boolean, permissions: readonly unknown[], permission: string) {
  return hasEffectivePermission(permissions, platform ? 'platform.master.access' : permission);
}
export function remoteUiKey(context: RemoteContext, user: string, environment: string | null) {
  if (!user) return '';
  return `mns.support.remote.ui.${user}.${context.platform ? 'platform' : (environment ?? '')}`;
}
export type RemoteLaunch = { ticket?: string; device?: string; customer?: string; title?: string };
export function remoteLaunchLink(
  platform: boolean,
  source: 'ticket' | 'device',
  row: Record<string, unknown>,
) {
  const query: RemoteLaunch =
    source === 'ticket'
      ? { ticket: String(row['SupportTicketUUID'] ?? ''), title: String(row['Subject'] ?? '') }
      : { device: String(row['NwdUUID'] ?? ''), title: String(row['NwdName'] ?? '') };
  if (!platform && row['CustomerUUID']) query.customer = String(row['CustomerUUID']);
  return { path: remoteContext(platform).console, query };
}
/** Query parameters only prefill the form. The API validates all references on creation. */
export function remotePreselection(
  context: RemoteContext,
  query: { get(key: string): string | null },
): RemoteLaunch {
  return {
    ticket: query.get('ticket') ?? '',
    device: query.get('device') ?? '',
    title: (query.get('title') ?? '').slice(0, 160),
    customer: context.platform ? '' : (query.get('customer') ?? ''),
  };
}

/** Platform desk users do not acquire infrastructure access through delegated ticket grants. */
export const masterGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return hasEffectivePermission(auth.user()?.permissions ?? [], 'platform.master.access')
    ? true
    : router.parseUrl('/dashboard');
};

/** Authenticated SSE mirrors the API client; a platform stream never carries a selected tenant. */
export function remoteStreamHeaders(
  context: RemoteContext,
  client: string,
  token: string | null,
  environment: string | null,
): Record<string, string> {
  return {
    Accept: 'text/event-stream',
    'X-Mns-Client': client,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!context.platform && environment ? { 'X-Environment-UUID': environment } : {}),
  };
}
