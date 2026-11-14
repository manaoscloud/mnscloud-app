import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Dict } from '../automation-adapter';
import {
  CronPreset,
  CronPresetKind,
  DEFAULT_PRESET,
  DEFAULT_TIMEZONE,
  EventCatalogItem,
  EventTriggerType,
  TIMEZONES,
  cronToPreset,
  eventLabel,
  eventVariables,
  groupEvents,
  newEventTrigger,
  parseTime,
  presetToCron,
  scheduleSummary,
  timeText,
  withEvent,
  withFilterTo,
} from '../event-triggers';

const PRESET_KINDS: CronPresetKind[] = ['daily', 'weekly', 'monthly', 'hourly', 'custom'];

/** Trigger list of an event-surface flow: "Evento" (domain event + status) or "Agenda" (cron preset + time zone). */
@Component({
  selector: 'app-automation-trigger-list',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  styles: `
    :host {
      display: block;
    }
    mat-form-field {
      width: 100%;
      margin-bottom: 0.75rem;
    }
    .tl-group {
      margin: 0 0 1rem;
      padding: 0.5rem 0.75rem 0.75rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
    }
    .tl-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .tl-item {
      margin-bottom: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-color-surface-container);
    }
    .tl-tools {
      display: flex;
      justify-content: flex-end;
    }
    .tl-hint {
      margin: -0.25rem 0 0.75rem;
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.75rem;
    }
    .tl-summary {
      margin: 0 0 0.5rem;
      font-size: 0.8125rem;
    }
    .tl-vars {
      margin: 0 0 0.5rem;
      padding-left: 1.25rem;
      font-family: var(--mat-sys-code-font, monospace);
      font-size: 0.75rem;
    }
  `,
  template: `
    <div class="tl-group">
      <div class="tl-title">
        <span>{{ 'automation.field.triggers' | transloco }}</span>
        <button
          mat-stroked-button
          type="button"
          [disabled]="disabled() || items().length >= 10"
          (click)="add()"
        >
          <mat-icon>add</mat-icon>{{ 'automation.inspector.add' | transloco }}
        </button>
      </div>
      @for (item of items(); track $index; let index = $index) {
        <div class="tl-item">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'automation.field.type' | transloco }}</mat-label>
            <mat-select
              [value]="typeOf(item)"
              [disabled]="disabled()"
              (selectionChange)="setType(index, $event.value)"
            >
              <mat-option value="event">{{
                'automation.trigger.type.event' | transloco
              }}</mat-option>
              <mat-option value="schedule">{{
                'automation.trigger.type.schedule' | transloco
              }}</mat-option>
            </mat-select>
          </mat-form-field>

          @if (typeOf(item) === 'event') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'automation.trigger.event' | transloco }} *</mat-label>
              <mat-select
                [value]="text(item, 'event')"
                [disabled]="disabled()"
                (selectionChange)="setEvent(index, $event.value)"
              >
                @for (group of groups(); track group.module) {
                  <mat-optgroup [label]="moduleLabel(group.module)">
                    @for (event of group.events; track event.name) {
                      <mat-option
                        [value]="event.name"
                        [disabled]="event.locked && event.name !== text(item, 'event')"
                      >
                        {{ labelOf(event) }}
                        @if (event.locked) {
                          <small> · {{ 'automation.trigger.locked' | transloco }}</small>
                        }
                      </mat-option>
                    }
                  </mat-optgroup>
                }
              </mat-select>
            </mat-form-field>
            @if (eventOf(item); as event) {
              @if (event.locked) {
                <p class="tl-hint">{{ 'automation.trigger.locked' | transloco }}</p>
              }
              @if (event.filterTo.length) {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.trigger.whenStatus' | transloco }}</mat-label>
                  <mat-select
                    [value]="filterOf(item)"
                    [disabled]="disabled()"
                    (selectionChange)="setFilter(index, $event.value)"
                  >
                    <mat-option value="">{{
                      'automation.trigger.anyStatus' | transloco
                    }}</mat-option>
                    @for (status of event.filterTo; track status) {
                      <mat-option [value]="status">{{ statusLabel(status) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
              <p class="tl-hint">{{ 'automation.trigger.variablesHelp' | transloco }}</p>
              <ul class="tl-vars">
                @for (variable of variablesOf(event); track variable) {
                  <li>{{ variable }}</li>
                }
              </ul>
            }
          } @else if (typeOf(item) === 'schedule') {
            @let preset = presetOf(item, index);
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'automation.schedule.frequency' | transloco }}</mat-label>
              <mat-select
                [value]="preset.kind"
                [disabled]="disabled()"
                (selectionChange)="setPreset(index, item, { kind: $event.value })"
              >
                @for (kind of presetKinds; track kind) {
                  <mat-option [value]="kind">{{
                    'automation.schedule.kind.' + kind | transloco
                  }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            @if (preset.kind === 'daily' || preset.kind === 'weekly' || preset.kind === 'monthly') {
              @if (preset.kind === 'weekly') {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.schedule.weekdayLabel' | transloco }}</mat-label>
                  <mat-select
                    [value]="preset.weekday"
                    [disabled]="disabled()"
                    (selectionChange)="setPreset(index, item, { weekday: $event.value })"
                  >
                    @for (day of weekdays; track day) {
                      <mat-option [value]="day">{{
                        'automation.schedule.weekday.' + day | transloco
                      }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
              @if (preset.kind === 'monthly') {
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'automation.schedule.dayLabel' | transloco }}</mat-label>
                  <mat-select
                    [value]="preset.day"
                    [disabled]="disabled()"
                    (selectionChange)="setPreset(index, item, { day: $event.value })"
                  >
                    @for (day of monthDays; track day) {
                      <mat-option [value]="day">{{ day }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              }
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'automation.schedule.timeLabel' | transloco }}</mat-label>
                <input
                  matInput
                  type="time"
                  [value]="timeValue(preset)"
                  [disabled]="disabled()"
                  (input)="setTime(index, item, $any($event.target).value)"
                />
              </mat-form-field>
            }
            @if (preset.kind === 'custom') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic">
                <mat-label>{{ 'automation.schedule.cronLabel' | transloco }}</mat-label>
                <input
                  matInput
                  maxlength="120"
                  [value]="text(item, 'cron')"
                  [disabled]="disabled()"
                  (input)="setPreset(index, item, { cron: $any($event.target).value })"
                />
              </mat-form-field>
              <p class="tl-hint">{{ 'automation.schedule.cronHint' | transloco }}</p>
            }
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <mat-label>{{ 'automation.field.timezone' | transloco }}</mat-label>
              <mat-select
                [value]="zoneOf(item)"
                [disabled]="disabled()"
                (selectionChange)="patch(index, { timezone: $event.value })"
              >
                @for (zone of zonesFor(item); track zone) {
                  <mat-option [value]="zone">{{ zone }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <p class="tl-summary">{{ summary(item) }}</p>
          }

          <div class="tl-tools">
            <button
              mat-icon-button
              type="button"
              [disabled]="disabled() || items().length <= 1"
              [matTooltip]="'automation.inspector.remove' | transloco"
              [attr.aria-label]="'automation.inspector.remove' | transloco"
              (click)="remove(index)"
            >
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class AutomationTriggerList {
  private readonly transloco = inject(TranslocoService);

  readonly value = input<unknown>(undefined);
  readonly events = input<EventCatalogItem[]>([]);
  readonly disabled = input(false);
  readonly valueChange = output<unknown>();

  readonly presetKinds = PRESET_KINDS;
  readonly weekdays = [0, 1, 2, 3, 4, 5, 6];
  readonly monthDays = Array.from({ length: 31 }, (_, index) => index + 1);

  readonly items = computed<Dict[]>(() =>
    (Array.isArray(this.value()) ? (this.value() as unknown[]) : []).map((item) =>
      item && typeof item === 'object' ? (item as Dict) : {},
    ),
  );
  readonly groups = computed(() => groupEvents(this.events()));

  /** Empty for a trigger left from another surface (the author picks Evento or Agenda). */
  typeOf(item: Dict): EventTriggerType | '' {
    return item['type'] === 'schedule' || item['type'] === 'event' ? item['type'] : '';
  }

  text(item: Dict, key: string): string {
    return item[key] == null ? '' : String(item[key]);
  }

  eventOf(item: Dict): EventCatalogItem | undefined {
    return this.events().find((event) => event.name === item['event']);
  }

  filterOf(item: Dict): string {
    const filter = item['filter'];
    return filter && typeof filter === 'object' ? String((filter as Dict)['to'] ?? '') : '';
  }

  labelOf(event: EventCatalogItem): string {
    return eventLabel(event, this.transloco.getActiveLang());
  }

  moduleLabel(module: string): string {
    return this.translateOr(`automation.module.${module}`, module);
  }

  statusLabel(status: string): string {
    return this.translateOr(`automation.status.${status}`, status);
  }

  variablesOf(event: EventCatalogItem): string[] {
    return eventVariables(event);
  }

  /** Indexes the author put in "Advanced": they stay so while typing, even if the text looks like a preset. */
  private readonly advanced = signal<ReadonlySet<number>>(new Set());

  presetOf(item: Dict, index: number): CronPreset {
    const preset = cronToPreset(this.text(item, 'cron'));
    return this.advanced().has(index) ? { ...preset, kind: 'custom' } : preset;
  }

  timeValue(preset: CronPreset): string {
    return timeText(preset);
  }

  zoneOf(item: Dict): string {
    return this.text(item, 'timezone') || DEFAULT_TIMEZONE;
  }

  /** Short list of zones; a zone already saved outside the list stays selectable. */
  zonesFor(item: Dict): string[] {
    const zone = this.zoneOf(item);
    return (TIMEZONES as readonly string[]).includes(zone) ? [...TIMEZONES] : [zone, ...TIMEZONES];
  }

  summary(item: Dict): string {
    const result = scheduleSummary(this.text(item, 'cron'), this.zoneOf(item));
    const params = {
      ...result.params,
      weekday: this.transloco.translate(String(result.params['weekdayKey'])),
    };
    return this.transloco.translate(result.key, params);
  }

  add(): void {
    this.advanced.set(new Set());
    this.valueChange.emit([...this.items(), newEventTrigger('event')]);
  }

  remove(index: number): void {
    this.advanced.set(new Set());
    this.valueChange.emit(this.items().filter((_, position) => position !== index));
  }

  patch(index: number, change: Dict): void {
    this.valueChange.emit(
      this.items().map((item, position) => (position === index ? { ...item, ...change } : item)),
    );
  }

  setType(index: number, type: EventTriggerType): void {
    this.advanced.set(new Set());
    if (type === this.typeOf(this.items()[index])) return;
    this.valueChange.emit(
      this.items().map((item, position) => (position === index ? newEventTrigger(type) : item)),
    );
  }

  setEvent(index: number, name: string): void {
    const event = this.events().find((candidate) => candidate.name === name);
    this.valueChange.emit(
      this.items().map((item, position) =>
        position === index ? withEvent(item, event, name) : item,
      ),
    );
  }

  setFilter(index: number, to: string): void {
    this.valueChange.emit(
      this.items().map((item, position) => (position === index ? withFilterTo(item, to) : item)),
    );
  }

  setPreset(index: number, item: Dict, change: Partial<CronPreset>): void {
    const current = this.presetOf(item, index);
    if (change.kind) {
      const flags = new Set(this.advanced());
      if (change.kind === 'custom') flags.add(index);
      else flags.delete(index);
      this.advanced.set(flags);
    }
    const next: CronPreset = { ...current, ...change };
    // Advanced starts from the cron the preset produced; leaving it starts from the default time.
    if (change.kind === 'custom') next.cron = presetToCron(current);
    if (change.kind && change.kind !== 'custom' && current.kind === 'custom') {
      Object.assign(next, { hour: DEFAULT_PRESET.hour, minute: DEFAULT_PRESET.minute });
    }
    this.patch(index, { cron: next.kind === 'custom' ? next.cron : presetToCron(next) });
  }

  setTime(index: number, item: Dict, raw: string): void {
    this.setPreset(index, item, parseTime(raw, this.presetOf(item, index)));
  }

  private translateOr(key: string, fallback: string): string {
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : fallback;
  }
}
