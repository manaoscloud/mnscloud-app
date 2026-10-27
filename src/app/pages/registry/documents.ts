import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { ApiService } from '../../services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import type {
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openPrivateFile } from '../support/shared/support-desk';

export const DOCUMENT_REVIEW_OPTIONS = [
  { value: 'not-required', label: 'documents.notRequired' },
  { value: 'pending', label: 'documents.pending' },
  { value: 'approved', label: 'documents.approved' },
  { value: 'rejected', label: 'documents.rejected' },
];
const states = DOCUMENT_REVIEW_OPTIONS;
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
  const versions = (document: ConfigurableCrudRecord): ConfigurableCrudConfig => {
    const base = `${endpoint}/${document['RdcUUID']}/versions`;
    const upload = (versionUUID?: string) =>
      defineCrud({
        endpoint: base,
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
        initialValuesFactory: () => ({
          file: null,
          versionUUID: versionUUID ?? crypto.randomUUID(),
          revision: document['RdcRevision'],
        }),
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
              { value: 'cancelled', label: 'documents.cancelled' },
            ],
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
    deletePayload: (row) => ({ revision: row['RdcRevision'] }),
    bulkDeletePayload: (rows) => ({
      ids: rows.map((row) => row['RdcUUID']),
      revisions: Object.fromEntries(
        rows.map((row) => [String(row['RdcUUID']), row['RdcRevision']]),
      ),
    }),
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
      { key: 'notes', source: 'RdcNotes', label: 'Notes', type: 'textarea', span: 1 },
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
              { key: 'notes', label: 'Notes', type: 'textarea', required: true, span: 1 },
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
