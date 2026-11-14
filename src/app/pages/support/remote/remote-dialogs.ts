import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import { assistRequestErrorKey } from './remote-assistant';
import { REMOTE_LEVELS } from './remote-session';
import { REMOTE_LOOKUPS, RemoteLookupComponent, RemoteLookupSpec } from './remote-lookup';

/** Only the field grid is local: the dialog surface is the shared `crud-form-dialog` + `.crud-dialog`. */
const DIALOG_STYLES = `
  .fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
`;

/* ---------------------------------------------------------------- new session */

export type NewSessionResult = {
  title: string;
  level: string;
  customerUUID: string | null;
  ticketUUID: string | null;
  deviceUUIDs: string[];
};

/** `+ Nova`: title, level, optional customer and ticket, and the devices of the session. */
@Component({
  selector: 'mns-support-remote-new-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RemoteLookupComponent,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'support.remote.new.title' | transloco }}</h2>
          <p>{{ 'support.remote.new.description' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.field.title' | transloco }}</mat-label>
              <input
                matInput
                name="title"
                maxlength="160"
                required
                [ngModel]="title()"
                (ngModelChange)="title.set($event)"
              />
              @if (touched() && !title().trim()) {
                <mat-error>{{ 'support.remote.field.titleRequired' | transloco }}</mat-error>
              }
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.field.level' | transloco }}</mat-label>
              <mat-select [value]="level()" (valueChange)="level.set($event)">
                @for (item of levels(); track item) {
                  <mat-option [value]="item">{{
                    'support.remote.level.' + item | transloco
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mns-remote-lookup
              [label]="'support.remote.field.customer' | transloco"
              [spec]="lookups.customer"
              [value]="customer()"
              (valueChange)="customer.set($any($event) ?? '')"
            />
            <mns-remote-lookup
              [label]="'support.remote.field.ticket' | transloco"
              [spec]="lookups.ticket"
              [value]="ticket()"
              (valueChange)="ticket.set($any($event) ?? '')"
            />
            <mns-remote-lookup
              [label]="'support.remote.field.devices' | transloco"
              [spec]="lookups.device"
              [multiple]="true"
              [value]="devices()"
              (valueChange)="devices.set($any($event) ?? [])"
            />
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
          <button mat-flat-button type="button" (click)="submit()">
            {{ 'support.remote.new.create' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteNewDialogComponent {
  readonly ref =
    inject<MatDialogRef<SupportRemoteNewDialogComponent, NewSessionResult>>(MatDialogRef);
  private readonly auth = inject(AuthService);
  readonly lookups = REMOTE_LOOKUPS;
  readonly title = signal('');
  readonly level = signal('n1');
  readonly customer = signal<string>('');
  readonly ticket = signal<string>('');
  readonly devices = signal<string[]>([]);
  readonly touched = signal(false);
  /** UX only: the API refuses a level the user lacks. */
  readonly levels = computed(() => {
    const permissions = this.auth.user()?.permissions ?? [];
    const allowed = REMOTE_LEVELS.filter((item) =>
      hasEffectivePermission(permissions, `tenant.support.remote.level.${item}`),
    );
    return allowed.length ? allowed : ['n1'];
  });

  submit() {
    this.touched.set(true);
    const title = this.title().trim();
    if (!title) return;
    this.ref.close({
      title,
      level: this.level(),
      customerUUID: this.customer() || null,
      ticketUUID: this.ticket() || null,
      deviceUUIDs: this.devices(),
    });
  }
}

/* ---------------------------------------------------------------- prompt */

export type PromptData = {
  title: string;
  description?: string;
  confirm: string;
  lookup?: { label: string; spec: RemoteLookupSpec; exclude?: readonly string[] };
  text?: { label: string; required: boolean; max: number };
  /** Draft of the text field by the AI copilot (close dialog); fills the field, never submits. */
  aiSummary?: () => Promise<string>;
};
export type PromptResult = { uuid: string; text: string };

/** One lookup and/or one text: transfer, add supervisor, add device, close with summary. */
@Component({
  selector: 'mns-support-remote-prompt-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RemoteLookupComponent,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ data.title | transloco }}</h2>
          @if (data.description) {
            <p>{{ data.description | transloco }}</p>
          }
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            @if (data.lookup; as lookup) {
              <mns-remote-lookup
                [label]="lookup.label | transloco"
                [spec]="lookup.spec"
                [required]="true"
                [exclude]="lookup.exclude ?? []"
                [invalid]="touched() && !uuid()"
                [value]="uuid()"
                (valueChange)="uuid.set($any($event) ?? '')"
              />
            }
            @if (data.text; as field) {
              <mat-form-field appearance="outline">
                <mat-label>{{ field.label | transloco }}</mat-label>
                <textarea
                  matInput
                  rows="4"
                  [attr.maxlength]="field.max"
                  [ngModel]="body()"
                  (ngModelChange)="body.set($event)"
                ></textarea>
                @if (touched() && field.required && !body().trim()) {
                  <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                }
              </mat-form-field>
              @if (data.aiSummary) {
                <div>
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="generating()"
                    (click)="generate()"
                  >
                    <mat-icon>auto_awesome</mat-icon>
                    {{
                      (generating()
                        ? 'support.remote.ai.summaryGenerating'
                        : 'support.remote.ai.summaryButton'
                      ) | transloco
                    }}
                  </button>
                </div>
              }
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
          <button mat-flat-button type="button" (click)="submit()">
            {{ data.confirm | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemotePromptDialogComponent {
  readonly data = inject<PromptData>(MAT_DIALOG_DATA);
  readonly ref =
    inject<MatDialogRef<SupportRemotePromptDialogComponent, PromptResult>>(MatDialogRef);
  readonly uuid = signal('');
  readonly body = signal('');
  readonly touched = signal(false);
  readonly generating = signal(false);
  private readonly snack = inject(SnackbarService);

  async generate() {
    const draft = this.data.aiSummary;
    if (!draft || this.generating()) return;
    this.generating.set(true);
    try {
      const summary = await draft();
      if (summary) this.body.set(summary.slice(0, this.data.text?.max ?? 4000));
      else this.snack.error('support.remote.ai.summaryEmpty', 6000);
    } catch (error) {
      this.snack.error(assistRequestErrorKey(error) || 'support.remote.ai.summaryFailed', 6000);
    } finally {
      this.generating.set(false);
    }
  }

  submit() {
    this.touched.set(true);
    if (this.data.lookup && !this.uuid()) return;
    if (this.data.text?.required && !this.body().trim()) return;
    this.ref.close({ uuid: this.uuid(), text: this.body().trim() });
  }
}
