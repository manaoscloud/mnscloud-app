import { sameUUID, testFactDetails } from './devices/device-connections';
import { deviceConsoleSocketUrl } from './devices/device-console';
import {
  DeviceConsoleAnswer,
  DeviceConsoleSession,
  DeviceConsoleVerdict,
  DeviceConsoleView,
  deviceConsoleCloseMessage,
  parseVerdict,
} from './devices/device-console-session';

type Question = {
  verdict: DeviceConsoleVerdict;
  signal: AbortSignal;
  answer: (value: DeviceConsoleAnswer) => void;
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness() {
  const sent: string[] = [];
  const output: string[] = [];
  const questions: Question[] = [];
  const resolved: string[] = [];
  const view: DeviceConsoleView = {
    ready: () => undefined,
    output: (data) => output.push(data),
    state: () => undefined,
    hostKey: () => undefined,
    blocked: () => undefined,
    resolved: (id, decision) => resolved.push(`${id}:${decision}`),
    notice: () => undefined,
    confirm: (verdict, signal) =>
      new Promise<DeviceConsoleAnswer>((resolve) => {
        questions.push({ verdict, signal, answer: resolve });
        signal.addEventListener('abort', () => resolve(null));
      }),
  };
  const session = new DeviceConsoleSession((frame) => sent.push(frame), view);
  return { session, sent, output, questions, resolved };
}

const verdict = (extra: Record<string, unknown> = {}) =>
  `3:${JSON.stringify({
    type: 'verdict',
    id: 'v1-ab12',
    line: '/ip address add address=10.0.0.1/24 interface=ether2',
    class: 'write_reversible',
    unknown: false,
    requires: 'confirm',
    step: 1,
    expiresInSeconds: 120,
    ...extra,
  })}`;

describe('DeviceConsoleSession', () => {
  it('sends input and resize only after the handshake', () => {
    const { session, sent } = harness();
    session.input('x');
    session.resize({ cols: 100, rows: 30 });
    expect(sent).toEqual([]);
    session.receive('OK');
    session.input('◆');
    session.resize({ cols: 100, rows: 30 });
    expect(sent).toEqual(['0:3:◆', '1:100:30:']);
  });

  it('writes only framed output', () => {
    const { session, output } = harness();
    session.receive('OK');
    session.receive('0:6:[admin');
    session.receive('raw text');
    session.receive('0:2:] ');
    expect(output).toEqual(['[admin', '] ']);
  });

  it('confirms a write with the command shown by the gateway', async () => {
    const { session, sent, questions } = harness();
    session.receive('OK');
    session.receive(verdict());
    expect(questions.length).toBe(1);
    expect(questions[0].verdict.line).toContain('/ip address add');
    expect(questions[0].verdict.commandClass).toBe('write_reversible');
    questions[0].answer(true);
    await flush();
    expect(sent).toEqual(['4:{"type":"confirm","id":"v1-ab12","step":1}']);
  });

  it('denies when the user refuses', async () => {
    const { session, sent, questions } = harness();
    session.receive('OK');
    session.receive(verdict());
    questions[0].answer(false);
    await flush();
    expect(sent).toEqual(['4:{"type":"deny","id":"v1-ab12"}']);
  });

  it('asks twice for a destructive command, each answer with its step', async () => {
    const { session, sent, questions } = harness();
    session.receive('OK');
    session.receive(verdict({ class: 'destructive', requires: 'double_confirm' }));
    questions[0].answer(true);
    await flush();
    session.receive(verdict({ class: 'destructive', requires: 'double_confirm', step: 2 }));
    expect(questions.length).toBe(2);
    expect(questions[1].verdict.step).toBe(2);
    questions[1].answer(true);
    await flush();
    expect(sent).toEqual([
      '4:{"type":"confirm","id":"v1-ab12","step":1}',
      '4:{"type":"confirm","id":"v1-ab12","step":2}',
    ]);
  });

  it('dismisses the question when the gateway resolves it and sends nothing', async () => {
    const { session, sent, questions, resolved } = harness();
    session.receive('OK');
    session.receive(verdict());
    session.receive('3:{"type":"resolved","id":"v1-ab12","decision":"expired"}');
    expect(questions[0].signal.aborted).toBeTrue();
    questions[0].answer(true);
    await flush();
    expect(sent).toEqual([]);
    expect(resolved).toEqual(['v1-ab12:expired']);
  });

  it('dismisses open questions when the socket closes', async () => {
    const { session, sent, questions } = harness();
    session.receive('OK');
    session.receive(verdict());
    session.end();
    expect(questions[0].signal.aborted).toBeTrue();
    await flush();
    expect(sent).toEqual([]);
  });

  it('expires a question after the time the gateway gave', async () => {
    jasmine.clock().install();
    try {
      const { session, questions } = harness();
      session.receive('OK');
      session.receive(verdict({ expiresInSeconds: 5 }));
      jasmine.clock().tick(5001);
      expect(questions[0].signal.aborted).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('treats a verdict without a class as unknown and ignores one without an id', () => {
    expect(parseVerdict({ id: 'v2' })?.commandClass).toBe('unknown');
    expect(parseVerdict({ line: 'x' })).toBeNull();
  });

  it('maps the gateway close codes and builds the relay URL with the ticket', () => {
    expect(deviceConsoleCloseMessage(4409)).toBe('network.console.close4409');
    expect(deviceConsoleCloseMessage(1006)).toBe('network.console.close4500');
    expect(deviceConsoleSocketUrl('wss://app.example.com/access-gateway/gw-dev1/ws', 'a_b-c')).toBe(
      'wss://app.example.com/access-gateway/gw-dev1/ws?ticket=a_b-c',
    );
  });
});

describe('device connections', () => {
  it('shows the access-test facts as key/value rows', () => {
    expect(
      testFactDetails({ AgcTestFacts: { identity: 'RB-Centro', version: '7.16', empty: '' } }),
    ).toEqual([
      { label: 'identity', value: 'RB-Centro', monospace: true },
      { label: 'version', value: '7.16', monospace: true },
    ]);
    expect(testFactDetails({ AgcTestFacts: '{"board":"CCR2004","uptime":{"days":3}}' })).toEqual([
      { label: 'board', value: 'CCR2004', monospace: true },
      { label: 'uptime', value: '{"days":3}', monospace: true },
    ]);
    expect(testFactDetails({ AgcTestFacts: null })).toEqual([]);
  });

  it('lets only the actor close a connection (UUID forms compared)', () => {
    expect(
      sameUUID('0B8C9C3A4F6C4D649F151E27AD2F6A1B', '0b8c9c3a-4f6c-4d64-9f15-1e27ad2f6a1b'),
    ).toBeTrue();
    expect(
      sameUUID('0B8C9C3A4F6C4D649F151E27AD2F6A1B', 'ffffffff-4f6c-4d64-9f15-1e27ad2f6a1b'),
    ).toBeFalse();
    expect(sameUUID('', '')).toBeFalse();
  });
});
