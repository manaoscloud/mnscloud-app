import { Injector, runInInjectionContext } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiService } from '../../../services/api.service';
import { AuthService } from '../../../services/auth.service';
import { RemoteAssistService } from './remote-assistant';
import { RemoteRunbookService } from './remote-runbook';
import { SupportRemoteNewDialogComponent } from './remote-dialogs';
import { remoteLookups } from './remote-lookup';
import {
  REMOTE_CONTEXT,
  REMOTE_PAGE_CONTEXT,
  REMOTE_DIALOG_CONTEXT,
  remoteContext,
  remoteLaunchLink,
  remotePreselection,
  remoteStreamHeaders,
  remoteUiKey,
  canRemote,
  masterGuard,
} from './remote-context';

function scoped(platform: boolean) {
  const api = jasmine.createSpyObj('ApiService', ['get', 'post', 'put', 'delete']);
  for (const method of ['get', 'post', 'put', 'delete'])
    api[method].and.resolveTo({ data: { items: [] } });
  const injector = Injector.create({
    providers: [
      { provide: REMOTE_CONTEXT, useValue: remoteContext(platform) },
      { provide: ApiService, useValue: api },
      RemoteAssistService,
      RemoteRunbookService,
    ],
  });
  return { api, injector };
}

describe('remote desk explicit scope', () => {
  it('resolves page context only from inherited route data', () => {
    for (const scope of ['master', 'tenant']) {
      const route = { snapshot: { pathFromRoot: [{ data: { scope } }, { data: {} }] } };
      const injector = Injector.create({
        providers: [{ provide: ActivatedRoute, useValue: route }, REMOTE_PAGE_CONTEXT],
      });
      expect(injector.get(REMOTE_CONTEXT).platform).toBe(scope === 'master');
    }
  });
  it('keeps explicit dialog scope independent of a tenant route', () => {
    const context = remoteContext(true);
    const injector = Injector.create({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { context } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { pathFromRoot: [{ data: { scope: 'tenant' } }] } },
        },
        REMOTE_DIALOG_CONTEXT,
      ],
    });
    expect(injector.get(REMOTE_CONTEXT)).toBe(context);
  });
  it('separates tabs by platform, tenant and user, ignoring stale platform environment', () => {
    const platform = remoteContext(true),
      tenant = remoteContext(false);
    expect(remoteUiKey(platform, 'a', 'tenant-a')).toBe(remoteUiKey(platform, 'a', 'tenant-b'));
    const keys = [
      remoteUiKey(platform, 'a', null),
      remoteUiKey(platform, 'b', null),
      remoteUiKey(tenant, 'a', 'tenant-a'),
      remoteUiKey(tenant, 'a', 'tenant-b'),
    ];
    expect(new Set(keys).size).toBe(4);
    expect(remoteUiKey(platform, '', null)).toBe('');
  });
  it('authenticates SSE and suppresses stale tenant headers only on platform', () => {
    const platform = remoteStreamHeaders(
      remoteContext(true),
      'app/test',
      'bootstrap-test',
      'stale',
    );
    expect(platform['Authorization']).toBe('Bearer bootstrap-test');
    expect(platform['X-Environment-UUID']).toBeUndefined();
    expect(
      remoteStreamHeaders(remoteContext(false), 'app/test', null, 'tenant-a')['X-Environment-UUID'],
    ).toBe('tenant-a');
  });
  it('requires effective master access, never a delegated ticket grant', () => {
    expect(
      canRemote(true, ['platform.support.tickets.manage'], 'tenant.support.remote.sessions.write'),
    ).toBeFalse();
    expect(
      canRemote(true, ['platform.master.access'], 'tenant.support.remote.sessions.write'),
    ).toBeTrue();
    expect(
      canRemote(
        false,
        ['tenant.support.remote.sessions.read'],
        'tenant.support.remote.sessions.write',
      ),
    ).toBeFalse();
    for (const allowed of [false, true]) {
      const injector = Injector.create({
        providers: [
          {
            provide: AuthService,
            useValue: {
              user: () => ({
                permissions: [
                  allowed ? 'platform.master.access' : 'platform.support.tickets.manage',
                ],
              }),
            },
          },
          { provide: Router, useValue: { parseUrl: () => 'denied' } },
        ],
      });
      expect(
        runInInjectionContext(injector, () =>
          masterGuard({} as ActivatedRouteSnapshot, {} as never),
        ),
      ).toBe(allowed ? true : ('denied' as never));
    }
  });
});

