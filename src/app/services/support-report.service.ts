import { SupportRequestDraft } from './support-request-draft';
import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_BUILD_INFO } from '../app-build-info';
import { openCrudComponentDialog } from '../shared/dialog/crud-dialog.util';
import {
  REPORT_IMAGE_LIMIT,
  ReportImageError,
  normalizeReportImage,
  reportImageExtension,
} from '../shared/support-report-dialog/report-image';
import { ApiService } from './api.service';
import { ClientDiagnosticsService, redactDiagnosticText } from './client-diagnostics.service';
import { SnackbarService } from './snackbar.service';

export type SupportReportDraft = {
  title: string;
  description: string;
  /** Platform ticket type and priority (catalogs of the platform support desk). */
  typeUUID: string;
  priorityUUID: string;
  includeDiagnostics: boolean;
};

/** Prefill by catalog code (for example from a failed API call: type bug, priority high). */
export type SupportReportPrefill = {
  title?: string;
  description?: string;
  typeCode?: string;
  priorityCode?: string;
};

/** Where the report was opened: the page itself or a dialog over it (no form values). */
export type SupportReportContext = {
  surface: 'page' | 'dialog';
  dialogTitle?: string;
  resource?: string;
  mode?: 'create' | 'edit';
  recordUUID?: string;
};

export type SupportReportOrigin = {
  context?: Omit<SupportReportContext, 'surface'>;
  /** Dialog pane the report was opened from, used to crop the print to that window. */
  element?: HTMLElement | null;
};

export type SupportReportCaptureScope = 'viewport' | 'window';

export type SupportReportImageStatus = 'ready' | 'uploading' | 'uploaded' | 'failed';

/** Extra image chosen by the user, already re-encoded (no metadata) and bounded. */
export type SupportReportImage = {
  id: string;
  fileName: string;
  blob: Blob;
  previewUrl: string;
  status: SupportReportImageStatus;
};

export type SupportReportPayload = {
  title: string;
  description: string;
  typeUUID: string | null;
  priorityUUID: string | null;
  url: string;
  route: string;
  appVersion: string;
  screenshot?: string;
  systemInfo: Record<string, unknown>;
};

export type SupportReportCreated = {
  SupportTicketUUID: string;
  SupportTicketID: string;
  AttachmentWarnings?: string[];
};

/** Elements whose content never appears in a problem report screenshot. */
export const SUPPORT_REPORT_MASK_SELECTOR = [
  'input[type="password"]',
  'input[autocomplete="current-password"]',
  'input[autocomplete="new-password"]',
  'input[autocomplete="one-time-code"]',
  '[data-report-mask]',
].join(', ');

/** Panel and backdrop classes of the report dialogs, which never appear in their own print. */
export const SUPPORT_REPORT_PANE_CLASS = 'support-report-pane';
export const SUPPORT_REPORT_BACKDROP_CLASS = 'support-report-backdrop';

/**
 * Overlays left out of the print: the report dialogs themselves and transient menus/tooltips.
 * Every other overlay (the dialog where the problem happened, toasts) stays in the image.
 */
export function isExcludedFromReportCapture(element: Element): boolean {
  const classes = element.classList;
  if (!classes) return false;
  return (
    classes.contains(SUPPORT_REPORT_PANE_CLASS) ||
    classes.contains(SUPPORT_REPORT_BACKDROP_CLASS) ||
    classes.contains('mat-mdc-menu-panel') ||
    classes.contains('mat-mdc-tooltip-panel') ||
    classes.contains('cdk-overlay-transparent-backdrop')
  );
}

const EMPTY_DRAFT: SupportReportDraft = {
  title: '',
  description: '',
  typeUUID: '',
  priorityUUID: '',
  includeDiagnostics: true,
};

@Injectable({ providedIn: 'root' })
export class SupportReportService {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly diagnostics = inject(ClientDiagnosticsService);

  /** Unsent form values survive closing the dialog or a failed submit. */
  readonly draft = signal<SupportReportDraft>({ ...EMPTY_DRAFT });
  /** Catalog codes to preselect once the dialog loads the platform types and priorities. */
  readonly prefillCodes = signal<{ typeCode?: string; priorityCode?: string }>({});
  /** Page or dialog the report was opened from; sent with the diagnostics. */
  readonly context = signal<SupportReportContext>({ surface: 'page' });
  /** Extra images survive closing the dialog, like the rest of the draft. */
  readonly images = signal<SupportReportImage[]>([]);
  readonly imageLimit = REPORT_IMAGE_LIMIT;
  private originElement: WeakRef<HTMLElement> | null = null;
  private draftEnvironment = readStoredEnvironmentUUID();

