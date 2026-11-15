import { assistEntries } from './remote-assistant';
import {
  RunbookDefinition,
  RunbookRun,
  autonomyBlockReason,
  definitionBody,
  definitionOf,
  definitionProblems,
  paramFieldError,
  paramFormErrors,
  paramValueValid,
  passwordCredentials,
  rollbackAllowed,
  canResolveRotation,
  rotationErrorKey,
  rotationStateKey,
  stepChipClass,
  stepStatusKey,
  runCard,
  runErrorKey,
  runParamValues,
  runbookMark,
  runbookRequestErrorKey,
  splitLines,
} from './remote-runbook';
import { RemoteEvent } from './remote-session';

const ev = (seq: number, kind: string, data: Record<string, unknown> = {}): RemoteEvent => ({
  SreSeq: seq,
  SreKind: kind,
  SreText: '',
  SreData: data,
  SreDateCreated: '2026-11-14T12:00:00Z',
});
const apiError = (code: string, status: number) => ({ status, error: { code } });

describe('runbook parameter validation', () => {
  it('validates values by type like the API', () => {
    expect(paramValueValid('word', 'ether1-wan')).toBe(true);
    expect(paramValueValid('word', 'a b')).toBe(false);
    expect(paramValueValid('word', 'x'.repeat(65))).toBe(false);
    expect(paramValueValid('int', '-42')).toBe(true);
    expect(paramValueValid('int', '1234567890')).toBe(false);
    expect(paramValueValid('ipv4', '192.0.2.10')).toBe(true);
    expect(paramValueValid('ipv4', '256.0.2.10')).toBe(false);
    expect(paramValueValid('cidr', '192.0.2.0/24')).toBe(true);
    expect(paramValueValid('cidr', '192.0.2.0/33')).toBe(false);
    expect(paramValueValid('cidr', '192.0.2.0')).toBe(false);
    expect(paramValueValid('mac', 'x')).toBe(false);
  });

  it('names the problem of each field and leaves empty optional ones out', () => {
    const required = { name: 'ip', label: 'IP', type: 'ipv4', required: true } as const;
    const optional = { name: 'n', label: 'Name', type: 'int', required: false } as const;
    expect(paramFieldError(required, ' ')).toBe('support.remote.runbooks.run.paramRequired');
    expect(paramFieldError(required, '10.0.0')).toBe('support.remote.runbooks.run.invalid.ipv4');
    expect(paramFieldError(optional, '')).toBe('');
    expect(paramFormErrors([required, optional], { ip: '10.0.0.1', n: 'x' })).toEqual({
      n: 'support.remote.runbooks.run.invalid.int',
    });
    expect(runParamValues([required, optional], { ip: ' 10.0.0.1 ', n: '' })).toEqual({
      ip: '10.0.0.1',
    });
  });
});

