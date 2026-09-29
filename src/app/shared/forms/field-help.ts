import { Component, input, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

let nextHelpId = 0;

/** Optional field guidance. Essential instructions and validation stay visible in the form. */
@Component({
  selector: 'mns-field-help',
  standalone: true,
  imports: [
    A11yModule,
    OverlayModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <button
      mat-icon-button
      type="button"
      class="field-help-trigger"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      [attr.aria-label]="('Help for' | transloco) + ': ' + label()"
      aria-haspopup="dialog"
      [attr.aria-expanded]="opened()"
      [attr.aria-controls]="opened() ? panelId : null"
      [matTooltip]="text()"
      [matTooltipDisabled]="opened()"
      matTooltipTouchGestures="off"
      (click)="opened.set(true)"
    >
      <mat-icon aria-hidden="true">info_outline</mat-icon>
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="opened()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayHasBackdrop]="true"
      cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
      [cdkConnectedOverlayPush]="true"
      [cdkConnectedOverlayViewportMargin]="12"
      (backdropClick)="opened.set(false)"
      (overlayKeydown)="onKeydown($event)"
      (detach)="opened.set(false)"
    >
      <section
        class="field-help-panel"
        role="dialog"
        [id]="panelId"
        [attr.aria-describedby]="panelId + '-text'"
        aria-modal="true"
        [attr.aria-label]="('Help for' | transloco) + ': ' + label()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
      >
        <div class="field-help-heading">
          <strong>{{ label() }}</strong>
          <button
            mat-icon-button
            type="button"
            cdkFocusInitial
            [attr.aria-label]="'Close help' | transloco"
            (click)="opened.set(false)"
          >
            <mat-icon aria-hidden="true">close</mat-icon>
          </button>
        </div>
        <p [id]="panelId + '-text'">{{ text() }}</p>
      </section>
    </ng-template>
  `,
})
export class FieldHelpComponent {
  readonly panelId = `mns-field-help-${++nextHelpId}`;
  readonly label = input.required<string>();
  readonly text = input.required<string>();
  readonly opened = signal(false);
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
  ];
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.opened.set(false);
  }
}
