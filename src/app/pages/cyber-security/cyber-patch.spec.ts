import {
  findingPatchAction,
  patchPolicyForm,
  patchRunsCollection,
  patchServerActions,
  policyPayload,
  runStateTone,
  runView,
  windowLabel,
} from './cyber-patch';

const t = (key: string) => `t:${key}`;

describe('Cyber Security patch management views', () => {
  it('describes the window and builds the policy body with the revision', () => {
    expect(
      windowLabel(
        { enabled: true, windowDays: ['sat', 'sun'], windowStart: '02:00', windowMinutes: 180 },
        t,
      ),
    ).toBe('t:cyberSecurity.patch.dayShort.sat, t:cyberSecurity.patch.dayShort.sun · 02:00 · 3 h');
    expect(windowLabel({ enabled: false }, t)).toBe('');
    expect(
      policyPayload(
        {
          windowDays: ['mon'],
          windowStart: '03:30:00',
          windowMinutes: '90',
          rebootPolicy: 'never',
        },
        { enabled: true, revision: 4 },
      ),
    ).toEqual({
      enabled: true,
      windowDays: ['mon'],
      windowStart: '03:30',
      windowMinutes: 90,
      rebootPolicy: 'never',
      revision: 4,
    });
    expect(
      policyPayload({ windowDays: 'sat,sun' }, { enabled: false, revision: 2 })['revision'],
    ).toBeNull();
  });

  it('posts the policy form to the server and starts with a weekend window', () => {
    const form = patchPolicyForm({ agentUUID: 'agent-1', enabled: false });
    expect(form.endpoint).toBe('cyber-security/patch/servers/agent-1');
    expect(form.initialValues).toEqual({
      windowDays: ['sat', 'sun'],
      windowStart: '02:00',
      windowMinutes: 180,
      rebootPolicy: 'if_required',
    });
  });

  it('shows each server action only when it applies', () => {
    const actions = Object.fromEntries(patchServerActions().map((action) => [action.key, action]));
    const off = { enabled: false, patchSupported: false };
    const on = { enabled: true, patchSupported: true, openFixable: 2, revision: 5, agentUUID: 'a' };
    expect(actions['patchEnable'].visible?.(off)).toBeTrue();
    expect(actions['patchEnable'].disabledReason?.(off)).toBe('cyberSecurity.patch.agentOutdated');
    expect(actions['patchRequest'].visible?.(on)).toBeTrue();
    expect(actions['patchRequest'].visible?.({ ...on, openFixable: 0 })).toBeFalse();
    expect(
      actions['patchRequest'].visible?.({ ...on, openFixable: 0, packageManager: 'windows' }),
    ).toBeTrue();
    expect(actions['patchDisable'].request?.body?.(on)).toEqual({ enabled: false, revision: 5 });
  });

  it('approves, rejects and cancels runs only in their states and asks for a patch from a finding', () => {
    const runs = patchRunsCollection(() => undefined, { agentUUID: 'a b', agentName: 'web' });
    expect(runs.endpoint).toBe('cyber-security/patch/runs?agentUUID=a%20b');
    const actions = Object.fromEntries(
      (runs.rowActions ?? []).map((action) => [action.key, action]),
    );
    expect(actions['approve'].visible?.({ state: 'requested' })).toBeTrue();
    expect(actions['approve'].visible?.({ state: 'approved' })).toBeFalse();
    expect(actions['approveNow'].request?.body?.({})).toEqual({ immediate: true });
    expect(actions['cancel'].visible?.({ state: 'approved' })).toBeTrue();
    expect(actions['reject'].request?.endpoint({ runUUID: 'r1' })).toBe(
      'cyber-security/patch/runs/r1/reject',
    );
    expect(
      findingPatchAction.visible?.({ status: 'open', fixState: 'no_fix', agentUUID: 'a' }),
    ).toBeFalse();
    expect(
      findingPatchAction.request?.body?.({ agentUUID: 'a', findingUUID: 'f', status: 'open' }),
    ).toEqual({
      agentUUID: 'a',
      findingUUIDs: ['f'],
    });
    expect(runStateTone('failed')).toBe('chip-failed');
  });

  it('shows the updated packages and the Agent output of a run', () => {
    const view = runView(
      {
        state: 'success',
        findingCount: 2,
        fixedFindings: 2,
        rebootPolicy: 'never',
        agentName: 'web',
        result: {
          updated: [{ name: 'openssl', from: '1', to: '2' }],
          rebootScheduled: false,
          output: 'done',
        },
      },
      t,
    );
    expect(view.sections?.map((section) => section.title)).toEqual([
      't:cyberSecurity.patch.summary',
      't:cyberSecurity.patch.updated',
      't:cyberSecurity.patch.output',
    ]);
    expect(view.sections?.[1].table?.rows).toEqual([{ name: 'openssl', from: '1', to: '2' }]);
  });
});
