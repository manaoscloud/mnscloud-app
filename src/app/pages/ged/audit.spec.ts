import {
  documentScanReasonText,
  documentUploadErrorMessage,
  documentVersionVerificationChipClass,
  documentVersionVerificationText,
} from '../registry/documents';
import {
  GED_AUDIT_ACTION_OPTIONS,
  gedAuditActionLabel,
  gedAuditActorKindLabel,
  gedAuditActorText,
  gedAuditShortHash,
} from './audit';

describe('GED security and audit helpers', () => {
  const dict: Record<string, string> = {
    'documents.pending': 'Pending',
    'documents.rejected': 'Rejected',
    'documents.scan.verified': 'Verified',
    'documents.scan.unverified': 'Unverified',
    'documents.scan.rejectedUpload': 'File rejected by security verification',
    'documents.scan.unavailable':
      'Security verification is temporarily unavailable. Retry the upload to keep the same version.',
    'documents.scan.reason.ok': 'No threats detected',
    'documents.scan.reason.pdf-javascript': 'PDF with active content (JavaScript)',
    'documents.scan.reason.pdf-launch': 'PDF with external execution action (Launch)',
    'documents.scan.reason.pdf-embedded-file': 'PDF with embedded file',
    'documents.scan.reason.pdf-encrypted': 'Encrypted PDF',
    'documents.scan.reason.pdf-truncated': 'Incomplete or truncated PDF',
    'documents.scan.reason.png-invalid': 'Invalid PNG image',
    'documents.scan.reason.jpeg-invalid': 'Invalid JPEG image',
    'documents.scan.reason.av': 'Threat detected by antivirus',
    'documents.scan.reason.unknown': 'Security rule violation',
    'ged.audit.actions.document.created': 'Document created',
    'ged.audit.actions.version.rejected': 'Version rejected',
    'ged.audit. actions.account.member-removed': 'Operator removed',
    'ged.audit.actorKinds.staff': 'Operator',
    'ged.audit.actorKinds.portal': 'Customer portal',
    'ged.audit.actorKinds.system': 'System',
  };
  const t = (key: string) => dict[key] ?? key;

  it('translates known scan rejection reasons and antivirus signatures', () => {
    expect(documentScanReasonText('pdf-javascript', t)).toBe(
      'PDF with active content (JavaScript)',
    );
    expect(documentScanReasonText('png-invalid', t)).toBe('Invalid PNG image');
    expect(documentScanReasonText('av:Win.Test.EICAR_HDB-1', t)).toBe(
      'Threat detected by antivirus (Win.Test.EICAR_HDB-1)',
    );
    expect(documentScanReasonText('', t)).toBe('Security rule violation');
  });

  it('formats version verification badge text and chip classes', () => {
    expect(
      documentVersionVerificationText(
        { RdvState: 'ready', RdvScanEngine: 'structural', RdvScanResult: 'ok' },
        t,
      ),
    ).toBe('Verified');
    expect(
      documentVersionVerificationChipClass({
        RdvState: 'ready',
        RdvScanEngine: 'clamav+structural',
      }),
    ).toBe('chip-success');

    expect(
      documentVersionVerificationText(
        { RdvState: 'ready', RdvScanEngine: null, RdvScanResult: null },
        t,
      ),
    ).toBe('Unverified');
    expect(
      documentVersionVerificationChipClass({ RdvState: 'ready', RdvScanEngine: null }),
    ).toBe('chip-skipped');

    expect(
      documentVersionVerificationText(
        { RdvState: 'rejected', RdvScanEngine: 'structural', RdvScanResult: 'pdf-encrypted' },
        t,
      ),
    ).toBe('Rejected: Encrypted PDF');
    expect(
      documentVersionVerificationChipClass({
        RdvState: 'rejected',
        RdvScanEngine: 'structural',
        RdvScanResult: 'pdf-encrypted',
      }),
    ).toBe('chip-failed');
  });

  it('maps upload error codes DOCUMENT_REJECTED and DOCUMENT_SCAN_UNAVAILABLE', () => {
    expect(
      documentUploadErrorMessage(
        { status: 422, error: { code: 'DOCUMENT_REJECTED', reason: 'pdf-launch' } },
        t,
      ),
    ).toBe('File rejected by security verification: PDF with external execution action (Launch)');

    expect(
      documentUploadErrorMessage(
        { status: 503, error: { code: 'DOCUMENT_SCAN_UNAVAILABLE' } },
        t,
      ),
    ).toBe(
      'Security verification is temporarily unavailable. Retry the upload to keep the same version.',
    );

    expect(documentUploadErrorMessage({ status: 500, error: { code: 'OTHER' } }, t)).toBeNull();
  });

  it('maps GED audit actions, actor kinds, actors and short hashes', () => {
    expect(GED_AUDIT_ACTION_OPTIONS.length).toBe(14);
    expect(gedAuditActionLabel('document.created', t)).toBe('Document created');
    expect(gedAuditActionLabel('version.rejected', t)).toBe('Version rejected');
    expect(gedAuditActorKindLabel('portal', t)).toBe('Customer portal');
    expect(gedAuditActorText({ RdaActorName: 'Maria Silva' })).toBe('Maria Silva');
    expect(gedAuditActorText({ ActorName: 'João Souza' })).toBe('João Souza');
    expect(gedAuditActorText({})).toBe('-');
    expect(
      gedAuditShortHash('abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'),
    ).toBe('abcdef012345');
    expect(gedAuditShortHash(null)).toBe('-');
  });
});
