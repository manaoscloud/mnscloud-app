import { deviceConfig } from '../../network/devices/devices';
import { ConnectionActions } from '../../network/devices/device-connections';
import {
  deviceSupportSessionsConfig,
  remoteConsoleLink,
  remoteSessionsConfig,
} from './remote-sessions';
import { remoteRunbooksConfig } from './remote-runbooks';
import { supportTicketsConfig } from '../tickets/tickets';

for (const platform of [false, true]) {
  describe(platform ? 'platform desk configuration' : 'tenant desk configuration', () => {
    const prefix = platform ? 'system/' : '';
    it('scopes sessions, history, runbooks and row actions together', () => {
      const open = jasmine.createSpy('open');
      const sessions = remoteSessionsConfig(open, () => true, platform);
      expect(sessions.endpoint).toBe(`${prefix}support/remote/sessions`);
      expect(sessions.columns.some((c) => c.id === 'customer')).toBe(!platform);
      expect(sessions.listFilters?.find((f) => f.key === 'device')?.remoteLookup?.endpoint).toBe(
        `${prefix}network/devices`,
      );
      const history = deviceSupportSessionsConfig('device-a', platform, open);
      expect(history.endpoint).toBe(`${prefix}network/devices/device-a/support-sessions`);
      history.rowActions?.[0].run?.({ SrsUUID: 'session-a' });
      expect(open).toHaveBeenCalledWith({ SrsUUID: 'session-a' });
      expect(remoteConsoleLink('session-a', platform)).toEqual({
        path: `/${prefix}support/remote/console`,
        query: { session: 'session-a' },
      });
      const books = remoteRunbooksConfig(
        () => true,
        () => true,
        platform,
      );
      expect(books.endpoint).toBe(`${prefix}support/remote/runbooks`);
      const autonomy = books.rowActions?.find((a) => a.key === 'autonomyOn')?.request?.endpoint;
      expect(typeof autonomy === 'function' ? autonomy({ SrbUUID: 'book-a' }) : autonomy).toBe(
        `${prefix}support/remote/runbooks/book-a/autonomy`,
      );
    });
    it('preserves direct device access and scopes the contextual session history', () => {
      const connections = {
        currentUserUUID: () => 'operator-a',
        canConsole: true,
        canReadRecordings: true,
        showConnection: async () => {},
        showRecording: async () => {},
      } satisfies ConnectionActions;
      const open = jasmine.createSpy('open');
      const config = deviceConfig(
        platform,
        () => true,
        (key) => key,
        () => undefined,
        connections,
        () => false,
        open,
      );
      expect(config.rowActions?.some((a) => a.key === 'console')).toBeTrue();
      const launch = config.rowActions?.find((a) => a.key === 'remote-session');
      expect(launch?.visible?.({})).toBeTrue();
      expect(launch?.disabledReason?.({ NwdRemoteSupportEnabled: 0 })).toBe(
        platform ? null : 'network.remoteSupport.requiredReason',
      );
      expect(launch?.disabledReason?.({ NwdRemoteSupportEnabled: 1 })).toBeNull();
      const history = config.rowActions
        ?.find((a) => a.key === 'support-sessions')
        ?.collection?.({ NwdUUID: 'device-a' });
      expect(history?.endpoint).toBe(`${prefix}network/devices/device-a/support-sessions`);
      history?.rowActions?.[0].run?.({ SrsUUID: 'session-a' });
      expect(open).toHaveBeenCalledWith({ SrsUUID: 'session-a' });
    });
    it('keeps ticket launchers subject to the caller authorization', () => {
      for (const allowed of [false, true]) {
        const config = supportTicketsConfig(
          platform ? 'platform' : 'tenant',
          () => ({}) as never,
          () => ({}) as never,
          () => allowed,
        );
        expect(config.rowActions?.find((a) => a.key === 'remote-session')?.visible?.({})).toBe(
          allowed,
        );
        expect(config.endpoint).toBe(`${prefix}support/tickets`);
      }
    });
  });
}