  clearDraft() {
    this.draft.set({ ...EMPTY_DRAFT });
    this.prefillCodes.set({});
    this.submission.clear();
    this.clearImages();
    this.draftEnvironment = readStoredEnvironmentUUID();
  }

  /** True when the report was opened from a dialog that is still on screen. */
  hasOriginWindow(): boolean {
    return Boolean(this.originElement?.deref()?.isConnected);
  }

  private opening = false;
  private readonly submission = new SupportRequestDraft();

  /**
   * Prints what the user sees, including open dialogs; only the report dialogs, menus and
   * tooltips are left out. `window` crops the print to the dialog the report was opened from.
   */
  async captureScreen(scope: SupportReportCaptureScope = 'viewport'): Promise<string | null> {
    if (typeof window === 'undefined' || !document?.body) return null;
    try {
      // html2canvas-pro understands modern color functions (color-mix/color()) used by the theme.
      const { default: html2canvas } = await import('html2canvas-pro');
      const canvas = await html2canvas(document.body, {
        scale: Math.min(window.devicePixelRatio || 1, 1.25),
        logging: false,
        useCORS: true,
        x: window.scrollX,
        y: window.scrollY,
        width: window.innerWidth,
        height: window.innerHeight,
        ignoreElements: isExcludedFromReportCapture,
        onclone: (clone: Document) => {
          maskSensitiveContent(clone);
          prepareCloneForCapture(clone);
        },
      });
      const origin = scope === 'window' ? this.originElement?.deref() : null;
      const cropped = origin?.isConnected ? cropToElement(canvas, origin) : canvas;
      return cropped.toDataURL('image/jpeg', 0.82);
    } catch (error) {
      console.warn('[SupportReportService] Screen capture failed:', error);
      return null;
    }
  }

  /** Opens the report dialog at once; the screenshot is captured behind it. */
  async openReportDialog(
    prefill?: SupportReportPrefill,
    origin?: SupportReportOrigin,
  ): Promise<void> {
    if (this.opening) return;
    if (this.draftEnvironment !== readStoredEnvironmentUUID()) this.clearDraft();
    this.opening = true;
    try {
      this.originElement = origin?.element ? new WeakRef(origin.element) : null;
      this.context.set(
        origin
          ? { surface: origin.element ? 'dialog' : 'page', ...cleanContext(origin.context ?? {}) }
          : { surface: 'page' },
      );
      if (prefill) {
        const { typeCode, priorityCode, ...text } = prefill;
        this.draft.update((draft) => ({ ...draft, ...text }));
        this.prefillCodes.set({ typeCode, priorityCode });
      }
      const { SupportReportDialogComponent } =
        await import('../shared/support-report-dialog/support-report-dialog');
      const binding = openCrudComponentDialog(
        this.dialog,
        SupportReportDialogComponent,
        ['crud-form-dialog', SUPPORT_REPORT_PANE_CLASS],
        {
          data: { url: window.location.href },
          backdropClass: ['cdk-overlay-dark-backdrop', SUPPORT_REPORT_BACKDROP_CLASS],
        },
      );
      void firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
    } finally {
      this.opening = false;
    }
  }

  /**
   * Adds user images (file picker, paste or drop). Returns translation keys of the rejected ones;
   * nothing is uploaded until the ticket exists.
   */
  async addImages(files: Blob[]): Promise<string[]> {
    const errors = new Set<string>();
    for (const file of files) {
      if (this.images().length >= REPORT_IMAGE_LIMIT) {
        errors.add('You can attach up to {{limit}} images.');
        break;
      }
      try {
        const blob = await normalizeReportImage(file);
        const id = crypto.randomUUID();
        this.images.update((images) => [
          ...images,
          {
            id,
            fileName: reportImageName(id, blob),
            blob,
            previewUrl: URL.createObjectURL(blob),
            status: 'ready',
          },
        ]);
      } catch (error) {
        errors.add(
          error instanceof ReportImageError ? error.message : 'The image could not be read.',
        );
      }
    }
    return [...errors];
  }

