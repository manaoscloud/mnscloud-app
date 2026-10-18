import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { PhoneDockService } from './phone-dock.service';

/** Topbar phone button: opens or minimizes the dock and rings on incoming calls. */
@Component({
  selector: 'mns-phone-dock-button',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    <button
      mat-icon-button
      type="button"
      class="phone-button"
      [class.is-ringing]="dock.ringing()"
      (click)="dock.toggle()"
      [matTooltip]="'phoneDock.title' | transloco"
      [attr.aria-label]="'phoneDock.title' | transloco"
      [attr.aria-pressed]="dock.visible()"
    >
      <mat-icon>{{
        dock.callActive() || dock.elsewhereCallActive() ? 'phone_in_talk' : 'phone'
      }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .phone-button mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .phone-button.is-ringing mat-icon {
      color: var(--mat-sys-color-primary);
      animation: phone-ring 1s ease-in-out infinite;
    }

    @keyframes phone-ring {
      0%,
      100% {
        transform: rotate(0);
      }
      25% {
        transform: rotate(-12deg);
      }
      75% {
        transform: rotate(12deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .phone-button.is-ringing mat-icon {
        animation: none;
      }
    }
  `,
})
export class PhoneDockButton {
  readonly dock = inject(PhoneDockService);
}
