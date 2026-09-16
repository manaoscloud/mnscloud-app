import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AsyncOperationsService } from './async-operations.service';

@Component({
  selector: 'mns-async-operation-activity',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <div class="activity-panel" (click)="$event.stopPropagation()">
      <div class="activity-panel-header">
        <span>{{ 'operations.activityTitle' | transloco }}</span>
      </div>
      @if (!operations.visible().length) {
        <p class="activity-empty">{{ 'operations.activityEmpty' | transloco }}</p>
      } @else {
        <ul class="activity-list">
          @for (operation of operations.visible(); track operation.operationUUID) {
            <li class="activity-item">
              <div class="activity-item-main">
                <span class="activity-id">{{ shortId(operation.operationUUID) }}</span>
                <span class="activity-state" [attr.data-state]="operation.state">
                  {{ stateLabel(operation.state) | transloco }}
                </span>
              </div>
              @if (operation.errorCode) {
                <div class="activity-error">{{ operation.errorCode }}</div>
              }
              <div class="activity-item-actions">
                @if (operation.canRecheck && (operation.state === 'blocked' || operation.state === 'failed')) {
                  <button
                    mat-button
                    type="button"
                    [disabled]="operations.rechecking().has(operation.operationUUID)"
                    (click)="operations.recheck(operation, destroy)"
                  >
                    @if (operations.rechecking().has(operation.operationUUID)) {
                      <mat-spinner diameter="16"></mat-spinner>
                    } @else {
                      {{ 'Recheck' | transloco }}
                    }
                  </button>
                }
                @if (
                  operation.state === 'succeeded' ||
                  operation.state === 'blocked' ||
                  operation.state === 'failed' ||
                  operation.state === 'cancelled'
                ) {
                  <button mat-icon-button type="button" (click)="operations.dismiss(operation.operationUUID)">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      .activity-panel {
        min-width: 280px;
        max-width: 360px;
        padding: 0.5rem 0.25rem;
      }
      .activity-panel-header {
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--mat-sys-color-on-surface-variant);
        padding: 0.25rem 0.75rem 0.5rem;
      }
      .activity-empty {
        margin: 0;
        padding: 0.5rem 0.75rem 0.75rem;
        font-size: 0.85rem;
        color: var(--mat-sys-color-on-surface-variant);
      }
      .activity-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 320px;
        overflow: auto;
      }
      .activity-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.5rem 0.75rem;
        border-top: 1px solid var(--mat-sys-color-outline-variant);
      }
      .activity-item-main {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        min-width: 0;
      }
      .activity-id {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.8rem;
      }
      .activity-state {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--mat-sys-color-primary);
      }
      .activity-state[data-state='succeeded'] {
        color: var(--mat-sys-color-primary);
      }
      .activity-state[data-state='blocked'],
      .activity-state[data-state='failed'] {
        color: var(--mat-sys-color-error);
      }
      .activity-error {
        font-size: 0.75rem;
        color: var(--mat-sys-color-error);
        word-break: break-word;
      }
      .activity-item-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.25rem;
      }
    `,
  ],
})
export class AsyncOperationActivityComponent {
  readonly operations = inject(AsyncOperationsService);
  readonly destroy = inject(DestroyRef);

  shortId(uuid: string) {
    return uuid.replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  stateLabel(state: string) {
    switch (state) {
      case 'queued':
        return 'operations.state.queued';
      case 'running':
        return 'operations.state.running';
      case 'verifying':
        return 'operations.state.verifying';
      case 'waiting_retry':
        return 'operations.state.waitingRetry';
      case 'succeeded':
        return 'operations.state.succeeded';
      case 'blocked':
        return 'operations.state.blocked';
      case 'failed':
        return 'operations.state.failed';
      case 'cancelled':
        return 'operations.state.cancelled';
      default:
        return state;
    }
  }
}
