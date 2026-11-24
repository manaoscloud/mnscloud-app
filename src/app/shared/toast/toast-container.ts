import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { SnackbarService } from '../../services/snackbar.service';
import { AppI18nService } from '../../services/app-i18n.service';

@Component({
  selector: 'mns-toast-container',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    @if (toasts().length > 0) {
      <div
        class="mns-toast-container"
        role="region"
        aria-label="Alertas e Notificações"
        aria-live="polite"
        (mouseenter)="onMouseEnter()"
        (mouseleave)="onMouseLeave()"
      >
        @for (toast of toasts(); track toast.id) {
          <div
            class="mns-toast mns-toast-{{ toast.type }}"
            [class.mns-toast-dismissing]="toast.dismissing"
            [attr.role]="toast.type === 'error' ? 'alert' : 'status'"
          >
            <div class="mns-toast-icon">
              @switch (toast.type) {
                @case ('success') {
                  <mat-icon>check_circle</mat-icon>
                }
                @case ('error') {
                  <mat-icon>error</mat-icon>
                }
                @case ('warning') {
                  <mat-icon>warning</mat-icon>
                }
                @case ('info') {
                  <mat-icon>info</mat-icon>
                }
              }
            </div>

            <div class="mns-toast-body">
              <span class="mns-toast-message">{{ toast.message }}</span>
              @if (toast.count > 1) {
                <span class="mns-toast-badge">{{ toast.count }}x</span>
              }
            </div>

            @if (toast.action; as action) {
              <button type="button" class="mns-toast-action" (click)="action.onClick()">
                {{ action.label }}
              </button>
            }

            <button
              type="button"
              class="mns-toast-close"
              [attr.aria-label]="closeLabel()"
              (click)="onDismiss(toast.id)"
            >
              <mat-icon>close</mat-icon>
            </button>

            <div
              class="mns-toast-progress"
              [style.animation-duration]="toast.duration + 'ms'"
              [class.mns-toast-progress-paused]="isPaused()"
            ></div>
          </div>
        }
      </div>
    }
  `,
  styles: [
    `
      .mns-toast-container {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        width: min(520px, calc(100vw - 32px));
        z-index: 10000;
        display: flex;
        flex-direction: column-reverse;
        align-items: stretch;
        gap: 10px;
        pointer-events: none;
      }

      @media (max-width: 600px) {
        .mns-toast-container {
          bottom: 16px;
          left: 16px;
          right: 16px;
          transform: none;
          width: auto;
          gap: 8px;
        }
      }

      .mns-toast {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 12px;
        color: #ffffff;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.4;
        box-shadow:
          0 10px 25px -5px rgba(0, 0, 0, 0.25),
          0 8px 10px -6px rgba(0, 0, 0, 0.15);
        pointer-events: auto;
        overflow: hidden;
        box-sizing: border-box;
        animation: mnsToastEnter 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transition:
          transform 0.2s ease,
          opacity 0.2s ease,
          max-height 0.2s ease,
          margin 0.2s ease;
        max-height: 200px;
      }

      .mns-toast-dismissing {
        animation: mnsToastExit 0.2s cubic-bezier(0.4, 0, 1, 1) forwards !important;
      }

      @keyframes mnsToastEnter {
        from {
          opacity: 0;
          transform: translateY(14px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes mnsToastExit {
        from {
          opacity: 1;
          transform: scale(1);
          max-height: 200px;
          margin-bottom: 0;
        }
        to {
          opacity: 0;
          transform: scale(0.92);
          max-height: 0;
          padding-top: 0;
          padding-bottom: 0;
          margin-bottom: -10px;
        }
      }

      .mns-toast-success {
        background-color: #16a34a;
        border: 1px solid rgba(255, 255, 255, 0.22);
      }

      .mns-toast-error {
        background-color: #dc2626;
        border: 1px solid rgba(255, 255, 255, 0.22);
      }

      .mns-toast-warning {
        background-color: #d97706;
        border: 1px solid rgba(255, 255, 255, 0.22);
      }

      .mns-toast-info {
        background-color: #2563eb;
        border: 1px solid rgba(255, 255, 255, 0.22);
      }

      .mns-toast-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        opacity: 0.95;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .mns-toast-body {
        flex: 1;
        min-width: 0;
        word-break: break-word;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .mns-toast-message {
        display: inline;
      }

      .mns-toast-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 1px 7px;
        font-size: 0.75rem;
        font-weight: 700;
        border-radius: 9999px;
        background: rgba(0, 0, 0, 0.28);
        color: #ffffff;
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.2);
        animation: mnsBadgePulse 0.2s ease-out;
      }

      @keyframes mnsBadgePulse {
        0% {
          transform: scale(0.8);
        }
        50% {
          transform: scale(1.15);
        }
        100% {
          transform: scale(1);
        }
      }

      .mns-toast-action {
        flex-shrink: 0;
        padding: 5px 12px;
        font-size: 0.8125rem;
        font-weight: 600;
        color: #ffffff;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.35);
        border-radius: 6px;
        cursor: pointer;
        transition:
          background 0.15s ease,
          transform 0.1s ease;

        &:hover {
          background: rgba(255, 255, 255, 0.32);
          transform: translateY(-1px);
        }

        &:active {
          transform: translateY(0);
        }
      }

      .mns-toast-close {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background: transparent;
        border: none;
        color: #ffffff;
        opacity: 0.75;
        cursor: pointer;
        padding: 4px;
        border-radius: 6px;
        transition:
          opacity 0.15s ease,
          background 0.15s ease;

        &:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.18);
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }

      .mns-toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        width: 100%;
        background: rgba(255, 255, 255, 0.45);
        transform-origin: left;
        animation: mnsToastProgress linear forwards;
      }

      .mns-toast-progress-paused {
        animation-play-state: paused !important;
      }

      @keyframes mnsToastProgress {
        from {
          transform: scaleX(1);
        }
        to {
          transform: scaleX(0);
        }
      }
    `,
  ],
})
export class ToastContainer {
  private readonly snackbar = inject(SnackbarService);
  private readonly i18n = inject(AppI18nService);

  readonly toasts = this.snackbar.toasts;
  readonly isPaused = this.snackbar.isPaused;
  readonly closeLabel = computed(() => this.i18n.t('snackbar.close'));

  onMouseEnter() {
    this.snackbar.pause();
  }

  onMouseLeave() {
    this.snackbar.resume();
  }

  onDismiss(id: string) {
    this.snackbar.dismiss(id);
  }
}
