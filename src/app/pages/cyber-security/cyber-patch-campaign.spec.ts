import {
  campaignActionsFor,
  campaignDescription,
  campaignDuration,
  campaignForm,
  campaignPayload,
  campaignPreviewBody,
  campaignProgress,
  campaignRowActions,
  campaignStatusTone,
  campaignView,
  campaignsCollection,
  canRebootCampaign,
  fixEverywhereAction,
  platformCampaignForm,
  previewSummary,
  shouldPollSimulation,
  simulationSummary,
  rebootForm,
  rebootPayload,
  skipReasonKey,
  targetFromEmergencyKey,
} from './cyber-patch-campaign';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `t:${key}:${JSON.stringify(params)}` : `t:${key}`;

describe('Cyber Security patch campaigns', () => {
  it('maps the status to its actions', () => {
    expect(campaignActionsFor('requested')).toEqual(['approve', 'reject', 'abort']);
    expect(campaignActionsFor('running')).toEqual(['pause', 'abort']);
    expect(campaignActionsFor('paused')).toEqual(['resume', 'abort']);
    expect(campaignActionsFor('halted')).toEqual(['pause', 'resume', 'abort']);
    expect(campaignActionsFor('completed')).toEqual([]);
    const actions = campaignRowActions(() => undefined);
    const visible = (status: string) =>
      actions.filter((a) => a.form && a.visible?.({ status })).map((a) => a.key);
    expect(visible('paused')).toEqual(['campaign_resume', 'campaign_abort']);
  });

  it('describes the scope and the progress', () => {
    expect(campaignDescription({ scope: 'cves', cves: ['CVE-1', 'CVE-2'] }, t)).toBe(
      'CVE-1, CVE-2',
    );
    expect(campaignDescription({ scope: 'cves', cves: ['a', 'b', 'c', 'd', 'e'] }, t)).toBe(
      'a, b, c +2',
    );
    expect(campaignDescription({ scope: 'priority', priority: 'kev' }, t)).toBe(
      't:cyberSecurity.patch.campaign.priority.kev',
    );
    expect(campaignDescription({ scope: 'all' }, t)).toBe(
      't:cyberSecurity.patch.campaign.scope.all',
    );
    expect(
      campaignProgress({ successCount: 3, partialCount: 1, nothingCount: 2, targetCount: 10 }),
    ).toBe('6 / 10');
    expect(campaignStatusTone('halted')).toBe('chip-warning');
  });

  it('translates reason codes and falls back for unknown ones', () => {
    expect(skipReasonKey('open_run')).toBe('cyberSecurity.patch.campaign.reason.open_run');
    expect(skipReasonKey('x')).toBe('cyberSecurity.patch.campaign.reason.unknown');
  });

  it('builds the preview and create bodies', () => {
    expect(campaignPreviewBody({ scope: 'cves', cves: ['CVE-1'] })).toEqual({
      scope: 'cves',
      cves: ['CVE-1'],
    });
    const values = {
      mode: 'immediate',
      reason: ' Exploited now ',
      confirm: 'CORRIGIR',
      canarySize: 1,
      maxParallel: '',
      maxFailures: '5',
      rebootPolicy: 'server_policy',
      approveNow: 'yes',
    };
    expect(campaignPayload({ scope: 'priority', priority: 'P0' }, values)).toEqual({
      scope: 'priority',
      priority: 'P0',
      mode: 'immediate',
      rebootPolicy: 'server_policy',
      canarySize: 1,
      maxParallel: undefined,
      maxFailures: 5,
      reason: 'Exploited now',
      confirm: 'CORRIGIR',
      approveNow: true,
    });
    const platform = campaignPayload({ scope: 'all' }, values, true);
    expect(platform['rebootPolicy']).toBe('never');
    expect(platform['approveNow']).toBe(false);
    const window = campaignPayload({ scope: 'all' }, { ...values, mode: 'window' });
    expect(window['mode']).toBe('window');
    expect('confirm' in window).toBe(false);
  });

  it('uses the account chosen in the form and formats the duration', () => {
    const target = { scope: 'all' as const, cyberAccountUUID: 'acc-1' };
    const body = (values: Record<string, unknown>) =>
      campaignPayload(target, { mode: 'window', reason: 'xxxxx', ...values });
    expect(body({ cyberAccountUUID: 'acc-2' })['cyberAccountUUID']).toBe('acc-2');
    expect('cyberAccountUUID' in body({ cyberAccountUUID: '' })).toBe(false);
    const lookup = { endpoint: 'cyber-security/accounts', uuidField: 'a', labelField: 'b' };
    const form = campaignForm(target, false, lookup);
    expect(form.fields.find((f) => f.key === 'cyberAccountUUID')?.span).toBe(1);
    expect(form.initialValues?.['cyberAccountUUID']).toBe('acc-1');
    expect(
      campaignForm(target, true, lookup).fields.some((f) => f.key === 'cyberAccountUUID'),
    ).toBe(false);
    expect(campaignDuration(42, () => 'min')).toBe('42 min');
    expect(campaignDuration(65, () => 'min')).toBe('1 h 5 min');
    expect(campaignDuration(null, () => 'min')).toBe('');
  });

  it('carries the selected account in the preview and create bodies', () => {
    const target = { scope: 'all' as const, cyberAccountUUID: 'acc-1' };
    expect(campaignPreviewBody(target)['cyberAccountUUID']).toBe('acc-1');
    expect(campaignPayload(target, { mode: 'window', reason: 'xxxxx' })['cyberAccountUUID']).toBe(
      'acc-1',
    );
    expect('cyberAccountUUID' in campaignPreviewBody({ scope: 'all' })).toBe(false);
    expect('cyberAccountUUID' in campaignPayload({ scope: 'all' }, { mode: 'window' })).toBe(false);
  });

  it('posts the form to the campaigns and hides platform-only choices', () => {
    const form = campaignForm({ scope: 'cves', cves: ['CVE-1'] });
    expect(form.endpoint).toBe('cyber-security/patch/campaigns');
    expect(form.fields.map((f) => f.key)).toContain('approveNow');
    expect(
      form.fields
        .find((f) => f.key === 'confirm')!
        .hiddenWhen?.({
          editing: false,
          values: { mode: 'window' },
        }),
    ).toBe(true);
    const keys = platformCampaignForm(form).fields.map((f) => f.key);
    expect(keys).not.toContain('rebootPolicy');
    expect(keys).not.toContain('approveNow');
    expect(
      campaignForm({ scope: 'all' }, true).payload?.({ mode: 'window', reason: 'xxxxx' }, false),
    ).toEqual(jasmine.objectContaining({ mode: 'window', approveNow: false }));
  });

  it('maps emergency menu keys to targets', () => {
    expect(targetFromEmergencyKey('campaignEmergency_kev')).toEqual({
      scope: 'priority',
      priority: 'kev',
    });
    expect(targetFromEmergencyKey('campaignEmergency_all')).toEqual({ scope: 'all' });
    expect(targetFromEmergencyKey('other')).toBeNull();
  });

  it('summarises the preview with the left-out servers', () => {
    const summary = previewSummary(
      {
        eligible: 1,
        items: [
          { agentName: 'a', eligible: true, reason: null },
          { agentName: 'b', eligible: false, reason: 'macos' },
        ],
      },
      t,
    );
    expect(summary.eligible).toBe(1);
    expect(summary.message).toContain('"skipped":1');
    expect(summary.message).toContain('b: t:cyberSecurity.patch.campaign.reason.macos');
  });

  it('summarises the simulation: counts, removals, reboot, failures, capability, pending', () => {
    const text = simulationSummary(
      [
        {
          agentName: 'web1',
          status: 'completed',
          upgradeCount: 3,
          installCount: 1,
          removeCount: 5,
          updateCount: 0,
          rebootLikely: true,
          remove: ['a', 'b', 'c', 'd', 'e'].map((name) => ({ name })),
        },
        { agentName: 'win1', status: 'completed', updateCount: 2, upgradeCount: 0 },
        { agentName: 'db1', status: 'failed', error: 'boom' },
        { agentName: 'old1', status: 'no_capability' },
        { agentName: 'busy1', status: 'patch_running' },
        { agentName: 'slow1', status: 'running' },
      ],
      t,
      1,
    );
    expect(text).toContain('"done":2,"total":6,"upgrade":5,"install":1,"remove":5');
    expect(text).toContain('web1: t:cyberSecurity.patch.campaign.simulationRemove a, b, c (+2)');
    expect(text).toContain('simulationReboot');
    expect(text).toContain('db1: boom');
    expect(text).toContain('simulationNoCapability');
    expect(text).toContain('simulationPatchRunning');
    expect(text).toContain('simulationPending');
    expect(simulationSummary([{ status: 'nothing' }], t)).not.toContain('simulationRemoveWarning');
  });

  it('polls only while servers are pending and the limit is not reached', () => {
    expect(shouldPollSimulation(2, 0)).toBe(true);
    expect(shouldPollSimulation(0, 0)).toBe(false);
    expect(shouldPollSimulation(2, 45000)).toBe(false);
    expect(shouldPollSimulation(2, 42000)).toBe(true);
  });

  it('offers the CVE fix only with servers that have a fix', () => {
    const starts: unknown[] = [];
    const action = fixEverywhereAction((target) => starts.push(target));
    expect(action.visible?.({ serverCount: 2, fixState: 'fixed' })).toBe(true);
    expect(action.visible?.({ serverCount: 0, fixState: 'fixed' })).toBe(false);
    expect(action.visible?.({ serverCount: 2, fixState: 'no_fix' })).toBe(false);
    void action.run?.({ code: 'CVE-9' });
    expect(starts).toEqual([{ scope: 'cves', cves: ['CVE-9'] }]);
  });

  it('shows runs sorted by wave', () => {
    const view = campaignView(
      {
        status: 'running',
        scope: 'all',
        mode: 'window',
        runs: [
          { agentName: 'late', wave: 2, state: 'running' },
          { agentName: 'early', wave: 0, state: 'success' },
        ],
        skipped: [{ agentName: 's', reason: 'macos' }],
        events: [{ type: 'created', createdAt: '2026-11-20' }],
      },
      t,
    );
    const runs = view.sections!.find((s) => s.title === 't:cyberSecurity.patch.campaign.runs')!;
    expect(runs.table!.rows.map((r) => r['agent'])).toEqual(['early', 'late']);
    expect(view.sections!.length).toBe(4);
  });

  it('offers the reboot only on a finished patch campaign and never on the platform', () => {
    expect(canRebootCampaign({ status: 'completed', rebootOnly: false })).toBe(true);
    expect(canRebootCampaign({ status: 'halted' })).toBe(true);
    expect(canRebootCampaign({ status: 'aborted' })).toBe(true);
    expect(canRebootCampaign({ status: 'running' })).toBe(false);
    expect(canRebootCampaign({ status: 'completed', rebootOnly: true })).toBe(false);
    const reboot = (platform: boolean) =>
      campaignRowActions(() => undefined, { platform }).find((a) => a.key === 'campaign_reboot')!;
    expect(reboot(false).visible?.({ status: 'completed' })).toBe(true);
    expect(reboot(true).visible?.({ status: 'completed' })).toBe(false);
    expect(campaignsCollection(() => undefined).rowActions?.map((a) => a.key)).toContain(
      'campaign_reboot',
    );
  });

  it('builds the reboot body and hides approve now when a second person approves', () => {
    expect(
      rebootPayload({ mode: 'immediate', reason: ' patch ok ', confirm: 'CORRIGIR ' }),
    ).toEqual({
      mode: 'immediate',
      maxParallel: 1,
      reason: 'patch ok',
      confirm: 'CORRIGIR',
      approveNow: false,
    });
    expect(
      rebootPayload({ mode: 'window', maxParallel: '5', reason: 'r', approveNow: 'yes' }),
    ).toEqual({ mode: 'window', maxParallel: 5, reason: 'r', approveNow: true });
    expect(rebootPayload({ mode: 'window', reason: 'r', approveNow: 'yes' }, true)).toEqual({
      mode: 'window',
      maxParallel: 1,
      reason: 'r',
      approveNow: false,
    });
    const row = { campaignUUID: 'c1' };
    expect(rebootForm(row).endpoint).toBe('cyber-security/patch/campaigns/c1/reboot');
    expect(rebootForm(row).fields.some((f) => f.key === 'approveNow')).toBe(true);
    expect(rebootForm(row, true).fields.some((f) => f.key === 'approveNow')).toBe(false);
    const target = { scope: 'all' as const };
    const keys = (form: ReturnType<typeof campaignForm>) => form.fields.map((f) => f.key);
    expect(keys(campaignForm(target))).toContain('approveNow');
    expect(keys(campaignForm(target, false, undefined, true))).not.toContain('approveNow');
  });
});