describe('runbook editor model', () => {
  const valid: RunbookDefinition = {
    name: 'Trocar DNS',
    description: null,
    dialect: 'linux',
    status: 'draft',
    params: [{ name: 'dns', label: 'DNS', type: 'ipv4', required: true }],
    preconditions: [],
    steps: [
      { title: 'Ler', kind: 'read', commands: ['uname -a'], verify: [], rollback: [] },
      {
        title: 'Mudar',
        kind: 'change',
        commands: ['echo {{dns}}'],
        verify: ['cat /etc/resolv.conf'],
        rollback: ['true'],
      },
    ],
  };

  it('accepts a valid definition and flags the invalid ones', () => {
    expect(definitionProblems(valid)).toEqual([]);
    const broken: RunbookDefinition = {
      ...valid,
      name: ' ',
      params: [{ name: 'Bad', label: '', type: 'word', required: true }],
      steps: [{ title: '', kind: 'change', commands: ['x {{other}}'], verify: [], rollback: [] }],
    };
    expect(definitionProblems(broken)).toEqual([
      'support.remote.runbooks.problem.name',
      'support.remote.runbooks.problem.params',
      'support.remote.runbooks.problem.step',
      'support.remote.runbooks.problem.verify',
      'support.remote.runbooks.problem.rollback',
      'support.remote.runbooks.problem.placeholder',
    ]);
    expect(definitionProblems({ ...valid, steps: [] })).toContain(
      'support.remote.runbooks.problem.steps',
    );
  });

  it('keeps rollback only for linux and proxmox change steps', () => {
    expect(rollbackAllowed('linux', 'change')).toBe(true);
    expect(rollbackAllowed('proxmox', 'change')).toBe(true);
    expect(rollbackAllowed('routeros', 'change')).toBe(false);
    expect(rollbackAllowed('linux', 'read')).toBe(false);
    const body = definitionBody({ ...valid, dialect: 'routeros' }) as {
      steps: { rollback: string[]; verify: string[] }[];
    };
    expect(body.steps[1].rollback).toEqual([]);
    expect(body.steps[0].verify).toEqual([]);
  });

  it('reads JSON columns as arrays or strings and splits lines', () => {
    const def = definitionOf({
      SrbName: 'A',
      SrbDialect: 'vrp',
      SrbStatus: 'active',
      SrbParams: '[{"name":"p","label":"Name","type":"int","required":1}]',
      SrbSteps: [{ title: 'T', kind: 'change', commands: ['a'], verify: ['b'] }],
    });
    expect(def.dialect).toBe('vrp');
    expect(def.params[0]).toEqual({ name: 'p', label: 'Name', type: 'int', required: true });
    expect(def.steps[0].rollback).toEqual([]);
    expect(splitLines(' a \r\n\n b\n')).toEqual(['a', 'b']);
  });

  it('explains why autonomy cannot be enabled', () => {
    expect(autonomyBlockReason({ SrbStatus: 'draft', AutonomyRemaining: 0 })).toBe(
      'support.remote.runbooks.autonomy.needsActive',
    );
    expect(autonomyBlockReason({ SrbStatus: 'active', AutonomyRemaining: 2 })).toBe(
      'support.remote.runbooks.autonomy.history',
    );
    expect(autonomyBlockReason({ SrbStatus: 'active', AutonomyRemaining: 0 })).toBeNull();
    expect(autonomyBlockReason({ SrbStatus: 'active', SrbAutonomous: 1 })).toBeNull();
  });
});

describe('run card', () => {
  const run = (patch: Partial<RunbookRun>): RunbookRun => ({
    SrxUUID: 'r1',
    SrxMode: 'supervised',
    SrxStatus: 'waiting_approval',
    SrxStep: 1,
    SrxRevision: 3,
    StepCount: 3,
    SrxResult: [
      { step: -1, kind: 'preconditions', status: 'ok' },
      { step: 0, kind: 'read', status: 'ok' },
    ],
    ...patch,
  });
  const events = [
    ev(1, 'runbook_step', { runUUID: 'r1', step: 0, title: 'Ler', kind: 'read', status: 'ok' }),
    ev(2, 'runbook_step', { runUUID: 'other', step: 1, title: 'Outro', kind: 'read' }),
  ];

  it('marks the current step and counts from one', () => {
    const card = runCard(run({}), events);
    expect(card.active).toBe(true);
    expect(card.currentNumber).toBe(2);
    expect(card.total).toBe(3);
    expect(card.preconditions?.status).toBe('ok');
    expect(card.steps.map((s) => s.status)).toEqual(['ok', 'waiting_approval', 'pending']);
    expect(card.steps[0].title).toBe('Ler');
    expect(card.steps[1].current).toBe(true);
    expect(card.steps[1].title).toBe('');
  });

  it('has no current step once finished and translates the error code', () => {
    const card = runCard(
      run({
        SrxStatus: 'failed',
        SrxError: 'SUPPORT_REMOTE_RUNBOOK_STEP_FAILED',
        SrxResult: '[{"step":1,"kind":"change","status":"failed","proposalUUID":"p1"}]',
      }),
      [],
    );
    expect(card.active).toBe(false);
    expect(card.currentNumber).toBe(0);
    expect(card.steps[1].status).toBe('failed');
    expect(card.steps[1].proposalUUID).toBe('p1');
    expect(card.errorKey).toBe('support.remote.runbooks.runError.SUPPORT_REMOTE_RUNBOOK_STEP_FAILED');
    expect(runErrorKey('NEW_CODE')).toBe('support.remote.runbooks.runError.unknown');
    expect(runErrorKey('')).toBe('');
  });

  it('takes titles from the finished event too', () => {
    const finished = ev(5, 'runbook_finished', {
      runUUID: 'r1',
      status: 'succeeded',
      steps: [{ step: 2, title: 'Fim', kind: 'read', status: 'ok' }],
    });
    expect(runCard(run({ SrxStatus: 'succeeded' }), [finished]).steps[2].title).toBe('Fim');
  });
});

