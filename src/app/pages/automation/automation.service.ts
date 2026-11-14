import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../services/api.service';
import {
  Dict,
  FlowDetail,
  FlowGraph,
  FlowVersion,
  NodeTypeDef,
  PICKER_LIMIT,
  RunDetail,
  SimulationResult,
  TestContact,
  ValidationResult,
  draftBody,
  publishBody,
  testContactsBody,
  toFlowDetail,
  toNodeTypes,
  toRunDetail,
  toSimulation,
  toTestContacts,
  toValidation,
  toVersions,
  unwrap,
} from './automation-adapter';

export interface ManualFlow {
  uuid: string;
  name: string;
  description: string;
}

export interface PickerOption {
  value: string;
  label: string;
}

/** Calls of the Automations API (`/automation/*`); the wire shapes live in the adapter. */
@Injectable({ providedIn: 'root' })
export class AutomationService {
  private readonly api = inject(ApiService);

  async nodeTypes(): Promise<NodeTypeDef[]> {
    return toNodeTypes(await this.api.get('automation/node-types'));
  }

  async flow(uuid: string): Promise<FlowDetail> {
    return toFlowDetail(await this.api.get(`automation/flows/${uuid}`));
  }

  async saveDraft(
    uuid: string,
    revision: number,
    graph: FlowGraph,
    force: boolean,
  ): Promise<FlowDetail> {
    return toFlowDetail(
      await this.api.put(`automation/flows/${uuid}/draft`, draftBody(revision, graph, force), {
        silent: true,
      }),
    );
  }

  /** Server validation of a graph; background calls stay silent (the panel shows the result). */
  async validate(uuid: string, graph: FlowGraph): Promise<ValidationResult> {
    return toValidation(
      await this.api.post(`automation/flows/${uuid}/validate`, { graph }, { silent: true }),
    );
  }

  async publish(uuid: string, revision: number, note: string): Promise<void> {
    await this.api.post(`automation/flows/${uuid}/publish`, publishBody(revision, note));
  }

  async versions(uuid: string): Promise<FlowVersion[]> {
    return toVersions(
      await this.api.get(`automation/flows/${uuid}/versions?limit=${PICKER_LIMIT}`),
    );
  }

  async restore(
    uuid: string,
    versionUUID: string,
    revision: number,
    force: boolean,
  ): Promise<void> {
    await this.api.post(`automation/flows/${uuid}/versions/${versionUUID}/restore`, {
      revision,
      ...(force ? { force: true } : {}),
    });
  }

  /** "Criar com IA": a draft graph from a description (nothing is saved by the API). */
  async aiDraft(
    description: string,
  ): Promise<{ graph: FlowGraph | null; errors: Dict[]; warnings: Dict[] }> {
    const body = unwrap(
      await this.api.post('automation/flows/ai-draft', { description }, { silent: true }),
    );
    return {
      graph: (body['graph'] as FlowGraph | null) ?? null,
      errors: Array.isArray(body['errors']) ? (body['errors'] as Dict[]) : [],
      warnings: Array.isArray(body['warnings']) ? (body['warnings'] as Dict[]) : [],
    };
  }

  /** "Revisar com IA": summary and issues of the saved draft. */
  async aiReview(
    uuid: string,
  ): Promise<{
    summary: string;
    issues: Array<{ nodeId: string | null; severity: string; message: string }>;
  }> {
    const body = unwrap(
      await this.api.post(`automation/flows/${uuid}/ai-review`, {}, { silent: true }),
    );
    return {
      summary: String(body['summary'] ?? ''),
      issues: Array.isArray(body['issues'])
        ? (body['issues'] as Array<{ nodeId: string | null; severity: string; message: string }>)
        : [],
    };
  }

  async simulate(
    uuid: string,
    body: { graph: FlowGraph; state?: Dict; input?: string; contact?: string },
  ): Promise<SimulationResult> {
    return toSimulation(await this.api.post(`automation/flows/${uuid}/simulate`, body));
  }

  async testContacts(query: string): Promise<TestContact[]> {
    const params = new URLSearchParams({ limit: '20' });
    if (query.trim()) params.set('q', query.trim());
    return toTestContacts(
      await this.api.get(`automation/test-contacts?${params}`, { silent: true }),
    );
  }

  async saveTestContacts(uuid: string, revision: number, contacts: string[]): Promise<FlowDetail> {
    return toFlowDetail(
      await this.api.put(`automation/flows/${uuid}`, testContactsBody(revision, contacts)),
    );
  }

  async run(uuid: string): Promise<RunDetail> {
    return toRunDetail(await this.api.get(`automation/runs/${uuid}`));
  }

  async cancelRun(uuid: string): Promise<void> {
    await this.api.post(`automation/runs/${uuid}/cancel`, {});
  }

  /** Creates a draft flow and returns its UUID. */
  async create(body: {
    name: string;
    description: string;
    surface: string;
    priority: number;
  }): Promise<string> {
    return toFlowDetail(await this.api.post('automation/flows', body)).uuid;
  }

