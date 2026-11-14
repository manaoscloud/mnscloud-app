import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../services/snackbar.service';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import {
  RemoteAssistService,
  RemoteProposal,
  SettingsRecord,
  assistRequestErrorKey,
  errorStatus,
  safeChangeKey,
} from './remote-assistant';

const DIALOG_STYLES = `
  .fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
  pre.commands {
    margin: 0;
    padding: 8px;
    border-radius: 8px;
    max-height: 220px;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 0.8125rem;
    background: var(--mat-sys-surface-container-highest, #333);
  }
  .note {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--mat-sys-tertiary-container, #ffd8e4);
    color: var(--mat-sys-on-tertiary-container, #31111d);
  }
  h3 {
    margin: 8px 0 4px;
    font-size: 0.9375rem;
  }
  .meta {
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.8125rem;
  }
`;

/* ---------------------------------------------------------------- approve / reject */

export type ProposalDecisionData = { proposal: RemoteProposal; decision: 'approve' | 'reject' };
export type ProposalDecisionResult = { note: string };

/** Confirmation of a proposal decision: approving repeats the commands and the rollback note. */
@Component({
  selector: 'mns-support-remote-proposal-decision-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>
            {{
              (approving
                ? 'support.remote.proposal.approveTitle'
                : 'support.remote.proposal.rejectTitle'
              ) | transloco
            }}
          </h2>
          <p>{{ data.proposal.SrpTitle }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            @if (approving) {
              <p class="meta">{{ 'support.remote.proposal.approveHelp' | transloco }}</p>
              <h3>{{ 'support.remote.proposal.commands' | transloco }}</h3>
              <pre class="commands" data-report-mask>{{ commands }}</pre>
              <div class="note" role="note">
                <mat-icon>shield</mat-icon>
                <span>{{ safeKey | transloco }}</span>
              </div>
              @if (data.proposal.SrpRollback.length) {
                <h3>{{ 'support.remote.proposal.rollback' | transloco }}</h3>
                <pre class="commands" data-report-mask>{{ rollback }}</pre>
              }
            }
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.proposal.note' | transloco }}</mat-label>
              <textarea
                matInput
                rows="3"
                maxlength="500"
                [ngModel]="note()"
                (ngModelChange)="note.set($event)"
              ></textarea>
            </mat-form-field>
          </div>
        </div>
      </div>
      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="ref.close()">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button mat-flat-button type="button" (click)="ref.close({ note: note().trim() })">
            {{
              (approving
                ? 'support.remote.proposal.approveConfirm'
                : 'support.remote.proposal.rejectConfirm'
              ) | transloco
            }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteProposalDecisionDialogComponent {
  readonly data = inject<ProposalDecisionData>(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<SupportRemoteProposalDecisionDialogComponent, ProposalDecisionResult>>(
      MatDialogRef,
    );
  readonly note = signal('');
  readonly approving = this.data.decision === 'approve';
  readonly commands = this.data.proposal.SrpCommands.join('\n');
  readonly rollback = this.data.proposal.SrpRollback.join('\n');
  readonly safeKey = safeChangeKey(this.data.proposal.SrpSafeChange);
}

/* ---------------------------------------------------------------- settings */

/** Sessões › Configurações: comment prefix the AI copilot writes on devices. */
@Component({
  selector: 'mns-support-remote-settings-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'support.remote.settings.title' | transloco }}</h2>
          <p>{{ 'support.remote.settings.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.settings.prefix' | transloco }}</mat-label>
              <input
                matInput
                name="prefix"
                maxlength="24"
                [disabled]="loading()"
                [placeholder]="current()?.effectivePrefix ?? ''"
                [ngModel]="prefix()"
                (ngModelChange)="prefix.set($event)"
              />
              <mat-hint>{{ 'support.remote.settings.prefixHelp' | transloco }}</mat-hint>
              @if (!valid()) {
                <mat-error>{{ 'support.remote.settings.prefixInvalid' | transloco }}</mat-error>
              }
            </mat-form-field>
            @if (current(); as settings) {
              <p class="meta">
                {{
                  'support.remote.settings.effective'
                    | transloco: { prefix: settings.effectivePrefix }
                }}
                @if (settings.commentPrefix === null) {
                  · {{ 'support.remote.settings.default' | transloco }}
                }
              </p>
            }
          </div>
        </div>
      </div>
      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="ref.close()">
            {{ 'Cancel' | transloco }}
          </button>
        </div>
        <div class="primary-actions">
          <button
            mat-flat-button
            type="button"
            [disabled]="loading() || saving() || !valid()"
            (click)="save()"
          >
            {{ 'Save' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteSettingsDialogComponent {
  readonly ref =
    inject<MatDialogRef<SupportRemoteSettingsDialogComponent, SettingsRecord>>(MatDialogRef);
  private readonly service = inject(RemoteAssistService);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly current = signal<SettingsRecord | null>(null);
  readonly prefix = signal('');
  /** Empty means the default (null); otherwise the API pattern. */
  readonly valid = computed(() => {
    const value = this.prefix().trim();
    return !value || /^[A-Za-z0-9 ._-]{1,24}$/.test(value);
  });

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      const settings = await this.service.settings();
      this.current.set(settings);
      this.prefix.set(settings.commentPrefix ?? '');
    } catch {
      this.snack.error('support.remote.settings.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    const settings = this.current();
    if (!settings || !this.valid() || this.saving()) return;
    this.saving.set(true);
    try {
      const value = this.prefix().trim();
      const saved = await this.service.saveSettings(value || null, settings.revision);
      this.snack.success('support.remote.settings.saved');
      this.ref.close(saved);
    } catch (error) {
      if (errorStatus(error) === 409) {
        // Someone else saved first: show their value and let the user decide again.
        await this.load();
        this.snack.error('support.remote.error.revision');
      } else {
        this.snack.error(assistRequestErrorKey(error) || 'support.remote.settings.saveFailed');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
