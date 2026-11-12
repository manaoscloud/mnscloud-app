import { Component, DestroyRef, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { commandClassLabel, DeviceConsoleVerdict } from './device-console-session';

export type DeviceConsoleConfirmData = { verdict: DeviceConsoleVerdict; deviceName: string };

/** Milliseconds before the final step of a double confirmation can be clicked. */
export const FINAL_CONFIRM_DELAY_MS = 1500;

/**
 * Asks before a write command runs on the device: shows the line exactly as the gateway
 * reconstructed it (redacted), its class and, for a destructive command, a second explicit step.
 * Closes with true (run), false (refuse) or nothing (the gateway resolved or expired it).
 */
@Component({
  selector: 'mns-device-console-confirm-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [
    `
      .crud-dialog {
        display: flex;
        flex-direction: column;
        row-gap: 0.75rem;
        padding: 1.5rem 1.75rem;
        box-sizing: border-box;
      }
      .dialog-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .dialog-header h2 {
        margin: 0;
      }
      .dialog-header p {
        margin: 4px 0 0;
        color: var(--mat-sys-on-surface-variant);
      }
      .command {
        margin: 0;
        padding: 12px;
        border-radius: 8px;
        background: #000;
        color: #e6e6e6;
        font-family: monospace;
        white-space: pre-wrap;
        word-break: break-all;
        max-height: 40vh;
        overflow: auto;
      }
      .warning {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        color: var(--mat-sys-error, #b3261e);
      }
      .meta {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
      }
    `,
  ],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ title() | transloco }}</h2>
          <p>{{ data.deviceName }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <pre class="command" data-report-mask>{{ data.verdict.line }}</pre>
          <p class="meta">
            {{ 'network.console.commandClass' | transloco }}:
            <strong>{{ classLabel | transloco }}</strong>
            ·
            {{
              'network.console.expiresIn' | transloco: { seconds: data.verdict.expiresInSeconds }
            }}
          </p>
          @if (data.verdict.unknown) {
            <p class="warning">
              <mat-icon>help</mat-icon>
              <span>{{ 'network.console.unknownLine' | transloco }}</span>
            </p>
          }
          @if (finalStep) {
            <p class="warning">
              <mat-icon>warning</mat-icon>
              <span>{{ 'network.console.destructiveWarning' | transloco }}</span>
            </p>
          } @else if (double) {
            <p class="meta">{{ 'network.console.doubleConfirmFirst' | transloco }}</p>
          } @else {
            <p class="meta">{{ 'network.console.confirmHint' | transloco }}</p>
          }
        </div>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="answer(false)">
            {{ 'network.console.deny' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            type="button"
            [color]="double ? 'warn' : 'primary'"
            [disabled]="!ready()"
            (click)="answer(true)"
          >
            {{
              (finalStep ? 'network.console.confirmFinal' : 'network.console.confirm') | transloco
            }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class DeviceConsoleConfirmDialogComponent {
  readonly data = inject<DeviceConsoleConfirmData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<DeviceConsoleConfirmDialogComponent, boolean>>(MatDialogRef);
  readonly double = this.data.verdict.requires === 'double_confirm';
  readonly finalStep = this.double && this.data.verdict.step >= 2;
  readonly classLabel = commandClassLabel(this.data.verdict.commandClass);
  /** The final step of a destructive command cannot be clicked through by reflex. */
  readonly ready = signal(!this.finalStep);

  constructor() {
    if (this.finalStep) {
      const timer = setTimeout(() => this.ready.set(true), FINAL_CONFIRM_DELAY_MS);
      inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    }
  }

  title(): string {
    if (this.finalStep) return 'network.console.confirmFinalTitle';
    return this.double ? 'network.console.confirmDestructiveTitle' : 'network.console.confirmTitle';
  }

  answer(run: boolean) {
    this.ref.close(run);
  }
}
