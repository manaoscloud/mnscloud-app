import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { BugReportService } from '../../services/bug-report.service';

export interface BugReportDialogData {
  screenshot?: string;
  url?: string;
  consoleLogs?: Array<{ type: string; message: string; timestamp: string }>;
}

@Component({
  selector: 'app-bug-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './bug-report-dialog.html',
  styleUrls: ['./bug-report-dialog.scss'],
})
export class BugReportDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<BugReportDialogComponent>);
  private readonly bugReportService = inject(BugReportService);
  readonly data = inject<BugReportDialogData>(MAT_DIALOG_DATA, { optional: true }) || {};

  readonly screenshotData = signal<string | null>(this.data.screenshot || null);
  readonly isCapturing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly type = signal<'bug' | 'performance' | 'ui' | 'suggestion' | 'other'>('bug');
  readonly severity = signal<'low' | 'medium' | 'high' | 'critical'>('medium');
  readonly title = signal<string>('');
  readonly description = signal<string>('');

  readonly isFormValid = computed(() => {
    return this.title().trim().length > 0 && this.description().trim().length > 0;
  });

  readonly pageUrl = signal<string>(this.data.url || window.location.href);
  readonly screenSize = signal<string>(
    `${window.innerWidth} x ${window.innerHeight} (${window.devicePixelRatio}x)`,
  );
  readonly browserAgent = signal<string>(navigator.userAgent);

  readonly typeOptions = [
    { value: 'bug', label: 'System Error / Bug' },
    { value: 'performance', label: 'Slowness / Performance' },
    { value: 'ui', label: 'Visual / Layout Issue' },
    { value: 'suggestion', label: 'Suggestion / Improvement' },
    { value: 'other', label: 'Other' },
  ];

  readonly severityOptions = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical (Blocks work)' },
  ];

  removeScreenshot() {
    this.screenshotData.set(null);
  }

  async recaptureScreenshot() {
    this.isCapturing.set(true);
    try {
      const captured = await this.bugReportService.captureScreen();
      this.screenshotData.set(captured);
    } catch {
      // ignore capture errors
    } finally {
      this.isCapturing.set(false);
    }
  }

  async submit() {
    if (!this.isFormValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);

    try {
      await this.bugReportService.submitReport({
        title: this.title().trim(),
        description: this.description().trim(),
        type: this.type(),
        severity: this.severity(),
        url: this.pageUrl(),
        screenshot: this.screenshotData() || undefined,
        systemInfo: {
          userAgent: this.browserAgent(),
          viewport: this.screenSize(),
          platform: navigator.platform,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          consoleLogs: this.data.consoleLogs || [],
        },
      });

      this.dialogRef.close(true);
    } catch {
      // Error is handled with toast in bugReportService
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
