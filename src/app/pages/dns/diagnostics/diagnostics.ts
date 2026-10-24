import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
  ConfigurableCrudSaveContext,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  DataViewerSection,
  DataViewerTone,
  openDataViewerDialog,
} from '../../../shared/data-viewer-dialog/data-viewer-dialog';

type Row = Record<string, unknown>;

const config = defineCrud({
  endpoint: 'system/dns/diagnostics',
  uuidField: 'DprUUID',
  pageTitle: 'dns.diagnostics',
  pageDescription: 'dns.diagnosticsDescription',
  dialogDescription: 'dns.diagnosticsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // A diagnosis is a record of what was observed: it is never edited or deleted.
  canEdit: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  initialValues: { target: '', agents: [] },
  rowActions: [{ key: 'result', label: 'dns.diagnosisResult', icon: 'troubleshoot' }],
  fields: [
    {
      key: 'target',
      source: 'DprTarget',
      label: 'dns.diagnosisTarget',
      help: 'dns.diagnosisTargetHelp',
      required: true,
      span: 2,
      type: 'text',
    },
    {
      key: 'agents',
      source: 'agents',
      label: 'dns.diagnosisAgents',
      help: 'dns.diagnosisAgentsHelp',
      required: true,
      span: 2,
      type: 'search-select',
      multiple: true,
      remoteLookup: {
        endpoint: 'system/dns/diagnostics/agents',
        uuidField: 'MagUUID',
        labelField: 'MagName',
      },
    },
  ],
  columns: [
    { id: 'target', field: 'DprTarget', label: 'dns.diagnosisTarget', kind: 'identity' },
    {
      id: 'progress',
      field: 'FinishedCount',
      label: 'dns.diagnosisProgress',
      kind: 'text',
      value: (row) => `${Number(row['FinishedCount'] ?? 0)}/${Number(row['AgentCount'] ?? 0)}`,
    },
    { id: 'requestedBy', field: 'RequestedBy', label: 'dns.diagnosisRequestedBy', kind: 'text' },
    { id: 'created', field: 'DprDateCreated', label: 'Created at', kind: 'datetime' },
  ],
});

const VERDICT_TONES: Record<string, DataViewerTone> = {
  reachable_everywhere: 'success',
  local_to_some_probes: 'warning',
  target_unresolved: 'danger',
  target_unreachable: 'danger',
  pending: 'info',
  no_result: 'neutral',
};

const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);
const step = (value: unknown): Row => (value && typeof value === 'object' ? (value as Row) : {});

/** Network operator as `AS28573 · CLARO S.A. · BR` (D4b); `—` when unknown. */
export function operatorLabel(value: unknown): string {
  const info = step(value);
  if (!info['asn']) return '—';
  return [`AS${info['asn']}`, info['name'], info['country']].filter(Boolean).join(' · ');
}

/** Per-Agent sections: identity and resolution, then connections and HTTP. */
export function probeSections(
  job: Row,
  outcome: string | undefined,
  t: (key: string) => string,
): DataViewerSection[] {
  const result = step(job['result']);
  const name = String(job['agentName'] ?? job['agentUUID'] ?? '');
  const http = step(result['http']);
  const network = step(result['network']);
  const targets = step(network['targets']);
  return [
    {
      title: name,
      details: [
        {
          label: 'dns.diagnosisState',
          value: `dns.jobStates.${String(job['state'] ?? '')}`,
          translate: true,
        },
        {
          label: 'dns.diagnosisOutcome',
          value: `dns.outcomes.${outcome ?? 'not_finished'}`,
          translate: true,
        },
        {
          label: 'dns.diagnosisEgress',
          value: step(result['egress'])['ipv4'] ?? step(result['egress'])['address'] ?? '—',
          monospace: true,
        },
        {
          label: 'dns.diagnosisEgress6',
          value: step(result['egress'])['ipv6'] ?? '—',
          monospace: true,
        },
        {
          label: 'dns.diagnosisOperator',
          value: operatorLabel(step(network['egress'])['ipv4']),
        },
        {
          label: 'dns.diagnosisOperator6',
          value: operatorLabel(step(network['egress'])['ipv6']),
        },
        {
          label: 'dns.diagnosisDuration',
          value: result['durationMs'] == null ? '—' : `${result['durationMs']} ms`,
        },
      ],
      table: {
        columns: [
          { key: 'resolver', label: 'dns.diagnosisResolver', monospace: true, translate: false },
          { key: 'type', label: 'Type', monospace: true, translate: false },
          { key: 'status', label: 'Status', translate: true },
          { key: 'answers', label: 'dns.diagnosisAnswers', monospace: true, translate: false },
          { key: 'ms', label: 'dns.diagnosisLatency', translate: false },
        ],
        rows: rows(result['resolution']).map((item) => ({
          resolver: item['resolver'] === 'system' ? 'system' : item['resolver'],
          type: item['type'],
          status: `dns.steps.${String(item['status'] ?? '')}`,
          answers: texts(item['answers']).join(', ') || '—',
          ms: `${Number(item['ms'] ?? 0)} ms`,
        })),
        emptyLabel: 'dns.diagnosisNoResolution',
      },
    },
    {
      // Section titles must be unique per dialog: each one names its Agent.
      title: `${name} · ${t('dns.diagnosisConnections')}`,
      details: [
        {
          label: 'HTTP',
          value: Object.keys(http).length
            ? `${http['code'] ?? '—'} (${Number(http['ms'] ?? 0)} ms)`
            : '—',
        },
      ],
      table: {
        columns: [
          { key: 'address', label: 'dns.diagnosisAddress', monospace: true, translate: false },
          { key: 'tcp', label: 'TCP', translate: true },
          { key: 'tls', label: 'TLS', translate: true },
          { key: 'operator', label: 'dns.diagnosisOperator', translate: false },
        ],
        rows: rows(result['connect']).map((item) => ({
          address: `IPv${item['family']} ${item['address']}:${item['port']}`,
          operator: operatorLabel(targets[String(item['address'])]),
          tcp: `dns.steps.${String(step(item['tcp'])['status'] ?? '')}`,
          tls: item['tls'] ? `dns.steps.${String(step(item['tls'])['status'] ?? '')}` : '—',
        })),
        emptyLabel: 'dns.diagnosisNoConnection',
      },
    },
  ];
}

