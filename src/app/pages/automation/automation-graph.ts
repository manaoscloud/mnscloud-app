// Pure graph operations of the flow editor (no Angular, no HTTP): ports, edits, layout and the
// indented "Lista" view. Everything returns a new graph, so the editor can keep it in a signal.

import {
  Dict,
  FlowGraph,
  GraphEdge,
  GraphNode,
  MAX_NODES,
  NodeTypeDef,
  PortDef,
  SchemaNode,
  TRIGGER_TYPE,
} from './automation-adapter';

export const NODE_WIDTH = 240;
const COLUMN_GAP = 90;
const ROW_GAP = 40;

export function emptyGraph(): FlowGraph {
  return {
    schemaVersion: 1,
    start: 'trigger',
    nodes: [
      {
        id: 'trigger',
        type: TRIGGER_TYPE,
        typeVersion: 1,
        position: { x: 40, y: 80 },
        config: { triggers: [{ type: 'conversation.inbound', connectionUUIDs: [] }] },
      },
    ],
    edges: [],
  };
}

function textOf(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * Output ports of a node. Static ports come from the node type; `core.switch` (cases) and
 * `conversations.ask` (options) derive theirs from the config, as the API registry does.
 */
export function portsOf(node: GraphNode, def: NodeTypeDef | undefined): PortDef[] {
  const config = node.config;
  if (node.type === 'core.switch') {
    const cases = Array.isArray(config['cases']) ? (config['cases'] as Dict[]) : [];
    return [
      ...cases
        .filter((item) => textOf(item['id']))
        .map((item) => ({
          id: `case:${textOf(item['id'])}`,
          label: textOf(item['label']) || textOf(item['equals']) || textOf(item['id']),
        })),
      { id: 'default', label: 'default' },
    ];
  }
  if (node.type === 'conversations.ask') {
    const options = Array.isArray(config['options']) ? (config['options'] as Dict[]) : [];
    const answers: PortDef[] = options.length
      ? options
          .filter((item) => textOf(item['id']))
          .map((item) => ({
            id: `option:${textOf(item['id'])}`,
            label: textOf(item['label']) || textOf(item['id']),
          }))
      : [{ id: 'answer', label: 'answer' }];
    return [...answers, { id: 'invalid', label: 'invalid' }, { id: 'timeout', label: 'timeout' }];
  }
  return def?.ports ?? [];
}

/** Ports whose absence is only a warning: they fall back to the end of the flow. */
export const OPTIONAL_PORTS = ['error', 'invalid', 'timeout'];

function schemaDefault(schema: SchemaNode): unknown {
  if (schema.default !== undefined) return structuredClone(schema.default);
  if (schema.enum?.length) return schema.enum[0];
  switch (schema.type) {
    case 'boolean':
      return false;
    case 'integer':
    case 'number':
      return schema.minimum ?? 0;
    case 'array':
      return [];
    case 'object': {
      const result: Dict = {};
      for (const [name, child] of Object.entries(schema.properties ?? {})) {
        if (schema.required?.includes(name) || child.default !== undefined)
          result[name] = schemaDefault(child);
      }
      return result;
    }
    default:
      return '';
  }
}

/** Starting config of a new node: defaults and required fields of the type schema. */
export function defaultConfig(schema: SchemaNode | undefined): Dict {
  if (!schema?.properties) return {};
  const config: Dict = {};
  for (const [name, child] of Object.entries(schema.properties)) {
    if (schema.required?.includes(name) || child.default !== undefined)
      config[name] = schemaDefault(child);
  }
  return config;
}

/** Item with the defaults of an array-of-objects schema (a new rule, option, header...). */
export function newItem(schema: SchemaNode | undefined, existing: readonly unknown[]): unknown {
  const item = schema
    ? schemaDefault({ ...schema, required: Object.keys(schema.properties ?? {}) })
    : {};
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const record = item as Dict;
    if ('id' in record && !record['id']) {
      const taken = new Set(existing.map((entry) => textOf((entry as Dict | null)?.['id'])));
      let index = existing.length + 1;
      while (taken.has(`o${index}`)) index++;
      record['id'] = `o${index}`;
    }
  }
  return item;
}

export function nextNodeId(graph: FlowGraph, type: string): string {
  const base =
    type
      .split('.')
      .pop()
      ?.replace(/[^a-z0-9]+/gi, '_') || 'node';
  const taken = new Set(graph.nodes.map((node) => node.id));
  for (let index = 1; ; index++) {
    const id = `${base}_${index}`;
    if (!taken.has(id)) return id;
  }
}

export function canAddNode(graph: FlowGraph, def: NodeTypeDef): boolean {
  if (def.locked || graph.nodes.length >= MAX_NODES) return false;
  return def.type !== TRIGGER_TYPE || !graph.nodes.some((node) => node.type === TRIGGER_TYPE);
}

export function addNode(
  graph: FlowGraph,
  def: NodeTypeDef,
  position: { x: number; y: number },
): { graph: FlowGraph; id: string } {
  const id = nextNodeId(graph, def.type);
  const node: GraphNode = {
    id,
    type: def.type,
    typeVersion: def.typeVersion,
    position: { x: Math.round(position.x), y: Math.round(position.y) },
    config: defaultConfig(def.configSchema),
  };
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, id };
}

/** Removes nodes and their edges; the start node (trigger) is never removed. */
export function removeNodes(graph: FlowGraph, ids: readonly string[]): FlowGraph {
  const doomed = new Set(ids.filter((id) => id !== graph.start));
  if (!doomed.size) return graph;
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !doomed.has(node.id)),
    edges: graph.edges.filter((edge) => !doomed.has(edge.from) && !doomed.has(edge.to)),
  };
}

