import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-refresh-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <button
      mat-stroked-button
      color="primary"
      type="button"
      class="refresh-button"
      [disabled]="disabled() || loading()"
      [attr.aria-label]="ariaLabel() || (label() | transloco)"
      (click)="emitRefresh()"
    >
      <span class="refresh-button-content">
        <span class="refresh-button-icon" aria-hidden="true">
          @if (loading()) {
            <mat-progress-spinner
              class="refresh-button-spinner"
              mode="indeterminate"
              diameter="18"
              strokeWidth="3"
            />
          } @else {
            <mat-icon>refresh</mat-icon>
          }
        </span>
        <span class="refresh-button-label">{{ label() | transloco }}</span>
      </span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .refresh-button {
        min-width: var(--crud-action-button-width, 120px);
        height: 40px;
        line-height: 1;
        white-space: nowrap;
        --mdc-outlined-button-container-height: 40px;
      }

      .refresh-button-content {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        width: 100%;
        min-width: 0;
        line-height: 1;
      }

      .refresh-button-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        min-width: 18px;
      }

      .refresh-button-icon mat-icon {
        width: 18px;
        height: 18px;
        min-width: 18px;
        font-size: 18px;
        line-height: 18px;
      }

      .refresh-button-spinner {
        width: 18px !important;
        height: 18px !important;
        --mdc-circular-progress-active-indicator-color: currentColor;
      }

      .refresh-button-label {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `,
  ],
})
export class RefreshButtonComponent {
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly label = input('Refresh');
  readonly ariaLabel = input<string | null>(null);

  readonly refresh = output<void>();

  emitRefresh(): void {
    if (this.disabled() || this.loading()) {
      return;
    }

    this.refresh.emit();
  }
}
