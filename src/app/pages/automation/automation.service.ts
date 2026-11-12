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

  async restore(uuid: string, versionUUID: string): Promise<void> {
    await this.api.post(`automation/flows/${uuid}/versions/${versionUUID}/restore`, {});
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

  /** Options of an entity picker of the inspector (`connection`, `team`, `user`). */
  async options(widget: string): Promise<PickerOption[]> {
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
      .map((item) => ({
        value: String(item[spec.value] ?? ''),
        label: String(item[spec.label] ?? ''),
      }))
      .filter((option) => option.value);
  }
}

const PICKERS: Record<string, { endpoint: string; value: string; label: string }> = {
  connection: { endpoint: 'conversations/connections', value: 'ChcUUID', label: 'ChcName' },
  team: { endpoint: 'support/teams', value: 'SupportTeamUUID', label: 'Name' },
  user: { endpoint: 'conversations/members', value: 'UsrUUID', label: 'UsrName' },
};

/** Widget of a config property: explicit `x-widget`, otherwise inferred from its name. */
export function widgetOf(name: string, hint: string | undefined): string {
  if (hint) return hint;
  if (name === 'connectionUUIDs') return 'connection';
  if (name === 'teamUUID') return 'team';
  if (name === 'userUUID') return 'user';
  return '';
}
