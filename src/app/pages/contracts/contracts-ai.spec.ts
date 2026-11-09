import {
  aiFailureKey,
  aiLanguage,
  anomalyInsightView,
  clauseDraftView,
  clauseExplanationView,
  metadataExtractionView,
  riskReviewView,
} from './contracts-ai';

describe('Contracts AI views', () => {
  const t = (k: string) => k;

  it('aiLanguage falls back to pt-BR for unsupported locales', () => {
    expect(aiLanguage('pt-BR')).toBe('pt-BR');
    expect(aiLanguage('en-US')).toBe('en-US');
    expect(aiLanguage('fr-FR')).toBe('pt-BR');
  });

  it('aiFailureKey maps HTTP status codes correctly', () => {
    expect(aiFailureKey({ status: 402 })).toBe('contracts.ai.noCredit');
    expect(aiFailureKey({ status: 429 })).toBe('contracts.ai.rateLimited');
    expect(aiFailureKey({ status: 502 })).toBe('contracts.ai.rejected');
    expect(aiFailureKey({ status: 503 })).toBe('contracts.ai.unavailable');
    expect(aiFailureKey({ status: 500 })).toBeNull();
  });

  it('clauseDraftView builds dialog sections with draft and suggested variables', () => {
    const dialog = clauseDraftView(
      {
        draft: 'Cláusula 1ª - Do Objeto...',
        title: 'Objeto do Contrato',
        suggestedVariables: ['NomeCliente', 'CNPJ'],
      },
      t,
    );
    expect(dialog.title).toBe('contracts.ai.draftClauseHeader');
    expect(dialog.sections?.length).toBe(4);
    expect(dialog.sections?.[0].message).toBe('Objeto do Contrato');
    expect(dialog.sections?.[1].code?.value).toContain('Cláusula 1ª');
  });

  it('riskReviewView builds risk score and findings', () => {
    const dialog = riskReviewView(
      {
        summary: 'Risco moderado.',
        score: 75,
        risks: [
          {
            severity: 'high',
            clause: 'Multa de 50%',
            risk: 'Abusividade CDC',
            recommendation: 'Reduzir para 10%',
          },
        ],
      },
      t,
    );
    expect(dialog.title).toBe('contracts.ai.riskReviewHeader');
    expect(dialog.sections?.[0].message).toBe('75 / 100');
    expect(dialog.sections?.[2].message).toContain('Abusividade CDC');
  });

  it('metadataExtractionView builds parties, terms and obligations', () => {
    const dialog = metadataExtractionView(
      {
        parties: [{ name: 'Empresa A', taxId: '12.345.678/0001-90', role: 'Contratante' }],
        effectiveDate: '2026-01-01',
        endDate: '2027-01-01',
        monthlyValue: 1500,
        adjustmentIndex: 'IPCA',
        obligations: [{ description: 'Entrega de relatório', dueDate: '2026-02-01' }],
      },
      t,
    );
    expect(dialog.title).toBe('contracts.ai.metadataHeader');
    expect(dialog.sections?.[0].message).toContain('Empresa A');
    expect(dialog.sections?.[1].message).toContain('IPCA');
    expect(dialog.sections?.[2].message).toContain('Entrega de relatório');
  });

  it('clauseExplanationView builds explanation, key points and highlights', () => {
    const dialog = clauseExplanationView(
      {
        plainSummary: 'Este trecho explica as condições de cancelamento.',
        keyPoints: ['Aviso prévio de 30 dias', 'Sem multa após 12 meses'],
        highlights: { cancellationTerms: '30 dias' },
      },
      t,
    );
    expect(dialog.title).toBe('contracts.ai.clauseExplanationHeader');
    expect(dialog.sections?.[0].message).toContain('condições de cancelamento');
    expect(dialog.sections?.[1].message).toContain('Aviso prévio');
    expect(dialog.sections?.[2].message).toContain('30 dias');
  });

  it('anomalyInsightView builds operational status and analysis', () => {
    const dialog = anomalyInsightView(
      {
        operationalStatus: 'healthy',
        analysis: 'Todos os conectores operando dentro dos parâmetros.',
        anomalies: [],
        recommendations: [],
        metrics: { EnvelopesCompleted7d: 150 },
      },
      t,
    );
    expect(dialog.title).toBe('contracts.ai.anomalyInsightHeader');
    expect(dialog.sections?.[0].message).toBe('HEALTHY');
    expect(dialog.sections?.[4].message).toContain('EnvelopesCompleted7d: 150');
  });
});
