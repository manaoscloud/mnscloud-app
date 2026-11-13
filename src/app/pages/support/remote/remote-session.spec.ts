import {
  RemoteEvent,
  RemoteEventFeed,
  SseParser,
  eventData,
  lastSeq,
  mergeEvents,
  unwrap,
} from './remote-session';

const ev = (seq: number, kind = 'note'): RemoteEvent => ({ SreSeq: seq, SreKind: kind });
const sse = (seq: number) =>
  `id: ${seq}\nevent: session-event\ndata: ${JSON.stringify(ev(seq))}\n\n`;

function streamOf(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe('SseParser', () => {
  it('assembles events split across chunks and drops heartbeats', () => {
    const parser = new SseParser();
    const text = `: heartbeat\n\n${sse(1)}`;
    const first = parser.push(text.slice(0, 30));
    const second = parser.push(text.slice(30));
    const all = [...first, ...second];
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('1');
    expect(all[0].event).toBe('session-event');
    expect(JSON.parse(all[0].data).SreSeq).toBe(1);
  });
});

describe('remote session helpers', () => {
  it('merges by sequence without duplicates', () => {
    const merged = mergeEvents([ev(1), ev(3)], [ev(2), ev(3)]);
    expect(merged.map((e) => e.SreSeq)).toEqual([1, 2, 3]);
    expect(lastSeq(merged)).toBe(3);
  });
  it('parses event data and unwraps the envelope', () => {
    expect(eventData({ ...ev(1), SreData: '{"to":"x"}' })).toEqual({ to: 'x' });
    expect(eventData({ ...ev(1), SreData: 'nope' })).toEqual({});
    expect(eventData({ ...ev(1), SreData: { from: 'a', to: 'b' } })).toEqual({
      from: 'a',
      to: 'b',
    });
    expect(eventData({ ...ev(1), SreData: null })).toEqual({});
    expect(unwrap<{ a: number }>({ data: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrap<{ a: number }>({ a: 2 })).toEqual({ a: 2 });
  });
});

describe('RemoteEventFeed', () => {
  it('delivers streamed events once, in order, and resumes after the last sequence', async () => {
    const got: number[] = [];
    const opened: number[] = [];
    const feed = new RemoteEventFeed({
      after: 1,
      openStream: async (after) => {
        opened.push(after);
        return streamOf([sse(1), sse(2), sse(2), sse(3)]);
      },
      poll: async () => [],
      onEvents: (events) => got.push(...events.map((e) => Number(e.SreSeq))),
      retryMs: 5,
    });
    feed.start();
    await new Promise((resolve) => setTimeout(resolve, 60));
    feed.stop();
    expect(got).toEqual([2, 3]);
    expect(opened[0]).toBe(1);
  });

  it('falls back to polling when the stream keeps failing', async () => {
    const got: number[] = [];
    const modes: string[] = [];
    const feed = new RemoteEventFeed({
      after: 0,
      openStream: async () => new Response('', { status: 503 }),
      poll: async (after) => (after < 2 ? [ev(1), ev(2)] : []),
      onEvents: (events) => got.push(...events.map((e) => Number(e.SreSeq))),
      onMode: (mode) => modes.push(mode),
      retryMs: 1,
      pollMs: 5,
      streamRetryAfterPollsMs: 40,
    });
    feed.start();
    await new Promise((resolve) => setTimeout(resolve, 120));
    feed.stop();
    expect(modes).toContain('polling');
    expect(got).toEqual([1, 2]);
  });

  it('stops and reports a session that is gone (404) instead of polling forever', async () => {
    let gone = 0;
    let polls = 0;
    const feed = new RemoteEventFeed({
      after: 0,
      openStream: async () => new Response('', { status: 404 }),
      poll: async () => {
        polls += 1;
        return [];
      },
      onEvents: () => undefined,
      onGone: () => (gone += 1),
      retryMs: 1,
    });
    feed.start();
    await new Promise((resolve) => setTimeout(resolve, 50));
    feed.stop();
    expect(gone).toBe(1);
    expect(polls).toBe(0);
  });

  it('reconnects when the stream goes silent past the watchdog', async () => {
    let opens = 0;
    const feed = new RemoteEventFeed({
      after: 0,
      openStream: async (_after, signal) => {
        opens += 1;
        return new Response(
          new ReadableStream({
            start(controller) {
              signal.addEventListener('abort', () => controller.error(new Error('aborted')));
            },
          }),
          { status: 200 },
        );
      },
      poll: async () => [],
      onEvents: () => undefined,
      watchdogMs: 10,
      retryMs: 1,
    });
    feed.start();
    await new Promise((resolve) => setTimeout(resolve, 120));
    feed.stop();
    expect(opens).toBeGreaterThan(1);
  });
});
