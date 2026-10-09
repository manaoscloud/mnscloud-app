import { readStoredEnvironmentUUID } from '../../core/environment/environment-context';
import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../services/api.service';
import {
  SUPPORT_REPORT_BACKDROP_CLASS,
  SUPPORT_REPORT_PANE_CLASS,
  SupportReportCaptureScope,
  SupportReportCreated,
  SupportReportImage,
  SupportReportService,
} from '../../services/support-report.service';
import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { REPORT_IMAGE_ACCEPT, REPORT_SCREENSHOT_MAX_BYTES, blobToDataUrl } from './report-image';
import type { ImageAnnotatorData } from './image-annotator/image-annotator';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../forms/mns-search-select-field/mns-search-select-field';

export interface SupportReportDialogData {
  url?: string;
}

type CatalogRow = { Name?: string; Code?: string; IsDefault?: number } & Record<string, unknown>;
type CatalogOption = MnsSearchSelectFieldOption & { code: string; isDefault: boolean };

function catalogOptions(rows: CatalogRow[] | undefined, uuidField: string): CatalogOption[] {
  return (rows ?? []).map((row) => ({
    value: String(row[uuidField] ?? ''),
    label: String(row.Name ?? ''),
    code: String(row.Code ?? ''),
    isDefault: Number(row.IsDefault ?? 0) === 1,
  }));
}

