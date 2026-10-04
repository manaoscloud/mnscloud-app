import { Component, computed, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  BugReportCreated,
  BugReportService,
  BugReportSeverity,
  BugReportType,
} from '../../services/bug-report.service';
import {
  MnsSearchSelectFieldComponent,
  MnsSearchSelectFieldOption,
} from '../forms/mns-search-select-field/mns-search-select-field';

export interface BugReportDialogData {
  url?: string;
}

export const BUG_REPORT_TYPE_OPTIONS: readonly MnsSearchSelectFieldOption[] = [
  { value: 'bug', label: 'System Error / Bug' },
  { value: 'performance', label: 'Slowness / Performance' },
  { value: 'ui', label: 'Visual / Layout Issue' },
  { value: 'suggestion', label: 'Suggestion / Improvement' },
  { value: 'other', label: 'Other' },
];

export const BUG_REPORT_SEVERITY_OPTIONS: readonly MnsSearchSelectFieldOption[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical (Blocks work)' },
];

@Component({
  selector: 'app-bug-report-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MnsSearchSelectFieldComponent,
    TranslocoPipe,
  ],
  templateUrl: './bug-report-dialog.html',
  styleUrls: ['./bug-report-dialog.scss'],
})
export class BugReportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<BugReportDialogComponent>);
  private readonly bugReports = inject(BugReportService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  readonly data = inject<BugReportDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};

  readonly typeOptions = BUG_REPORT_TYPE_OPTIONS;
  readonly severityOptions = BUG_REPORT_SEVERITY_OPTIONS;
  readonly titleMax = 200;
  readonly descriptionMax = 4000;

  readonly draft = this.bugReports.draft;
  readonly screenshot = signal<string | null>(null);
  readonly capturing = signal(true);
  readonly submitting = signal(false);
  readonly created = signal<BugReportCreated | null>(null);
  readonly environment = this.bugReports.environment();
  readonly diagnostics = this.bugReports.diagnosticsSnapshot();

  readonly isFormValid = computed(() => {
    const draft = this.draft();
    return (
      draft.title.trim().length > 0 &&
      draft.title.trim().length <= this.titleMax &&
      draft.description.trim().length > 0 &&
      draft.description.trim().length <= this.descriptionMax
    );
  });

  constructor() {
    // The dialog lives in the CDK overlay, which the capture ignores: the print shows the page.
    void this.capture();
  }

  successTitle(protocol: string): string {
    return this.transloco.translate('Problem report #{{protocol}} sent.', { protocol });
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
    this.draft.update((draft) => ({ ...draft, type: (value || 'bug') as BugReportType }));
  }

  setSeverity(value: unknown) {
    this.draft.update((draft) => ({
      ...draft,
      severity: (value || 'medium') as BugReportSeverity,
    }));
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
      this.screenshot.set(await this.bugReports.captureScreen());
    } finally {
      this.capturing.set(false);
    }
  }

  async submit() {
    if (!this.isFormValid() || this.submitting()) return;
    this.submitting.set(true);
    const draft = this.draft();
    const include = draft.includeDiagnostics;
    try {
      const created = await this.bugReports.submitReport({
        title: draft.title.trim(),
        description: draft.description.trim(),
        type: draft.type,
        severity: draft.severity,
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
          consoleLogs: include ? this.diagnostics.consoleLogs : [],
          failedRequests: include ? this.diagnostics.failedRequests : [],
          navigation: include ? this.diagnostics.navigation : [],
        },
      });
      this.created.set(created);
    } catch {
      // The API interceptor already shows the error; the draft stays for a retry.
    } finally {
      this.submitting.set(false);
    }
  }

  openMyReports() {
    this.dialogRef.close(true);
    void this.router.navigateByUrl('/user/bug-reports');
  }

  close() {
    this.dialogRef.close(Boolean(this.created()));
  }
}
