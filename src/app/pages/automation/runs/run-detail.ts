import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SnackbarService } from '../../../services/snackbar.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { RUN_LIVE_STATES, RunDetail } from '../automation-adapter';
import { AutomationService } from '../automation.service';

export interface RunDetailData {
  uuid: string;
}

/** Icon of a step result in the timeline. */
export function stepIcon(result: string): string {
  switch (result) {
    case 'ok':
      return 'check_circle';
    case 'error':
      return 'error';
    case 'waiting':
      return 'hourglass_top';
    default:
      return 'remove_circle_outline';
  }
}

/** Run with its step timeline; a live run can be cancelled from here. */
@Component({
  selector: 'app-automation-run-detail',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, ReportProblemButtonComponent, TranslocoPipe],
  styles: `
    .run-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      margin: 0 0 1rem;
      color: var(--mat-sys-color-on-surface-variant);
    }
    .run-timeline {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .run-step {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.25rem 0.75rem;
      align-items: start;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
    }
    .run-step mat-icon.ok {
      color: var(--mns-status-success);
    }
    .run-step mat-icon.error {
      color: var(--mat-sys-color-error);
    }
    .run-step mat-icon.waiting {
      color: var(--mns-status-warning);
    }
    .run-step-summary {
      grid-column: 2 / 4;
      color: var(--mat-sys-color-on-surface-variant);
      overflow-wrap: anywhere;
    }
    .run-error {
      color: var(--mat-sys-color-error);
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.runs.detailTitle' | transloco }}</h2>
          <p>{{ run()?.flowName }}</p>
        </div>
        <mns-report-problem-button />
      </header>

      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (run(); as detail) {
            <div class="run-meta">
              <span>{{ 'automation.runs.state.' + detail.state | transloco }}</span>
              <span>{{ 'automation.runs.mode.' + detail.mode | transloco }}</span>
              <span>{{ detail.trigger }}</span>
              @if (detail.startedAt) {
                <span>{{ detail.startedAt | date: 'short' }}</span>
              }
              @if (detail.error) {
                <span class="run-error">{{ detail.error }}</span>
              }
            </div>
            <ol class="run-timeline" [attr.aria-label]="'automation.runs.timeline' | transloco">
              @for (step of detail.steps; track step.seq) {
                <li class="run-step">
                  <mat-icon [class]="step.result">{{ icon(step.result) }}</mat-icon>
                  <span
                    ><strong>{{ step.seq }}. {{ step.nodeType }}</strong> · {{ step.nodeId }}
                    @if (step.port) {
                      → {{ step.port }}
                    }
                  </span>
                  <span>{{ step.durationMs }} ms</span>
                  @if (step.summary || step.errorCode) {
                    <span class="run-step-summary">{{ step.summary || step.errorCode }}</span>
                  }
                </li>
              } @empty {
                <li>{{ 'automation.runs.noSteps' | transloco }}</li>
              }
            </ol>
          } @else if (loading()) {
            <p>{{ 'Loading...' | transloco }}</p>
          }
        </div>
      </div>

      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          @if (live()) {
            <button mat-flat-button color="primary" type="button" (click)="cancel()">
              {{ 'Cancel run' | transloco }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class AutomationRunDetailDialog {
  private readonly data = inject<RunDetailData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<AutomationRunDetailDialog, boolean>);
  private readonly service = inject(AutomationService);
  private readonly snack = inject(SnackbarService);

  readonly run = signal<RunDetail | null>(null);
  readonly loading = signal(true);
  readonly icon = stepIcon;

  live(): boolean {
    return RUN_LIVE_STATES.includes(this.run()?.state ?? '');
  }

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.run.set(await this.service.run(this.data.uuid));
    } finally {
      this.loading.set(false);
    }
  }

  async cancel(): Promise<void> {
    await this.service.cancelRun(this.data.uuid);
    this.snack.success('automation.runs.cancelled');
    this.ref.close(true);
  }

  close(): void {
    this.ref.close(false);
  }
}

/** Opens the run detail; `onChanged` runs when the run was cancelled from the dialog. */
export function openRunDetail(dialog: MatDialog, uuid: string, onChanged: () => void): void {
  const binding = openCrudComponentDialog(dialog, AutomationRunDetailDialog, 'crud-form-dialog', {
    data: { uuid } satisfies RunDetailData,
  });
  void firstValueFrom(binding.ref.afterClosed()).then((changed) => {
    binding.stop();
    if (changed) onChanged();
  });
}
