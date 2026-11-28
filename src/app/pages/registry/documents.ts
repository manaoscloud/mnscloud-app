import { revisionDeletePayloads } from '../../shared/crud/configurable-crud/revision-delete';
import { openDataViewerDialog } from '../../shared/data-viewer-dialog/data-viewer-dialog';
import { ApiService, FileUploadProgress } from '../../services/api.service';
import { MatDialog } from '@angular/material/dialog';
import { defineCrud } from '../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../shared/crud/configurable-crud/quick-create';
import { ConfigurableCrudCollectionDialog } from '../../shared/crud/configurable-crud/configurable-crud-collection-dialog';
import { ConfigurableCrudEmbeddedCollection } from '../../shared/crud/configurable-crud/configurable-crud-embedded-collection';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
  ConfigurableCrudRowAction,
} from '../../shared/crud/configurable-crud/configurable-crud-page-base';
import { openPrivateFile } from '../../shared/file-preview-dialog/private-file';
import { openCrudTemplateDialog } from '../../shared/dialog/crud-dialog.util';
import { UploadCancelledError } from '../../shared/upload/file-upload-progress';
import { TranslocoService } from '@jsverse/transloco';
import { afterNextRender, Component, inject } from '@angular/core';
import { catchError, firstValueFrom, Observable, throwError } from 'rxjs';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_CAMERA_ACCEPT_ATTRIBUTE,
  documentUploadObservable,
} from './document-upload';

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
  'webp-invalid': 'documents.scan.reason.webp-invalid',
  'heic-invalid': 'documents.scan.reason.heic-invalid',
  'tiff-invalid': 'documents.scan.reason.tiff-invalid',
  'type-mismatch': 'documents.scan.reason.type-mismatch',
  'checksum-mismatch': 'documents.scan.reason.checksum-mismatch',
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

function hasUploadedTimestamp(row: ConfigurableCrudRecord): boolean {
  const uploadedAt = row['RdvUploadedAt'];
  if (typeof uploadedAt === 'string') return uploadedAt.trim().length > 0;
  return Boolean(uploadedAt);
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
    if (row['RdvState'] === 'pending') {
      if (hasUploadedTimestamp(row)) return t('documents.scan.verifying');
      if ('RdvUploadedAt' in row || 'RdvUploadMode' in row) return t('documents.scan.incomplete');
      return t('documents.pending');
    }
    return t('documents.scan.unverified');
  }
  return t('documents.scan.verified');
}

export function documentVersionVerificationChipClass(row: ConfigurableCrudRecord): string {
  if (row['RdvState'] === 'rejected') return 'chip-failed';
  const engine = typeof row['RdvScanEngine'] === 'string' ? row['RdvScanEngine'].trim() : '';
  if (!engine) {
    if (row['RdvState'] === 'pending') {
      return hasUploadedTimestamp(row) ? 'chip-running' : 'chip-queued';
    }
    return 'chip-skipped';
  }
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
  if (code === 'DOCUMENT_MULTIPART_UNSUPPORTED') {
    return t('documents.scan.multipartUnsupported');
  }
  return null;
}

function wrapUploadError(
  err: unknown,
  translate: (key: string, params?: Record<string, string | number>) => string,
): unknown {
  const msg = documentUploadErrorMessage(err, translate);
  if (!msg) return err;
  return {
    ...(typeof err === 'object' && err ? err : {}),
    error: {
      ...(typeof (err as { error?: unknown })?.error === 'object' &&
      (err as { error?: unknown })?.error
        ? (err as { error: Record<string, unknown> }).error
        : {}),
      error: msg,
      message: msg,
    },
    message: msg,
  };
}

