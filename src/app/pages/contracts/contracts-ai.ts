import type {
  DataViewerDialogData,
  DataViewerSection,
} from '../../shared/data-viewer-dialog/data-viewer-dialog';

/**
 * Contracts & CLM AI features (Phase AI): views of the AI answers and human review dialogs.
 * Every AI feature provides assistive suggestions only; human review and confirmation are mandatory.
 */

type Translate = (key: string) => string;
type Row = Record<string, unknown>;

export const AI_LANGUAGES = ['pt-BR', 'en-US', 'es-ES'] as const;

export function aiLanguage(active: string): string {
  return (AI_LANGUAGES as readonly string[]).includes(active) ? active : 'pt-BR';
}

/** AI refusals (no provider, credits, hourly limit, rejected answer) have their own translated message. */
export function aiFailureKey(error: unknown): string | null {
  const status = (error as { status?: number } | null)?.status;
  if (status === 402) return 'contracts.ai.noCredit';
  if (status === 429) return 'contracts.ai.rateLimited';
  if (status === 502) return 'contracts.ai.rejected';
  if (status === 503) return 'contracts.ai.unavailable';
  return null;
}

const list = (items: unknown, numbered = false) =>
  (Array.isArray(items) ? items : [])
    .map((item, index) => `${numbered ? `${index + 1}.` : '-'} ${String(item)}`)
    .join('\n');

const AI_NOTE = 'contracts.ai.generatedNote';

/** Dialog view for drafted clause or template section. */
export function clauseDraftView(
  data: Row,
  _t: Translate,
): DataViewerDialogData {
  const draft = String(data['draft'] ?? '');
  const title = String(data['title'] ?? 'Cláusula');
  const vars = Array.isArray(data['suggestedVariables']) ? data['suggestedVariables'] : [];

  const sections: DataViewerSection[] = [
    { title: 'contracts.ai.draftTitle', message: title },
    {
      title: 'contracts.ai.draftContent',
      code: { value: draft, format: 'text', copy: true },
    },
  ];

  if (vars.length > 0) {
    sections.push({
      title: 'contracts.ai.suggestedVariables',
      message: list(vars),
    });
  }

  sections.push({
    title: 'contracts.ai.disclaimer',
    message: AI_NOTE,
  });

  return {
    title: 'contracts.ai.draftClauseHeader',
    sections,
  };
}

/** Dialog view for contract risk review. */
export function riskReviewView(
  data: Row,
  _t: Translate,
): DataViewerDialogData {
  const summary = String(data['summary'] ?? '');
  const score = data['score'] != null ? String(data['score']) : '80';
  const risks = Array.isArray(data['risks']) ? data['risks'] as Row[] : [];

  const riskLines = risks.map((r, i) =>
    `${i + 1}. [${String(r['severity'] ?? 'info').toUpperCase()}] ${String(r['clause'] ?? '')}\n   Risco: ${String(r['risk'] ?? '')}\n   Recomendação: ${String(r['recommendation'] ?? '')}`
  ).join('\n\n');

  const sections: DataViewerSection[] = [
    { title: 'contracts.ai.riskScore', message: `${score} / 100` },
    { title: 'contracts.ai.riskSummary', message: summary },
    {
      title: 'contracts.ai.riskFindings',
      message: riskLines || 'Nenhum risco relevante encontrado.',
    },
    {
      title: 'contracts.ai.disclaimer',
      message: AI_NOTE,
    },
  ];

  return {
    title: 'contracts.ai.riskReviewHeader',
    sections,
  };
}

