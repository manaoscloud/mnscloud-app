import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SnackbarService } from '../../../services/snackbar.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { AutomationService, ManualFlow } from '../../automation/automation.service';

export interface RunAutomationDialogData {
  conversationUUID: string;
}

/** Translation key of a failed manual start (by API code, then by status). */
export function manualStartErrorKey(error: unknown): string {
  const failure = error as Partial<HttpErrorResponse> | null;
  const code = String((failure?.error as { code?: unknown } | null)?.code ?? '');
  if (code === 'automation.chain.invalid') return 'automation.manual.error.chain';
  if (code === 'automation.run.already_live') return 'automation.manual.error.conflict';
  if (code === 'automation.flow.not_published') return 'automation.manual.error.notPublished';
  if (code === 'automation.forbidden') return 'automation.manual.error.permission';
  if (code === 'automation.not_found' || code === 'automation.flow.not_found')
    return 'automation.manual.error.notFound';
  if (failure?.status === 403) return 'automation.manual.error.permission';
  if (failure?.status === 404) return 'automation.manual.error.notFound';
  if (failure?.status === 409) return 'automation.manual.error.conflict';
  return 'automation.manual.error.generic';
}

/** Lists the manual flows of a conversation and starts the chosen one. */
@Component({
  selector: 'app-run-automation-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: `
    .ra-list {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .ra-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.25rem 1rem;
      align-items: center;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
    }
    .ra-description,
    .ra-empty {
      margin: 0;
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.8125rem;
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.manual.title' | transloco }}</h2>
          <p>{{ 'automation.manual.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (loading()) {
            <mat-progress-spinner mode="indeterminate" diameter="32" />
          } @else if (!flows().length) {
            <p class="ra-empty">{{ 'automation.manual.empty' | transloco }}</p>
          } @else {
            <ul class="ra-list">
              @for (flow of flows(); track flow.uuid) {
                <li class="ra-item">
                  <div>
                    <strong>{{ flow.name }}</strong>
                    @if (flow.description) {
                      <p class="ra-description">{{ flow.description }}</p>
                    }
                  </div>
                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    [disabled]="starting() !== ''"
                    (click)="start(flow)"
                  >
                    <mat-icon>play_arrow</mat-icon>{{ 'automation.manual.start' | transloco }}
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="ref.close(false)">
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions"></div>
      </div>
    </div>
  `,
})
export class RunAutomationDialog {
  readonly data = inject<RunAutomationDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<RunAutomationDialog, boolean>);
  private readonly service = inject(AutomationService);
  private readonly snack = inject(SnackbarService);

  readonly flows = signal<ManualFlow[]>([]);
  readonly loading = signal(true);
  readonly starting = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.flows.set(await this.service.manualFlows(this.data.conversationUUID));
    } catch (error) {
      this.snack.error(manualStartErrorKey(error));
    } finally {
      this.loading.set(false);
    }
  }

  async start(flow: ManualFlow): Promise<void> {
    this.starting.set(flow.uuid);
    try {
      await this.service.startManual(flow.uuid, this.data.conversationUUID);
      this.snack.success('automation.manual.started', 3000, { name: flow.name });
      this.ref.close(true);
    } catch (error) {
      this.snack.error(manualStartErrorKey(error));
      this.starting.set('');
    }
  }
}

/** Resolves true when a flow was started. */
export async function openRunAutomation(
  dialog: MatDialog,
  data: RunAutomationDialogData,
): Promise<boolean> {
  const binding = openCrudComponentDialog(dialog, RunAutomationDialog, 'crud-form-dialog', {
    data,
  });
  try {
    return (await firstValueFrom(binding.ref.afterClosed())) === true;
  } finally {
    binding.stop();
  }
}
