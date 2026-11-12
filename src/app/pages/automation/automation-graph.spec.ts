import { FlowGraph, NodeTypeDef, TRIGGER_TYPE } from './automation-adapter';
import {
  addNode,
  autoLayout,
  canAddNode,
  connect,
  defaultConfig,
  disconnect,
  emptyGraph,
  inputId,
  listEntries,
  newItem,
  outputId,
  parseConnector,
  portsOf,
  removeNodes,
  unreachableIds,
  updateConfig,
} from './automation-graph';

function def(type: string, ports: string[] = ['next'], extra: Partial<NodeTypeDef> = {}) {
  return {
    type,
    typeVersion: 1,
    module: type.split('.')[0],
    category: '',
    icon: 'extension',
    surfaces: ['conversation'],
    ports: ports.map((id) => ({ id, label: id })),
    configSchema: {},
    effect: 'read',
    locked: false,
    lockReason: '',
    ...extra,
  } satisfies NodeTypeDef;
}

const DEFS = new Map<string, NodeTypeDef>([
  [TRIGGER_TYPE, def(TRIGGER_TYPE)],
  ['core.condition', def('core.condition', ['true', 'false'])],
  ['core.end', def('core.end', [])],
  ['conversations.send_message', def('conversations.send_message')],
  ['core.switch', def('core.switch', [])],
  ['conversations.ask', def('conversations.ask', [])],
]);

function sample(): FlowGraph {
  let graph = emptyGraph();
  const a = addNode(graph, DEFS.get('core.condition')!, { x: 300, y: 0 });
  const b = addNode(a.graph, DEFS.get('conversations.send_message')!, { x: 600, y: 0 });
  const c = addNode(b.graph, DEFS.get('core.end')!, { x: 600, y: 100 });
  graph = connect(c.graph, { from: 'trigger', port: 'next', to: a.id });
  graph = connect(graph, { from: a.id, port: 'true', to: b.id });
  graph = connect(graph, { from: a.id, port: 'false', to: c.id });
  return connect(graph, { from: b.id, port: 'next', to: c.id });
}

