import type {
  DataViewerDetail,
  DataViewerSection,
} from '../../../../shared/data-viewer-dialog/data-viewer-dialog';
import type { RuntimeDiagnosticResult } from '../../../../shared/runtime-diagnostic/runtime-diagnostic.util';

type JsonRecord = Record<string, unknown>;

const categoryLabels: Record<string, string> = {
  registered: 'Registered with the provider',
  not_applicable: 'Outbound registration is disabled for this trunk',
  not_configured: 'Trunk not loaded in the PABX runtime',
  registering: 'Registration in progress',
  auth_rejected: 'Credentials rejected by the provider',
  forbidden: 'Registration forbidden by the provider',
  not_found: 'Account not found at the provider',
  no_response: 'No response from the provider',
  unresolved: 'Provider address could not be resolved',
  service_unavailable: 'Provider refused the service',
  provider_error: 'Provider server error',
  rejected: 'Registration rejected by the provider',
  unknown: 'Cause not identified',
};

const categoryGuidance: Record<string, string> = {
  not_configured: 'Save the trunk again to reapply it to the PABX runtime.',
  registering: 'Wait a few seconds and run the status again.',
  auth_rejected:
    'Check the username and password of the trunk; they must match the account at the provider.',
  forbidden:
    'The provider refused this registration. Check the password, whether the account accepts registration (dynamic host) and whether the IP of this PABX is allowed at the provider.',
  not_found:
    'Check the username and the domain/realm of the trunk: the provider does not know this account.',
  no_response:
    'The provider did not answer. Check the host and port of the trunk and whether the provider firewall allows the IP of this PABX.',
  unresolved:
    'The host of the trunk could not be resolved. Check the domain name or use the IP address of the provider.',
  service_unavailable:
    'The provider refused the service. It may be blocking the IP of this PABX (firewall, fail2ban, anti-flood) or be temporarily unavailable; ask the provider to allow the IP shown below.',
  provider_error: 'The provider server returned an error. Try again later or contact the provider.',
  rejected:
    'The provider rejected the registration. Review the trunk settings with the provider using the SIP response shown.',
  unknown: 'No SIP response was recorded yet. Run the status again in a few seconds.',
};

function record(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function address(host: unknown, port: unknown, transport: unknown): string {
  const name = text(host);
  if (!name) return '';
  const base = text(port) ? `${name.includes(':') ? `[${name}]` : name}:${text(port)}` : name;
  return text(transport) ? `${base} (${text(transport).toUpperCase()})` : base;
}

/** `403 Forbidden` from a SIP response object. */
export function sipResponseLabel(value: unknown): string {
  const item = record(value);
  const code = text(item?.['code']);
  return code ? [code, text(item?.['phrase'])].filter(Boolean).join(' ') : '';
}

function probeValue(probe: JsonRecord): DataViewerDetail | null {
  const outcome = text(probe['outcome']);
  if (outcome === 'response') {
    const parts = [sipResponseLabel(probe), text(probe['target'])].filter(Boolean);
    const duration = text(probe['durationMs']);
    return {
      label: 'Provider check',
      value: duration ? `${parts.join(' · ')} · ${duration} ms` : parts.join(' · '),
      monospace: true,
    };
  }
  if (outcome === 'timeout') {
    return { label: 'Provider check', value: 'No response within 4 seconds', translate: true };
  }
  if (outcome === 'error') {
    return { label: 'Provider check', value: 'Address could not be resolved', translate: true };
  }
  return null;
}

/** Diagnosis and connection sections of the single-trunk runtime status dialog. */
export function trunkDiagnosisSections(result: RuntimeDiagnosticResult): DataViewerSection[] {
  const diagnosis = record((result as RuntimeDiagnosticResult & { diagnosis?: unknown }).diagnosis);
  if (!diagnosis) return [];

  const category = text(diagnosis['category']) || 'unknown';
  const lastResponse = record(diagnosis['lastResponse']);
  const diagnosisDetails: DataViewerDetail[] = [
    {
      label: 'Diagnosis',
      value: categoryLabels[category] ?? categoryLabels['unknown'],
      translate: true,
    },
  ];
  if (lastResponse) {
    diagnosisDetails.push({
      label: 'Last SIP response',
      value: sipResponseLabel(lastResponse),
      monospace: true,
    });
    if (text(lastResponse['at'])) {
      diagnosisDetails.push({ label: 'Last attempt', value: lastResponse['at'], kind: 'datetime' });
    }
    if (text(lastResponse['failures'])) {
      diagnosisDetails.push({ label: 'Failed attempts', value: lastResponse['failures'] });
    }
    if (text(lastResponse['retrySeconds'])) {
      diagnosisDetails.push({ label: 'Next retry (seconds)', value: lastResponse['retrySeconds'] });
    }
  }
  const guidance = categoryGuidance[category];
  if (guidance) {
    diagnosisDetails.push({ label: 'What to check', value: guidance, translate: true, wide: true });
  }

  const destination = record(diagnosis['destination']);
  const local = record(diagnosis['local']);
  const allow = record(diagnosis['allowSource']);
  const realm = record(diagnosis['realm']);
  const probe = record(diagnosis['probe']);
  const connection: DataViewerDetail[] = [];
  const destinationText = address(
    destination?.['host'],
    destination?.['port'],
    destination?.['transport'],
  );
  if (destinationText) {
    connection.push({ label: 'Registration destination', value: destinationText, monospace: true });
  }
  const contactText = address(local?.['publicIP'], local?.['port'], local?.['transport']);
  if (contactText) {
    connection.push({
      label: 'Address of this PABX (Contact)',
      value: contactText,
      monospace: true,
    });
    connection.push({
      label: 'About the Contact address',
      value:
        'The Contact is the address of this PABX, where the provider sends calls. Its port is fixed by the PABX server and is not the destination port of the trunk.',
      translate: true,
      wide: true,
    });
  }
  const allowText = address(allow?.['ip'], allow?.['port'], allow?.['transport']);
  if (allowText) {
    connection.push({ label: 'Allow at the provider', value: allowText, monospace: true });
  }
  if (text(realm?.['configured'])) {
    connection.push({ label: 'Configured realm', value: realm?.['configured'], monospace: true });
  }
  if (text(realm?.['announced'])) {
    connection.push({
      label: 'Realm announced by the provider',
      value: realm?.['announced'],
      monospace: true,
    });
  }
  if (realm?.['matches'] === false) {
    connection.push({
      label: 'Realm',
      value:
        'The provider announces a different realm. Fill the Realm (and From domain) of the trunk with the announced realm.',
      translate: true,
      wide: true,
    });
  }
  const probeDetail = probe ? probeValue(probe) : null;
  if (probeDetail) connection.push(probeDetail);

  return [
    { title: 'Registration diagnosis', details: diagnosisDetails },
    ...(connection.length ? [{ title: 'Connection', details: connection }] : []),
  ];
}
