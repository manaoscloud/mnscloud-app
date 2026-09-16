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
              @if (
                (operation.canRecheck &&
                  (operation.state === 'blocked' || operation.state === 'failed')) ||
                operation.state === 'succeeded' ||
                operation.state === 'blocked' ||
                operation.state === 'failed' ||
                operation.state === 'cancelled'
              ) {
                <div class="activity-item-actions">
                  @if (
                    operation.canRecheck &&
                    (operation.state === 'blocked' || operation.state === 'failed')
                  ) {
                    <button
                      mat-stroked-button
                      type="button"
                      class="activity-recheck"
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
                    <button
                      mat-icon-button
                      type="button"
                      class="activity-dismiss"
                      (click)="operations.dismiss(operation.operationUUID)"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                </div>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .activity-panel {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
        padding: 0.5rem 0;
        overflow-x: hidden;
      }
      .activity-panel-header {
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--mat-sys-color-on-surface-variant);
        padding: 0.25rem 0.85rem 0.5rem;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .activity-empty {
        margin: 0;
        padding: 0.5rem 0.85rem 0.75rem;
        font-size: 0.85rem;
        color: var(--mat-sys-color-on-surface-variant);
        overflow-wrap: anywhere;
      }
      .activity-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: min(320px, 50vh);
        overflow-x: hidden;
        overflow-y: auto;
      }
      .activity-item {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        padding: 0.55rem 0.85rem;
        border-top: 1px solid var(--mat-sys-color-outline-variant);
        min-width: 0;
      }
      .activity-item-main {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 0.65rem;
        min-width: 0;
      }
      .activity-id {
        flex: 0 0 auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.8rem;
        line-height: 1.35;
      }
      .activity-state {
        flex: 1 1 auto;
        min-width: 0;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        text-align: right;
        line-height: 1.35;
        color: var(--mat-sys-color-primary);
        overflow-wrap: anywhere;
        white-space: normal;
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
        overflow-wrap: anywhere;
      }
      .activity-item-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: flex-end;
        gap: 0.35rem;
        min-width: 0;
      }
      .activity-recheck {
        min-height: 32px;
        line-height: 32px;
        padding: 0 0.7rem;
      }
      .activity-dismiss {
        width: 32px;
        height: 32px;
        padding: 0;
      }
      .activity-dismiss mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
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
