import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
    ReactiveFormsModule,
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
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<BugReportDialogComponent>);
  private readonly bugReportService = inject(BugReportService);
  readonly data = inject<BugReportDialogData>(MAT_DIALOG_DATA, { optional: true }) || {};

  readonly screenshotData = signal<string | null>(this.data.screenshot || null);
  readonly isCapturing = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);

  readonly pageUrl = signal<string>(this.data.url || window.location.href);
  readonly screenSize = signal<string>(`${window.innerWidth} x ${window.innerHeight} (${window.devicePixelRatio}x)`);
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

  readonly form = this.fb.group({
    type: ['bug', Validators.required],
    severity: ['medium', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(4000)]],
  });

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
    if (this.form.invalid || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const formVal = this.form.getRawValue();

    try {
      await this.bugReportService.submitReport({
        title: formVal.title!,
        description: formVal.description!,
        type: formVal.type as any,
        severity: formVal.severity as any,
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