/** Dialog view for extracted document metadata. */
export function metadataExtractionView(
  data: Row,
  _t: Translate,
): DataViewerDialogData {
  const parties = Array.isArray(data['parties']) ? data['parties'] as Row[] : [];
  const obligations = Array.isArray(data['obligations']) ? data['obligations'] as Row[] : [];

  const partiesText = parties.map((p) =>
    `- ${String(p['name'] ?? '')} (${String(p['taxId'] ?? 'N/A')}) - ${String(p['role'] ?? 'Parte')}`
  ).join('\n');

  const obligationsText = obligations.map((o) =>
    `- ${String(o['description'] ?? '')} (Vencimento: ${String(o['dueDate'] ?? 'N/A')})`
  ).join('\n');

  const sections: DataViewerSection[] = [
    { title: 'contracts.ai.parties', message: partiesText || 'Não identificadas' },
    {
      title: 'contracts.ai.termsAndValues',
      message: `Início: ${String(data['effectiveDate'] ?? 'N/A')} | Término: ${String(data['endDate'] ?? 'N/A')}\nValor Mensal: R$ ${String(data['monthlyValue'] ?? '0,00')} | Reajuste: ${String(data['adjustmentIndex'] ?? 'N/A')}`,
    },
    {
      title: 'contracts.ai.obligations',
      message: obligationsText || 'Nenhuma obrigação específica identificada',
    },
    {
      title: 'contracts.ai.disclaimer',
      message: AI_NOTE,
    },
  ];

  return {
    title: 'contracts.ai.metadataHeader',
    sections,
  };
}

/** Dialog view for clause explanation in plain language for signers. */
export function clauseExplanationView(
  data: Row,
  _t: Translate,
): DataViewerDialogData {
  const summary = String(data['plainSummary'] ?? '');
  const keyPoints = Array.isArray(data['keyPoints']) ? data['keyPoints'] : [];
  const highlights = (data['highlights'] ?? {}) as Row;

  const highlightLines: string[] = [];
  if (highlights['monthlyValue']) highlightLines.push(`Valor: ${String(highlights['monthlyValue'])}`);
  if (highlights['commitmentPeriod']) highlightLines.push(`Fidelidade: ${String(highlights['commitmentPeriod'])}`);
  if (highlights['cancellationTerms']) highlightLines.push(`Cancelamento: ${String(highlights['cancellationTerms'])}`);
  if (highlights['adjustmentIndex']) highlightLines.push(`Reajuste: ${String(highlights['adjustmentIndex'])}`);

  const sections: DataViewerSection[] = [
    { title: 'contracts.ai.plainExplanation', message: summary },
    { title: 'contracts.ai.keyPoints', message: list(keyPoints, true) },
  ];

  if (highlightLines.length > 0) {
    sections.push({
      title: 'contracts.ai.keyTerms',
      message: highlightLines.join('\n'),
    });
  }

  sections.push({
    title: 'contracts.ai.disclaimer',
    message: AI_NOTE,
  });

  return {
    title: 'contracts.ai.clauseExplanationHeader',
    sections,
  };
}

/** Dialog view for platform operational anomalies insight. */
export function anomalyInsightView(
  data: Row,
  _t: Translate,
): DataViewerDialogData {
  const status = String(data['operationalStatus'] ?? 'healthy').toUpperCase();
  const analysis = String(data['analysis'] ?? '');
  const anomalies = Array.isArray(data['anomalies']) ? data['anomalies'] : [];
  const recommendations = Array.isArray(data['recommendations']) ? data['recommendations'] : [];
  const metrics = (data['metrics'] ?? {}) as Row;

  const metricsLines = Object.entries(metrics)
    .map(([k, v]) => `- ${k}: ${String(v)}`)
    .join('\n');

  const sections: DataViewerSection[] = [
    { title: 'contracts.ai.operationalStatus', message: status },
    { title: 'contracts.ai.analysis', message: analysis },
    {
      title: 'contracts.ai.anomalies',
      message: anomalies.length > 0 ? list(anomalies) : 'Nenhuma anomalia detectada.',
    },
    {
      title: 'contracts.ai.recommendations',
      message: recommendations.length > 0 ? list(recommendations, true) : 'Nenhuma ação necessária.',
    },
    {
      title: 'contracts.ai.metrics',
      message: metricsLines || 'Métricas não disponíveis.',
    },
    {
      title: 'contracts.ai.disclaimer',
      message: AI_NOTE,
    },
  ];

  return {
    title: 'contracts.ai.anomalyInsightHeader',
    sections,
  };
}
