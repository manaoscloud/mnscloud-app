import { ClipboardModule } from '@angular/cdk/clipboard';
import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-softswitch-install-command-dialog',
  standalone: true,
  imports: [ClipboardModule, MatButtonModule, MatDialogModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="crud-dialog">
      <div class="dialog-header">
        <div>
          <h2>{{ 'Install command' | transloco }}</h2>
          <p>{{ 'Copy this command once and run it on the Softswitch server.' | transloco }}</p>
        </div>
      </div>
      <mat-dialog-content class="dialog-content">
        <pre class="install-command-shell"><code>{{ data.command }}</code></pre>
      </mat-dialog-content>
      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" mat-dialog-close>
            {{ 'Close' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button mat-flat-button color="primary" type="button" [cdkCopyToClipboard]="data.command">
            <mat-icon>content_copy</mat-icon>
            {{ 'Copy command' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SoftswitchInstallCommandDialogComponent {
  readonly data = inject<{ command: string }>(MAT_DIALOG_DATA);
}