@Component({
  selector: 'app-dns-diagnostics',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsDiagnosticsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'result') return super.handleRowAction(action, row);
    await this.showResult(String(row['DprUUID']));
  }

  /** A new diagnosis opens its result once the probes answered (or after 40 s at most). */
  protected override async afterSave(
    context: ConfigurableCrudSaveContext<ConfigurableCrudRecord>,
  ): Promise<void> {
    const uuid = (context.response as { data?: Row })?.data?.['DprUUID'];
    if (!uuid) return;
    this.snack.success(this.t('dns.diagnosisQueued'));
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (this.destroyRef.destroyed) return;
      const data = await this.load(String(uuid)).catch(() => null);
      const code = String(step(data?.['verdict'])['code'] ?? 'pending');
      if (
        data &&
        code !== 'pending' &&
        !texts(step(data['verdict'])['notes']).includes('probes_pending')
      ) {
        this.refreshList();
        this.open(data);
        return;
      }
    }
    this.refreshList();
    await this.showResult(String(uuid));
  }

  private async load(uuid: string): Promise<Row | null> {
    const response = await this.api.get<{ data?: Row }>(`${config.endpoint}/${uuid}`);
    return response?.data ?? null;
  }

  private async showResult(uuid: string): Promise<void> {
    try {
      const data = await this.load(uuid);
      if (data) this.open(data);
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }

  private open(data: Row): void {
    const verdict = step(data['verdict']);
    const code = String(verdict['code'] ?? 'no_result');
    const outcomes = step(verdict['outcomes']) as Record<string, string>;
    const notes = texts(verdict['notes']).map((note) => this.t(`dns.verdictNotes.${note}`));
    const failing = texts(verdict['failingAgents']).join(', ');
    const scope = verdict['scope'] ? String(verdict['scope']) : null;
    const operators: DataViewerSection = {
      title: 'dns.diagnosisOperators',
      table: {
        columns: [
          { key: 'operator', label: 'dns.diagnosisOperator', translate: false },
          { key: 'agents', label: 'dns.diagnosisAgents', translate: false },
          { key: 'failing', label: 'dns.diagnosisFailing', translate: false },
        ],
        rows: rows(verdict['operators']).map((group) => ({
          operator: operatorLabel(group),
          agents: texts(group['agents']).join(', '),
          failing: texts(group['failingAgents']).join(', ') || '—',
        })),
        emptyLabel: 'dns.diagnosisNoOperator',
      },
    };
    openDataViewerDialog(this.dialog, {
      title: 'dns.diagnosisResult',
      description: String(data['DprTarget'] ?? ''),
      status: {
        label: 'dns.diagnosisVerdict',
        value: `dns.verdicts.${code}`,
        tone: VERDICT_TONES[code] ?? 'neutral',
      },
      details: [
        { label: 'dns.diagnosisTarget', value: data['DprTarget'], monospace: true },
        { label: 'Created at', value: data['DprDateCreated'], kind: 'datetime' },
        { label: 'dns.diagnosisFailing', value: failing || '—' },
        ...(scope
          ? [{ label: 'dns.diagnosisScope', value: `dns.verdictScopes.${scope}`, translate: true }]
          : []),
        { label: 'dns.diagnosisNotes', value: notes.join(' · ') || '—', wide: true },
      ],
      sections: [
        operators,
        ...rows(data['jobs']).flatMap((job) =>
          probeSections(job, outcomes[String(job['agentName'] ?? job['agentUUID'])], (key) =>
            this.t(key),
          ),
        ),
      ],
    });
  }
}