  /** Swaps an image for its annotated version (new bytes, new name: never confused on retry). */
  replaceImage(id: string, blob: Blob) {
    this.images.update((images) =>
      images.map((image) => {
        if (image.id !== id || image.status === 'uploaded') return image;
        URL.revokeObjectURL(image.previewUrl);
        const next = crypto.randomUUID();
        return {
          ...image,
          fileName: reportImageName(next, blob),
          blob,
          previewUrl: URL.createObjectURL(blob),
          status: 'ready' as const,
        };
      }),
    );
  }

  removeImage(id: string) {
    this.images.update((images) =>
      images.filter((image) => {
        if (image.id !== id || image.status === 'uploaded') return true;
        URL.revokeObjectURL(image.previewUrl);
        return false;
      }),
    );
  }

  clearImages() {
    for (const image of this.images()) URL.revokeObjectURL(image.previewUrl);
    this.images.set([]);
  }

  /**
   * Sends the extra images to the ticket one by one through the regular attachment endpoint.
   * A retry first looks at what the ticket already holds (unique name + size), so an upload whose
   * response was lost is never stored twice. Returns how many images are still missing.
   */
  async uploadImages(ticketUUID: string): Promise<number> {
    const pending = this.images().filter((image) => image.status !== 'uploaded');
    if (!ticketUUID || !pending.length) return 0;
    let existing: Array<{ FileName?: string; SizeBytes?: number | string }> | null = null;
    if (pending.some((image) => image.status === 'failed')) {
      try {
        const response = await this.api.get<{ data?: { items?: typeof existing } }>(
          `help/tickets/${encodeURIComponent(ticketUUID)}/attachments`,
        );
        existing = response?.data?.items ?? [];
      } catch {
        existing = null;
      }
    }
    let missing = 0;
    for (const image of pending) {
      const stored = existing?.some(
        (item) =>
          String(item.FileName ?? '').toLowerCase() === image.fileName.toLowerCase() &&
          Number(item.SizeBytes) === image.blob.size,
      );
      if (stored) {
        this.setImageStatus(image.id, 'uploaded');
        continue;
      }
      this.setImageStatus(image.id, 'uploading');
      try {
        const form = new FormData();
        form.append('file', image.blob, image.fileName);
        await this.api.post(`help/tickets/${encodeURIComponent(ticketUUID)}/attachments`, form);
        this.setImageStatus(image.id, 'uploaded');
      } catch {
        this.setImageStatus(image.id, 'failed');
        missing++;
      }
    }
    return missing;
  }

  private setImageStatus(id: string, status: SupportReportImageStatus) {
    this.images.update((images) =>
      images.map((image) => (image.id === id ? { ...image, status } : image)),
    );
  }

  diagnosticsSnapshot() {
    return this.diagnostics.snapshot();
  }

