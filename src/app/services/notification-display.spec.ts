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

  it('shows the V12 firmware, threat and hardening notices with their details', () => {
    const titled = (key: string, params?: Record<string, string>) =>
      `${key}:${params?.['device'] ?? params?.['server']}:${params?.['count']}`;
    const firmware = item('security.network_device', {
      device: 'edge firewall',
      count: '2',
      codes: 'CVE-2024-21762, CVE-2023-27997',
    });
    expect(notificationIcon(firmware)).toBe('router');
    expect(notificationTitle(firmware, titled)).toBe(
      'notifications.securityNetworkDevice:edge firewall:2',
    );
    expect(notificationDescription(firmware, 'pt-BR')).toBe('CVE-2024-21762, CVE-2023-27997');
    const threat = item('security.threat', {
      server: 'web-1',
      count: '1',
      threats: 'Eicar-Signature',
    });
    expect(notificationIcon(threat)).toBe('pest_control');
    expect(notificationTitle(threat, titled)).toBe('notifications.securityThreat:web-1:1');
    expect(notificationDescription(threat, 'pt-BR')).toBe('Eicar-Signature');
    const hardening = item('security.hardening', {
      server: 'web-1',
      count: '1',
      checks: 'mac.sip',
    });
    expect(notificationIcon(hardening)).toBe('rule');
    expect(notificationTitle(hardening, titled)).toBe('notifications.securityHardening:web-1:1');
    expect(notificationDescription(hardening, 'pt-BR')).toBe('mac.sip');
  });
});

describe('time clock kiosk notifications (K4b)', () => {
  const named = (key: string, params?: Record<string, string>) =>
    [key, params?.['kiosk'], params?.['employee'] ?? params?.['count'] ?? ''].join(':');

  it('shows the offline, PIN locked and refused mark notices of a time clock', () => {
    const offline = item('hr.time_clock_kiosk.offline', { kiosk: 'Recepcao' });
    expect(notificationIcon(offline)).toBe('signal_wifi_off');
    expect(notificationTitle(offline, named)).toBe('notifications.hrKioskOffline:Recepcao:');
    const locked = item('hr.time_clock_kiosk.pin_locked', { kiosk: 'Recepcao', employee: 'Ana' });
    expect(notificationIcon(locked)).toBe('lock_clock');
    expect(notificationTitle(locked, named)).toBe('notifications.hrKioskPinLocked:Recepcao:Ana');
    const refused = item('hr.time_clock_kiosk.rejected', { kiosk: 'Recepcao', count: '3' });
    expect(notificationIcon(refused)).toBe('running_with_errors');
    expect(notificationTitle(refused, named)).toBe('notifications.hrKioskRejected:Recepcao:3');
  });
});
