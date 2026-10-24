import { FieldHelpComponent } from '../field-help';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormField, type Field } from '@angular/forms/signals';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { FieldInvalidDirective } from '../field-invalid.directive';

type SignalFormField = Field<any, any>;

export type MnsSearchSelectFieldOption = {
  value: string | number | boolean | null;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
  /** Extra CSS class for the option row (group/subgroup headers). */
  optionClass?: string;
};

type MnsSearchSelectValue = string | number | boolean | null | readonly unknown[];

/** Remote searches wait for a typing pause so each keystroke does not hit the API. */
export const MNS_REMOTE_SEARCH_DEBOUNCE_MS = 250;

/** Keys the search input hands to mat-select so the option list stays keyboard-driven. */
const SELECT_NAVIGATION_KEYS = new Set([
  'ArrowDown',
  'ArrowUp',
  'PageDown',
  'PageUp',
  'Enter',
  'Escape',
  'Tab',
]);

@Component({
  selector: 'mns-search-select-field',
  standalone: true,
  host: {
    '[class]': 'fieldClass()',
  },
  imports: [
    FieldHelpComponent,
    FieldInvalidDirective,
    FormField,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <mat-form-field appearance="outline" floatLabel="always" [class]="fieldClass()">
      <mat-label>{{ label() }}</mat-label>
      @if (field(); as formField) {
        <mat-select
          #select
          [formField]="formField"
          [multiple]="multiple()"
          [compareWith]="compareOptionValues"
          [mnsInvalid]="invalid()"
          (selectionChange)="selectValue($event.value)"
          (openedChange)="handleOpenedChange($event)"
        >
          <mat-select-trigger>
            @if (multiple()) {
              {{ selectedOptionLabels() }}
            } @else if (selectedOption(); as option) {
              @if (translateOptions()) {
                {{ option.label | transloco }}
              } @else {
                {{ option.label }}
              }
            }
          </mat-select-trigger>

          <mat-option class="select-search-option" disabled>
            <mat-form-field
              appearance="outline"
              class="select-search-field"
              role="group"
              aria-disabled="false"
            >
              <mat-icon matPrefix>search</mat-icon>
              <input
                #searchInput
                matInput
                [placeholder]="placeholder() | transloco"
                [attr.aria-label]="placeholder() | transloco"
                [attr.aria-controls]="select.id + '-panel'"
                [attr.aria-activedescendant]="select._getAriaActiveDescendant()"
                [value]="search()"
                (input)="setSearch($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="handleSearchKeydown($event)"
                autocomplete="off"
              />
            </mat-form-field>
          </mat-option>

          @if (multiple() && selectableOptions().length > 1) {
            <div
              class="select-toggle-all"
              role="button"
              tabindex="0"
              (click)="$event.stopPropagation(); toggleAllVisible()"
              (keydown.enter)="$event.stopPropagation(); toggleAllVisible()"
            >
              <mat-icon>{{
                allVisibleSelected() ? 'check_box' : 'check_box_outline_blank'
              }}</mat-icon>
              <span>{{
                (allVisibleSelected() ? 'Clear selection' : 'Select all') | transloco
              }}</span>
            </div>
          }

          @if (loadError()) {
            <mat-option disabled>{{ 'Failed to load options.' | transloco }}</mat-option>
          }
          @if (remoteSearch() && (hasPrevious() || hasNext())) {
            <div class="select-page-navigation" role="group">
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasPrevious() || loading()"
                [attr.aria-label]="'Previous page' | transloco"
                [matTooltip]="'Previous page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(-1)"
              >
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext() || loading()"
                [attr.aria-label]="'Next page' | transloco"
                [matTooltip]="'Next page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(1)"
              >
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @if (showClearOption()) {
            <mat-option [value]="''" class="select-clear-option">
              <span class="select-option-main">{{ clearLabel() | transloco }}</span>
            </mat-option>
          }
          @for (option of filteredOptions(); track optionTrack(option)) {
            <mat-option
              [value]="option.value"
              [disabled]="option.disabled"
              [class]="option.optionClass ?? ''"
            >
              <span class="select-option-main">
                @if (translateOptions()) {
                  {{ option.label | transloco }}
                } @else {
                  {{ option.label }}
                }
              </span>
              @if (option.description) {
                <span class="select-option-description">{{ option.description }}</span>
              }
            </mat-option>
          } @empty {
            @if (!loading()) {
              <mat-option disabled class="select-state-option">{{
                emptyLabel() | transloco
              }}</mat-option>
              @if (canCreate()) {
                <mat-option class="select-create-option" (click)="triggerCreate($event)">
                  <mat-icon>add</mat-icon>
                  <span>{{ createLabel() | transloco }}</span>
                </mat-option>
              }
            }
          }
        </mat-select>
      } @else {
        <mat-select
          #select
          [value]="value()"
          [multiple]="multiple()"
          [disabled]="disabled()"
          [compareWith]="compareOptionValues"
          [mnsInvalid]="invalid()"
          (selectionChange)="selectValue($event.value)"
          (openedChange)="handleOpenedChange($event)"
        >
          <mat-select-trigger>
            @if (multiple()) {
              {{ selectedOptionLabels() }}
            } @else if (selectedOption(); as option) {
              @if (translateOptions()) {
                {{ option.label | transloco }}
              } @else {
                {{ option.label }}
              }
            }
          </mat-select-trigger>

          <mat-option class="select-search-option" disabled>
            <mat-form-field
              appearance="outline"
              class="select-search-field"
              role="group"
              aria-disabled="false"
            >
              <mat-icon matPrefix>search</mat-icon>
              <input
                #searchInput
                matInput
                [placeholder]="placeholder() | transloco"
                [attr.aria-label]="placeholder() | transloco"
                [attr.aria-controls]="select.id + '-panel'"
                [attr.aria-activedescendant]="select._getAriaActiveDescendant()"
                [value]="search()"
                (input)="setSearch($any($event.target).value)"
                (click)="$event.stopPropagation()"
                (keydown)="handleSearchKeydown($event)"
                autocomplete="off"
              />
            </mat-form-field>
          </mat-option>

          @if (multiple() && selectableOptions().length > 1) {
            <div
              class="select-toggle-all"
              role="button"
              tabindex="0"
              (click)="$event.stopPropagation(); toggleAllVisible()"
              (keydown.enter)="$event.stopPropagation(); toggleAllVisible()"
            >
              <mat-icon>{{
                allVisibleSelected() ? 'check_box' : 'check_box_outline_blank'
              }}</mat-icon>
              <span>{{
                (allVisibleSelected() ? 'Clear selection' : 'Select all') | transloco
              }}</span>
            </div>
          }

          @if (loadError()) {
            <mat-option disabled>{{ 'Failed to load options.' | transloco }}</mat-option>
          }
          @if (remoteSearch() && (hasPrevious() || hasNext())) {
            <div class="select-page-navigation" role="group">
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasPrevious() || loading()"
                [attr.aria-label]="'Previous page' | transloco"
                [matTooltip]="'Previous page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(-1)"
              >
                <mat-icon>chevron_left</mat-icon>
              </button>
              <button
                mat-icon-button
                type="button"
                [disabled]="!hasNext() || loading()"
                [attr.aria-label]="'Next page' | transloco"
                [matTooltip]="'Next page' | transloco"
                (click)="$event.stopPropagation(); pageChange.emit(1)"
              >
                <mat-icon>chevron_right</mat-icon>
              </button>
            </div>
          }
          @if (loading()) {
            <mat-option disabled class="select-state-option">
              {{ loadingLabel() | transloco }}
            </mat-option>
          }

          @if (showClearOption()) {
            <mat-option [value]="''" class="select-clear-option">
              <span class="select-option-main">{{ clearLabel() | transloco }}</span>
            </mat-option>
          }
          @for (option of filteredOptions(); track optionTrack(option)) {
            <mat-option
              [value]="option.value"
              [disabled]="option.disabled"
              [class]="option.optionClass ?? ''"
            >
              <span class="select-option-main">
                @if (translateOptions()) {
                  {{ option.label | transloco }}
                } @else {
                  {{ option.label }}
                }
              </span>
              @if (option.description) {
                <span class="select-option-description">{{ option.description }}</span>
              }
            </mat-option>
          } @empty {
            @if (!loading()) {
              <mat-option disabled class="select-state-option">{{
                emptyLabel() | transloco
              }}</mat-option>
              @if (canCreate()) {
                <mat-option class="select-create-option" (click)="triggerCreate($event)">
                  <mat-icon>add</mat-icon>
                  <span>{{ createLabel() | transloco }}</span>
                </mat-option>
              }
            }
          }
        </mat-select>
      }
      @if (canCreate()) {
        <button
          mat-icon-button
          matSuffix
          type="button"
          class="select-create-button"
          [attr.aria-label]="createLabel() | transloco"
          [matTooltip]="createLabel() | transloco"
          (click)="triggerCreate($event)"
        >
          <mat-icon>add</mat-icon>
        </button>
      }
      @if (help()) {
        <mns-field-help matIconSuffix [label]="label()" [text]="help()" />
      }
      @if (errorMessage()) {
        <!-- Material shows it only in error state (invalid flag or invalid touched control). -->
        <mat-error>{{ errorMessage() }}</mat-error>
      }
    </mat-form-field>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      mat-form-field {
        width: 100%;
      }

      .select-create-button {
        --mdc-icon-button-state-layer-size: 36px;
        color: var(--mns-color-accent, #00d5d5);
        margin-right: -0.35rem;
      }

      .select-clear-option {
        font-style: italic;
        opacity: 0.8;
      }

      .select-create-option {
        color: var(--mns-color-accent, #00d5d5);
      }

      .select-create-option mat-icon {
        margin-right: 0.5rem;
        vertical-align: middle;
      }
    `,
  ],
})
export class MnsSearchSelectFieldComponent {
  readonly field = input<SignalFormField | null>(null);
  readonly value = input<MnsSearchSelectValue>('');
  readonly valueChange = output<MnsSearchSelectValue>();
  readonly selectionChange = output<MnsSearchSelectValue>();
  readonly openedChange = output<boolean>();
  readonly label = input.required<string>();
  /** Already-translated optional contextual guidance, rendered inside the field outline. */
  readonly help = input('');
  readonly options = input.required<readonly MnsSearchSelectFieldOption[]>();
  readonly fieldClass = input('');
  readonly placeholder = input('Search');
  readonly emptyLabel = input('No records found.');
  readonly loadingLabel = input('Loading...');
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly translateOptions = input(false);
  readonly multiple = input(false);
  readonly canCreate = input(false);
  readonly createLabel = input('Create new');
  readonly createRecord = output<void>();
  /** Optional single selects: offer an empty choice so a picked value can be removed. */
  readonly clearable = input(false);
  readonly clearLabel = input('No selection');

  readonly remoteSearch = input(false);
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly loadError = input(false);
  /** Required Field Feedback Baseline: red outline and `errorMessage` under the field. */
  readonly invalid = input(false);
  readonly errorMessage = input('');
  readonly searchChange = output<string>();
  readonly pageChange = output<number>();
  readonly search = signal('');

  private readonly select = viewChild(MatSelect);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Capture phase: a printable key on the closed select must open the search before
    // mat-select's typeahead silently picks a matching option.
    const host = this.host.nativeElement;
    const typeToSearch = (event: KeyboardEvent) => this.handleClosedKeydown(event);
    host.addEventListener('keydown', typeToSearch, true);
    inject(DestroyRef).onDestroy(() => {
      host.removeEventListener('keydown', typeToSearch, true);
      this.clearSearchTimer();
    });

    // While searching, keep the first visible option active so Enter picks it.
    effect(() => {
      const term = this.search();
      this.filteredOptions();
      untracked(() => {
        if (!term.trim() || !this.select()?.panelOpen) return;
        afterNextRender(() => this.activateFirstSelectableOption(), {
          injector: this.injector,
        });
      });
    });
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.clearSearchTimer();
    if (!this.remoteSearch() || !value) {
      this.searchChange.emit(value);
      return;
    }
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.searchChange.emit(value);
    }, MNS_REMOTE_SEARCH_DEBOUNCE_MS);
  }

  /** Navigation keys reach mat-select; text editing keys stay in the search input. */
  handleSearchKeydown(event: KeyboardEvent): void {
    if (SELECT_NAVIGATION_KEYS.has(event.key)) return;
    event.stopPropagation();
  }

  private handleClosedKeydown(event: KeyboardEvent): void {
    const select = this.select();
    if (!select || select.panelOpen || select.disabled) return;
    if (!(event.target as HTMLElement | null)?.classList?.contains('mat-mdc-select')) return;
    if (event.key.length !== 1 || event.key === ' ') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    this.setSearch(event.key);
    select.open();
  }

  /** An open mat-select also navigates disabled rows (search box, states); skip them here. */
  private activateFirstSelectableOption(): void {
    const select = this.select();
    if (!select?.panelOpen) return;
    const index = select.options.toArray().findIndex((option) => !option.disabled);
    if (index >= 0) select._keyManager.setActiveItem(index);
  }

  private focusSearchInput(): void {
    // Touch devices keep the list visible instead of raising the on-screen keyboard.
    if (globalThis.matchMedia?.('(pointer: coarse)').matches) return;
    // After the opening event finishes: the same click still bubbles to mat-form-field, whose
    // onContainerClick focuses the select again (seen in CRUD dialogs on DEV).
    setTimeout(() => {
      const input = this.searchInput()?.nativeElement;
      if (!input || !this.select()?.panelOpen) return;
      input.focus({ preventScroll: true });
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  private clearSearchTimer(): void {
    if (this.searchTimer === null) return;
    clearTimeout(this.searchTimer);
    this.searchTimer = null;
  }

  readonly selectedOption = computed(() => {
    const field = this.field();
    const currentValue = field ? field().value() : this.value();
    return this.options().find(
      (option) => !option.disabled && this.areOptionValuesEqual(option.value, currentValue),
    );
  });
  readonly selectedOptionLabels = computed(() => {
    const field = this.field();
    const value = field ? field().value() : this.value();
    const selectedValues = Array.isArray(value) ? value : [];
    return selectedValues
      .map((selected) =>
        this.options().find((option) => this.areOptionValuesEqual(option.value, selected)),
      )
      .filter((option): option is MnsSearchSelectFieldOption => option !== undefined)
      .map((option) => option.label)
      .join(', ');
  });

  readonly filteredOptions = computed(() => {
    const term = this.normalize(this.search());
    const options = this.options();
    if (!term || this.remoteSearch()) return options;

    const matches = new Set<number>();
    options.forEach((option, index) => {
      if (option.disabled) return;
      if (this.normalize(this.optionSearchText(option)).includes(term)) {
        matches.add(index);
      }
    });
    if (!matches.size) return [];

    const visible = new Set<number>();
    for (const matchIndex of matches) {
      visible.add(matchIndex);
      for (let i = matchIndex - 1; i >= 0; i -= 1) {
        const option = options[i];
        if (!option?.disabled) break;
        visible.add(i);
        if ((option.optionClass ?? '').includes('select-group-option')) break;
      }
    }
    return options.filter((_, index) => visible.has(index));
  });

  /** Empty choice on top of an unfiltered list, unless the page already supplies one. */
  readonly showClearOption = computed(
    () =>
      this.clearable() &&
      !this.multiple() &&
      !this.normalize(this.search()) &&
      this.filteredOptions().length > 0 &&
      !this.options().some((option) => this.areOptionValuesEqual(option.value, '')),
  );

  /** Visible, enabled options (respecting the current search) for "Select all". */
  readonly selectableOptions = computed(() =>
    this.filteredOptions().filter((option) => !option.disabled),
  );

  readonly allVisibleSelected = computed(() => {
    const field = this.field();
    const value = field ? field().value() : this.value();
    const selected = Array.isArray(value) ? value : [];
    const visible = this.selectableOptions();
    return (
      visible.length > 0 &&
      visible.every((option) =>
        selected.some((item) => this.areOptionValuesEqual(item, option.value)),
      )
    );
  });

  /** Selects every visible option, or clears them when all are already selected. */
  toggleAllVisible(): void {
    const field = this.field();
    const value = field ? field().value() : this.value();
    const selected = Array.isArray(value) ? [...value] : [];
    const visible = this.selectableOptions().map((option) => option.value);
    const next = this.allVisibleSelected()
      ? selected.filter(
          (item) => !visible.some((option) => this.areOptionValuesEqual(item, option)),
        )
      : [
          ...selected,
          ...visible.filter(
            (option) => !selected.some((item) => this.areOptionValuesEqual(item, option)),
          ),
        ];
    if (field) field().value.set(next as never);
    this.selectValue(next as MnsSearchSelectValue);
  }

  handleOpenedChange(opened: boolean): void {
    this.openedChange.emit(opened);
    if (opened) this.focusSearchInput();
    else if (this.search()) this.setSearch('');
  }

  readonly compareOptionValues = (left: unknown, right: unknown): boolean =>
    this.areOptionValuesEqual(left, right);

  optionTrack(option: MnsSearchSelectFieldOption): string {
    return `${String(option.value)}::${option.label}::${option.optionClass ?? ''}`;
  }

  selectValue(value: MnsSearchSelectValue): void {
    const nextValue = this.multiple() ? this.orderMultipleValues(value) : value;
    this.valueChange.emit(nextValue);
    this.selectionChange.emit(nextValue);
  }

  triggerCreate(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.createRecord.emit();
  }

  private orderMultipleValues(value: MnsSearchSelectValue): MnsSearchSelectValue {
    const selectedValues = Array.isArray(value) ? [...value] : [];
    const field = this.field();
    const currentValue = field ? field().value() : this.value();
    const currentValues = Array.isArray(currentValue) ? currentValue : [];
    return [
      ...currentValues.filter((current) =>
        selectedValues.some((selected) => this.areOptionValuesEqual(current, selected)),
      ),
      ...selectedValues.filter(
        (selected) =>
          !currentValues.some((current) => this.areOptionValuesEqual(current, selected)),
      ),
    ];
  }

  private optionSearchText(option: MnsSearchSelectFieldOption): string {
    return `${option.label} ${option.description ?? ''} ${option.searchText ?? ''} ${String(
      option.value,
    )}`;
  }

  private areOptionValuesEqual(left: unknown, right: unknown): boolean {
    return String(left ?? '') === String(right ?? '');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }
}