@Component({
  selector: 'app-support-report-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatButtonToggleModule,
    MatTooltipModule,
    MnsSearchSelectFieldComponent,
    TranslocoPipe,
  ],
  templateUrl: './support-report-dialog.html',
  styleUrls: ['./support-report-dialog.scss'],
  host: { '(document:paste)': 'pasteImages($event)' },
})
export class SupportReportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<SupportReportDialogComponent>);
  private readonly reports = inject(SupportReportService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<SupportReportDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  private readonly environmentUUID = readStoredEnvironmentUUID();
  readonly titleMax = 160;
  readonly descriptionMax = 10000;

  /** Ticket types and priorities come from the platform support desk catalogs. */
  readonly catalogs = resource({
    loader: async () => {
      const [types, priorities] = await Promise.all([
        this.api.get<{ data?: { items?: CatalogRow[] } }>('help/ticket-types'),
        this.api.get<{ data?: { items?: CatalogRow[] } }>('help/ticket-priorities'),
      ]);
      return {
        types: catalogOptions(types?.data?.items, 'SupportTicketTypeUUID'),
        priorities: catalogOptions(priorities?.data?.items, 'SupportTicketPriorityUUID'),
      };
    },
  });
  readonly typeOptions = computed(() => this.catalogs.value()?.types ?? []);
  readonly priorityOptions = computed(() => this.catalogs.value()?.priorities ?? []);
  /** Tickets belong to an environment: without one selected, the catalogs cannot load. */
  readonly unavailable = computed(() => this.catalogs.status() === 'error');

  readonly draft = this.reports.draft;
  readonly screenshot = signal<string | null>(null);
  readonly capturing = signal(true);
  readonly submitting = signal(false);
  readonly created = signal<SupportReportCreated | null>(null);
  readonly environment = this.reports.environment();
  readonly diagnostics = this.reports.diagnosticsSnapshot();
  /** Page or dialog the report came from, and the user's extra images. */
  readonly context = this.reports.context;
  readonly images = this.reports.images;
  readonly imageLimit = this.reports.imageLimit;
  readonly imageAccept = REPORT_IMAGE_ACCEPT;
  readonly canCropWindow = this.reports.hasOriginWindow();
  readonly captureScope = signal<SupportReportCaptureScope>('viewport');
  readonly addingImages = signal(false);
  readonly imageErrors = signal<string[]>([]);
  readonly dragging = signal(false);
  readonly uploadingImages = signal(false);
  readonly missingImages = computed(
    () => this.images().filter((image) => image.status === 'failed').length,
  );
  readonly canAddImages = computed(
    () => !this.created() && this.images().length < this.imageLimit && !this.addingImages(),
  );

  readonly isFormValid = computed(() => {
    const draft = this.draft();
    return (
      !this.unavailable() &&
      draft.title.trim().length > 0 &&
      draft.title.trim().length <= this.titleMax &&
      draft.description.trim().length > 0 &&
      draft.description.trim().length <= this.descriptionMax
    );
  });

  constructor() {
    // The dialog lives in the CDK overlay, which the capture ignores: the print shows the page.
    void this.capture();
    // Preselect: prefill codes (failed call), then the draft, then the desk defaults.
    effect(() => {
      const types = this.typeOptions();
      const priorities = this.priorityOptions();
      if (!types.length && !priorities.length) return;
      const codes = this.reports.prefillCodes();
      const draft = this.draft();
      const pick = (options: CatalogOption[], current: string, code?: string) =>
        options.find((option) => code && option.code === code)?.value ??
        options.find((option) => option.value === current)?.value ??
        options.find((option) => option.isDefault)?.value ??
        options[0]?.value ??
        '';
      const typeUUID = String(pick(types, draft.typeUUID, codes.typeCode));
      const priorityUUID = String(pick(priorities, draft.priorityUUID, codes.priorityCode));
      if (typeUUID !== draft.typeUUID || priorityUUID !== draft.priorityUUID) {
        this.draft.update((value) => ({ ...value, typeUUID, priorityUUID }));
      }
    });
  }

  successTitle(protocol: string): string {
    return this.transloco.translate('Ticket #{{protocol}} opened.', { protocol });
  }

  diagnosticsSummary(): string {
    return this.transloco.translate('{{errors}} console errors and {{requests}} failed requests', {
      errors: this.diagnostics.consoleLogs.length,
      requests: this.diagnostics.failedRequests.length,
    });
  }

  /** Exactly what will be sent, so the user can review it before submitting. */
  diagnosticsPreview(): string {
    const requests = this.diagnostics.failedRequests.map((entry) =>
      [
        entry.method,
        entry.url,
        `→ ${entry.status}`,
        entry.requestId ? `(${entry.requestId})` : '',
        entry.message ?? '',
      ]
        .filter(Boolean)
        .join(' '),
    );
    const errors = this.diagnostics.consoleLogs.map(
      (entry) => `[${entry.type}] ${entry.message.split('\n')[0]}`,
    );
    return [...requests, ...errors].slice(-15).join('\n');
  }

  update<K extends 'title' | 'description'>(key: K, value: string) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  setType(value: unknown) {
    this.reports.prefillCodes.update((codes) => ({ ...codes, typeCode: undefined }));
    this.draft.update((draft) => ({ ...draft, typeUUID: String(value ?? '') }));
  }

  setPriority(value: unknown) {
    this.reports.prefillCodes.update((codes) => ({ ...codes, priorityCode: undefined }));
    this.draft.update((draft) => ({ ...draft, priorityUUID: String(value ?? '') }));
  }

  setIncludeDiagnostics(value: boolean) {
    this.draft.update((draft) => ({ ...draft, includeDiagnostics: value }));
  }

  removeScreenshot() {
    this.screenshot.set(null);
  }

  async capture() {
    this.capturing.set(true);
    try {
      this.screenshot.set(await this.reports.captureScreen(this.captureScope()));
    } finally {
      this.capturing.set(false);
    }
  }

  setCaptureScope(value: unknown) {
    if (value !== 'viewport' && value !== 'window') return;
    if (value === this.captureScope()) return;
    this.captureScope.set(value);
    void this.capture();
  }

  async annotateScreenshot() {
    const image = this.screenshot();
    if (!image) return;
    const result = await this.annotate({ src: image, maxBytes: REPORT_SCREENSHOT_MAX_BYTES });
    if (result) this.screenshot.set(await blobToDataUrl(result));
  }

  async annotateImage(image: SupportReportImage) {
    const result = await this.annotate({ src: image.previewUrl });
    if (result) this.reports.replaceImage(image.id, result);
  }

  removeImage(image: SupportReportImage) {
    this.reports.removeImage(image.id);
  }

  async addFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? []);
    if (!list.length || !this.canAddImages()) return;
    this.addingImages.set(true);
    try {
      this.imageErrors.set(await this.reports.addImages(list));
    } finally {
      this.addingImages.set(false);
    }
  }

  async pickFiles(input: HTMLInputElement) {
    await this.addFiles(input.files);
    input.value = '';
  }

  /** Ctrl+V of a print while this dialog is the top one (not while marking an image). */
  pasteImages(event: ClipboardEvent) {
    if (this.created() || this.dialog.openDialogs.at(-1) !== this.dialogRef) return;
    const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    if (!files.length) return;
    event.preventDefault();
    void this.addFiles(files);
  }

  dragOver(event: DragEvent) {
    if (!this.canAddImages() || !event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  dropFiles(event: DragEvent) {
    this.dragging.set(false);
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    void this.addFiles(event.dataTransfer.files);
  }

  imageLabel(index: number): string {
    return this.transloco.translate('Image {{n}}', { n: index + 1 });
  }

  imageStatusLabel(image: SupportReportImage): string {
    const labels: Record<SupportReportImage['status'], string> = {
      ready: 'Waiting',
      uploading: 'Sending…',
      uploaded: 'Sent',
      failed: 'Not sent',
    };
    return this.transloco.translate(labels[image.status]);
  }

  imageStatusIcon(image: SupportReportImage): string {
    if (image.status === 'uploaded') return 'cloud_done';
    if (image.status === 'uploading') return 'cloud_upload';
    if (image.status === 'failed') return 'error';
    return '';
  }

  async retryImages() {
    const ticket = this.created()?.SupportTicketUUID;
    if (ticket) await this.sendImages(ticket);
  }

  private async sendImages(ticketUUID: string) {
    this.uploadingImages.set(true);
    try {
      await this.reports.uploadImages(ticketUUID);
    } finally {
      this.uploadingImages.set(false);
    }
  }

  private async annotate(data: ImageAnnotatorData): Promise<Blob | null> {
    const { ReportImageAnnotatorComponent } = await import('./image-annotator/image-annotator');
    const binding = openCrudComponentDialog(
      this.dialog,
      ReportImageAnnotatorComponent,
      ['crud-form-dialog', SUPPORT_REPORT_PANE_CLASS],
      { data, backdropClass: ['cdk-overlay-dark-backdrop', SUPPORT_REPORT_BACKDROP_CLASS] },
    );
    try {
      return ((await firstValueFrom(binding.ref.afterClosed())) as Blob | null) ?? null;
    } finally {
      binding.stop();
    }
  }

  async submit() {
    if (!this.isFormValid() || this.submitting()) return;
    this.submitting.set(true);
    const draft = this.draft();
    const include = draft.includeDiagnostics;
    try {
      const created = await this.reports.submitReport(
        {
          title: draft.title.trim(),
          description: draft.description.trim(),
          typeUUID: draft.typeUUID || null,
          priorityUUID: draft.priorityUUID || null,
          url: this.environment.url,
          route: this.environment.route,
          appVersion: this.environment.appVersion,
          screenshot: this.screenshot() ?? undefined,
          systemInfo: {
            userAgent: this.environment.userAgent,
            viewport: this.environment.viewport,
            language: this.environment.language,
            timezone: this.environment.timezone,
            platform: this.environment.platform,
            context: this.context(),
            consoleLogs: include ? this.diagnostics.consoleLogs : [],
            failedRequests: include ? this.diagnostics.failedRequests : [],
            navigation: include ? this.diagnostics.navigation : [],
          },
        },
        this.environmentUUID,
      );
      this.created.set(created);
      if (created.SupportTicketUUID) await this.sendImages(created.SupportTicketUUID);
    } catch {
      // The API interceptor already shows the error; the draft stays for a retry.
    } finally {
      this.submitting.set(false);
    }
  }

  openMyTickets() {
    const ticket = this.created()?.SupportTicketUUID;
    this.reports.clearImages();
    this.dialogRef.close(true);
    void this.router.navigate(['/support/requests'], ticket ? { queryParams: { ticket } } : {});
  }

  close() {
    // Images belong to the draft until a ticket exists; after that they were sent or reported.
    if (this.created()) this.reports.clearImages();
    this.dialogRef.close(Boolean(this.created()));
  }
}
