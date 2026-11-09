import {
  aiFailureKey,
  aiLanguage,
  digestView,
  explanationView,
  exposureView,
  narrativeForm,
  narrativeMonth,
  triageView,
} from './cyber-ai';

const t = (key: string) => `t:${key}`;

describe('Cyber Security AI views', () => {
  it('maps AI refusals to their messages and keeps other errors generic', () => {
    expect(aiFailureKey({ status: 503 })).toBe('cyberSecurity.ai.unavailable');
    expect(aiFailureKey({ status: 402 })).toBe('cyberSecurity.ai.noCredit');
    expect(aiFailureKey({ status: 429 })).toBe('cyberSecurity.ai.rateLimited');
    expect(aiFailureKey({ status: 502 })).toBe('cyberSecurity.ai.rejected');
    expect(aiFailureKey({ status: 403 })).toBeNull();
    expect(aiFailureKey(null)).toBeNull();
    expect(aiLanguage('es-ES')).toBe('es-ES');
    expect(aiLanguage('fr')).toBe('pt-BR');
  });

  it('shows the rule-based command beside the AI explanation', () => {
    const view = explanationView(
      { code: 'CVE-2023-4863', agentName: 'web-01' },
      {
        explanation: {
          summary: 'Heap overflow.',
          risk: 'High.',
          steps: ['Update', 'Restart'],
          warning: '',
        },
        remediation: { action: 'update', command: 'sudo apt-get install --only-upgrade libwebp7' },
      },
      t,
    );
    expect(view.sections?.map((s) => s.title)).toEqual([
      'cyberSecurity.ai.whatIsIt',
      'cyberSecurity.ai.risk',
      'cyberSecurity.ai.steps',
      'cyberSecurity.vuln.updateCommand',
    ]);
    expect(view.sections?.[2].message).toBe('1. Update\n2. Restart');
    expect(view.sections?.[3].code?.value).toBe('sudo apt-get install --only-upgrade libwebp7');
  });

  it('lists the digest and the triage groups with the rule data', () => {
    const digest = digestView(
      {
        digest: { headline: 'One urgent.', highlights: ['a'], actions: ['b'] },
        summary: { p0: 1 },
        items: [{ code: 'CVE-1' }],
      },
      t,
    );
    expect(digest.description).toContain('One urgent.');
    expect(digest.sections?.[2].table?.rows.length).toBe(1);
    const triage = triageView(
      {
        summary: 'S',
        groups: [
          {
            category: 'brute_force',
            title: 'SSH',
            explanation: 'E',
            suggestion: 'Keep',
            alerts: [
              { uuid: 'a', enforcementStatus: 'active' },
              { uuid: 'b', enforcementStatus: 'not_blocked' },
            ],
          },
        ],
      },
      t,
    );
    expect(triage.sections?.[0].title).toBe('t:cyberSecurity.ai.category.brute_force · SSH');
    expect(triage.sections?.[0].table?.rows.map((row) => row['blocked'])).toEqual(['Yes', 'No']);
  });

  it('shows the platform exposure without AI when the answer is missing', () => {
    const view = exposureView('CVE-1', { totals: { servers: 2 }, items: [{ tenantName: 'A' }] }, t);
    expect(view.description).toBe('CVE-1 · t:cyberSecurity.ai.withoutAi');
    expect(view.sections?.length).toBe(1);
    const withAi = exposureView(
      'CVE-1',
      { totals: {}, items: [], watch: { summary: 'x', actions: [] } },
      t,
    );
    expect(withAi.sections?.length).toBe(3);
  });

  it('opens the report text for the previous month with revision and source in the query', () => {
    expect(narrativeMonth(new Date(2026, 0, 15))).toBe('2025-12');
    expect(narrativeMonth(new Date(2026, 10, 9))).toBe('2026-10');
    const edit = narrativeForm(
      'acc',
      '2026-10',
      { text: 'Saved', status: 'published', revision: 3 },
      null,
    );
    expect(edit.endpoint).toBe(
      'cyber-security/accounts/acc/vulnerability-report/narrative?month=2026-10&source=manual&revision=3',
    );
    expect(edit.initialValues).toEqual({ text: 'Saved', publication: 'published' });
    const draft = narrativeForm('acc', '2026-10', null, 'AI text');
    expect(draft.endpoint).toContain('source=ai');
    expect(draft.endpoint).not.toContain('revision');
    expect(draft.initialValues).toEqual({ text: 'AI text', publication: 'draft' });
  });
});
