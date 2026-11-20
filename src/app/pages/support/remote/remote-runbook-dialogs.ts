import { REMOTE_CONTEXT, REMOTE_DIALOG_CONTEXT } from './remote-context';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';

import { SnackbarService } from '../../../services/snackbar.service';
import { FieldHelpComponent } from '../../../shared/forms/field-help';
import { FieldInvalidDirective } from '../../../shared/forms/field-invalid.directive';
import { FieldRules } from '../../../shared/forms/field-validation';
import { injectRevealInvalidFields } from '../../../shared/forms/reveal-invalid-fields';
import { shellDialectFor } from '../../network/network-options';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import {
  RUNBOOK_DIALECTS,
  RUNBOOK_LIMITS,
  RUNBOOK_PARAM_TYPES,
  RUNBOOK_STATUSES,
  RUNBOOK_STEP_KINDS,
  RemoteRunbookService,
  RunMode,
  RunbookDefinition,
  RunbookDialect,
  RunbookParamType,
  RunbookStatus,
  RunbookStepKind,
  credentialLabel,
  definitionOf,
  definitionProblems,
  emptyStep,
  joinLines,
  paramFormErrors,
  passwordCredentials,
  rollbackAllowed,
  runParamValues,
  runbookParams,
  runbookRequestErrorKey,
  splitLines,
} from './remote-runbook';
import { RemoteRecord, text } from './remote-session';

const DIALOG_STYLES = `
  .fields {
    display: grid;
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }
  h3 {
    margin: 12px 0 4px;
    font-size: 0.9375rem;
  }
  .meta {
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.8125rem;
    overflow-wrap: anywhere;
  }
  .block {
    border: 1px solid var(--mat-sys-outline-variant, #ccc);
    border-radius: 10px;
    padding: 8px 10px;
    margin-bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
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
  .problems {
    margin: 4px 0;
    padding: 8px 12px 8px 28px;
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--mat-sys-error-container, #f9dedc);
    color: var(--mat-sys-on-error-container, #410e0b);
  }
  textarea {
    font-family: monospace;
  }
`;

type EditStep = {
  title: string;
  kind: RunbookStepKind;
  commands: string;
  verify: string;
  rollback: string;
};

/* ---------------------------------------------------------------- runbook editor */

export type RunbookEditorData = { record: RemoteRecord | null };