describe('automation graph', () => {
  it('starts with one trigger and refuses a second one', () => {
    const graph = emptyGraph();
    expect(graph.nodes.map((node) => node.type)).toEqual([TRIGGER_TYPE]);
    expect(canAddNode(graph, DEFS.get(TRIGGER_TYPE)!)).toBeFalse();
    expect(canAddNode(graph, DEFS.get('core.end')!)).toBeTrue();
    expect(canAddNode(graph, def('x.locked', [], { locked: true }))).toBeFalse();
  });

  it('gives each new node a unique id', () => {
    let graph = emptyGraph();
    const first = addNode(graph, DEFS.get('core.end')!, { x: 1.4, y: 2.6 });
    graph = first.graph;
    const second = addNode(graph, DEFS.get('core.end')!, { x: 0, y: 0 });
    expect(first.id).not.toBe(second.id);
    expect(graph.nodes[1].position).toEqual({ x: 1, y: 3 });
  });

  it('keeps one edge per output port and never leads into the trigger', () => {
    const graph = sample();
    const condition = graph.nodes[1].id;
    const end = graph.nodes[3].id;
    const rewired = connect(graph, { from: condition, port: 'true', to: end });
    expect(rewired.edges.filter((edge) => edge.from === condition && edge.port === 'true')).toEqual(
      [{ from: condition, port: 'true', to: end }],
    );
    expect(connect(graph, { from: condition, port: 'true', to: 'trigger' })).toBe(graph);
    expect(connect(graph, { from: condition, port: 'true', to: 'missing' })).toBe(graph);
  });

  it('removes a node with its edges but never the trigger', () => {
    const graph = sample();
    const condition = graph.nodes[1].id;
    const removed = removeNodes(graph, [condition, 'trigger']);
    expect(removed.nodes.some((node) => node.id === 'trigger')).toBeTrue();
    expect(removed.nodes.some((node) => node.id === condition)).toBeFalse();
    expect(
      removed.edges.some((edge) => edge.from === condition || edge.to === condition),
    ).toBeFalse();
  });

  it('disconnects one edge', () => {
    const graph = sample();
    const edge = graph.edges[0];
    expect(disconnect(graph, edge).edges.length).toBe(graph.edges.length - 1);
  });

  it('derives switch and ask ports from the config', () => {
    const sw = {
      id: 's',
      type: 'core.switch',
      typeVersion: 1,
      position: { x: 0, y: 0 },
      config: {
        cases: [
          { id: 'a', label: 'A', equals: '1' },
          { id: '', label: 'skip' },
        ],
      },
    };
    expect(portsOf(sw, DEFS.get('core.switch')).map((port) => port.id)).toEqual([
      'case:a',
      'default',
    ]);
    const ask = { ...sw, type: 'conversations.ask', config: { options: [] as unknown[] } };
    expect(portsOf(ask, undefined).map((port) => port.id)).toEqual([
      'answer',
      'invalid',
      'timeout',
    ]);
    ask.config = { options: [{ id: 'x', label: 'X' }] };
    expect(portsOf(ask, undefined).map((port) => port.id)).toEqual([
      'option:x',
      'invalid',
      'timeout',
    ]);
  });

  it('drops edges of a port removed by a config change', () => {
    let graph = emptyGraph();
    const added = addNode(graph, DEFS.get('core.switch')!, { x: 0, y: 0 });
    const end = addNode(added.graph, DEFS.get('core.end')!, { x: 0, y: 0 });
    graph = updateConfig(
      end.graph,
      added.id,
      { cases: [{ id: 'a', label: 'A', equals: '1' }] },
      DEFS,
    );
    graph = connect(graph, { from: added.id, port: 'case:a', to: end.id });
    expect(graph.edges.length).toBe(1);
    graph = updateConfig(graph, added.id, { cases: [] }, DEFS);
    expect(graph.edges.length).toBe(0);
  });

  it('lists the steps by branch with repeats for joins', () => {
    const graph = sample();
    const entries = listEntries(graph, DEFS);
    expect(entries[0]).toEqual({ depth: 0, nodeId: 'trigger', viaPort: '', repeat: false });
    const condition = graph.nodes[1].id;
    const via = entries.filter((entry) => entry.viaPort).map((entry) => entry.viaPort);
    expect(via).toEqual(['true', 'false']);
    expect(entries.some((entry) => entry.repeat)).toBeTrue();
    expect(entries.find((entry) => entry.nodeId === condition)?.depth).toBe(0);
  });

  it('lays nodes out left to right by distance from the trigger', () => {
    const graph = autoLayout(sample(), () => 100);
    const x = (id: string) => graph.nodes.find((node) => node.id === id)!.position.x;
    expect(x('trigger')).toBeLessThan(x(graph.nodes[1].id));
    expect(x(graph.nodes[1].id)).toBeLessThan(x(graph.nodes[2].id));
  });

  it('finds nodes that nothing leads to', () => {
    const graph = sample();
    const loose = addNode(graph, DEFS.get('core.end')!, { x: 0, y: 0 });
    expect(unreachableIds(graph)).toEqual([]);
    expect(unreachableIds(loose.graph)).toEqual([loose.id]);
  });

  it('builds default config and list items from a schema', () => {
    const schema = {
      type: 'object' as const,
      required: ['mode', 'rules'],
      properties: {
        mode: { type: 'string' as const, enum: ['all', 'any'] },
        rules: { type: 'array' as const },
        note: { type: 'string' as const },
        wait: { type: 'integer' as const, minimum: 1, default: 5 },
      },
    };
    expect(defaultConfig(schema)).toEqual({ mode: 'all', rules: [], wait: 5 });
    const option = {
      type: 'object' as const,
      properties: { id: { type: 'string' as const }, label: { type: 'string' as const } },
    };
    expect(newItem(option, [{ id: 'o1' }])).toEqual({ id: 'o2', label: '' });
  });

  it('round trips connector ids', () => {
    expect(parseConnector(inputId('n_1'))).toEqual({ nodeId: 'n_1', kind: 'in', port: '' });
    expect(parseConnector(outputId('n_1', 'case:a'))).toEqual({
      nodeId: 'n_1',
      kind: 'out',
      port: 'case:a',
    });
    expect(parseConnector('nonsense')).toBeNull();
  });
});
