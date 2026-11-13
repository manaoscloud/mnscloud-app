import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { openCrudComponentDialog } from '../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../shared/support-report-dialog/report-problem-button';
import { FlowGraph } from './automation-adapter';
import { AutomationService } from './automation.service';

/** i18n key of an AI refusal of the API (`automation.ai.*`), or the generic failure. */
export function aiErrorKey(error: unknown): string {
  const code = String((error as { error?: { code?: unknown } })?.error?.code ?? '');
  const known = ['no_credit', 'not_entitled', 'not_configured', 'rate_limit'];
  const suffix = code.replace(/^automation\.ai\./, '');
  return known.includes(suffix) ? `automation.ai.error.${suffix}` : 'automation.ai.error.failed';
}

export interface AiDraftResult {
  description: string;
  graph: FlowGraph;
}

/** "Criar com IA": asks the description, gets the draft; closes with it (nothing saved yet). */
@Component({
  selector: 'app-automation-ai-draft-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: `
    mat-form-field {
      width: 100%;
    }
    .ai-error {
      display: flex;
      gap: 0.5rem;
      color: var(--mns-status-danger);
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.ai.draftTitle' | transloco }}</h2>
          <p>{{ 'automation.ai.draftDescription' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'automation.ai.draftField' | transloco }}</mat-label>
            <textarea matInput rows="8" maxlength="4000" [(ngModel)]="description"></textarea>
          </mat-form-field>
          @if (busy()) {
            <mat-progress-bar mode="indeterminate" />
          }
          @if (error()) {
            <p class="ai-error">
              <mat-icon>error</mat-icon><span>{{ error() | transloco }}</span>
            </p>
          }
        </div>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="ref.close()">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            color="primary"
            type="button"
            [disabled]="busy() || description.trim().length < 10"
            (click)="generate()"
          >
            <mat-icon>auto_awesome</mat-icon>{{ 'automation.ai.draftConfirm' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AutomationAiDraftDialog {
  readonly ref = inject(MatDialogRef<AutomationAiDraftDialog, AiDraftResult>);
  private readonly service = inject(AutomationService);
  description = '';
  readonly busy = signal(false);
  readonly error = signal('');

  async generate(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.service.aiDraft(this.description.trim());
      if (!result.graph) {
        this.error.set('automation.ai.error.empty');
        return;
      }
      this.ref.close({ description: this.description.trim(), graph: result.graph });
    } catch (error) {
      this.error.set(aiErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}

export async function askAiDraft(dialog: MatDialog): Promise<AiDraftResult | undefined> {
  const binding = openCrudComponentDialog(dialog, AutomationAiDraftDialog, 'crud-form-dialog', {});
  try {
    return await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}

/** "Revisar com IA": summary and issues of the saved draft. */
@Component({
  selector: 'app-automation-ai-review-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: `
    .ai-issue {
      display: flex;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
    }
    .ai-issue.high mat-icon {
      color: var(--mns-status-danger);
    }
    .ai-issue.medium mat-icon {
      color: var(--mns-status-warning);
    }
    .ai-error {
      display: flex;
      gap: 0.5rem;
      color: var(--mns-status-danger);
    }
    .ai-summary {
      white-space: pre-line;
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.ai.reviewTitle' | transloco }}</h2>
          <p>{{ 'automation.ai.reviewDescription' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (busy()) {
            <mat-progress-bar mode="indeterminate" />
          }
          @if (error()) {
            <p class="ai-error">
              <mat-icon>error</mat-icon><span>{{ error() | transloco }}</span>
            </p>
          }
          @if (summary()) {
            <p class="ai-summary">{{ summary() }}</p>
          }
          @for (item of issues(); track $index) {
            <p class="ai-issue" [class]="item.severity">
              <mat-icon>{{ item.severity === 'low' ? 'info' : 'warning' }}</mat-icon>
              <span>{{ item.nodeId ? item.nodeId + ': ' : '' }}{{ item.message }}</span>
            </p>
          }
          @if (!busy() && !error() && !issues().length && summary()) {
            <p>{{ 'automation.ai.reviewNoIssues' | transloco }}</p>
          }
        </div>
      </div>
      <div class="form-actions">
        <div class="primary-actions">
          <button mat-flat-button color="primary" type="button" (click)="ref.close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AutomationAiReviewDialog {
  readonly data = inject<{ flowUUID: string }>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AutomationAiReviewDialog>);
  private readonly service = inject(AutomationService);
  readonly busy = signal(true);
  readonly error = signal('');
  readonly summary = signal('');
  readonly issues = signal<Array<{ nodeId: string | null; severity: string; message: string }>>([]);

  constructor() {
    void this.review();
  }

  private async review(): Promise<void> {
    try {
      const result = await this.service.aiReview(this.data.flowUUID);
      this.summary.set(result.summary);
      this.issues.set(result.issues);
    } catch (error) {
      this.error.set(aiErrorKey(error));
    } finally {
      this.busy.set(false);
    }
  }
}

export async function openAiReview(dialog: MatDialog, flowUUID: string): Promise<void> {
  const binding = openCrudComponentDialog(dialog, AutomationAiReviewDialog, 'crud-form-dialog', {
    data: { flowUUID },
  });
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
