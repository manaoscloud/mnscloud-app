import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
      <span>{{ label() | transloco }}</span>
    </button>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .refresh-button {
        min-width: var(--crud-action-button-width, 128px);
      }

      .refresh-button-spinner,
      .refresh-button mat-icon {
        margin-right: 0.5rem;
      }

      .refresh-button-spinner {
        --mdc-circular-progress-active-indicator-color: currentColor;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
