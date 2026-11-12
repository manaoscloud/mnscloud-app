import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { FlowVersion, ValidationIssue } from '../automation-adapter';
import { AutomationService } from '../automation.service';

export interface PublishDialogData {
  nextVersion: number;
  warnings: ValidationIssue[];
}

/** Asks for the version note before publishing. Closes with the note, or undefined on cancel. */
@Component({
  selector: 'app-automation-publish-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: `
    .pd-warning {
      display: flex;
      gap: 0.5rem;
      margin: 0 0 0.5rem;
      color: var(--mns-status-warning);
    }
    mat-form-field {
      width: 100%;
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.publish.title' | transloco: { version: data.nextVersion } }}</h2>
          <p>{{ 'automation.publish.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          @for (warning of data.warnings; track $index) {
            <p class="pd-warning">
              <mat-icon>warning</mat-icon><span>{{ warning.message || warning.code }}</span>
            </p>
          }
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'automation.publish.note' | transloco }}</mat-label>
            <textarea matInput rows="4" maxlength="500" [(ngModel)]="note"></textarea>
          </mat-form-field>
        </div>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="ref.close()">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button mat-flat-button color="primary" type="button" (click)="ref.close(note)">
            {{ 'automation.publish.confirm' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class AutomationPublishDialog {
  readonly data = inject<PublishDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AutomationPublishDialog, string>);
  note = '';
}

export interface VersionsDialogData {
  flowUUID: string;
  canRestore: boolean;
}

/** Published versions of the flow; restoring copies one into the draft. */
@Component({
  selector: 'app-automation-versions-dialog',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, ReportProblemButtonComponent, TranslocoPipe],
  styles: `
    .vd-list {
      display: grid;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .vd-item {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 0.25rem 1rem;
      align-items: center;
      padding: 0.625rem 0.75rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
    }
    .vd-meta {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.8125rem;
    }
  `,
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'automation.versions.title' | transloco }}</h2>
          <p>{{ 'automation.versions.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <ul class="vd-list">
            @for (version of versions(); track version.uuid) {
              <li class="vd-item">
                <div>
                  <strong>v{{ version.number }}</strong>
                  <span class="vd-meta">
                    · {{ 'automation.versions.state.' + version.state | transloco }} ·
                    {{ version.publishedAt | date: 'short' }}
                    @if (version.publishedBy) {
                      · {{ version.publishedBy }}
                    }
                  </span>
                  @if (version.note) {
                    <div class="vd-meta">{{ version.note }}</div>
                  }
                </div>
                @if (data.canRestore) {
                  <button mat-stroked-button type="button" (click)="restore(version)">
                    {{ 'automation.versions.restore' | transloco }}
                  </button>
                }
              </li>
            } @empty {
              <li class="vd-meta">
                {{ (loading() ? 'Loading...' : 'automation.versions.empty') | transloco }}
              </li>
            }
          </ul>
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
export class AutomationVersionsDialog {
  readonly data = inject<VersionsDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<AutomationVersionsDialog, boolean>);
  private readonly service = inject(AutomationService);

  readonly versions = signal<FlowVersion[]>([]);
  readonly loading = signal(true);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.versions.set(await this.service.versions(this.data.flowUUID));
    } finally {
      this.loading.set(false);
    }
  }

  async restore(version: FlowVersion): Promise<void> {
    await this.service.restore(this.data.flowUUID, version.uuid);
    this.ref.close(true);
  }
}

export async function askPublish(
  dialog: MatDialog,
  data: PublishDialogData,
): Promise<string | undefined> {
  const binding = openCrudComponentDialog(dialog, AutomationPublishDialog, 'crud-form-dialog', {
    data,
  });
  try {
    return await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}

/** Resolves true when a version was restored into the draft. */
export async function openVersions(dialog: MatDialog, data: VersionsDialogData): Promise<boolean> {
  const binding = openCrudComponentDialog(dialog, AutomationVersionsDialog, 'crud-form-dialog', {
    data,
  });
  try {
    return (await firstValueFrom(binding.ref.afterClosed())) === true;
  } finally {
    binding.stop();
  }
}
