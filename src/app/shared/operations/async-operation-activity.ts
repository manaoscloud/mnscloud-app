import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { AsyncOperation, AsyncOperationsService } from './async-operations.service';

const KIND_LABELS: Record<string, string> = {
  dns: 'operations.kind.dns',
  vps: 'operations.kind.vps',
  vpsContainer: 'operations.kind.vpsContainer',
  webhost: 'operations.kind.webhost',
  smtp: 'operations.kind.smtp',
  storage: 'operations.kind.storage',
  pabxControl: 'operations.kind.pabxControl',
  clinicBradescoSiad: 'operations.kind.clinicBradescoSiad',
  activityLog: 'operations.kind.activityLog',
};

const ACTION_LABELS: Record<string, string> = {
  provision: 'operations.action.provision',
  update: 'operations.action.update',
  delete: 'operations.action.delete',
  deprovision: 'operations.action.deprovision',
  sync: 'operations.action.sync',
  suspend: 'operations.action.suspend',
  unsuspend: 'operations.action.unsuspend',
  'reset-password': 'operations.action.resetPassword',
  change_plan: 'operations.action.changePlan',
  start: 'operations.action.start',
  stop: 'operations.action.stop',
  destroy: 'operations.action.destroy',
  snapshot_create: 'operations.action.snapshotCreate',
  snapshot_delete: 'operations.action.snapshotDelete',
  snapshot_restore: 'operations.action.snapshotRestore',
  network_create: 'operations.action.networkCreate',
  network_delete: 'operations.action.networkDelete',
  network_attach: 'operations.action.networkAttach',
  network_detach: 'operations.action.networkDetach',
  firewall_sync: 'operations.action.firewallSync',
  firewall_detach: 'operations.action.firewallDetach',
  firewall_delete: 'operations.action.firewallDelete',
  refresh: 'operations.action.refresh',
  'record.add': 'operations.action.recordAdd',
  'record.remove': 'operations.action.recordRemove',
  'pabx.realm.reconcile': 'operations.action.pabxRealm',
  'softswitch.realm.reconcile': 'operations.action.softswitchRealm',
  'realtime.domain.reconcile': 'operations.action.realtimeDomain',
  submit: 'operations.action.submit',
};

@Component({
  selector: 'mns-async-operation-activity',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <div class="activity-panel" (click)="$event.stopPropagation()">
      <div class="mns-menu-title">
        <span>{{ 'operations.activityTitle' | transloco }}</span>
      </div>
      @if (!operations.visible().length) {
        <p class="activity-empty">{{ 'operations.activityEmpty' | transloco }}</p>
      } @else {
        <ul class="activity-list">
          @for (operation of operations.visible(); track operation.operationUUID) {
            <li class="activity-item">
              <div class="activity-item-main">
                <div class="activity-text">
                  <span class="activity-title">
                    {{ kindLabel(operation.kind) | transloco }}
                    @if (actionLabel(operation.action); as action) {
                      · {{ action | transloco }}
                    } @else if (operation.action && operation.action !== 'execute') {
                      · {{ humanize(operation.action) }}
                    }
                  </span>
                  @if (operation.resourceLabel) {
                    <span class="activity-resource">{{ operation.resourceLabel }}</span>
                  }
                  <span class="activity-meta" [attr.title]="operation.operationUUID">
                    {{ shortId(operation.operationUUID) }}
                    @if (operation.createdAt) {
                      · {{ operation.createdAt | date: timeFormat(operation.createdAt) }}
                    }
                  </span>
                </div>
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
                      [attr.aria-label]="'topbar.dismissActivity' | transloco"
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
        overflow-x: hidden;
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
      .activity-text {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        flex: 1 1 auto;
        min-width: 0;
      }
      .activity-title {
        font-size: 0.85rem;
        font-weight: 600;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .activity-resource {
        font-size: 0.8rem;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .activity-meta {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.72rem;
        line-height: 1.35;
        color: var(--mat-sys-color-on-surface-variant);
      }
      .activity-state {
        flex: 0 0 auto;
        max-width: 45%;
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
        min-height: 44px;
        line-height: 44px;
        padding: 0 0.7rem;
      }
      .activity-dismiss {
        width: 44px;
        height: 44px;
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

  kindLabel(kind: AsyncOperation['kind']) {
    return (kind && KIND_LABELS[kind]) || 'operations.kind.unknown';
  }

  actionLabel(action: AsyncOperation['action']) {
    return action ? (ACTION_LABELS[action] ?? null) : null;
  }

  /** Readable fallback for an action the panel has no translation for yet. */
  humanize(action: string) {
    const text = action.replace(/[._-]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  timeFormat(createdAt: string) {
    return new Date(createdAt).toDateString() === new Date().toDateString() ? 'shortTime' : 'short';
  }

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