  environment() {
    return {
      url: redactDiagnosticText(window.location.href),
      route: redactDiagnosticText(this.router.url),
      appVersion: APP_BUILD_INFO.version,
      viewport: `${window.innerWidth} x ${window.innerHeight} (${window.devicePixelRatio || 1}x)`,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform:
        (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
          ?.platform ?? navigator.platform,
    };
  }

  /**
   * "Report problem" opens a ticket to the platform support team (help center, origin app_report).
   * Errors are already toasted by the API interceptor; success shows the protocol.
   */
  async submitReport(
    payload: SupportReportPayload,
    environmentUUID: string | null,
  ): Promise<SupportReportCreated> {
    if (!environmentUUID || environmentUUID !== readStoredEnvironmentUUID()) {
      this.clearDraft();
      this.snack.error('Environment changed. Reopen the form before continuing.');
      throw new Error('Support report environment changed');
    }
    const { title, ...rest } = payload;
    const body = this.submission.prepare(
      readStoredEnvironmentUUID() ?? '',
      {
        ...rest,
        subject: title,
        origin: 'app_report',
      },
      {
        title,
        description: payload.description,
        typeUUID: payload.typeUUID,
        priorityUUID: payload.priorityUUID,
        screenshot: payload.screenshot,
        route: payload.route,
        includeDiagnostics: this.draft().includeDiagnostics,
      },
    );
    const response = await this.api.post<{ data?: SupportReportCreated }>('help/tickets', body);
    this.submission.clear();
    const created = response?.data;
    // Extra images stay until uploadImages() sends them to the new ticket.
    this.draft.set({ ...EMPTY_DRAFT });
    this.prefillCodes.set({});
    this.snack.success('Ticket #{{protocol}} opened.', 5000, {
      protocol: created?.SupportTicketID ?? '',
    });
    return {
      SupportTicketUUID: created?.SupportTicketUUID ?? '',
      SupportTicketID: created?.SupportTicketID ?? '',
      AttachmentWarnings: created?.AttachmentWarnings ?? [],
    };
  }
}

/** Report image names are unique per image, which also identifies them on an upload retry. */
function reportImageName(id: string, blob: Blob): string {
  return `report-image-${id.replace(/-/g, '').slice(0, 12)}.${reportImageExtension(blob)}`;
}

function cleanContext(context: Omit<SupportReportContext, 'surface'>) {
  const text = (value: unknown, max: number) => {
    const clean = typeof value === 'string' ? redactDiagnosticText(value.trim()).slice(0, max) : '';
    return clean || undefined;
  };
  return {
    dialogTitle: text(context.dialogTitle, 160),
    resource: text(context.resource, 160),
    mode: context.mode === 'create' || context.mode === 'edit' ? context.mode : undefined,
    recordUUID: /^[0-9a-f-]{36}$/i.test(context.recordUUID ?? '') ? context.recordUUID : undefined,
  };
}

/** Crops a viewport print to one element (the dialog the report was opened from). */
function cropToElement(canvas: HTMLCanvasElement, element: HTMLElement): HTMLCanvasElement {
  const rect = element.getBoundingClientRect();
  const ratio = canvas.width / window.innerWidth;
  const left = Math.max(0, Math.floor(rect.left * ratio));
  const top = Math.max(0, Math.floor(rect.top * ratio));
  const width = Math.min(canvas.width - left, Math.ceil(rect.width * ratio));
  const height = Math.min(canvas.height - top, Math.ceil(rect.height * ratio));
  if (width <= 0 || height <= 0) return canvas;
  const cropped = document.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  cropped.getContext('2d')?.drawImage(canvas, left, top, width, height, 0, 0, width, height);
  return cropped;
}

/**
 * Works around what html2canvas cannot paint, so the print matches the screen: elements with
 * `backdrop-filter` (dialog footers, sticky tab headers) disappear entirely, and Material floating
 * labels lose their text. Labels are redrawn as plain text at the same place in the clone.
 */
export function prepareCloneForCapture(clone: Document): void {
  const style = clone.createElement('style');
  style.textContent =
    '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
  clone.head.appendChild(style);
  const view = clone.defaultView;
  if (!view) return;
  clone.querySelectorAll<HTMLElement>('.mdc-floating-label').forEach((label) => {
    const rect = label.getBoundingClientRect();
    const text = label.textContent?.trim();
    if (!text || !rect.width || !rect.height) return;
    const computed = view.getComputedStyle(label);
    const scale = label.offsetHeight ? rect.height / label.offsetHeight : 1;
    const copy = clone.createElement('span');
    copy.textContent = text;
    Object.assign(copy.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      color: computed.color,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontSize: `${parseFloat(computed.fontSize) * scale}px`,
      lineHeight: `${rect.height}px`,
      whiteSpace: 'nowrap',
      zIndex: '2147483647',
    });
    clone.body.appendChild(copy);
    label.style.setProperty('visibility', 'hidden', 'important');
  });
}

/**
 * Masks passwords and anything marked `data-report-mask` inside the cloned document. The clone
 * lives in another window (iframe), so elements are recognized by tag name, not `instanceof`.
 */
export function maskSensitiveContent(clone: Document): void {
  clone.querySelectorAll<HTMLElement>(SUPPORT_REPORT_MASK_SELECTOR).forEach((element) => {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      field.value = field.value ? '••••••' : '';
      if (element.tagName === 'INPUT') element.setAttribute('value', field.value);
      else element.textContent = field.value;
      return;
    }
    element.style.setProperty('background', '#94a3b8', 'important');
    element.style.setProperty('color', 'transparent', 'important');
    element.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.setProperty('visibility', 'hidden', 'important');
    });
  });
}
