import { revisionDeletePayloads } from '../../shared/crud/configurable-crud/revision-delete';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { ApiService, FileUploadProgress } from '../../services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openPrivateFile } from '../../shared/file-preview-dialog/private-file';
import { TranslocoService } from '@jsverse/transloco';
import { inject } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';

export const DOCUMENT_REVIEW_OPTIONS = [
  { value: 'not-required', label: 'documents.notRequired' },
  { value: 'pending', label: 'documents.pending' },
  { value: 'approved', label: 'documents.approved' },
  { value: 'rejected', label: 'documents.rejected' },
];
const states = DOCUMENT_REVIEW_OPTIONS;

export const DOCUMENT_SCAN_REASON_KEYS: Readonly<Record<string, string>> = {
  ok: 'documents.scan.reason.ok',
  'pdf-javascript': 'documents.scan.reason.pdf-javascript',
  'pdf-launch': 'documents.scan.reason.pdf-launch',
  'pdf-embedded-file': 'documents.scan.reason.pdf-embedded-file',
  'pdf-encrypted': 'documents.scan.reason.pdf-encrypted',
  'pdf-truncated': 'documents.scan.reason.pdf-truncated',
  'pdf-invalid': 'documents.scan.reason.pdf-invalid',
  'pdf-richmedia': 'documents.scan.reason.pdf-richmedia',
  'pdf-xfa': 'documents.scan.reason.pdf-xfa',
  'pdf-too-complex': 'documents.scan.reason.pdf-too-complex',
  'pdf-unsupported-filter': 'documents.scan.reason.pdf-unsupported-filter',
  'pdf-unreadable-stream': 'documents.scan.reason.pdf-unreadable-stream',
  'pdf-encrypted-uninspectable': 'documents.scan.reason.pdf-encrypted-uninspectable',
  'pdf-submit-form': 'documents.scan.reason.pdf-submit-form',
  'pdf-import-data': 'documents.scan.reason.pdf-import-data',
  'pdf-embedded-goto': 'documents.scan.reason.pdf-embedded-goto',
  'png-invalid': 'documents.scan.reason.png-invalid',
  'jpeg-invalid': 'documents.scan.reason.jpeg-invalid',
  'type-unsupported': 'documents.scan.reason.type-unsupported',
};

export function documentScanReasonText(
  reason: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  const code = typeof reason === 'string' ? reason.trim() : '';
  if (!code) return t('documents.scan.reason.unknown');
  if (code.startsWith('av:')) {
    const signature = code.slice(3).trim() || '-';
    return `${t('documents.scan.reason.av')} (${signature})`;
  }
  const key = DOCUMENT_SCAN_REASON_KEYS[code];
  return key ? t(key) : code;
}

export function documentVersionVerificationText(
  row: ConfigurableCrudRecord,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (row['RdvState'] === 'rejected') {
    return `${t('documents.rejected')}: ${documentScanReasonText(row['RdvScanResult'], t)}`;
  }
  const engine = typeof row['RdvScanEngine'] === 'string' ? row['RdvScanEngine'].trim() : '';
  if (!engine) {
    return row['RdvState'] === 'pending'
      ? t('documents.pending')
      : t('documents.scan.unverified');
  }
  return t('documents.scan.verified');
}

export function documentVersionVerificationChipClass(row: ConfigurableCrudRecord): string {
  if (row['RdvState'] === 'rejected') return 'chip-failed';
  const engine = typeof row['RdvScanEngine'] === 'string' ? row['RdvScanEngine'].trim() : '';
  if (!engine) return row['RdvState'] === 'pending' ? 'chip-queued' : 'chip-skipped';
  return 'chip-success';
}

export function documentUploadErrorMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string | null {
  const body = (error as { error?: Record<string, unknown> } | null)?.error;
  const code = typeof body?.['code'] === 'string' ? body['code'] : '';
  if (code === 'DOCUMENT_REJECTED') {
    const reason = documentScanReasonText(body?.['reason'], t);
    return `${t('documents.scan.rejectedUpload')}: ${reason}`;
  }
  if (code === 'DOCUMENT_SCAN_UNAVAILABLE') {
    return t('documents.scan.unavailable');
  }
  if (code === 'DOCUMENT_UPLOAD_EXPIRED') {
    return t('documents.scan.uploadExpired');
  }
  return null;
}

