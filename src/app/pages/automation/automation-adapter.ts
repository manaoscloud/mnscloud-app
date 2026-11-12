// Wire contract of the Automations API (`/automation/*`) in one place. The API and the App were
// written in parallel against docs/handoffs/2026-11-12-automation-fl0-fl1.md (sections 2.2, 2.3):
// every field name the App reads or sends lives here, so a rename on the API side is a one-file
// change. Readers are tolerant (column name first, then the camelCase alias).

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Dict = Record<string, unknown>;

export const AUTOMATION_PERMISSIONS = {
  flowsWrite: 'tenant.automation.flows.write',
  flowsPublish: 'tenant.automation.flows.publish',
  runsCancel: 'tenant.automation.runs.cancel',
  secretsWrite: 'tenant.automation.secrets.write',
} as const;

/** Page size the editor asks for lists it renders whole (versions, contacts, connections). */
export const PICKER_LIMIT = 200;

// ---------------------------------------------------------------------------------------------
// Graph (schemaVersion 1)
// ---------------------------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  type: string;
  typeVersion: number;
  position: { x: number; y: number };
  config: Dict;
}

export interface GraphEdge {
  from: string;
  port: string;
  to: string;
}

export interface FlowGraph {
  schemaVersion: 1;
  start: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const TRIGGER_TYPE = 'core.trigger';
export const MAX_NODES = 300;

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}

function asText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Parses a graph that may arrive as a JSON string (longtext column) or as an object. */
export function parseGraph(raw: unknown): FlowGraph {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      value = null;
    }
  }
  const source = asDict(value);
  const nodes = (Array.isArray(source['nodes']) ? source['nodes'] : []).map((item) => {
    const node = asDict(item);
    const position = asDict(node['position']);
    return {
      id: asText(node['id']),
      type: asText(node['type']),
      typeVersion: asNumber(node['typeVersion'], 1),
      position: { x: asNumber(position['x']), y: asNumber(position['y']) },
      config: asDict(node['config']),
    } satisfies GraphNode;
  });
  const edges = (Array.isArray(source['edges']) ? source['edges'] : []).map((item) => {
    const edge = asDict(item);
    return {
      from: asText(edge['from']),
      port: asText(edge['port']),
      to: asText(edge['to']),
    } satisfies GraphEdge;
  });
  const start =
    asText(source['start']) || nodes.find((node) => node.type === TRIGGER_TYPE)?.id || '';
  return { schemaVersion: 1, start, nodes, edges };
}

// ---------------------------------------------------------------------------------------------
// Node types (GET /automation/node-types)
// ---------------------------------------------------------------------------------------------