/** Create/edit a runbook: header fields plus the params, pre-conditions and steps editors. */
@Component({
  selector: 'mns-support-remote-runbook-dialog',
  standalone: true,
  providers: [REMOTE_DIALOG_CONTEXT, RemoteRunbookService],
  imports: [
    FieldHelpComponent,
    FieldInvalidDirective,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
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
              (data.record
                ? 'support.remote.runbooks.editTitle'
                : 'support.remote.runbooks.createTitle'
              ) | transloco
            }}
          </h2>
          <p>{{ 'support.remote.runbooks.dialogDescription' | transloco }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.runbooks.field.name' | transloco }}</mat-label>
              <input
                matInput
                name="name"
                [attr.maxlength]="limits.name"
                [mnsInvalid]="rules.invalid('name')"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
              />
              <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
            </mat-form-field>
            <div class="two">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'support.remote.runbooks.field.dialect' | transloco }}</mat-label>
                <mat-select [value]="dialect()" (valueChange)="dialect.set($event)">
                  @for (item of dialects; track item) {
                    <mat-option [value]="item">{{
                      'support.remote.runbooks.dialect.' + item | transloco
                    }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'support.remote.runbooks.field.status' | transloco }}</mat-label>
                <mat-select [value]="status()" (valueChange)="status.set($event)">
                  @for (item of statuses; track item) {
                    <mat-option [value]="item">{{
                      'support.remote.runbooks.status.' + item | transloco
                    }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.runbooks.field.description' | transloco }}</mat-label>
              <textarea
                matInput
                rows="4"
                [attr.maxlength]="limits.description"
                [ngModel]="description()"
                (ngModelChange)="description.set($event)"
              ></textarea>
              <mns-field-help
                matIconSuffix
                [label]="'support.remote.runbooks.field.description' | transloco"
                [text]="
                  'support.remote.runbooks.placeholderHelp'
                    | transloco: { example: placeholderExample }
                "
              />
            </mat-form-field>

            <h3>{{ 'support.remote.runbooks.params' | transloco }}</h3>
            @for (param of params(); track $index) {
              <div class="block">
                <div class="two">
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.param.name' | transloco }}</mat-label>
                    <input
                      matInput
                      maxlength="32"
                      [ngModel]="param.name"
                      [mnsInvalid]="rules.invalid('definition') && !paramNameValid(param.name)"
                      (ngModelChange)="patchParam($index, { name: $event })"
                    />
                    <mns-field-help
                      matIconSuffix
                      [label]="'support.remote.runbooks.param.name' | transloco"
                      [text]="'support.remote.runbooks.paramsHelp' | transloco"
                    />
                    <mat-error>{{
                      'support.remote.runbooks.problem.params' | transloco
                    }}</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.param.label' | transloco }}</mat-label>
                    <input
                      matInput
                      maxlength="80"
                      [mnsInvalid]="rules.invalid('definition') && !param.label.trim()"
                      [ngModel]="param.label"
                      (ngModelChange)="patchParam($index, { label: $event })"
                    />
                    <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.param.type' | transloco }}</mat-label>
                    <mat-select
                      [value]="param.type"
                      (valueChange)="patchParam($index, { type: $event })"
                    >
                      @for (item of paramTypes; track item) {
                        <mat-option [value]="item">{{
                          'support.remote.runbooks.paramType.' + item | transloco
                        }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <div class="block-head">
                  <mat-checkbox
                    [checked]="param.required"
                    (change)="patchParam($index, { required: $event.checked })"
                    >{{ 'support.remote.runbooks.param.required' | transloco }}</mat-checkbox
                  >
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="'support.remote.runbooks.remove' | transloco"
                    (click)="removeParam($index)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }
            <div>
              <button
                mat-stroked-button
                type="button"
                [disabled]="params().length >= limits.params"
                (click)="addParam()"
              >
                <mat-icon>add</mat-icon> {{ 'support.remote.runbooks.addParam' | transloco }}
              </button>
            </div>

            <h3>{{ 'support.remote.runbooks.preconditions' | transloco }}</h3>
            @for (pre of preconditions(); track $index) {
              <div class="block">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'support.remote.runbooks.pre.command' | transloco }}</mat-label>
                  <input
                    matInput
                    [mnsInvalid]="rules.invalid('definition') && !pre.command.trim()"
                    [ngModel]="pre.command"
                    (ngModelChange)="patchPre($index, { command: $event })"
                  />
                  <mns-field-help
                    matIconSuffix
                    [label]="'support.remote.runbooks.pre.command' | transloco"
                    [text]="'support.remote.runbooks.preconditionsHelp' | transloco"
                  />
                  <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'support.remote.runbooks.pre.contains' | transloco }}</mat-label>
                  <input
                    matInput
                    [attr.maxlength]="limits.contains"
                    [mnsInvalid]="rules.invalid('definition') && !pre.contains.trim()"
                    [ngModel]="pre.contains"
                    (ngModelChange)="patchPre($index, { contains: $event })"
                  />
                  <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                </mat-form-field>
                <div class="block-head">
                  <mat-checkbox
                    [checked]="pre.negate"
                    (change)="patchPre($index, { negate: $event.checked })"
                    >{{ 'support.remote.runbooks.pre.negate' | transloco }}</mat-checkbox
                  >
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="'support.remote.runbooks.remove' | transloco"
                    (click)="removePre($index)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
            }
            <div>
              <button
                mat-stroked-button
                type="button"
                [disabled]="preconditions().length >= limits.preconditions"
                (click)="addPre()"
              >
                <mat-icon>add</mat-icon> {{ 'support.remote.runbooks.addPre' | transloco }}
              </button>
            </div>

            <h3>{{ 'support.remote.runbooks.steps' | transloco }}</h3>
            @for (step of steps(); track $index) {
              <div class="block">
                <div class="block-head">
                  <strong>{{
                    'support.remote.runbooks.stepNumber' | transloco: { number: $index + 1 }
                  }}</strong>
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="'support.remote.runbooks.remove' | transloco"
                    (click)="removeStep($index)"
                  >
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
                <div class="two">
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.step.title' | transloco }}</mat-label>
                    <input
                      matInput
                      [attr.maxlength]="limits.stepTitle"
                      [mnsInvalid]="rules.invalid('definition') && !step.title.trim()"
                      [ngModel]="step.title"
                      (ngModelChange)="patchStep($index, { title: $event })"
                    />
                    <mns-field-help
                      matIconSuffix
                      [label]="'support.remote.runbooks.step.title' | transloco"
                      [text]="'support.remote.runbooks.stepsHelp' | transloco"
                    />
                    <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.step.kind' | transloco }}</mat-label>
                    <mat-select
                      [value]="step.kind"
                      (valueChange)="patchStep($index, { kind: $event })"
                    >
                      @for (item of stepKinds; track item) {
                        <mat-option [value]="item">{{
                          'support.remote.runbooks.stepKind.' + item | transloco
                        }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'support.remote.runbooks.step.commands' | transloco }}</mat-label>
                  <textarea
                    matInput
                    rows="4"
                    [mnsInvalid]="rules.invalid('definition') && !step.commands.trim()"
                    [ngModel]="step.commands"
                    (ngModelChange)="patchStep($index, { commands: $event })"
                  ></textarea>
                  <mns-field-help
                    matIconSuffix
                    [label]="'support.remote.runbooks.step.commands' | transloco"
                    [text]="'support.remote.runbooks.step.commandsHelp' | transloco"
                  />
                  <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                </mat-form-field>
                @if (step.kind === 'change') {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.step.verify' | transloco }}</mat-label>
                    <textarea
                      matInput
                      rows="4"
                      [mnsInvalid]="rules.invalid('definition') && !step.verify.trim()"
                      [ngModel]="step.verify"
                      (ngModelChange)="patchStep($index, { verify: $event })"
                    ></textarea>
                    <mns-field-help
                      matIconSuffix
                      [label]="'support.remote.runbooks.step.verify' | transloco"
                      [text]="'support.remote.runbooks.step.verifyHelp' | transloco"
                    />
                    <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                  </mat-form-field>
                }
                @if (rollbackShown(step)) {
                  <mat-form-field appearance="outline">
                    <mat-label>{{ 'support.remote.runbooks.step.rollback' | transloco }}</mat-label>
                    <textarea
                      matInput
                      rows="4"
                      [mnsInvalid]="rules.invalid('definition') && !step.rollback.trim()"
                      [ngModel]="step.rollback"
                      (ngModelChange)="patchStep($index, { rollback: $event })"
                    ></textarea>
                    <mns-field-help
                      matIconSuffix
                      [label]="'support.remote.runbooks.step.rollback' | transloco"
                      [text]="'support.remote.runbooks.step.rollbackHelp' | transloco"
                    />
                    <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
                  </mat-form-field>
                }
              </div>
            }
            <div>
              <button
                mat-stroked-button
                type="button"
                [disabled]="steps().length >= limits.steps"
                (click)="addStep()"
              >
                <mat-icon>add</mat-icon> {{ 'support.remote.runbooks.addStep' | transloco }}
              </button>
            </div>
            @if (data.record) {
              <div class="note" role="note">
                <mat-icon>info</mat-icon>
                <span>{{ 'support.remote.runbooks.versionHelp' | transloco }}</span>
              </div>
            }
            @if (rules.invalid('definition')) {
              <ul class="problems" role="alert">
                @for (key of problems(); track key) {
                  <li>{{ key | transloco }}</li>
                }
              </ul>
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
          <!-- required-feedback-exempt: the full record is still loading -->
          <button mat-flat-button type="button" [disabled]="saving() || !loaded()" (click)="save()">
            {{ 'Save' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteRunbookDialogComponent {
  readonly context = inject(REMOTE_CONTEXT);
  readonly data = inject<RunbookEditorData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<SupportRemoteRunbookDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(RemoteRunbookService);
  private readonly snack = inject(SnackbarService);

  readonly limits = RUNBOOK_LIMITS;
  /** Literal braces cannot be written in a translation (interpolation): passed as a parameter. */
  readonly placeholderExample = '{{' + 'name' + '}}';
  readonly dialects = RUNBOOK_DIALECTS;
  readonly statuses = RUNBOOK_STATUSES;
  readonly paramTypes = RUNBOOK_PARAM_TYPES;
  readonly stepKinds = RUNBOOK_STEP_KINDS;

  readonly name = signal('');
  readonly description = signal('');
  readonly dialect = signal<RunbookDialect>('routeros');
  readonly status = signal<RunbookStatus>('draft');
  readonly params = signal<RunbookDefinition['params']>([]);
  readonly preconditions = signal<RunbookDefinition['preconditions']>([]);
  readonly steps = signal<EditStep[]>([]);
  readonly saving = signal(false);
  /** The full record (steps included) is loaded; Save stays off until then. */
  readonly loaded = signal(false);
  private readonly revision = signal(0);
  readonly problems = computed(() => definitionProblems(this.definition()));
  /** Required Field Feedback Baseline: invalid fields turn red and are named on Save. */
  readonly rules = new FieldRules({
    name: () => !!this.name().trim(),
    definition: () => this.problems().length === 0,
  });
  private readonly revealInvalid = injectRevealInvalidFields();

  constructor() {
    // The list row carries no steps and may be stale: edit only the full record read now.
    const record = this.data.record;
    if (!record) {
      this.apply(null);
      this.loaded.set(true);
      return;
    }
    void this.service
      .get(text(record['SrbUUID']))
      .then((full) => {
        this.apply(full);
        this.revision.set(Number(full['SrbRevision']));
        this.loaded.set(true);
      })
      .catch(() => {
        this.snack.error('support.remote.runbooks.loadFailed');
        this.ref.close(false);
      });
  }

  private apply(source: RemoteRecord | null) {
    const def = definitionOf(source);
    this.name.set(def.name);
    this.description.set(def.description ?? '');
    this.dialect.set(def.dialect);
    this.status.set(def.status);
    this.params.set(def.params);
    this.preconditions.set(def.preconditions);
    this.steps.set(
      def.steps.map((step) => ({
        title: step.title,
        kind: step.kind,
        commands: joinLines(step.commands),
        verify: joinLines(step.verify),
        rollback: joinLines(step.rollback),
      })),
    );
  }

  paramNameValid(value: string): boolean {
    return /^[a-z][a-z0-9_]{0,31}$/.test(value);
  }

  rollbackShown(step: EditStep): boolean {
    return rollbackAllowed(this.dialect(), step.kind);
  }

  definition(): RunbookDefinition {
    return {
      name: this.name(),
      description: this.description() || null,
      dialect: this.dialect(),
      status: this.status(),
      params: this.params(),
      preconditions: this.preconditions(),
      steps: this.steps().map((step) => ({
        title: step.title,
        kind: step.kind,
        commands: splitLines(step.commands),
        verify: splitLines(step.verify),
        rollback: splitLines(step.rollback),
      })),
    };
  }

  addParam() {
    this.params.update((rows) => [...rows, { name: '', label: '', type: 'word', required: true }]);
  }
  patchParam(
    index: number,
    patch: Partial<RunbookDefinition['params'][number]> & { type?: RunbookParamType },
  ) {
    this.params.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  removeParam(index: number) {
    this.params.update((rows) => rows.filter((_, i) => i !== index));
  }

  addPre() {
    this.preconditions.update((rows) => [...rows, { command: '', contains: '', negate: false }]);
  }
  patchPre(index: number, patch: Partial<RunbookDefinition['preconditions'][number]>) {
    this.preconditions.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }
  removePre(index: number) {
    this.preconditions.update((rows) => rows.filter((_, i) => i !== index));
  }

  addStep() {
    const step = emptyStep();
    this.steps.update((rows) => [
      ...rows,
      { title: '', kind: step.kind, commands: '', verify: '', rollback: '' },
    ]);
  }
  patchStep(index: number, patch: Partial<EditStep>) {
    this.steps.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  removeStep(index: number) {
    this.steps.update((rows) => rows.filter((_, i) => i !== index));
  }

  async save() {
    if (this.saving() || !this.loaded()) return;
    if (!this.rules.check()) return this.revealInvalid();
    this.saving.set(true);
    try {
      const record = this.data.record;
      if (record) {
        await this.service.update(text(record['SrbUUID']), this.revision(), this.definition());
      } else {
        await this.service.create(this.definition());
      }
      this.snack.success('support.remote.runbooks.saved');
      this.ref.close(true);
    } catch (error) {
      this.snack.error(runbookRequestErrorKey(error) || 'support.remote.runbooks.saveFailed', 7000);
    } finally {
      this.saving.set(false);
    }
  }
}

/* ---------------------------------------------------------------- run a runbook */

export type RunRunbookData = {
  sessionUUID: string;
  deviceUUID: string;
  deviceName: string;
  /** Device type code (`NwdVendorType`) and OS version: the shell dialect comes from the catalog. */
  vendorType: string;
  osVersion: string;
  canAutonomous: boolean;
  runbookUUID?: string;
  params?: Record<string, string>;
};

/** "Rodar runbook": pick a runbook, fill the parameters (validated by type) and choose the mode. */
@Component({
  selector: 'mns-support-remote-run-dialog',
  standalone: true,
  providers: [REMOTE_DIALOG_CONTEXT, RemoteRunbookService],
  imports: [
    FieldHelpComponent,
    FieldInvalidDirective,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'support.remote.runbooks.run.title' | transloco }}</h2>
          <p>
            {{ 'support.remote.runbooks.run.description' | transloco: { device: data.deviceName } }}
          </p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'support.remote.runbooks.run.runbook' | transloco }}</mat-label>
              <mat-select
                [disabled]="loading()"
                [mnsInvalid]="rules.invalid('runbook')"
                [value]="runbookUUID()"
                (valueChange)="pick($event)"
              >
                @for (item of runbooks(); track item['SrbUUID']) {
                  <mat-option [value]="item['SrbUUID']">
                    {{ item['SrbName'] }} ·
                    {{ 'support.remote.runbooks.dialect.' + item['SrbDialect'] | transloco }}
                  </mat-option>
                }
              </mat-select>
              <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
            </mat-form-field>
            @if (!loading() && !runbooks().length) {
              <p class="meta" role="status">{{ 'support.remote.runbooks.run.none' | transloco }}</p>
            }
            @if (selected(); as current) {
              @if (current['SrbDescription']) {
                <p class="meta" data-report-mask>{{ current['SrbDescription'] }}</p>
              }
              @for (param of selectedParams(); track param.name) {
                <mat-form-field appearance="outline">
                  <mat-label>{{ param.label || param.name }}</mat-label>
                  <input
                    matInput
                    [attr.name]="param.name"
                    [required]="param.required"
                    [mnsInvalid]="rules.invalid('params') && !!errors()[param.name]"
                    [ngModel]="values()[param.name] ?? ''"
                    (ngModelChange)="setValue(param.name, $event)"
                  />
                  <mns-field-help
                    matIconSuffix
                    [label]="param.label || param.name"
                    [text]="'support.remote.runbooks.paramType.' + param.type | transloco"
                  />
                  <mat-error>{{
                    errors()[param.name] || 'support.remote.field.required' | transloco
                  }}</mat-error>
                </mat-form-field>
              }
              <mat-form-field appearance="outline">
                <mat-label>{{ 'support.remote.runbooks.run.mode' | transloco }}</mat-label>
                <mat-select [value]="mode()" (valueChange)="mode.set($event)">
                  <mat-option value="supervised">{{
                    'support.remote.runbooks.mode.supervised' | transloco
                  }}</mat-option>
                  <mat-option value="autonomous" [disabled]="!autonomousAllowed()">{{
                    'support.remote.runbooks.mode.autonomous' | transloco
                  }}</mat-option>
                </mat-select>
                <mns-field-help
                  matIconSuffix
                  [label]="'support.remote.runbooks.run.mode' | transloco"
                  [text]="modeHelpKey() | transloco"
                />
              </mat-form-field>
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
          <!-- required-feedback-exempt: the request is already running -->
          <button mat-flat-button type="button" [disabled]="busy()" (click)="start()">
            {{ 'support.remote.runbooks.run.start' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteRunDialogComponent {
  readonly context = inject(REMOTE_CONTEXT);
  readonly data = inject<RunRunbookData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<SupportRemoteRunDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(RemoteRunbookService);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly runbooks = signal<RemoteRecord[]>([]);
  readonly runbookUUID = signal('');
  readonly values = signal<Record<string, string>>({});
  readonly mode = signal<RunMode>('supervised');

  readonly selected = computed(
    () => this.runbooks().find((row) => text(row['SrbUUID']) === this.runbookUUID()) ?? null,
  );
  readonly selectedParams = computed(() => runbookParams(this.selected()));
  readonly errors = computed(() => paramFormErrors(this.selectedParams(), this.values()));
  /** Required Field Feedback Baseline: runbook and parameters turn red on Start. */
  readonly rules = new FieldRules({
    runbook: () => !!this.runbookUUID(),
    params: () => Object.keys(this.errors()).length === 0,
  });
  private readonly revealInvalid = injectRevealInvalidFields();
  /** Autonomy needs the permission and a runbook that earned it (the API checks both again). */
  readonly autonomousAllowed = computed(() => {
    const row = this.selected();
    return (
      this.data.canAutonomous &&
      !!row &&
      (Number(row['SrbAutonomous']) === 1 || row['SrbAutonomous'] === true)
    );
  });
  readonly modeHelpKey = computed(() =>
    this.mode() === 'autonomous'
      ? 'support.remote.runbooks.run.autonomousHelp'
      : this.autonomousAllowed()
        ? 'support.remote.runbooks.run.supervisedHelp'
        : 'support.remote.runbooks.run.autonomousUnavailable',
  );

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      // The dialect of the device comes from the device type catalog; unknown lists every runbook.
      const types = await this.service.deviceTypes().catch(() => []);
      const dialect = shellDialectFor(
        types.find((type) => type.code === this.data.vendorType),
        this.data.osVersion,
      );
      const rows = await this.service.list({
        status: 'active',
        ...(dialect ? { dialect } : {}),
      });
      this.runbooks.set(rows);
      const preset = this.data.runbookUUID ?? '';
      if (preset && rows.some((row) => text(row['SrbUUID']) === preset)) {
        this.runbookUUID.set(preset);
        this.values.set({ ...(this.data.params ?? {}) });
      }
    } catch {
      this.snack.error('support.remote.runbooks.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  pick(uuid: string) {
    this.runbookUUID.set(uuid);
    this.values.set({});
    this.mode.set('supervised');
  }

  setValue(name: string, value: string) {
    this.values.update((current) => ({ ...current, [name]: value }));
  }

  async start() {
    if (this.busy()) return;
    if (!this.rules.check()) return this.revealInvalid();
    const runbook = this.selected();
    if (!runbook) return;
    this.busy.set(true);
    try {
      await this.service.startRun(this.data.sessionUUID, {
        runbookUUID: text(runbook['SrbUUID']),
        deviceUUID: this.data.deviceUUID,
        params: runParamValues(this.selectedParams(), this.values()),
        mode: this.autonomousAllowed() ? this.mode() : 'supervised',
      });
      this.snack.success('support.remote.runbooks.run.started');
      this.ref.close(true);
    } catch (error) {
      this.snack.error(runbookRequestErrorKey(error) || 'support.remote.runbooks.run.failed', 7000);
    } finally {
      this.busy.set(false);
    }
  }
}

/* ---------------------------------------------------------------- credential rotation */

export type RotateData = {
  sessionUUID: string;
  deviceUUID: string;
  deviceName: string;
  /** The session is level N3, the only level the gateway accepts for a rotation. */
  levelOk: boolean;
};

/** "Gerar nova senha": explains the flow, picks the password credential when there are several. */
@Component({
  selector: 'mns-support-remote-rotate-dialog',
  standalone: true,
  providers: [REMOTE_DIALOG_CONTEXT, RemoteRunbookService],
  imports: [
    FieldInvalidDirective,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
    ReportProblemButtonComponent,
    TranslocoPipe,
  ],
  styles: [DIALOG_STYLES],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ 'support.remote.runbooks.rotate.title' | transloco }}</h2>
          <p>{{ data.deviceName }}</p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          <div class="fields">
            <p>{{ 'support.remote.runbooks.rotate.explain' | transloco }}</p>
            <ol class="meta">
              <li>{{ 'support.remote.runbooks.rotate.step1' | transloco }}</li>
              <li>{{ 'support.remote.runbooks.rotate.step2' | transloco }}</li>
              <li>{{ 'support.remote.runbooks.rotate.step3' | transloco }}</li>
              <li>{{ 'support.remote.runbooks.rotate.step4' | transloco }}</li>
            </ol>
            <div class="note" role="note">
              <mat-icon>shield</mat-icon>
              <span>{{ 'support.remote.runbooks.rotate.level' | transloco }}</span>
            </div>
            @if (!data.levelOk) {
              <p class="problems" role="alert">
                {{ 'support.remote.runbooks.error.rotationLevel' | transloco }}
              </p>
            }
            @if (loadFailed()) {
              <p class="problems" role="alert">
                {{ 'support.remote.runbooks.rotate.loadFailedUsesLogin' | transloco }}
              </p>
            } @else if (!loading() && !credentials().length) {
              <p class="problems" role="alert">
                {{ 'support.remote.runbooks.rotate.noPassword' | transloco }}
              </p>
            }
            @if (credentials().length > 1) {
              <mat-form-field appearance="outline">
                <mat-label>{{ 'support.remote.runbooks.rotate.credential' | transloco }}</mat-label>
                <mat-select
                  [mnsInvalid]="rules.invalid('credential')"
                  [value]="credentialUUID()"
                  (valueChange)="credentialUUID.set($event)"
                >
                  @for (item of credentials(); track item['NwcUUID']) {
                    <mat-option [value]="item['NwcUUID']">{{ label(item) }}</mat-option>
                  }
                </mat-select>
                <mat-error>{{ 'support.remote.field.required' | transloco }}</mat-error>
              </mat-form-field>
            } @else if (credentials().length === 1) {
              <p class="meta" data-report-mask>{{ label(credentials()[0]) }}</p>
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
          <!-- required-feedback-exempt: the session level (N3) or the load state blocks the action -->
          <button mat-flat-button type="button" [disabled]="!canStart()" (click)="start()">
            {{ 'support.remote.runbooks.rotate.confirm' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
})
export class SupportRemoteRotateDialogComponent {
  readonly context = inject(REMOTE_CONTEXT);
  readonly data = inject<RotateData>(MAT_DIALOG_DATA);
  readonly ref = inject<MatDialogRef<SupportRemoteRotateDialogComponent, boolean>>(MatDialogRef);
  private readonly service = inject(RemoteRunbookService);
  private readonly snack = inject(SnackbarService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  /** The credential list could not be read: the API then uses the login credential of the device. */
  readonly loadFailed = signal(false);
  readonly credentials = signal<RemoteRecord[]>([]);
  readonly credentialUUID = signal('');
  readonly label = credentialLabel;
  readonly rules = new FieldRules({
    credential: () => this.credentials().length < 2 || !!this.credentialUUID(),
  });
  private readonly revealInvalid = injectRevealInvalidFields();
  readonly canStart = computed(
    () =>
      this.data.levelOk &&
      !this.busy() &&
      !this.loading() &&
      (this.loadFailed() || this.credentials().length > 0),
  );

  constructor() {
    void this.load();
  }

  private async load() {
    try {
      const rows = passwordCredentials(await this.service.deviceCredentials(this.data.deviceUUID));
      this.credentials.set(rows);
      // One password: the API takes it by itself; several: the technician picks, primary first.
      const primary = rows.find((row) => Number(row['NwcIsPrimary']) === 1) ?? rows[0];
      if (primary) this.credentialUUID.set(text(primary['NwcUUID']));
    } catch {
      this.loadFailed.set(true);
      this.snack.error('support.remote.runbooks.rotate.loadFailed');
    } finally {
      this.loading.set(false);
    }
  }

  async start() {
    if (!this.canStart()) return;
    if (!this.rules.check()) return this.revealInvalid();
    this.busy.set(true);
    try {
      await this.service.startRotation(
        this.data.sessionUUID,
        this.data.deviceUUID,
        this.credentials().length > 1 ? this.credentialUUID() : null,
      );
      this.snack.success('support.remote.runbooks.rotate.started');
      this.ref.close(true);
    } catch (error) {
      this.snack.error(
        runbookRequestErrorKey(error) || 'support.remote.runbooks.rotate.failed',
        8000,
      );
    } finally {
      this.busy.set(false);
    }
  }
}
