import { ChangeDetectionStrategy, Component, ElementRef, inject, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupportReportContext, SupportReportService } from '../../services/support-report.service';

/**
 * "Report problem" for dialog headers (app.md `Dialog Report Problem Baseline`). The report opens
 * over the dialog, the print keeps the dialog visible and the ticket records which window it was.
 * The dialog title is read from the header; pages may add resource/mode/record details.
 */
@Component({
  selector: 'mns-report-problem-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      class="report-problem-button"
      [matTooltip]="'topbar.reportBug' | transloco"
      [attr.aria-label]="'topbar.reportBug' | transloco"
      (click)="open()"
    >
      <mat-icon>bug_report</mat-icon>
    </button>
  `,
  styles: `
    :host {
      flex: 0 0 auto;
      align-self: flex-start;
      margin: -0.5rem -0.5rem 0 auto;
    }
    .report-problem-button {
      color: var(--mat-sys-color-on-surface-variant);
    }
  `,
})
export class ReportProblemButtonComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reports = inject(SupportReportService);
  readonly context = input<Omit<SupportReportContext, 'surface' | 'dialogTitle'> | null>(null);

  open() {
    const element = this.host.nativeElement;
    const header = element.closest('.dialog-header');
    const title = header?.querySelector('h1, h2, h3')?.textContent?.trim() ?? '';
    void this.reports.openReportDialog(undefined, {
      context: { ...(this.context() ?? {}), dialogTitle: title },
      element: (element.closest('.cdk-overlay-pane') as HTMLElement | null) ?? null,
    });
  }
}
