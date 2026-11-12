import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Dict, SchemaNode } from '../automation-adapter';
import { newItem } from '../automation-graph';
import { PickerOption, widgetOf } from '../automation.service';

export type FieldKind =
  | 'enum'
  | 'boolean'
  | 'number'
  | 'textarea'
  | 'time'
  | 'string'
  | 'picker'
  | 'picker-multi'
  | 'string-array'
  | 'object-array'
  | 'object';

/** Which control renders a schema property (pure, covered by the spec). */
export function fieldKind(name: string, schema: SchemaNode): FieldKind {
  const widget = widgetOf(name, schema['x-widget']);
  if (widget && schema.type === 'array') return 'picker-multi';
  if (widget) return 'picker';
  if (schema.enum?.length) return 'enum';
  switch (schema.type) {
    case 'boolean':
      return 'boolean';
    case 'integer':
    case 'number':
      return 'number';
    case 'array':
      return schema.items?.type === 'object' ? 'object-array' : 'string-array';
    case 'object':
      return 'object';
    default:
      if (schema.format === 'time' || ((name === 'start' || name === 'end') && !schema.enum))
        return 'time';
      return schema.format === 'textarea' ||
        schema.format === 'template' ||
        (schema.maxLength ?? 0) > 200
        ? 'textarea'
        : 'string';
  }
}

/** `contactName` -> `Contact name` (fallback label when the API gives no title). */
export function humanize(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.:-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}

/** One property of a node config, rendered from its JSON Schema (recursive for lists/objects). */
@Component({
  selector: 'app-automation-schema-field',
  standalone: true,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    TranslocoPipe,
    AutomationSchemaField,
  ],
  styles: `
    :host {
      display: block;
    }
    mat-form-field {
      width: 100%;
    }
    .sf-hint {
      margin: -0.5rem 0 0.75rem;
      color: var(--mat-sys-color-on-surface-variant);
      font-size: 0.75rem;
    }
    .sf-group {
      margin: 0 0 1rem;
      padding: 0.5rem 0.75rem 0.75rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
    }
    .sf-group > .sf-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .sf-item {
      margin-bottom: 0.5rem;
      padding: 0.5rem;
      border-radius: 0.5rem;
      background: var(--mat-sys-color-surface-container);
    }
    .sf-item-tools {
      display: flex;
      justify-content: flex-end;
    }
    .sf-toggle {
      display: block;
      margin-bottom: 1rem;
    }
  `,
  template: `
    @switch (kind()) {
      @case ('boolean') {
        <mat-slide-toggle
          class="sf-toggle"
          [checked]="value() === true"
          [disabled]="disabled()"
          (change)="valueChange.emit($event.checked)"
          >{{ label() }}</mat-slide-toggle
        >
      }
      @case ('enum') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <mat-select
            [value]="value()"
            [disabled]="disabled()"
            (selectionChange)="valueChange.emit($event.value)"
          >
            @for (option of schema().enum; track option) {
              <mat-option [value]="option">{{ optionLabel(option) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @case ('picker') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <mat-select
            [value]="value() || ''"
            [disabled]="disabled()"
            (selectionChange)="valueChange.emit($event.value || undefined)"
          >
            <mat-option value="">{{ 'automation.inspector.none' | transloco }}</mat-option>
            @for (option of pickerOptions(); track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @case ('picker-multi') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <mat-select
            multiple
            [value]="list()"
            [disabled]="disabled()"
            (selectionChange)="valueChange.emit($event.value)"
          >
            @for (option of pickerOptions(); track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (name() === 'connectionUUIDs') {
          <p class="sf-hint">{{ 'automation.inspector.allConnections' | transloco }}</p>
        }
      }
      @case ('number') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <input
            matInput
            type="number"
            [value]="value() ?? ''"
            [min]="schema().minimum ?? null"
            [max]="schema().maximum ?? null"
            [disabled]="disabled()"
            (input)="setNumber($any($event.target).value)"
          />
        </mat-form-field>
      }
      @case ('textarea') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <textarea
            matInput
            rows="4"
            [value]="text()"
            [maxLength]="schema().maxLength ?? 4096"
            [disabled]="disabled()"
            (input)="valueChange.emit($any($event.target).value)"
          ></textarea>
        </mat-form-field>
        @if (schema().format === 'template') {
          <p class="sf-hint">{{ 'automation.inspector.templateHint' | transloco }}</p>
        }
      }
      @case ('time') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <input
            matInput
            type="time"
            [value]="text()"
            [disabled]="disabled()"
            (input)="valueChange.emit($any($event.target).value)"
          />
        </mat-form-field>
      }
      @case ('string-array') {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <textarea
            matInput
            rows="3"
            [value]="list().join('\\n')"
            [disabled]="disabled()"
            (input)="setLines($any($event.target).value)"
          ></textarea>
        </mat-form-field>
        <p class="sf-hint">{{ 'automation.inspector.onePerLine' | transloco }}</p>
      }
      @case ('object') {
        <div class="sf-group">
          <div class="sf-title">{{ label() }}</div>
          @for (child of childNames(); track child) {
            <app-automation-schema-field
              [name]="child"
              [schema]="schema().properties![child]"
              [value]="record()[child]"
              [required]="schema().required?.includes(child) ?? false"
              [pickers]="pickers()"
              [disabled]="disabled()"
              (valueChange)="setChild(child, $event)"
            />
          }
        </div>
      }
      @case ('object-array') {
        <div class="sf-group">
          <div class="sf-title">
            <span>{{ label() }}</span>
            <button
              mat-stroked-button
              type="button"
              [disabled]="disabled() || atLimit()"
              (click)="addItem()"
            >
              <mat-icon>add</mat-icon>{{ 'automation.inspector.add' | transloco }}
            </button>
          </div>
          @for (item of items(); track $index; let index = $index) {
            <div class="sf-item">
              @for (child of itemNames(); track child) {
                <app-automation-schema-field
                  [name]="child"
                  [schema]="schema().items!.properties![child]"
                  [value]="asRecord(item)[child]"
                  [required]="schema().items!.required?.includes(child) ?? false"
                  [pickers]="pickers()"
                  [disabled]="disabled()"
                  (valueChange)="setItemChild(index, child, $event)"
                />
              }
              <div class="sf-item-tools">
                <button
                  mat-icon-button
                  type="button"
                  [disabled]="disabled() || index === 0"
                  [matTooltip]="'automation.inspector.moveUp' | transloco"
                  [attr.aria-label]="'automation.inspector.moveUp' | transloco"
                  (click)="moveItem(index, -1)"
                >
                  <mat-icon>arrow_upward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  [disabled]="disabled() || index === items().length - 1"
                  [matTooltip]="'automation.inspector.moveDown' | transloco"
                  [attr.aria-label]="'automation.inspector.moveDown' | transloco"
                  (click)="moveItem(index, 1)"
                >
                  <mat-icon>arrow_downward</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  [disabled]="disabled()"
                  [matTooltip]="'automation.inspector.remove' | transloco"
                  [attr.aria-label]="'automation.inspector.remove' | transloco"
                  (click)="removeItem(index)"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </div>
          }
        </div>
      }
      @default {
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ label() }}</mat-label>
          <input
            matInput
            [value]="text()"
            [maxLength]="schema().maxLength ?? 500"
            [disabled]="disabled()"
            (input)="valueChange.emit($any($event.target).value)"
          />
        </mat-form-field>
      }
    }
    @if (schema().description && kind() !== 'boolean') {
      <p class="sf-hint">{{ schema().description }}</p>
    }
  `,
})
export class AutomationSchemaField {
  private readonly transloco = inject(TranslocoService);