describe('rotation and timeline helpers', () => {
  it('lists only live password credentials', () => {
    const rows = [
      { NwcUUID: '1', NwcKind: 'password', NwcState: 'stored' },
      { NwcUUID: '2', NwcKind: 'ssh_key', NwcState: 'stored' },
      { NwcUUID: '3', NwcKind: 'password', NwcState: 'deleting' },
    ];
    expect(passwordCredentials(rows).map((r) => r['NwcUUID'])).toEqual(['1']);
  });

  it('explains each rotation state', () => {
    expect(rotationStateKey({ ScrState: 'promoting' })).toBe(
      'support.remote.runbooks.rotation.help.promoting',
    );
    expect(rotationStateKey({ ScrState: 'weird' })).toBe(
      'support.remote.runbooks.rotation.help.unknown',
    );
  });

  it('reloads on runbook and rotation events only', () => {
    expect(runbookMark([ev(3, 'note'), ev(4, 'runbook_step'), ev(7, 'credential_rotated')])).toBe(7);
    expect(runbookMark([ev(3, 'note')])).toBe(0);
  });

  it('turns a runbook suggestion into its own chat entry', () => {
    const entries = assistEntries([
      {
        ...ev(9, 'ai_exec', {
          tool: 'support.runbook.suggest',
          status: 'suggested',
          runbook: { runbookUUID: 'rb1', name: 'Trocar DNS', params: { dns: '1.1.1.1' } },
        }),
        NetworkDeviceNwdUUID: 'dev1',
        DeviceName: 'rb-centro',
      },
      ev(10, 'ai_exec', { tool: 'support.device.read', status: 'ok', commands: [] }),
    ]);
    expect(entries[0]).toEqual(
      jasmine.objectContaining({
        type: 'suggest',
        runbookUUID: 'rb1',
        params: { dns: '1.1.1.1' },
        deviceUUID: 'dev1',
        device: 'rb-centro',
      }),
    );
    expect(entries[1].type).toBe('exec');
  });

  it('maps the API error codes to translated messages', () => {
    expect(runbookRequestErrorKey(apiError('SUPPORT_REMOTE_RUNBOOK_BUSY', 409))).toBe(
      'support.remote.runbooks.error.busy',
    );
    expect(runbookRequestErrorKey(apiError('SUPPORT_REMOTE_ROTATION_LEVEL', 403))).toBe(
      'support.remote.runbooks.error.rotationLevel',
    );
    expect(runbookRequestErrorKey(apiError('SUPPORT_REMOTE_REVISION_CONFLICT', 409))).toBe(
      'support.remote.error.revision',
    );
    expect(runbookRequestErrorKey(apiError('OTHER', 400))).toBe(
      'support.remote.runbooks.error.invalid',
    );
    expect(runbookRequestErrorKey(apiError('OTHER', 500))).toBe('');
  });

  it('knows the proposal-driven step statuses and rotation error codes', () => {
    for (const status of ['proposed', 'applying', 'rejected', 'expired']) {
      expect(stepStatusKey(status)).toBe(`support.remote.runbooks.step.status.${status}`);
    }
    expect(stepChipClass('proposed')).toBe('chip-warning');
    expect(stepChipClass('rejected')).toBe('chip-skipped');
    expect(rotationErrorKey('SUPPORT_REMOTE_ROTATION_PROMOTE_RETRY_2')).toBe(
      'support.remote.runbooks.rotation.error.promoteRetry',
    );
    expect(rotationErrorKey('EXEC_FAILED')).toBe('support.remote.runbooks.rotation.error.exec');
    expect(rotationErrorKey('')).toBe('');
  });

  it('requires rollback commands for linux change steps and checks contains placeholders', () => {
    const base: RunbookDefinition = {
      name: 'X',
      description: null,
      dialect: 'linux',
      status: 'draft',
      params: [],
      preconditions: [{ command: 'id', contains: '{{ghost}}', negate: false }],
      steps: [{ title: 'T', kind: 'change', commands: ['a'], verify: ['b'], rollback: [] }],
    };
    expect(definitionProblems(base)).toEqual([
      'support.remote.runbooks.problem.rollback',
      'support.remote.runbooks.problem.placeholder',
    ]);
  });

  it('offers the rotation answer only while it needs attention', () => {
    expect(canResolveRotation({ ScrState: 'needs_attention' })).toBe(true);
    expect(canResolveRotation({ ScrState: 'promoting' })).toBe(false);
    expect(canResolveRotation({ ScrState: 'done' })).toBe(false);
  });
});
