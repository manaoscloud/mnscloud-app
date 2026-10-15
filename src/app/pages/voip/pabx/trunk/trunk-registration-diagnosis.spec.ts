import type { DataViewerDetail } from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import type { RuntimeDiagnosticResult } from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';
import { sipResponseLabel, trunkDiagnosisSections } from './trunk-registration-diagnosis';

function detail(details: readonly DataViewerDetail[] | undefined, label: string) {
  return details?.find((item) => item.label === label)?.value;
}

describe('PABX trunk registration diagnosis', () => {
  const base: RuntimeDiagnosticResult = { jobUUID: 'job', status: 'success' };

  it('explains a forbidden registration with destination, contact and the IP to allow', () => {
    const sections = trunkDiagnosisSections({
      ...base,
      diagnosis: {
        category: 'forbidden',
        lastResponse: { code: 403, phrase: 'Forbidden', failures: 4, retrySeconds: 120 },
        destination: { host: 'sip1.example.test', port: 5060, transport: 'udp' },
        local: { publicIP: '203.0.113.10', port: 5080, transport: 'udp' },
        allowSource: { ip: '203.0.113.10', port: 5080, transport: 'udp' },
        realm: { configured: '198.51.100.7', announced: 'sip1.example.test', matches: false },
        probe: {
          outcome: 'response',
          code: 401,
          phrase: 'Unauthorized',
          target: '198.51.100.7:5060',
          durationMs: 40,
        },
      },
    } as RuntimeDiagnosticResult);

    const [diagnosis, connection] = sections;
    expect(diagnosis.title).toBe('Registration diagnosis');
    expect(detail(diagnosis.details, 'Diagnosis')).toBe('Registration forbidden by the provider');
    expect(detail(diagnosis.details, 'Last SIP response')).toBe('403 Forbidden');
    expect(detail(diagnosis.details, 'Next retry (seconds)')).toBe(120);
    expect(detail(connection.details, 'Registration destination')).toBe(
      'sip1.example.test:5060 (UDP)',
    );
    expect(detail(connection.details, 'Address of this PABX (Contact)')).toBe(
      '203.0.113.10:5080 (UDP)',
    );
    expect(detail(connection.details, 'Allow at the provider')).toBe('203.0.113.10:5080 (UDP)');
    expect(detail(connection.details, 'Realm announced by the provider')).toBe('sip1.example.test');
    expect(detail(connection.details, 'Realm')).toContain('announces a different realm');
    expect(detail(connection.details, 'Provider check')).toBe(
      '401 Unauthorized · 198.51.100.7:5060 · 40 ms',
    );
  });

  it('shows nothing for results without a diagnosis (older API) and labels SIP responses', () => {
    expect(trunkDiagnosisSections(base)).toEqual([]);
    expect(sipResponseLabel({ code: 503, phrase: 'Service Unavailable' })).toBe(
      '503 Service Unavailable',
    );
    expect(sipResponseLabel(null)).toBe('');
  });

  it('reports a silent provider without a SIP response', () => {
    const [diagnosis, connection] = trunkDiagnosisSections({
      ...base,
      diagnosis: {
        category: 'no_response',
        lastResponse: null,
        destination: { host: '198.51.100.7', port: 5060, transport: 'udp' },
        local: null,
        allowSource: null,
        realm: { configured: null, announced: null, matches: null },
        probe: { outcome: 'timeout' },
      },
    } as RuntimeDiagnosticResult);
    expect(detail(diagnosis.details, 'Diagnosis')).toBe('No response from the provider');
    expect(detail(diagnosis.details, 'Last SIP response')).toBeUndefined();
    expect(detail(connection.details, 'Provider check')).toBe('No response within 4 seconds');
  });
});