/** JSON Schema subset the inspector understands. */
export interface SchemaNode {
  type?: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  enum?: unknown[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  maxItems?: number;
  /** `textarea` renders a multi-line field; `template` also offers the variable helper. */
  format?: string;
  items?: SchemaNode;
  properties?: Record<string, SchemaNode>;
  required?: string[];
  /** Optional hint of the API: `connection`, `team` or `user` render an entity picker. */
  'x-widget'?: string;
}

export interface PortDef {
  id: string;
  label: string;
}

export interface NodeTypeDef {
  type: string;
  typeVersion: number;
  module: string;
  category: string;
  icon: string;
  surfaces: string[];
  /** Static ports of the type; dynamic ones (switch cases, ask options) come from `portsOf`. */
  ports: PortDef[];
  configSchema: SchemaNode;
  effect: string;
  locked: boolean;
  lockReason: string;
}

function toPort(raw: unknown): PortDef {
  if (typeof raw === 'string') return { id: raw, label: raw };
  const port = asDict(raw);
  const id = asText(port['id'] ?? port['port'] ?? port['name']);
  return { id, label: asText(port['label']) || id };
}

export function toNodeType(raw: unknown): NodeTypeDef {
  const item = asDict(raw);
  const type = asText(item['type']);
  return {
    type,
    typeVersion: asNumber(item['typeVersion'], 1),
    module: asText(item['module']) || type.split('.')[0] || 'core',
    category: asText(item['category']),
    icon: asText(item['icon']) || 'extension',
    surfaces: Array.isArray(item['surfaces']) ? item['surfaces'].map(asText) : [],
    ports: (Array.isArray(item['ports']) ? item['ports'] : []).map(toPort).filter((p) => p.id),
    configSchema: asDict(item['configSchema']) as SchemaNode,
    effect: asText(item['effect']) || 'read',
    locked: item['locked'] === true || item['locked'] === 1,
    lockReason: asText(item['lockReason']),
  };
}

/** Unwraps the `{ data: ... }` envelope of the API (a bare body is accepted too). */
export function unwrap(response: unknown): Dict {
  const body = asDict(response);
  return 'data' in body ? asDict(body['data']) : body;
}

export function toNodeTypes(response: unknown): NodeTypeDef[] {
  const body = unwrap(response);
  const items = Array.isArray(body['items'])
    ? body['items']
    : Array.isArray(response)
      ? response
      : [];
  return items.map(toNodeType).filter((def) => def.type);
}

// ---------------------------------------------------------------------------------------------
// Flow (draft, lock, status)
// ---------------------------------------------------------------------------------------------

export interface FlowLock {
  userUUID: string;
  userName: string;
  editedAt: string;
}

export interface FlowDetail {
  uuid: string;
  name: string;
  description: string;
  surface: string;
  status: string;
  revision: number;
  publishedVersion: number | null;
  graph: FlowGraph;
  lock: FlowLock | null;
  testContacts: string[];
}

export function toFlowDetail(response: unknown): FlowDetail {
  const body = unwrap(response);
  const item = asDict(body['item'] ?? body);
  const published = item['AflPublishedVersion'] ?? item['publishedVersion'];
  const lockUser = asText(item['AflDraftEditorUsrUUID'] ?? item['draftEditorUUID']);
  let contacts: unknown = item['AflTestContacts'] ?? item['testContacts'];
  if (typeof contacts === 'string') {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      contacts = [];
    }
  }
  return {
    uuid: asText(item['AflUUID'] ?? item['uuid']),
    name: asText(item['AflName'] ?? item['name']),
    description: asText(item['AflDescription'] ?? item['description']),
    surface: asText(item['AflSurface'] ?? item['surface']) || 'conversation',
    status: asText(item['AflStatus'] ?? item['status']) || 'draft',
    revision: asNumber(item['AflRevision'] ?? item['revision']),
    publishedVersion:
      published === null || published === undefined || published === ''
        ? null
        : asNumber(published),
    graph: parseGraph(item['AflDraftGraph'] ?? item['draftGraph'] ?? item['graph']),
    lock: lockUser
      ? {
          userUUID: lockUser,
          userName: asText(
            item['DraftEditorName'] ?? item['draftEditorName'] ?? item['EditorName'],
          ),
          editedAt: asText(item['AflDraftEditedAt'] ?? item['draftEditedAt']),
        }
      : null,
    testContacts: Array.isArray(contacts) ? contacts.map(asText).filter(Boolean) : [],
  };
}

/** Body of `PUT /automation/flows/:uuid/draft`. */
export function draftBody(revision: number, graph: FlowGraph, force: boolean): Dict {
  return { revision, graph, ...(force ? { force: true } : {}) };
}

/** Body of `PUT /automation/flows/:uuid` when only the test contacts change. */
export function testContactsBody(revision: number, contacts: string[]): Dict {
  return { revision, testContacts: contacts.slice(0, 20) };
}

/** Body of `POST /automation/flows/:uuid/publish`. */
export function publishBody(revision: number, note: string): Dict {
  return { revision, note: note.trim() };
}

// ---------------------------------------------------------------------------------------------
// Validation, versions, contacts
// ---------------------------------------------------------------------------------------------