  /** Manual flows the user can start on a conversation (published, trigger `conversation.manual`). */
  async manualFlows(conversationUUID: string): Promise<ManualFlow[]> {
    const response = await this.api.get(
      `automation/manual-flows?conversationUUID=${encodeURIComponent(conversationUUID)}`,
      { silent: true },
    );
    const body = unwrap(response);
    const items = Array.isArray(body['items'])
      ? (body['items'] as Dict[])
      : Array.isArray((response as { data?: unknown } | null)?.data)
        ? ((response as { data: Dict[] }).data as Dict[])
        : [];
    return items
      .map((item) => ({
        uuid: String(item['AflUUID'] ?? item['flowUUID'] ?? item['uuid'] ?? ''),
        name: String(item['AflName'] ?? item['name'] ?? ''),
        description: String(item['AflDescription'] ?? item['description'] ?? ''),
      }))
      .filter((flow) => flow.uuid);
  }

  /** Starts a manual flow on a conversation; errors are shown by the caller. */
  async startManual(flowUUID: string, conversationUUID: string): Promise<void> {
    await this.api.post('automation/runs/manual', { flowUUID, conversationUUID }, { silent: true });
  }

  /**
   * Options of an entity picker of the inspector (`connection`, `team`, `user`, `flow`); the
   * `flow` picker lists published flows only and leaves out `excludeUUID` (the flow being edited).
   */
  async options(widget: string, excludeUUID = ''): Promise<PickerOption[]> {
    const spec = PICKERS[widget];
    if (!spec) return [];
    const response = await this.api.get(`${spec.endpoint}?limit=${PICKER_LIMIT}`, {
      silent: true,
    });
    const data = (response as { data?: unknown } | null)?.data ?? response;
    const body = unwrap(response);
    const items = Array.isArray(data)
      ? (data as Dict[])
      : Array.isArray(body['items'])
        ? (body['items'] as Dict[])
        : [];
    return items
      .filter((item) => !spec.publishedOnly || Number(item['AflPublishedVersion'] ?? 0) > 0)
      .map((item) => ({
        value: String(item[spec.value] ?? ''),
        // A stage shows its pipeline ("Vendas › Proposta") when there are several pipelines.
        label:
          spec.group && item[spec.group]
            ? `${String(item[spec.group])} › ${String(item[spec.label] ?? '')}`
            : String(item[spec.label] ?? ''),
      }))
      .filter((option) => option.value && option.value !== excludeUUID);
  }
}

const PICKERS: Record<
  string,
  { endpoint: string; value: string; label: string; publishedOnly?: boolean; group?: string }
> = {
  connection: { endpoint: 'conversations/connections', value: 'ChcUUID', label: 'ChcName' },
  team: { endpoint: 'support/teams', value: 'SupportTeamUUID', label: 'Name' },
  user: { endpoint: 'conversations/members', value: 'UsrUUID', label: 'UsrName' },
  flow: {
    endpoint: 'automation/flows',
    value: 'AflUUID',
    label: 'AflName',
    publishedOnly: true,
  },
  supportChannel: {
    endpoint: 'support/ticket-channels',
    value: 'SupportTicketChannelUUID',
    label: 'Name',
  },
  supportType: { endpoint: 'support/ticket-types', value: 'SupportTicketTypeUUID', label: 'Name' },
  supportPriority: {
    endpoint: 'support/ticket-priorities',
    value: 'SupportTicketPriorityUUID',
    label: 'Name',
  },
  crmSource: { endpoint: 'crm/sources', value: 'CsoUUID', label: 'CsoName' },
  crmStage: {
    endpoint: 'crm/stages',
    value: 'CstUUID',
    label: 'CstName',
    group: 'CrmPipelineCpiUUIDName',
  },
  crmMember: { endpoint: 'crm/members', value: 'UsrUUID', label: 'UsrName' },
  billingDueDay: { endpoint: 'customer-billing/due-days', value: 'BddUUID', label: 'BddName' },
  saleProduct: { endpoint: 'sale/products', value: 'SprUUID', label: 'SprName' },
  salePriceList: { endpoint: 'sale/price-lists', value: 'SplUUID', label: 'SplName' },
  stockLocation: { endpoint: 'stock/locations', value: 'StlUUID', label: 'StlName' },
};

/** Picker widgets used by the config of the nodes the tenant can use (locked modules excluded). */
export function usedWidgets(defs: Array<{ locked: boolean; configSchema: unknown }>): string[] {
  const found = new Set<string>();
  const walk = (schema: unknown): void => {
    if (!schema || typeof schema !== 'object') return;
    const record = schema as Dict;
    const widget = record['x-widget'];
    if (typeof widget === 'string' && widget in PICKERS) found.add(widget);
    for (const value of Object.values(record)) if (value && typeof value === 'object') walk(value);
  };
  for (const def of defs) if (!def.locked) walk(def.configSchema);
  return [...found];
}

/** Widget of a config property: explicit `x-widget`, otherwise inferred from its name. */
export function widgetOf(name: string, hint: string | undefined): string {
  if (hint) return hint;
  if (name === 'connectionUUIDs') return 'connection';
  if (name === 'teamUUID') return 'team';
  if (name === 'userUUID') return 'user';
  if (name === 'flowUUID') return 'flow';
  return '';
}
