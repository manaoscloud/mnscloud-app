import {
  draftBody,
  issuesFromError,
  parseGraph,
  stateVariables,
  toFlowDetail,
  toNodeTypes,
  toRunDetail,
  toSimulation,
  toValidation,
} from './automation-adapter';

describe('automation adapter', () => {
  it('maps node types and tolerates string ports', () => {
    const types = toNodeTypes({
      data: {
        items: [
          {
            type: 'core.condition',
            typeVersion: 1,
            module: 'core',
            ports: ['true', { id: 'false', label: 'No' }],
            configSchema: { type: 'object' },
            effect: 'read',
            locked: false,
          },
          { type: 'conversations.ask', locked: 1, lockReason: 'module_not_contracted' },
          { notype: true },
        ],
      },
    });
    expect(types.length).toBe(2);
    expect(types[0].ports).toEqual([
      { id: 'true', label: 'true' },
      { id: 'false', label: 'No' },
    ]);
    expect(types[1].module).toBe('conversations');
    expect(types[1].locked).toBeTrue();
    expect(types[1].lockReason).toBe('module_not_contracted');
  });

  it('reads a flow with a graph sent as a JSON string and the draft lock', () => {
    const flow = toFlowDetail({
      data: {
        item: {
          AflUUID: 'f1',
          AflName: 'Welcome',
          AflRevision: 4,
          AflPublishedVersion: 2,
          AflDraftGraph: JSON.stringify({
            schemaVersion: 1,
            start: 'trigger',
            nodes: [{ id: 'trigger', type: 'core.trigger', position: { x: 1, y: 2 } }],
            edges: [{ from: 'trigger', port: 'next', to: 'x' }],
          }),
          AflDraftEditorUsrUUID: 'u1',
          DraftEditorName: 'Maria',
          AflDraftEditedAt: '2026-11-12T10:00:00Z',
          AflTestContacts: '["c1","c2"]',
        },
      },
    });
    expect(flow.revision).toBe(4);
    expect(flow.publishedVersion).toBe(2);
    expect(flow.graph.nodes[0].position).toEqual({ x: 1, y: 2 });
    expect(flow.graph.edges.length).toBe(1);
    expect(flow.lock?.userName).toBe('Maria');
    expect(flow.testContacts).toEqual(['c1', 'c2']);
  });

  it('survives an empty or broken graph', () => {
    expect(parseGraph('not json').nodes).toEqual([]);
    expect(parseGraph(null).start).toBe('');
    expect(toFlowDetail({}).publishedVersion).toBeNull();
  });

  it('maps the validation, simulation and run shapes', () => {
    const validation = toValidation({
      data: { errors: [{ nodeId: 'a', code: 'x', message: 'Bad' }], warnings: [{ code: 'w' }] },
    });
    expect(validation.errors[0].nodeId).toBe('a');
    expect(validation.warnings[0].message).toBe('');

    const simulation = toSimulation({
      data: {
        messages: [
          { author: 'bot', text: 'Hi', options: [{ id: '1', label: 'Sales' }, 'Support'] },
        ],
        trace: [
          {
            seq: 1,
            nodeId: 'a',
            nodeType: 'core.end',
            port: '',
            result: 'ok',
            durationMs: 3,
            simulated: true,
          },
        ],
        state: { vars: { name: 'Ana', n: 2 } },
        done: false,
        waiting: true,
      },
    });
    expect(simulation.messages[0].options).toEqual(['Sales', 'Support']);
    expect(simulation.trace[0].simulated).toBeTrue();
    expect(stateVariables(simulation.state)).toEqual([
      { name: 'name', value: 'Ana' },
      { name: 'n', value: '2' },
    ]);

    const run = toRunDetail({
      data: { item: { AfrUUID: 'r', AfrState: 'waiting', steps: [{ seq: 2, nodeId: 'x' }] } },
    });
    expect(run.state).toBe('waiting');
    expect(run.steps[0].seq).toBe(2);
  });

  it('sends the draft with the revision and force only when asked', () => {
    const graph = parseGraph(null);
    expect(draftBody(3, graph, false)).toEqual({ revision: 3, graph });
    expect(draftBody(3, graph, true)['force']).toBeTrue();
  });

  it('reads publish rejections', () => {
    expect(
      issuesFromError({ error: { errors: [{ nodeId: 'n', code: 'unreachable', message: 'm' }] } }),
    ).toEqual([{ nodeId: 'n', code: 'unreachable', message: 'm' }]);
    expect(issuesFromError(null)).toEqual([]);
  });
});
