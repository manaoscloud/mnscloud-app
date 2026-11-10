import {
  antivirusActionsCollection,
  antivirusLabel,
  antivirusThreatsCollection,
  antivirusTone,
  checkAdvice,
  checkTitle,
  HARDENING_CODES,
  hardeningCheckView,
  hardeningChecksCollection,
  postureServerActions,
  scoreTone,
} from './cyber-posture';

const t = (key: string) => `t:${key}`;

const server = {
  agentUUID: 'A-1',
  agentName: 'web-1',
  advanced: true,
  supported: true,
  checkPending: false,
  lastCheckedAt: '2026-11-10T12:00:00Z',
  antivirusEngine: 'clamav',
  antivirusInstalled: true,
  antivirusRunning: true,
  antivirusRealtime: false,
  antivirusInstallable: false,
  activeThreats: 0,
  lastActionType: 'quick_scan',
};

describe('Cyber Security hardening and antivirus views', () => {
  it('translates every check code the Agent reports and keeps unknown codes', () => {
    expect(new Set(HARDENING_CODES).size).toBe(49);
    for (const code of HARDENING_CODES) {
      expect(checkTitle({ code }, t)).toBe(`t:cyberSecurity.hardening.check.${code}`);
      expect(checkAdvice({ code }, t)).toBe(`t:cyberSecurity.hardening.advice.${code}`);
    }
    expect(checkTitle({ code: 'future.check' }, t)).toBe('future.check');
    expect(checkAdvice({ code: 'future.check' }, t)).toBe('');
  });

  it('summarizes the antivirus state and tones', () => {
    expect(antivirusLabel(server, t)).toBe('ClamAV: t:cyberSecurity.antivirus.state.onDemand');
    expect(
      antivirusLabel({ ...server, antivirusEngine: 'defender', antivirusRealtime: true }, t),
    ).toBe('Microsoft Defender: t:cyberSecurity.antivirus.state.realtime');
    expect(
      antivirusLabel(
        {
          ...server,
          antivirusEngine: 'none',
          antivirusInstalled: false,
          antivirusInstallable: true,
        },
        t,
      ),
    ).toBe('t:cyberSecurity.antivirus.state.installable');
    expect(antivirusLabel({ ...server, advanced: false }, t)).toBe('');
    expect(antivirusTone(null, server)).toBe('chip-success');
    expect(antivirusTone(null, { ...server, activeThreats: 2 })).toBe('chip-failed');
    expect(antivirusTone(null, { ...server, antivirusRunning: false })).toBe('chip-warning');
    expect([scoreTone(95), scoreTone(75), scoreTone(40), scoreTone(null)]).toEqual([
      'chip-success',
      'chip-warning',
      'chip-failed',
      'chip-skipped',
    ]);
  });

  it('offers actions by the Advanced plan and the antivirus state', () => {
    const actions = postureServerActions();
    const visible = (row: Record<string, unknown>) =>
      actions.filter((action) => action.visible?.(row) ?? true).map((action) => action.key);
    expect(visible(server)).toEqual([
      'hardeningChecks',
      'hardeningCheckNow',
      'antivirusThreats',
      'antivirusUpdate',
      'antivirusQuickScan',
      'antivirusFullScan',
      'antivirusActions',
    ]);
    expect(visible({ ...server, advanced: false })).toEqual(['advancedEnable']);
    expect(
      visible({
        ...server,
        antivirusEngine: 'none',
        antivirusInstalled: false,
        antivirusInstallable: true,
        lastActionType: null,
        checkPending: true,
      }),
    ).toEqual(['hardeningChecks', 'antivirusThreats', 'antivirusInstall']);
    const scan = actions.find((action) => action.key === 'antivirusFullScan');
    expect(scan?.request?.body?.(server)).toEqual({ action: 'full_scan' });
    expect(scan?.request?.endpoint(server)).toBe('cyber-security/posture/servers/A-1/antivirus');
    expect(scan?.request?.confirm?.message).toBe('cyberSecurity.antivirus.fullScanConfirm');
    // A Mac reports XProtect: macOS updates and runs it, so no antivirus actions.
    expect(
      visible({
        ...server,
        antivirusEngine: 'xprotect',
        antivirusRealtime: true,
        lastActionType: null,
      }),
    ).toEqual(['hardeningChecks', 'hardeningCheckNow', 'antivirusThreats']);
    expect(
      antivirusLabel({ ...server, antivirusEngine: 'xprotect', antivirusRealtime: true }, t),
    ).toBe('t:cyberSecurity.antivirus.engine.xprotect: t:cyberSecurity.antivirus.state.realtime');
    expect(HARDENING_CODES).toContain('mac.filevault');
    expect(checkTitle({ code: 'mac.sip' }, t)).toBe('t:cyberSecurity.hardening.check.mac.sip');
    const check = actions.find((action) => action.key === 'hardeningCheckNow');
    expect(check?.disabledReason?.({ ...server, supported: false })).toBe(
      'cyberSecurity.hardening.agentOutdated',
    );
  });

  it('lists checks, threats and actions of one server', () => {
    expect(hardeningChecksCollection(server, () => undefined).endpoint).toBe(
      'cyber-security/posture/servers/A-1/checks',
    );
    expect(antivirusThreatsCollection(server).endpoint).toBe(
      'cyber-security/posture/servers/A-1/threats',
    );
    expect(antivirusActionsCollection(server).endpoint).toBe(
      'cyber-security/posture/servers/A-1/antivirus-actions',
    );
  });

  it('shows a check with what was found and how to fix it', () => {
    const view = hardeningCheckView(
      {
        code: 'ssh.root_login',
        severity: 'high',
        status: 'fail',
        evidence: 'permitrootlogin yes',
        benchmark: 'CIS 5.2',
      },
      t,
    );
    expect(view.title).toBe('t:cyberSecurity.hardening.check.ssh.root_login');
    expect(view.sections?.[0].message).toContain('permitrootlogin yes');
    expect(view.sections?.[1].message).toBe('t:cyberSecurity.hardening.advice.ssh.root_login');
  });
});