export function withDocumentUploadErrors(
  api: ApiService,
  translate: (key: string, params?: Record<string, string | number>) => string,
): ApiService {
  return new Proxy(api, {
    get(target, prop, receiver) {
      if (prop === 'postFormWithProgress') {
        return <T>(endpoint: string, body: FormData): Observable<FileUploadProgress<T>> =>
          target
            .postFormWithProgress<T>(endpoint, body)
            .pipe(catchError((err: unknown) => throwError(() => wrapUploadError(err, translate))));
      }
      if (prop === 'post' || prop === 'put' || prop === 'get') {
        return async <T>(...args: [string, ...unknown[]]): Promise<T> => {
          try {
            const fn = Reflect.get(target, prop, receiver) as (...a: unknown[]) => Promise<T>;
            return await fn.apply(target, args);
          } catch (err) {
            throw wrapUploadError(err, translate);
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

function extractUploadedFiles(value: unknown): File[] {
  if (value instanceof File) return [value];
  if (Array.isArray(value)) return value.filter((item): item is File => item instanceof File);
  if (typeof FileList !== 'undefined' && value instanceof FileList) return Array.from(value);
  return [];
}

/**
 * Canonical collection dialog for document versions: reuses the shared CRUD template and enhances
 * the file control in the upload dialog with multiple file selection (when creating new versions),
 * drag-and-drop on the upload area, and a separate "Usar câmera" (`capture="environment"`) option
 * on mobile, uploading each selected file sequentially through single or 8 MiB resumable parts.
 */
@Component({
  selector: 'mns-document-versions-dialog',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  host: { '[class.collection-dialog-host]': '!config.formOnly' },
})
export class RegistryDocumentVersionsDialog extends ConfigurableCrudCollectionDialog {
  private readonly batchVersionUUIDs = new Map<string, string>();
  private cleanupUploadEnhancements: (() => void) | null = null;

  private isResumeDialog(): boolean {
    return Boolean(this.config.formOnly && this.formValues()['resume']);
  }

  override startCreate(): void {
    this.batchVersionUUIDs.clear();
    super.startCreate();
    afterNextRender(() => this.enhanceUploadDialog());
  }

  override closeDialog(): void {
    this.cleanupUploadEnhancements?.();
    this.cleanupUploadEnhancements = null;
    super.closeDialog();
  }

  override onFileInput(key: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.applySelectedFiles(key, files);
  }

  override fieldFileName(key: string): string {
    const files = extractUploadedFiles(this.formValues()[key]);
    if (!files.length) return '';
    if (files.length === 1) return files[0].name;
    return `${files.length}: ${files.map((f) => f.name).join(', ')}`;
  }

  private applySelectedFiles(key: string, files: File[]): void {
    if (!files.length) {
      this.setFieldValue(key, null);
      return;
    }
    if (this.isResumeDialog() || files.length === 1) {
      this.setFieldValue(key, files[0]);
      return;
    }
    this.setFieldValue(key, files);
  }

  private enhanceUploadDialog(): void {
    this.cleanupUploadEnhancements?.();
    this.cleanupUploadEnhancements = null;

    const dialogId = this.dialogBinding?.ref.id;
    const root = (dialogId ? document.getElementById(dialogId) : null) ?? document;
    const fileInput = root.querySelector<HTMLInputElement>(
      'input.crud-file-field-input[data-field-key="file"]',
    );
    if (!fileInput) return;

    if (!this.isResumeDialog()) {
      fileInput.multiple = true;
    }

    const fileBox = fileInput.closest<HTMLElement>('.crud-file-field') ?? fileInput.parentElement;
    if (!fileBox) return;

    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types?.includes('Files')) return;
      event.preventDefault();
      fileBox.classList.add('is-dragging');
    };
    const onDragLeave = () => {
      fileBox.classList.remove('is-dragging');
    };
    const onDrop = (event: DragEvent) => {
      fileBox.classList.remove('is-dragging');
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (!dropped.length) return;
      event.preventDefault();
      this.applySelectedFiles('file', dropped);
    };

    fileBox.addEventListener('dragover', onDragOver);
    fileBox.addEventListener('dragleave', onDragLeave);
    fileBox.addEventListener('drop', onDrop);

    let cameraInput: HTMLInputElement | null = null;
    let cameraButton: HTMLButtonElement | null = null;
    if (this.mobileLayout()) {
      cameraInput = document.createElement('input');
      cameraInput.type = 'file';
      cameraInput.accept = DOCUMENT_CAMERA_ACCEPT_ATTRIBUTE;
      cameraInput.setAttribute('capture', 'environment');
      cameraInput.style.display = 'none';
      cameraInput.addEventListener('change', () => {
        const captured = Array.from(cameraInput?.files ?? []);
        if (captured.length) {
          this.applySelectedFiles('file', captured);
        }
        if (cameraInput) cameraInput.value = '';
      });
      cameraButton = document.createElement('button');
      cameraButton.type = 'button';
      cameraButton.className = 'mdc-button mdc-button--outlined mat-mdc-outlined-button';
      cameraButton.textContent = this.t('documents.useCamera');
      cameraButton.addEventListener('click', () => cameraInput?.click());
      fileBox.appendChild(cameraInput);
      fileBox.appendChild(cameraButton);
    }

    this.cleanupUploadEnhancements = () => {
      fileBox.removeEventListener('dragover', onDragOver);
      fileBox.removeEventListener('dragleave', onDragLeave);
      fileBox.removeEventListener('drop', onDrop);
      cameraInput?.remove();
      cameraButton?.remove();
    };
  }

  triggerCameraCapture(): void {
    const dialogId = this.dialogBinding?.ref.id;
    const root = (dialogId ? document.getElementById(dialogId) : null) ?? document;
    const existing = root.querySelector<HTMLInputElement>('input[capture="environment"]');
    if (existing) {
      existing.click();
      return;
    }
    const cameraInput = document.createElement('input');
    cameraInput.type = 'file';
    cameraInput.accept = DOCUMENT_CAMERA_ACCEPT_ATTRIBUTE;
    cameraInput.setAttribute('capture', 'environment');
    cameraInput.addEventListener(
      'change',
      () => {
        const captured = Array.from(cameraInput.files ?? []);
        if (captured.length) this.applySelectedFiles('file', captured);
      },
      { once: true },
    );
    cameraInput.click();
  }

  override async saveItem(saveAndNew = false): Promise<void> {
    if (this.saving()) return;
    if (!this.canCreate()) return;
    this.clearFieldErrors(null);

    const values = this.formValues();
    const files = extractUploadedFiles(values['file']);
    if (!files.length) {
      this.validatePayload({ ...values, file: null });
      return;
    }

    const saveContextIsCurrent = this.captureSaveContext();
    this.saving.set(true);
    const resume = this.isResumeDialog();
    const initialVersionUUID = String(values['versionUUID'] ?? '').trim() || crypto.randomUUID();
    let currentRevision = values['revision'];
    let uploadedCount = 0;

    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const fileKey = `${index}:${file.name}:${file.size}:${file.lastModified}`;
        const versionUUID =
          index === 0 && (resume || files.length === 1)
            ? initialVersionUUID
            : (this.batchVersionUUIDs.get(fileKey) ?? crypto.randomUUID());
        this.batchVersionUUIDs.set(fileKey, versionUUID);

        const progress = await this.runManagedFileUpload(
          documentUploadObservable({
            api: this.api,
            endpoint: this.createEndpoint(),
            file,
            versionUUID,
            revision: currentRevision,
            resume,
          }),
          file.size,
        );
        if (!saveContextIsCurrent()) return;
        uploadedCount += 1;
        const responseData = (
          progress.response as { data?: ConfigurableCrudRecord } | null
        )?.data;
        if (responseData && responseData['RdcRevision'] !== undefined) {
          currentRevision = responseData['RdcRevision'];
        }
      }

      if (!saveContextIsCurrent()) return;
      this.snack.success(this.t(this.config.savedMessage));
      this.itemsResource.reload();
      if (saveAndNew) {
        this.batchVersionUUIDs.clear();
        this.resetFieldErrors();
        this.editingRecord.set(null);
        this.formValues.set({
          ...values,
          file: null,
          versionUUID: crypto.randomUUID(),
          revision: currentRevision,
        });
      } else {
        this.closeDialog();
      }
    } catch (error) {
      if (!saveContextIsCurrent()) return;
      if (uploadedCount > 0) this.itemsResource.reload();
      if (error instanceof UploadCancelledError) return;
      this.snack.error(this.t(this.errorMessage(error)));
    } finally {
      this.saving.set(false);
    }
  }

  override async runRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.visible?.(row) === false) return;
    if (this.rowActionDisabledReason(action, row)) return;
    if (action.form) {
      await this.openFormOnlyDialog(action.form(row), RegistryDocumentVersionsDialog);
      return;
    }
    await super.runRowAction(action, row);
  }
}

/**
 * Embedded document collection component that opens `RegistryDocumentVersionsDialog` for version
 * management while keeping the canonical shared CRUD table and template.
 */
@Component({
  selector: 'mns-registry-documents-collection',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegistryDocumentsEmbeddedCollection extends ConfigurableCrudEmbeddedCollection {
  override async runRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.visible?.(row) === false) return;
    if (this.rowActionDisabledReason(action, row)) return;
    if (action.collection) {
      const binding = openCrudTemplateDialog(
        this.dialog,
        RegistryDocumentVersionsDialog,
        ['crud-form-dialog', 'crud-collection-dialog'],
        {
          data: {
            ...action.collection(row),
            requestApi: this.api,
            collectionDialog: true,
            formOnly: false,
          },
        },
      );
      await firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
      this.refreshList();
      return;
    }
    await super.runRowAction(action, row);
  }
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
      const isResume = Boolean(versionUUID);
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
            resume: isResume,
          };
        },
        fields: [
          {
            key: 'file',
            label: 'File',
            type: 'file',
            accept: DOCUMENT_ACCEPT_ATTRIBUTE,
            help: 'documents.dropOrCameraHelp',
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
          visible: (row: ConfigurableCrudRecord) =>
            row['RdvState'] === 'pending' && !hasUploadedTimestamp(row),
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
      {
        key: 'versions',
        label: 'documents.versions',
        icon: 'history',
        collection: versions,
        run: async (row: ConfigurableCrudRecord) => {
          const binding = openCrudTemplateDialog(
            dialog,
            RegistryDocumentVersionsDialog,
            ['crud-form-dialog', 'crud-collection-dialog'],
            {
              data: {
                ...versions(row),
                requestApi: uploadApi,
                collectionDialog: true,
                formOnly: false,
              },
            },
          );
          await firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
        },
      },
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
    component: () => Promise.resolve(RegistryDocumentsEmbeddedCollection),
  };
}
