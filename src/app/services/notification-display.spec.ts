import {
  notificationDescription,
  notificationIcon,
  notificationTitle,
} from './notification-display';
import type { InboxNotification } from './notification-inbox.service';

const t = (key: string, params?: Record<string, string>) => `${key}:${params?.['server'] ?? ''}`;

function item(type: string, params: Record<string, string>): InboxNotification {
  return { type, params, lastEventAt: null } as unknown as InboxNotification;
}

describe('cyber security notifications', () => {
  it('shows a critical alert with the scenario and origin', () => {
    const alert = item('security.alert', {
      kind: 'critical',
      server: 'agent-web-1',
      scenario: 'crowdsecurity/CVE-2021-41773',
      sourceIP: '203.0.113.8',
    });
    expect(notificationIcon(alert)).toBe('gpp_bad');
    expect(notificationTitle(alert, t)).toBe('notifications.securityCriticalAlert:agent-web-1');
    expect(notificationDescription(alert, 'pt-BR')).toBe(
      'crowdsecurity/CVE-2021-41773 · 203.0.113.8',
    );
  });

  it('shows lost and restored protection', () => {
    const lost = item('security.protection', {
      kind: 'lost',
      server: 'agent-web-1',
      hostname: 'web-1',
      services: 'CrowdSec: stopped',
    });
    expect(notificationIcon(lost)).toBe('gpp_maybe');
    expect(notificationTitle(lost, t)).toBe('notifications.securityProtectionLost:agent-web-1');
    expect(notificationDescription(lost, 'pt-BR')).toBe('CrowdSec: stopped');
    const restored = item('security.protection', {
      kind: 'restored',
      server: 'agent-web-1',
      hostname: 'web-1',
    });
    expect(notificationIcon(restored)).toBe('verified_user');
    expect(notificationTitle(restored, t)).toBe(
      'notifications.securityProtectionRestored:agent-web-1',
    );
    expect(notificationDescription(restored, 'pt-BR')).toBe('web-1');
  });

  it('shows an offline Agent and its return', () => {
    const offline = item('security.agent', {
      kind: 'offline',
      server: 'agent-web-1',
      hostname: 'web-1',
    });
    expect(notificationIcon(offline)).toBe('portable_wifi_off');
    expect(notificationTitle(offline, t)).toBe('notifications.securityAgentOffline:agent-web-1');
    const back = item('security.agent', {
      kind: 'restored',
      server: 'agent-web-1',
      hostname: 'web-1',
    });
    expect(notificationIcon(back)).toBe('lan');
    expect(notificationTitle(back, t)).toBe('notifications.securityAgentRestored:agent-web-1');
  });

  it('shows an urgent vulnerability with its servers', () => {
    const urgent = item('security.vulnerability', {
      kind: 'urgent',
      code: 'CVE-2024-6387',
      serverCount: '2',
      servers: 'agent-web-1, agent-api-1',
    });
    const titled = (key: string, params?: Record<string, string>) =>
      `${key}:${params?.['code']}:${params?.['count']}`;
    expect(notificationIcon(urgent)).toBe('bug_report');
    expect(notificationTitle(urgent, titled)).toBe(
      'notifications.securityVulnerability:CVE-2024-6387:2',
    );
    expect(notificationDescription(urgent, 'pt-BR')).toBe('agent-web-1, agent-api-1');
  });
});
