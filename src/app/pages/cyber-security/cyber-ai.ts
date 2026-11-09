import type {
  ConfigurableCrudConfig,
  ConfigurableCrudRecord,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import type {
  DataViewerDialogData,
  DataViewerSection,
} from '../../shared/data-viewer-dialog/data-viewer-dialog';

/**
 * Cyber Security AI features (V5): views of the answers and the reviewed report text form. The
 * API validates every AI answer against the data it came from; these views always show the
 * rule-based data (command, counters, lists) beside the AI text.
 */

type Translate = (key: string) => string;
type Row = Record<string, unknown>;

export const AI_LANGUAGES = ['pt-BR', 'en-US', 'es-ES'] as const;

export function aiLanguage(active: string): string {
  return (AI_LANGUAGES as readonly string[]).includes(active) ? active : 'pt-BR';
}

/** AI refusals (no provider, credits, hourly limit, rejected answer) have their own message. */
export function aiFailureKey(error: unknown): string | null {
  const status = (error as { status?: number } | null)?.status;
  if (status === 402) return 'cyberSecurity.ai.noCredit';
  if (status === 429) return 'cyberSecurity.ai.rateLimited';
  if (status === 502) return 'cyberSecurity.ai.rejected';
  if (status === 503) return 'cyberSecurity.ai.unavailable';
  return null;
}

const list = (items: unknown, numbered = false) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => `${numbered ? `${index + 1}.` : '-'} ${String(item)}`)
    .join('\n');

const AI_NOTE = 'cyberSecurity.ai.generatedNote';

/** Explanation of one finding; the update command shown is the rule-based one. */
export function explanationView(
  finding: ConfigurableCrudRecord,
  data: Row,
  t: Translate,
): DataViewerDialogData {
  const explanation = (data['explanation'] ?? {}) as Row;
  const fix = (data['remediation'] ?? {}) as Row;
  const sections: DataViewerSection[] = [
    { title: 'cyberSecurity.ai.whatIsIt', message: explanation['summary'] ?? '' },
    { title: 'cyberSecurity.ai.risk', message: explanation['risk'] ?? '' },
    { title: 'cyberSecurity.ai.steps', message: list(explanation['steps'], true) },
  ];
  if (fix['action'] === 'update' && fix['command']) {
    sections.push({
      title: 'cyberSecurity.vuln.updateCommand',
      code: { value: fix['command'], format: 'shell', copy: true },
    });
  }
  if (explanation['warning']) {
    sections.push({ title: 'cyberSecurity.ai.warning', message: explanation['warning'] });
  }
  return {
    title: 'cyberSecurity.ai.explain',
    description: `${finding['code'] ?? ''} · ${finding['agentName'] ?? ''} · ${t(AI_NOTE)}`,
    sections,
  };
}

/** Exposure digest: AI headline, highlights and actions over the rule-ordered list. */
export function digestView(data: Row, t: Translate): DataViewerDialogData {
  const digest = (data['digest'] ?? {}) as Row;
  const summary = (data['summary'] ?? {}) as Row;
  const counter = (key: string, label: string) => ({
    label,
    value: summary[key] ?? 0,
    translate: true,
  });
  return {
    title: 'cyberSecurity.ai.digest',
    description: `${String(digest['headline'] ?? '')} · ${t(AI_NOTE)}`,
    details: [
      counter('openFindings', 'cyberSecurity.ai.openFindings'),
      counter('p0', 'P0'),
      counter('p1', 'P1'),
      counter('overdue', 'cyberSecurity.ai.overdue'),
      counter('kev', 'KEV'),
      counter('fixedLast30Days', 'cyberSecurity.ai.fixed30'),
    ],
    sections: [
      { title: 'cyberSecurity.ai.highlights', message: list(digest['highlights']) },
      { title: 'cyberSecurity.ai.actions', message: list(digest['actions'], true) },
      {
        title: 'cyberSecurity.ai.mostUrgent',
        table: {
          columns: [
            { key: 'code', label: 'CVE', translate: false },
            { key: 'priority', label: 'cyberSecurity.vuln.priority', translate: false },
            { key: 'serverCount', label: 'cyberSecurity.vuln.affectedServers', translate: false },
            { key: 'dueAt', label: 'cyberSecurity.vuln.due', kind: 'datetime' },
          ],
          rows: (data['items'] as Row[] | undefined) ?? [],
        },
      },
    ],
  };
}

