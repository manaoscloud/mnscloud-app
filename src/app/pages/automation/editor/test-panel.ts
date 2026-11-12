import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  Dict,
  FlowGraph,
  SimMessage,
  TestContact,
  TraceStep,
  stateVariables,
} from '../automation-adapter';
import { AutomationService } from '../automation.service';

export interface ChatLine {
  author: string;
  text: string;
  options: string[];
}

/** Lines of the simulator chat: what the contact typed and what the flow answered. */
export function chatLines(
  existing: readonly ChatLine[],
  typed: string | null,
  replies: readonly SimMessage[],
): ChatLine[] {
  return [
    ...existing,
    ...(typed ? [{ author: 'contact', text: typed, options: [] }] : []),
    ...replies.map((message) => ({
      author: message.author,
      text: message.text,
      options: message.options,
    })),
  ];
}

/** Simulator of the draft: chat, step trace and variables, with no side effects. */
@Component({
  selector: 'app-automation-test-panel',
  standalone: true,
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      min-height: 0;
    }
    .tp-chat {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-height: 320px;
      min-height: 120px;
      overflow: auto;
      padding: 0.75rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-color-surface-container);
    }
    .tp-bubble {
      max-width: 85%;
      padding: 0.5rem 0.75rem;
      border-radius: 1rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      background: var(--mat-sys-color-surface-container-highest);
    }
    .tp-bubble.contact {
      align-self: flex-end;
      background: var(--mat-sys-color-primary-container);
      color: var(--mat-sys-color-on-primary-container);
    }
    .tp-options {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      margin-top: 0.5rem;
    }
    .tp-send {
      display: flex;
      gap: 0.5rem;
      align-items: flex-start;
    }
    .tp-send mat-form-field {
      flex: 1;
    }
    h4 {
      margin: 0.5rem 0 0.25rem;
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--mat-sys-color-on-surface-variant);
    }
    .tp-trace,
    .tp-vars {
      display: grid;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 0.8125rem;
    }
    .tp-step {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0 0.5rem;
      align-items: baseline;
      padding: 0.25rem 0.5rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-color-surface-container-low);
    }
    .tp-step.error {
      background: var(--mat-sys-color-error-container);
      color: var(--mat-sys-color-on-error-container);
    }
    .tp-step-summary {
      grid-column: 2 / 4;
      color: var(--mat-sys-color-on-surface-variant);
      overflow-wrap: anywhere;
    }
    .tp-badge {
      padding: 0 0.375rem;
      border-radius: 0.5rem;
      font-size: 0.6875rem;
      background: var(--mat-sys-color-tertiary-container);
      color: var(--mat-sys-color-on-tertiary-container);
    }
    .tp-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .tp-var-name {
      font-family: monospace;
      margin-right: 0.5rem;
    }
    .tp-status {
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.8125rem;
    }
  `,
  template: `
    <div class="tp-chips">
      <button mat-flat-button type="button" [disabled]="busy()" (click)="start()">
        <mat-icon>play_arrow</mat-icon>
        {{ (started() ? 'automation.test.restart' : 'automation.test.start') | transloco }}
      </button>
      @if (started()) {
        <button mat-stroked-button type="button" (click)="reset()">
          {{ 'automation.test.reset' | transloco }}
        </button>
      }
    </div>

    <div class="tp-chat" role="log" [attr.aria-label]="'automation.test.chat' | transloco">
      @for (line of lines(); track $index) {
        <div class="tp-bubble" [class.contact]="line.author === 'contact'">
          {{ line.text }}
          @if (line.options.length && $last && waiting()) {
            <div class="tp-options">
              @for (option of line.options; track option) {
                <button mat-stroked-button type="button" (click)="send(option)">
                  {{ option }}
                </button>
              }
            </div>
          }
        </div>
      } @empty {
        <span class="tp-status">{{ 'automation.test.empty' | transloco }}</span>
      }
    </div>

    @if (started()) {
      @if (done()) {
        <span class="tp-status">{{ 'automation.test.done' | transloco }}</span>
      } @else if (waiting()) {
        <div class="tp-send">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'automation.test.message' | transloco }}</mat-label>
            <input matInput [(ngModel)]="draft" (keydown.enter)="send(draft)" [disabled]="busy()" />
          </mat-form-field>
          <button
            mat-icon-button
            type="button"
            [disabled]="busy()"
            [attr.aria-label]="'automation.test.send' | transloco"
            [matTooltip]="'automation.test.send' | transloco"
            (click)="send(draft)"
          >
            <mat-icon>send</mat-icon>
          </button>
        </div>
      }
    }

    <h4>{{ 'automation.test.trace' | transloco }}</h4>
    <ol class="tp-trace">
      @for (step of trace(); track step.seq) {
        <li class="tp-step" [class.error]="step.result === 'error'">
          <span>{{ step.seq }}</span>
          <span
            >{{ step.nodeType }} <small>{{ step.nodeId }}</small>
            @if (step.port) {
              → {{ step.port }}
            }
            @if (step.simulated) {
              <span class="tp-badge">{{ 'automation.test.simulated' | transloco }}</span>
            }
          </span>
          <span>{{ step.durationMs }} ms</span>
          @if (step.summary) {
            <span class="tp-step-summary">{{ step.summary }}</span>
          }
        </li>
      } @empty {
        <li class="tp-status">{{ 'automation.test.noTrace' | transloco }}</li>
      }
    </ol>

    <h4>{{ 'automation.test.variables' | transloco }}</h4>
    <ul class="tp-vars">
      @for (variable of variables(); track variable.name) {
        <li>
          <span class="tp-var-name">{{ variable.name }}</span>{{ variable.value }}
        </li>
      } @empty {
        <li class="tp-status">{{ 'automation.test.noVariables' | transloco }}</li>
      }
    </ul>

    <h4>{{ 'automation.test.contacts' | transloco }}</h4>
    <p class="tp-status">{{ 'automation.test.contactsHint' | transloco }}</p>
    <div class="tp-chips">
      @for (uuid of testContacts(); track uuid) {
        <button
          mat-stroked-button
          type="button"
          [attr.aria-pressed]="simContact() === uuid"
          [matTooltip]="'automation.test.useContact' | transloco"
          (click)="simContact.set(simContact() === uuid ? '' : uuid)"
        >
          @if (simContact() === uuid) {
            <mat-icon>check</mat-icon>
          }
          {{ contactName(uuid) }}
        </button>
        @if (canEdit()) {
          <button
            mat-icon-button
            type="button"
            [attr.aria-label]="'automation.inspector.remove' | transloco"
            (click)="removeContact(uuid)"
          >
            <mat-icon>close</mat-icon>
          </button>
        }
      }
    </div>
    @if (canEdit()) {
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'automation.test.addContact' | transloco }}</mat-label>
        <input
          matInput
          [matAutocomplete]="auto"
          [ngModel]="contactQuery()"
          (ngModelChange)="searchContacts($event)"
        />
        <mat-autocomplete
          #auto="matAutocomplete"
          (optionSelected)="addContact($event.option.value)"
        >
          @for (contact of found(); track contact.uuid) {
            <mat-option [value]="contact.uuid"
              >{{ contact.name }} <small>{{ contact.detail }}</small></mat-option
            >
          }
        </mat-autocomplete>
      </mat-form-field>
    }
  `,
})
export class AutomationTestPanel {
  private readonly service = inject(AutomationService);

  readonly flowUUID = input.required<string>();
  readonly graph = input.required<FlowGraph>();
  readonly testContacts = input<string[]>([]);
  readonly canEdit = input(false);
  readonly contactsChange = output<string[]>();
  /** Node ids visited by the last simulation (the canvas highlights them). */
  readonly visited = output<string[]>();

  readonly lines = signal<ChatLine[]>([]);
  readonly trace = signal<TraceStep[]>([]);
  readonly state = signal<Dict>({});
  readonly started = signal(false);
  readonly done = signal(false);
  readonly waiting = signal(false);
  readonly busy = signal(false);
  readonly simContact = signal('');
  readonly contactQuery = signal('');
  readonly found = signal<TestContact[]>([]);
  readonly variables = computed(() => stateVariables(this.state()));
  private readonly names = new Map<string, string>();
  draft = '';

  constructor() {
    // A new flow starts with a clean simulation.
    effect(() => {
      this.flowUUID();
      this.reset();
    });
  }

  contactName(uuid: string): string {
    return this.names.get(uuid) ?? uuid.slice(0, 8);
  }

  reset(): void {
    this.lines.set([]);
    this.trace.set([]);
    this.state.set({});
    this.started.set(false);
    this.done.set(false);
    this.waiting.set(false);
    this.draft = '';
    this.visited.emit([]);
  }

  async start(): Promise<void> {
    this.reset();
    this.started.set(true);
    await this.run(null);
  }

  async send(text: string): Promise<void> {
    const value = text.trim();
    if (!value || this.busy()) return;
    this.draft = '';
    await this.run(value);
  }

  private async run(input: string | null): Promise<void> {
    this.busy.set(true);
    try {
      const result = await this.service.simulate(this.flowUUID(), {
        graph: this.graph(),
        ...(input === null ? {} : { state: this.state(), input }),
        ...(this.simContact() ? { contact: this.simContact() } : {}),
      });
      this.lines.set(chatLines(this.lines(), input, result.messages));
      this.trace.update((trace) => (input === null ? result.trace : [...trace, ...result.trace]));
      this.state.set(result.state);
      this.done.set(result.done);
      this.waiting.set(result.waiting);
      this.visited.emit([...new Set(this.trace().map((step) => step.nodeId))]);
    } finally {
      this.busy.set(false);
    }
  }

  async searchContacts(query: string): Promise<void> {
    this.contactQuery.set(query);
    if (query.trim().length < 2) return this.found.set([]);
    const contacts = await this.service.testContacts(query);
    for (const contact of contacts) this.names.set(contact.uuid, contact.name);
    this.found.set(contacts);
  }

  addContact(uuid: string): void {
    this.contactQuery.set('');
    this.found.set([]);
    if (!uuid || this.testContacts().includes(uuid) || this.testContacts().length >= 20) return;
    this.contactsChange.emit([...this.testContacts(), uuid]);
  }

  removeContact(uuid: string): void {
    if (this.simContact() === uuid) this.simContact.set('');
    this.contactsChange.emit(this.testContacts().filter((item) => item !== uuid));
  }
}
