import { Component, computed, inject, resource } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';

export interface CgnatScriptDialogData {
  profileUUID: string;
  name: string;
  vendor: string;
}

@Component({
  selector: 'app-isp-cgnat-script-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ClipboardModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    TranslocoPipe,
    ReportProblemButtonComponent,
  ],
  template: `
    <div class="crud-dialog" style="min-width: 600px; max-width: 800px; padding: 1.5rem;">
      <div class="dialog-header" style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="margin: 0 0 0.5rem 0;">{{ 'isp.cgnat.scriptTitle' | transloco }} - {{ data.name }}</h2>
          <p style="margin: 0; color: var(--mat-sys-outline, #757575);">
            {{ 'isp.cgnat.scriptDescription' | transloco }} ({{ data.vendor }})
          </p>
        </div>
        <mns-report-problem-button />
      </div>

      <div mat-dialog-content style="max-height: 60vh; overflow: auto; margin-top: 1rem;">
        @if (scriptResource.isLoading()) {
          <mat-progress-bar mode="indeterminate" />
        } @else if (scriptResource.error()) {
          <p class="error-text" style="color: var(--mat-sys-error, #ba1a1a);">{{ errorMessage() }}</p>
        } @else {
          <div style="position: relative;">
            <pre style="background: var(--mat-sys-surface-container, #f3f3f3); padding: 1rem; border-radius: 6px; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; word-break: break-all;"><code>{{ script() }}</code></pre>
          </div>
        }
      </div>

      <div mat-dialog-actions align="end" style="padding: 1rem 0 0 0; display: flex; justify-content: flex-end; gap: 0.5rem;">
        <button mat-button (click)="dialogRef.close()">
          {{ 'Close' | transloco }}
        </button>
        <button
          mat-flat-button
          color="primary"
          [disabled]="scriptResource.isLoading() || !script()"
          [cdkCopyToClipboard]="script()"
          (cdkCopyToClipboardCopied)="onCopied()"
        >
          <mat-icon>content_copy</mat-icon>
          {{ 'isp.cgnat.copyScript' | transloco }}
        </button>
      </div>
    </div>
  `,
})
export class IspCgnatScriptDialogComponent {
  readonly dialogRef = inject(MatDialogRef<IspCgnatScriptDialogComponent>);
  readonly data: CgnatScriptDialogData = inject(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);

  readonly scriptResource = resource({
    loader: async () => {
      const res = await this.api.post<{ status: string; data: { script: string } }>(
        `isp/cgnat-profiles/${this.data.profileUUID}/generate-script`,
        {},
      );
      return res.data?.script ?? '';
    },
  });

  readonly script = computed(() => this.scriptResource.value() ?? '');
  readonly errorMessage = computed(() => {
    const err = this.scriptResource.error();
    return err instanceof Error ? err.message : 'Failed to generate script.';
  });

  onCopied() {
    this.snackbar.success('Script copied to clipboard.');
  }
}