/** Alert triage: one section per group with its alerts; nothing was blocked or changed. */
export function triageView(data: Row, t: Translate): DataViewerDialogData {
  const groups = (data['groups'] as Row[] | undefined) ?? [];
  return {
    title: 'cyberSecurity.ai.triage',
    description: `${String(data['summary'] ?? '')} · ${t('cyberSecurity.ai.triageNote')}`,
    sections: groups.map((group) => ({
      title: `${t(`cyberSecurity.ai.category.${group['category']}`)} · ${group['title'] ?? ''}`,
      message: `${group['explanation'] ?? ''}\n\n${t('cyberSecurity.ai.suggestion')}: ${
        group['suggestion'] ?? ''
      }`,
      table: {
        columns: [
          { key: 'level', label: 'Level' },
          { key: 'sourceIP', label: 'cyberSecurity.ai.source', monospace: true, translate: false },
          { key: 'scenario', label: 'cyberSecurity.ai.scenario', translate: false },
          { key: 'serverName', label: 'cyberSecurity.ai.server', translate: false },
          { key: 'blocked', label: 'Blocked' },
        ],
        rows: ((group['alerts'] as Row[] | undefined) ?? []).map((alert) => ({
          ...alert,
          blocked: alert['enforcementStatus'] === 'active' ? 'Yes' : 'No',
        })),
      },
    })),
  };
}

/** Platform exposure per tenant, with the AI answer when it is available. */
export function exposureView(code: string, data: Row, t: Translate): DataViewerDialogData {
  const totals = (data['totals'] ?? {}) as Row;
  const watch = data['watch'] as Row | undefined;
  const sections: DataViewerSection[] = [];
  if (watch) {
    sections.push({ title: 'cyberSecurity.ai.answer', message: watch['summary'] ?? '' });
    sections.push({ title: 'cyberSecurity.ai.actions', message: list(watch['actions'], true) });
  }
  sections.push({
    title: 'cyberSecurity.ai.perTenant',
    table: {
      columns: [
        { key: 'tenantName', label: 'Tenant', translate: false },
        { key: 'servers', label: 'cyberSecurity.ai.servers', translate: false },
        { key: 'openFindings', label: 'cyberSecurity.ai.openFindings', translate: false },
        { key: 'overdue', label: 'cyberSecurity.ai.overdue', translate: false },
        { key: 'acceptedRisks', label: 'cyberSecurity.ai.acceptedRisks', translate: false },
        { key: 'fixedFindings', label: 'cyberSecurity.ai.fixed', translate: false },
        { key: 'topPriority', label: 'cyberSecurity.vuln.priority', translate: false },
      ],
      rows: (data['items'] as Row[] | undefined) ?? [],
      emptyLabel: 'cyberSecurity.ai.notExposed',
    },
  });
  return {
    title: 'cyberSecurity.ai.platformExposure',
    description: `${code} · ${watch ? t(AI_NOTE) : t('cyberSecurity.ai.withoutAi')}`,
    details: [
      { label: 'cyberSecurity.ai.exposedTenants', value: totals['exposedTenants'] ?? 0 },
      { label: 'cyberSecurity.ai.servers', value: totals['servers'] ?? 0 },
      { label: 'cyberSecurity.ai.openFindings', value: totals['openFindings'] ?? 0 },
      { label: 'cyberSecurity.ai.overdue', value: totals['overdue'] ?? 0 },
    ],
    sections,
  };
}

export type ReportNarrative = {
  text: string;
  status: 'draft' | 'published';
  revision: number;
} | null;

/** The month the report text actions work on: the previous (closed) month, YYYY-MM. */
export function narrativeMonth(now: Date): string {
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Report text form: the saved text, or an AI draft to review (source ai). Saving keeps a draft
 * unless "published" is chosen; month, revision and source travel in the endpoint query string.
 */
export function narrativeForm(
  accountUUID: string,
  month: string,
  current: ReportNarrative,
  aiText: string | null,
): ConfigurableCrudConfig {
  const params = new URLSearchParams({ month, source: aiText === null ? 'manual' : 'ai' });
  if (current) params.set('revision', String(current.revision));
  return defineCrud({
    endpoint: `cyber-security/accounts/${encodeURIComponent(accountUUID)}/vulnerability-report/narrative?${params.toString()}`,
    uuidField: 'uuid',
    pageTitle: 'cyberSecurity.ai.reportText',
    pageDescription:
      aiText === null ? 'cyberSecurity.ai.reportTextHelp' : 'cyberSecurity.ai.reportDraftHelp',
    createTitle: 'cyberSecurity.ai.reportText',
    savedMessage: 'cyberSecurity.ai.reportTextSaved',
    statusFilter: false,
    initialValues: {
      text: aiText ?? current?.text ?? '',
      publication: aiText === null ? (current?.status ?? 'draft') : 'draft',
    },
    columns: [],
    fields: [
      {
        key: 'publication',
        label: 'cyberSecurity.ai.publication',
        type: 'select',
        required: true,
        span: 1,
        options: [
          { value: 'draft', label: 'cyberSecurity.ai.draft' },
          { value: 'published', label: 'cyberSecurity.ai.published' },
        ],
        help: 'cyberSecurity.ai.publicationHelp',
      },
      {
        key: 'text',
        label: 'cyberSecurity.ai.reportText',
        type: 'textarea',
        required: true,
        span: 4,
        help: 'cyberSecurity.ai.reportTextFieldHelp',
      },
    ],
  });
}