/** Connects `from.port` to `to`: one edge per output port (it replaces the previous one). */
export function connect(graph: FlowGraph, edge: GraphEdge): FlowGraph {
  if (edge.to === graph.start) return graph;
  const ids = new Set(graph.nodes.map((node) => node.id));
  if (!ids.has(edge.from) || !ids.has(edge.to)) return graph;
  const rest = graph.edges.filter((item) => !(item.from === edge.from && item.port === edge.port));
  return { ...graph, edges: [...rest, edge] };
}

export function disconnect(graph: FlowGraph, edge: GraphEdge): FlowGraph {
  return {
    ...graph,
    edges: graph.edges.filter(
      (item) => !(item.from === edge.from && item.port === edge.port && item.to === edge.to),
    ),
  };
}

export function moveNodes(
  graph: FlowGraph,
  moves: ReadonlyArray<{ id: string; position: { x: number; y: number } }>,
): FlowGraph {
  const byId = new Map(moves.map((move) => [move.id, move.position]));
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      const position = byId.get(node.id);
      return position
        ? { ...node, position: { x: Math.round(position.x), y: Math.round(position.y) } }
        : node;
    }),
  };
}

/** Replaces a node config and drops edges of ports that no longer exist (removed option/case). */
export function updateConfig(
  graph: FlowGraph,
  id: string,
  config: Dict,
  defs: ReadonlyMap<string, NodeTypeDef>,
): FlowGraph {
  const nodes = graph.nodes.map((node) => (node.id === id ? { ...node, config } : node));
  const updated = nodes.find((node) => node.id === id);
  if (!updated) return graph;
  const ports = new Set(portsOf(updated, defs.get(updated.type)).map((port) => port.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => edge.from !== id || ports.has(edge.port)),
  };
}

/** Layered left-to-right layout from the start node; unreachable nodes go below. */
export function autoLayout(graph: FlowGraph, heightOf: (node: GraphNode) => number): FlowGraph {
  const level = new Map<string, number>();
  const queue: string[] = graph.nodes.some((node) => node.id === graph.start) ? [graph.start] : [];
  if (queue.length) level.set(graph.start, 0);
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.from !== current || level.has(edge.to)) continue;
      level.set(edge.to, (level.get(current) ?? 0) + 1);
      queue.push(edge.to);
    }
  }
  const columns = new Map<number, GraphNode[]>();
  const loose: GraphNode[] = [];
  for (const node of graph.nodes) {
    const depth = level.get(node.id);
    if (depth === undefined) loose.push(node);
    else columns.set(depth, [...(columns.get(depth) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let bottom = 0;
  for (const [depth, nodes] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    let y = 40;
    for (const node of nodes) {
      positions.set(node.id, { x: 40 + depth * (NODE_WIDTH + COLUMN_GAP), y });
      y += heightOf(node) + ROW_GAP;
    }
    bottom = Math.max(bottom, y);
  }
  let x = 40;
  for (const node of loose) {
    positions.set(node.id, { x, y: bottom + 40 });
    x += NODE_WIDTH + COLUMN_GAP;
  }
  return moveNodes(
    graph,
    graph.nodes.map((node) => ({ id: node.id, position: positions.get(node.id) ?? node.position })),
  );
}

export interface ListEntry {
  depth: number;
  nodeId: string;
  /** Output port of the parent that leads here (empty for the first step). */
  viaPort: string;
  /** The node was already listed above (a join or a loop): shown as a reference. */
  repeat: boolean;
}

/** Depth-first list of the steps with the branch indentation used by the Lista tab. */
export function listEntries(graph: FlowGraph, defs: ReadonlyMap<string, NodeTypeDef>): ListEntry[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const entries: ListEntry[] = [];
  const visit = (id: string, depth: number, viaPort: string) => {
    const node = nodes.get(id);
    if (!node) return;
    if (seen.has(id)) {
      entries.push({ depth, nodeId: id, viaPort, repeat: true });
      return;
    }
    seen.add(id);
    entries.push({ depth, nodeId: id, viaPort, repeat: false });
    const ports = portsOf(node, defs.get(node.type));
    const branching = ports.length > 1;
    for (const port of ports) {
      const edge = graph.edges.find((item) => item.from === id && item.port === port.id);
      if (edge) visit(edge.to, branching ? depth + 1 : depth, branching ? port.id : '');
    }
  };
  visit(graph.start, 0, '');
  for (const node of graph.nodes) if (!seen.has(node.id)) visit(node.id, 0, '');
  return entries;
}

/** Estimated height of a node card (header + one row per port), for layout. */
export function nodeHeight(portCount: number): number {
  return 64 + Math.max(1, portCount) * 28;
}

export function sameGraph(a: FlowGraph, b: FlowGraph): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Nodes that no edge leads to and that are not the start (flagged as unreachable hints). */
export function unreachableIds(graph: FlowGraph): string[] {
  const reach = new Set<string>([graph.start]);
  const queue = [graph.start];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of graph.edges) {
      if (edge.from === current && !reach.has(edge.to)) {
        reach.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return graph.nodes.filter((node) => !reach.has(node.id)).map((node) => node.id);
}

// Connector ids of the canvas: one target per node, one source per output port.
export const inputId = (nodeId: string) => `${nodeId}::in`;
export const outputId = (nodeId: string, port: string) => `${nodeId}::out::${port}`;

export function parseConnector(
  id: string,
): { nodeId: string; kind: 'in' | 'out'; port: string } | null {
  const match = /^(.+?)::(in|out)(?:::(.*))?$/.exec(id);
  return match ? { nodeId: match[1], kind: match[2] as 'in' | 'out', port: match[3] ?? '' } : null;
}
