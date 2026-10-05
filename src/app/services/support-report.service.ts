import { SupportRequestDraft } from './support-request-draft';
import { readStoredEnvironmentUUID } from '../core/environment/environment-context';
import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_BUILD_INFO } from '../app-build-info';
import { openCrudComponentDialog } from '../shared/dialog/crud-dialog.util';
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
export const SUPPORT_REPORT_MASK_SELECTOR = 'input[type="password"], [data-report-mask]';

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
  private draftEnvironment = readStoredEnvironmentUUID();

  clearDraft() {
    this.draft.set({ ...EMPTY_DRAFT });
    this.prefillCodes.set({});
    this.submission.clear();
    this.draftEnvironment = readStoredEnvironmentUUID();
  }

  private opening = false;
  private readonly submission = new SupportRequestDraft();

  async captureScreen(): Promise<string | null> {
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
        ignoreElements: (element: Element) =>
          element.classList?.contains('cdk-overlay-container') ||
          element.classList?.contains('cdk-overlay-backdrop') ||
          element.classList?.contains('mat-mdc-menu-panel'),
        onclone: (clone: Document) => maskSensitiveContent(clone),
      });
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (error) {
      console.warn('[SupportReportService] Screen capture failed:', error);
      return null;
    }
  }

  /** Opens the report dialog at once; the screenshot is captured behind it. */
  async openReportDialog(prefill?: SupportReportPrefill): Promise<void> {
    if (this.opening) return;
    if (this.draftEnvironment !== readStoredEnvironmentUUID()) this.clearDraft();
    this.opening = true;
    try {
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
        'crud-form-dialog',
        { data: { url: window.location.href } },
      );
      void firstValueFrom(binding.ref.afterClosed()).finally(binding.stop);
    } finally {
      this.opening = false;
    }
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

/** Masks passwords and anything marked `data-report-mask` inside the cloned document. */
export function maskSensitiveContent(clone: Document): void {
  clone.querySelectorAll<HTMLElement>(SUPPORT_REPORT_MASK_SELECTOR).forEach((element) => {
    if (element instanceof HTMLInputElement) {
      element.value = element.value ? '••••••' : '';
      element.setAttribute('value', element.value);
      return;
    }
    element.style.setProperty('background', '#94a3b8', 'important');
    element.style.setProperty('color', 'transparent', 'important');
    element.querySelectorAll<HTMLElement>('*').forEach((child) => {
      child.style.setProperty('visibility', 'hidden', 'important');
    });
  });
}