for (const platform of [false, true]) {
  describe(platform ? 'platform remote paths' : 'tenant remote regression', () => {
    const context = remoteContext(platform);
    it('uses canonical inventory, tickets and eligible operator search', () => {
      const lookups = remoteLookups(context);
      expect(lookups.device.endpoint).toBe(`${context.network}/devices`);
      expect(lookups.ticket.endpoint).toBe(context.tickets);
      expect(lookups.user).toEqual({
        endpoint: `${context.base}/operators`,
        uuidField: 'UserUUID',
        labelField: 'Name',
      });
    });
    it('propagates context to assistant, settings, runbooks and credential metadata', async () => {
      const { api, injector } = scoped(platform);
      const assist = injector.get(RemoteAssistService),
        books = injector.get(RemoteRunbookService);
      await assist.send('session-a', 'diagnose');
      expect(api.post.calls.mostRecent().args[0]).toBe(`${context.base}/sessions/session-a/assist`);
      await assist.settings();
      expect(api.get.calls.mostRecent().args[0]).toBe(`${context.base}/settings`);
      await books.get('book-a');
      expect(api.get.calls.mostRecent().args[0]).toBe(`${context.base}/runbooks/book-a`);
      await books.startRun('session-a', {
        runbookUUID: 'book-a',
        deviceUUID: 'device-a',
        params: {},
        mode: 'supervised',
      });
      expect(api.post.calls.mostRecent().args[0]).toBe(
        `${context.base}/sessions/session-a/runbook-runs`,
      );
      await books.startRotation('session-a', 'device-a', null);
      expect(api.post.calls.mostRecent().args[0]).toBe(
        `${context.base}/sessions/session-a/devices/device-a/credential-rotation`,
      );
      await books.deviceCredentials('device-a');
      expect(api.get.calls.mostRecent().args[0]).toBe(
        `${context.network}/devices/device-a/credentials`,
      );
    });
    it('prefills the chosen ticket/device without treating the requester as tenant scope', () => {
      const ticket = remoteLaunchLink(platform, 'ticket', {
        SupportTicketUUID: 'ticket-a',
        Subject: 'Help',
        CustomerUUID: 'customer-a',
        EnvironmentUUID: 'requester-tenant',
      });
      const device = remoteLaunchLink(platform, 'device', {
        NwdUUID: 'device-a',
        NwdName: 'Router',
      });
      expect(ticket.path).toBe(context.console);
      expect(ticket.query.ticket).toBe('ticket-a');
      expect(ticket.query.customer).toBe(platform ? undefined : 'customer-a');
      expect(device.query.device).toBe('device-a');
      const launch = remotePreselection(
        context,
        new URLSearchParams({
          ticket: 'ticket-a',
          device: 'device-a',
          customer: 'customer-a',
          title: 'Help',
          scope: 'master',
        }),
      );
      expect(launch.customer).toBe(platform ? '' : 'customer-a');
      const close = jasmine.createSpy('close');
      const injector = Injector.create({
        providers: [
          { provide: REMOTE_CONTEXT, useValue: context },
          { provide: MAT_DIALOG_DATA, useValue: { context, launch } },
          { provide: MatDialogRef, useValue: { close } },
          {
            provide: AuthService,
            useValue: {
              user: () => ({ permissions: platform ? ['platform.master.access'] : ['tenant.*'] }),
            },
          },
        ],
      });
      const dialog = runInInjectionContext(injector, () => new SupportRemoteNewDialogComponent());
      dialog.submit();
      expect(close).toHaveBeenCalledWith({
        title: 'Help',
        level: 'n1',
        ticketUUID: 'ticket-a',
        deviceUUIDs: ['device-a'],
        customerUUID: platform ? null : 'customer-a',
      });
    });
  });
}