function withDocumentUploadErrors(
  api: ApiService,
  translate: (key: string, params?: Record<string, string | number>) => string,
): ApiService {
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (prop === 'postFormWithProgress') {
        return <T>(endpoint: string, body: FormData): Observable<FileUploadProgress<T>> =>
          target.postFormWithProgress<T>(endpoint, body).pipe(
            catchError((err: unknown) => {
              const msg = documentUploadErrorMessage(err, translate);
              if (msg) {
                return throwError(() => ({
                  ...(typeof err === 'object' && err ? err : {}),
                  error: {
                    ...(typeof (err as { error?: unknown })?.error === 'object' &&
                    (err as { error?: unknown })?.error
                      ? ((err as { error: Record<string, unknown> }).error)
                      : {}),
                    error: msg,
                    message: msg,
                  },
                  message: msg,
                }));
              }
              return throwError(() => err);
            }),
          );
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

const suggestionLabels: Record<string, string> = {
  title: 'Title',
  documentType: 'documents.documentType',
  issueDate: 'documents.issueDate',
  expiryDate: 'documents.expiryDate',
  summary: 'documents.summary',
  warning: 'documents.warning',
};
const hidden = (key: string, source = key): ConfigurableCrudField => ({
  key,
  source,
  label: suggestionLabels[key] ?? 'documents.revision',
  hiddenWhen: () => true,
});

/** One document component for all resource owners; the endpoint enforces the parent's scope. */
export function documentCollection(
  endpoint: string,
  api: ApiService,
  dialog: MatDialog,
  canReview: () => boolean,
  canAssist: () => boolean,
): ConfigurableCrudConfig {
  const transloco = inject(TranslocoService, { optional: true });
  const translate = (key: string, params?: Record<string, string | number>) =>
    transloco?.translate(key, params) ?? key;
  const uploadApi = withDocumentUploadErrors(api, translate);

  const versions = (document: ConfigurableCrudRecord): ConfigurableCrudConfig => {
    const base = `${endpoint}/${document['RdcUUID']}/versions`;
    const upload = (versionUUID?: string) => {
      let currentVersionUUID = versionUUID;
      return defineCrud({
        endpoint: base,
        requestApi: uploadApi,
        uuidField: 'RdvUUID',
        pageTitle: 'documents.versions',
        pageDescription: 'documents.uploadDescription',
        dialogDescription: 'documents.uploadDescription',
        createTitle: 'documents.upload',
        canEdit: false,
        canDelete: false,
        bulkDelete: false,
        statusFilter: false,
        serverSidePagination: true,
        createUpload: { fileField: 'file', formField: 'file', includeFields: true },
        initialValuesFactory: () => {
          currentVersionUUID ??= crypto.randomUUID();
          return {
            file: null,
            versionUUID: currentVersionUUID,
            revision: document['RdcRevision'],
          };
        },
        fields: [
          {
            key: 'file',
            label: 'File',
            type: 'file',
            accept: 'application/pdf,image/jpeg,image/png',
            required: true,
            span: 1,
          },
          hidden('versionUUID'),
          hidden('revision'),
        ],
        columns: [
          { id: 'version', field: 'RdvVersion', label: 'documents.version', kind: 'number' },
          { id: 'filename', field: 'RdvFilename', label: 'File', kind: 'identity' },
          {
            id: 'state',
            field: 'RdvState',
            label: 'Status',
            options: [
              { value: 'pending', label: 'documents.pending' },
              {
                value: 'ready',
                label: 'documents.ready',
              },
              { value: 'rejected', label: 'documents.rejected' },
              { value: 'cancelled', label: 'documents.cancelled' },
            ],
          },
          {
            id: 'verification',
            field: 'RdvScanResult',
            label: 'documents.scan.verification',
            kind: 'status',
            value: (row, t) => documentVersionVerificationText(row, t),
            chipClass: (_value, row) => documentVersionVerificationChipClass(row),
          },
          { id: 'created', field: 'RdvDateCreated', label: 'Date', kind: 'datetime' },
          {
            id: 'checksum',
            field: 'RdvChecksum',
            label: 'SHA-256',
            optional: true,
            copyable: true,
          },
        ],
      });
    };
    return {
      ...upload(),
      rowActions: [
        {
          key: 'open',
          label: 'Open file',
          icon: 'open_in_new',
          visible: (row: ConfigurableCrudRecord) => row['RdvState'] === 'ready',
          run: (row: ConfigurableCrudRecord) =>
            openPrivateFile(api, `${base}/${row['RdvUUID']}/content`, {
              dialog,
              contentType: String(row['RdvMimeType']),
              fileName: String(row['RdvFilename']),
            }),
        },
        {
          key: 'assist',
          label: 'documents.assist',
          icon: 'auto_awesome',
          visible: (row: ConfigurableCrudRecord) => row['RdvState'] === 'ready' && canAssist(),
          run: async (row: ConfigurableCrudRecord) => {
            const response = await api.post<{ data: ConfigurableCrudRecord }>(
              `${base}/${row['RdvUUID']}/assist`,
              {},
            );
            openDataViewerDialog(dialog, {
              title: 'documents.assist',
              description: 'documents.assistDescription',
              details: [
                'title',
                'documentType',
                'issueDate',
                'expiryDate',
                'summary',
                'warning',
              ].map((key) => ({
                label: suggestionLabels[key] ?? 'documents.revision',
                value: response.data[key],
              })),
            });
          },
        },
        {
          key: 'cancel',
          label: 'documents.cancelUpload',
          icon: 'cancel',
          visible: (row: ConfigurableCrudRecord) => row['RdvState'] === 'pending',
          request: {
            method: 'post',
            endpoint: (row: ConfigurableCrudRecord) => `${base}/${row['RdvUUID']}/cancel`,
            successMessage: 'documents.cancelled',
            confirm: { title: 'documents.cancelUpload', message: 'documents.cancelDescription' },
          },
        },
        {
          key: 'resume',
          label: 'documents.resume',
          icon: 'upload_file',
          visible: (row: ConfigurableCrudRecord) => row['RdvState'] === 'pending',
          form: (row: ConfigurableCrudRecord) => upload(String(row['RdvUUID'])),
        },
      ],
    };
  };
  return defineCrud({
    endpoint,
    uuidField: 'RdcUUID',
    pageTitle: 'documents.title',
    pageDescription: 'documents.description',
    createTitle: 'documents.new',
    editTitle: 'documents.edit',
    serverSidePagination: true,
    bulkDelete: true,
    initialValues: {
      title: '',
      notes: '',
      RegDocumentTypeRdtUUID: '',
      issueDate: '',
      expiryDate: '',
      status: 1,
    },
    ...revisionDeletePayloads('RdcUUID', 'RdcRevision'),
    fields: [
      { key: 'status', source: 'RdcStatus', label: 'Status', type: 'status', span: 1 },
      { key: 'title', source: 'RdcTitle', label: 'Title', required: true, span: 1 },
      {
        key: 'RegDocumentTypeRdtUUID',
        source: 'RegDocumentTypeRdtUUID',
        label: 'documents.type',
        type: 'search-select',
        required: true,
        span: 1,
        remoteLookup: {
          endpoint: 'registry/document-types?status=1',
          uuidField: 'RdtUUID',
          labelField: 'RdtName',
          selectedLabelField: 'RdtName',
        },
        quickCreate: quickCreateFor('RegDocumentTypeRdtUUID'),
      },
      {
        key: 'issueDate',
        source: 'RdcIssueDate',
        label: 'documents.issueDate',
        type: 'date',
        span: 1,
      },
      {
        key: 'expiryDate',
        source: 'RdcExpiryDate',
        label: 'documents.expiryDate',
        type: 'date',
        span: 1,
      },
      { key: 'notes', source: 'RdcNotes', label: 'Notes', type: 'textarea', tab: 'notes', span: 4 },
      hidden('revision', 'RdcRevision'),
    ],
    columns: [
      { id: 'title', field: 'RdcTitle', label: 'Title', kind: 'identity' },
      { id: 'expiry', field: 'RdcExpiryDate', label: 'documents.expiryDate', kind: 'date' },
      { id: 'review', field: 'RdcReviewState', label: 'documents.review', options: states },
      { id: 'status', field: 'RdcStatus', label: 'Status', kind: 'status' },
    ],
    rowActions: [
      { key: 'versions', label: 'documents.versions', icon: 'history', collection: versions },
      {
        key: 'review',
        label: 'documents.review',
        icon: 'fact_check',
        visible: canReview,
        form: (row) =>
          defineCrud({
            endpoint: `${endpoint}/${row['RdcUUID']}/review`,
            uuidField: 'RdcUUID',
            pageTitle: 'documents.review',
            pageDescription: 'documents.reviewDescription',
            initialValues: { revision: row['RdcRevision'], state: 'approved', notes: '' },
            fields: [
              hidden('revision'),
              {
                key: 'state',
                label: 'Status',
                type: 'select',
                options: states.filter((state) => ['approved', 'rejected'].includes(state.value)),
                required: true,
                span: 1,
              },
              // notes-tab-exempt: the review reason is the only input of this action dialog.
              { key: 'notes', label: 'Notes', type: 'textarea', required: true, span: 4 },
            ],
            columns: [],
          }),
      },
    ],
  });
}

export function registryDocuments(
  endpoint: string,
  api: ApiService,
  dialog: MatDialog,
  canReview: () => boolean,
  canAssist: () => boolean,
): ConfigurableCrudRelatedCollection {
  const base = (parent: string) => `${endpoint}/${parent}/documents`;
  return {
    key: 'documents',
    label: 'documents.title',
    emptyLabel: 'documents.empty',
    uuidField: 'RdcUUID',
    endpoint: base,
    deleteEndpoint: (parent, row) => `${base(parent)}/${row['RdcUUID']}`,
    initialValues: {},
    fields: [],
    columns: [],
    config: (parent) => documentCollection(base(parent), api, dialog, canReview, canAssist),
  };
}