  readonly name = input.required<string>();
  readonly schema = input.required<SchemaNode>();
  readonly value = input<unknown>(undefined);
  readonly required = input(false);
  readonly pickers = input<Record<string, PickerOption[]>>({});
  readonly disabled = input(false);
  readonly valueChange = output<unknown>();

  readonly kind = computed(() => fieldKind(this.name(), this.schema()));
  readonly text = computed(() => (this.value() == null ? '' : String(this.value())));
  readonly list = computed(() =>
    (Array.isArray(this.value()) ? (this.value() as unknown[]) : []).map(String),
  );
  readonly items = computed(() => (Array.isArray(this.value()) ? (this.value() as unknown[]) : []));
  readonly record = computed(() => this.asRecord(this.value()));
  readonly childNames = computed(() => Object.keys(this.schema().properties ?? {}));
  readonly itemNames = computed(() => Object.keys(this.schema().items?.properties ?? {}));
  readonly pickerOptions = computed(
    () => this.pickers()[widgetOf(this.name(), this.schema()['x-widget'])] ?? [],
  );

  asRecord(value: unknown): Dict {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
  }

  label(): string {
    const key = `automation.field.${this.name()}`;
    const translated = this.transloco.translate(key);
    const base = translated !== key ? translated : this.schema().title || humanize(this.name());
    return this.required() ? `${base} *` : base;
  }

  optionLabel(option: unknown): string {
    const key = `automation.enum.${String(option)}`;
    const translated = this.transloco.translate(key);
    return translated !== key ? translated : String(option);
  }

  atLimit(): boolean {
    const max = this.schema().maxItems;
    return max !== undefined && this.items().length >= max;
  }

  setNumber(raw: string): void {
    if (raw === '') return this.valueChange.emit(undefined);
    const number = Number(raw);
    if (!Number.isFinite(number)) return;
    this.valueChange.emit(this.schema().type === 'integer' ? Math.trunc(number) : number);
  }

  setLines(raw: string): void {
    this.valueChange.emit(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    );
  }

  setChild(child: string, next: unknown): void {
    const record = { ...this.record() };
    if (next === undefined) delete record[child];
    else record[child] = next;
    this.valueChange.emit(record);
  }

  addItem(): void {
    this.valueChange.emit([...this.items(), newItem(this.schema().items, this.items())]);
  }

  setItemChild(index: number, child: string, next: unknown): void {
    this.valueChange.emit(
      this.items().map((item, position) => {
        if (position !== index) return item;
        const record = { ...this.asRecord(item) };
        if (next === undefined) delete record[child];
        else record[child] = next;
        return record;
      }),
    );
  }

  moveItem(index: number, delta: -1 | 1): void {
    const items = [...this.items()];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    this.valueChange.emit(items);
  }

  removeItem(index: number): void {
    this.valueChange.emit(this.items().filter((_, position) => position !== index));
  }
}