export interface ValidationIssue {
  nodeId: string;
  code: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function toIssue(raw: unknown): ValidationIssue {
  const item = asDict(raw);
  return {
    nodeId: asText(item['nodeId']),
    code: asText(item['code']),
    message: asText(item['message']),
  };
}

export function toValidation(response: unknown): ValidationResult {
  const body = unwrap(response);
  const list = (value: unknown) => (Array.isArray(value) ? value.map(toIssue) : []);
  return { errors: list(body['errors']), warnings: list(body['warnings']) };
}

/** Publish rejection: `400` with the list of errors inside the error body. */
export function issuesFromError(error: unknown): ValidationIssue[] {
  const body = asDict(asDict(error)['error']);
  const list = body['errors'] ?? asDict(body['details'])['errors'] ?? asDict(error)['errors'];
  return Array.isArray(list) ? list.map(toIssue) : [];
}

export interface FlowVersion {
  uuid: string;
  number: number;
  state: string;
  note: string;
  publishedAt: string;
  publishedBy: string;
}

export function toVersions(response: unknown): FlowVersion[] {
  const body = unwrap(response);
  return (Array.isArray(body['items']) ? body['items'] : []).map((raw) => {
    const item = asDict(raw);
    return {
      uuid: asText(item['AfvUUID'] ?? item['uuid']),
      number: asNumber(item['AfvNumber'] ?? item['number']),
      state: asText(item['AfvState'] ?? item['state']),
      note: asText(item['AfvNote'] ?? item['note']),
      publishedAt: asText(item['AfvPublishedAt'] ?? item['publishedAt']),
      publishedBy: asText(item['PublishedByName'] ?? item['publishedByName']),
    };
  });
}

export interface TestContact {
  uuid: string;
  name: string;
  detail: string;
}

export function toTestContacts(response: unknown): TestContact[] {
  const body = unwrap(response);
  return (Array.isArray(body['items']) ? body['items'] : []).map((raw) => {
    const item = asDict(raw);
    return {
      uuid: asText(item['CntUUID'] ?? item['uuid']),
      name: asText(item['CntName'] ?? item['name']),
      detail: [item['CntPhone'] ?? item['phone'], item['CntExternalId'] ?? item['externalId']]
        .map(asText)
        .filter(Boolean)
        .join(' · '),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------------------------

export interface SimMessage {
  author: string;
  text: string;
  options: string[];
}

export interface TraceStep {
  seq: number;
  nodeId: string;
  nodeType: string;
  port: string;
  result: string;
  durationMs: number;
  summary: string;
  simulated: boolean;
  errorCode: string;
}

export interface SimulationResult {
  messages: SimMessage[];
  trace: TraceStep[];
  state: Dict;
  done: boolean;
  waiting: boolean;
}

export function toTraceStep(raw: unknown): TraceStep {
  const item = asDict(raw);
  return {
    seq: asNumber(item['seq'] ?? item['AfsSeq']),
    nodeId: asText(item['nodeId'] ?? item['AfsNodeId']),
    nodeType: asText(item['nodeType'] ?? item['AfsNodeType']),
    port: asText(item['port'] ?? item['AfsPort']),
    result: asText(item['result'] ?? item['AfsResult']),
    durationMs: asNumber(item['durationMs'] ?? item['AfsDurationMs']),
    summary: asText(item['summary'] ?? item['AfsSummary']),
    simulated: item['simulated'] === true,
    errorCode: asText(item['errorCode'] ?? item['AfsErrorCode']),
  };
}

export function toSimulation(response: unknown): SimulationResult {
  const body = unwrap(response);
  const messages = (Array.isArray(body['messages']) ? body['messages'] : []).map((raw) => {
    const item = asDict(raw);
    const options = Array.isArray(item['options'])
      ? item['options'].map((option) => asText(asDict(option)['label'] ?? option))
      : [];
    return { author: asText(item['author']) || 'bot', text: asText(item['text']), options };
  });
  return {
    messages,
    trace: (Array.isArray(body['trace']) ? body['trace'] : []).map(toTraceStep),
    state: asDict(body['state']),
    done: body['done'] === true,
    waiting: body['waiting'] === true,
  };
}

/** Variables shown in the test panel: `state.vars` when present, otherwise the state itself. */
export function stateVariables(state: Dict): Array<{ name: string; value: string }> {
  const vars = asDict(state['vars'] ?? state['variables']);
  const source = Object.keys(vars).length ? vars : {};
  return Object.entries(source).map(([name, value]) => ({
    name,
    value: typeof value === 'string' ? value : JSON.stringify(value),
  }));
}

// ---------------------------------------------------------------------------------------------
// Runs (list is a CRUD; detail loads one run with its steps)
// ---------------------------------------------------------------------------------------------

export const RUN_LIVE_STATES = ['queued', 'running', 'waiting'];

export interface RunDetail {
  uuid: string;
  flowName: string;
  state: string;
  mode: string;
  trigger: string;
  currentNode: string;
  error: string;
  stepCount: number;
  startedAt: string;
  endedAt: string;
  steps: TraceStep[];
}

export function toRunDetail(response: unknown): RunDetail {
  const body = unwrap(response);
  const item = asDict(body['item'] ?? body);
  const steps = item['steps'] ?? body['steps'];
  return {
    uuid: asText(item['AfrUUID'] ?? item['uuid']),
    flowName: asText(item['AflName'] ?? item['FlowName'] ?? item['flowName']),
    state: asText(item['AfrState'] ?? item['state']),
    mode: asText(item['AfrMode'] ?? item['mode']),
    trigger: asText(item['AfrTriggerType'] ?? item['triggerType']),
    currentNode: asText(item['AfrCurrentNode'] ?? item['currentNode']),
    error: asText(item['AfrError'] ?? item['error']),
    stepCount: asNumber(item['AfrStepCount'] ?? item['stepCount']),
    startedAt: asText(item['AfrStartedAt'] ?? item['startedAt']),
    endedAt: asText(item['AfrEndedAt'] ?? item['endedAt']),
    steps: (Array.isArray(steps) ? steps : []).map(toTraceStep),
  };
}
