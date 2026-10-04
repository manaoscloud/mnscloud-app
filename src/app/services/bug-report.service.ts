import { Injectable, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { APP_BUILD_INFO } from '../app-build-info';
import { openCrudComponentDialog } from '../shared/dialog/crud-dialog.util';
import { ApiService } from './api.service';
import { ClientDiagnosticsService, redactDiagnosticText } from './client-diagnostics.service';
import { SnackbarService } from './snackbar.service';

export type BugReportType = 'bug' | 'performance' | 'ui' | 'suggestion' | 'other';
export type BugReportSeverity = 'low' | 'medium' | 'high' | 'critical';

export type BugReportDraft = {
  title: string;
  description: string;
  type: BugReportType;
  severity: BugReportSeverity;
  includeDiagnostics: boolean;
};

export type BugReportPrefill = Partial<Omit<BugReportDraft, 'includeDiagnostics'>>;

export type BugReportPayload = {
  title: string;
  description: string;
  type: BugReportType;
  severity: BugReportSeverity;
  url: string;
  route: string;
  appVersion: string;
  screenshot?: string;
  systemInfo: Record<string, unknown>;
};

export type BugReportCreated = { BgrUUID: string; BgrID: string };

/** Elements whose content never appears in a problem report screenshot. */
export const BUG_REPORT_MASK_SELECTOR = 'input[type="password"], [data-report-mask]';

const EMPTY_DRAFT: BugReportDraft = {
  title: '',
  description: '',
  type: 'bug',
  severity: 'medium',
  includeDiagnostics: true,
};

@Injectable({ providedIn: 'root' })
export class BugReportService {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly router = inject(Router);
  private readonly diagnostics = inject(ClientDiagnosticsService);

  /** Unsent form values survive closing the dialog or a failed submit. */
  readonly draft = signal<BugReportDraft>({ ...EMPTY_DRAFT });
  private opening = false;

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
        ignoreElements: (element) =>
          element.classList?.contains('cdk-overlay-container') ||
          element.classList?.contains('cdk-overlay-backdrop') ||
          element.classList?.contains('mat-mdc-menu-panel'),
        onclone: (clone) => maskSensitiveContent(clone),
      });
      return canvas.toDataURL('image/jpeg', 0.82);
    } catch (error) {
      console.warn('[BugReportService] Screen capture failed:', error);
      return null;
    }
  }

  /** Opens the report dialog at once; the screenshot is captured behind it. */
  async openReportDialog(prefill?: BugReportPrefill): Promise<void> {
    if (this.opening) return;
    this.opening = true;
    try {
      if (prefill) this.draft.update((draft) => ({ ...draft, ...prefill }));
      const { BugReportDialogComponent } =
        await import('../shared/bug-report-dialog/bug-report-dialog');
      const binding = openCrudComponentDialog(
        this.dialog,
        BugReportDialogComponent,
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

  /** Errors are already toasted by the API interceptor; success shows the protocol. */
  async submitReport(payload: BugReportPayload): Promise<BugReportCreated> {
    const response = await this.api.post<{ data?: BugReportCreated }>(
      'system/bug-reports',
      payload,
    );
    const created = response?.data;
    this.draft.set({ ...EMPTY_DRAFT });
    this.snack.success('Problem report #{{protocol}} sent.', 5000, {
      protocol: created?.BgrID ?? '',
    });
    return { BgrUUID: created?.BgrUUID ?? '', BgrID: created?.BgrID ?? '' };
  }
}

/** Masks passwords and anything marked `data-report-mask` inside the cloned document. */
export function maskSensitiveContent(clone: Document): void {
  clone.querySelectorAll<HTMLElement>(BUG_REPORT_MASK_SELECTOR).forEach((element) => {
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
