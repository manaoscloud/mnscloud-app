import {
  Component,
  Directive,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuItem } from '@angular/material/menu';

/**
 * Global menu building blocks (app.md "Menus"). Every Material menu panel uses the `mns-menu`
 * class (plus `mns-menu-compact` for short action lists) from `src/styles/_mns-menu.scss`; these
 * primitives keep titles, items, selection state and search identical across the app while
 * Material keeps keyboard navigation, Escape and focus restoration.
 */

export type MnsMenuSelection = 'radio' | 'checkbox';
export type MnsMenuTone = 'default' | 'danger';

/**
 * Menu item semantics on a `button[mat-menu-item]`: selection role with `aria-checked`, the
 * danger tone and `keepOpen` for selection lists that stay open while the user toggles items.
 */
@Directive({
  selector: 'button[mat-menu-item][mnsMenuItem]',
  host: {
    class: 'mns-menu-item',
    '[class.mns-menu-danger]': "tone() === 'danger'",
    '[attr.aria-checked]': 'selection() ? checked() : null',
    '(click)': 'onClick($event)',
  },
})
export class MnsMenuItem {
  readonly selection = input<MnsMenuSelection | null>(null);
  readonly checked = input(false, { transform: booleanAttribute });
  readonly tone = input<MnsMenuTone>('default');
  readonly keepOpen = input(false, { transform: booleanAttribute });

  /** Whether the item shows the trailing check mark. */
  readonly showsCheck = computed(() => Boolean(this.selection()) && this.checked());

  private readonly item = inject(MatMenuItem);

  constructor() {
    // MatMenuItem owns the host `role`; drive it instead of binding the attribute twice.
    effect(() => {
      const selection = this.selection();
      this.item.role =
        selection === 'radio'
          ? 'menuitemradio'
          : selection === 'checkbox'
            ? 'menuitemcheckbox'
            : 'menuitem';
    });
  }

  onClick(event: Event): void {
    if (this.keepOpen()) event.stopPropagation();
  }
}

/**
 * Item label with an optional second line (`description`, for example the reason a disabled
 * action is unavailable, or projected `[mnsMenuDescription]` markup) and the trailing check mark
 * of a selected `mnsMenuItem`.
 */
@Component({
  selector: 'mns-menu-label',
  imports: [MatIconModule],
  host: { class: 'mns-menu-label' },
  template: `
    <span class="mns-menu-label-text">
      <span class="mns-menu-label-primary"><ng-content /></span>
      @if (description()) {
        <span class="mns-menu-description">{{ description() }}</span>
      }
      <ng-content select="[mnsMenuDescription]" />
    </span>
    @if (item?.showsCheck()) {
      <mat-icon class="mns-menu-check" aria-hidden="true">check</mat-icon>
    }
  `,
})
export class MnsMenuLabel {
  readonly description = input<string | null | undefined>(null);

  protected readonly item = inject(MnsMenuItem, { optional: true });
}

/** Panel or section heading with an optional context hint (record name, count, scope). */
@Component({
  selector: 'mns-menu-title',
  host: {
    class: 'mns-menu-title',
    // A heading is not an action: clicking it must not close the panel.
    '(click)': '$event.stopPropagation()',
  },
  template: `
    <span class="mns-menu-title-text"><ng-content /></span>
    @if (hint()) {
      <span class="mns-menu-hint">{{ hint() }}</span>
    }
  `,
})
export class MnsMenuTitle {
  readonly hint = input<string | null | undefined>(null);
}

/** Navigation keys the search field hands back to the menu (close, move into the list). */
const MENU_KEYS = new Set(['Escape', 'ArrowDown', 'ArrowUp', 'Tab']);

/**
 * Search field inside a menu panel. Typing stays in the field (no typeahead or close), while
 * Escape and the arrow keys still reach the menu. The owner clears `value` when the menu closes.
 */
@Component({
  selector: 'mns-menu-search',
  imports: [MatIconModule],
  host: {
    class: 'mns-menu-search',
    '(click)': '$event.stopPropagation()',
  },
  template: `
    <mat-icon aria-hidden="true">search</mat-icon>
    <input
      type="search"
      [value]="value()"
      [attr.aria-label]="label()"
      [placeholder]="label()"
      (input)="value.set($any($event.target).value)"
      (keydown)="onKeydown($event)"
    />
  `,
})
export class MnsMenuSearch {
  readonly value = model('');
  readonly label = input.required<string>();

  onKeydown(event: KeyboardEvent): void {
    if (!MENU_KEYS.has(event.key)) event.stopPropagation();
  }
}

export const MNS_MENU = [MnsMenuItem, MnsMenuLabel, MnsMenuTitle, MnsMenuSearch] as const;
