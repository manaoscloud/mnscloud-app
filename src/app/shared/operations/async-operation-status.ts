import { MatButtonModule } from '@angular/material/button';
import { Component, DestroyRef, inject } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';
import { AsyncOperation, AsyncOperationsService } from './async-operations.service';

@Component({
  selector: 'mns-async-operation-status',
  standalone: true,
  imports: [MatChipsModule, MatButtonModule, TranslocoPipe],
  template: `
    @if (operations.visible().length) {
      <div class="operation-status-list" role="status" aria-live="polite">
        @for (operation of operations.visible(); track operation.operationUUID) {
          <div class="operation-status-item">
            <span>{{ 'Operation' | transloco }} {{ operation.operationUUID.slice(0, 8) }}</span>
            <mat-chip class="status-pill" [class.active]="operation.state === 'succeeded'">
              {{ label(operation.state) | transloco }}
            </mat-chip>
            @if (operation.state === 'blocked' || operation.state === 'failed') {
              <span>{{ errorLabel(operation.errorCode) | transloco }}</span>
              @if (operation.canRecheck) {
                <button
                  mat-stroked-button
                  type="button"
                  [disabled]="operations.rechecking().has(operation.operationUUID)"
                  (click)="recheck(operation)"
                >
                  {{ 'Verify again' | transloco }}
                </button>
              }
            }
          </div>
        }
      </div>
    }
  `,
})
export class AsyncOperationStatusComponent {
  protected readonly operations = inject(AsyncOperationsService);
  private readonly destroy = inject(DestroyRef);
  constructor() {
    void this.operations.resume(this.destroy);
  }
  protected recheck(operation: AsyncOperation) {
    void this.operations.recheck(operation, this.destroy).catch(() => {});
  }
  protected errorLabel(code?: string | null): string {
    return (
      (
        {
          DNS_REVISION_CHANGED: 'The DNS zone changed. Refresh before trying again.',
          DNS_RECORD_PROTECTED: 'The DNS record is missing or managed by the provider.',
          DNS_RECORD_CONFLICT: 'The requested DNS record conflicts with an existing record.',
          DNS_PERMISSION_REVOKED: 'Your DNS permission changed. Check your access.',
          DNS_BINDING_CHANGED: 'The DNS provider changed. Review the domain before trying again.',
          DNS_DOMAIN_UNAVAILABLE: 'The DNS domain is no longer available.',
        } as Record<string, string>
      )[code ?? ''] ?? 'Check the operation before submitting it again.'
    );
  }
  protected label(state: string): string {
    return (
      (
        {
          queued: 'Queued',
          running: 'Processing',
          waiting_retry: 'Waiting for retry',
          verifying: 'Verifying',
          succeeded: 'Completed',
          blocked: 'Needs attention',
          failed: 'Failed',
          cancelled: 'Cancelled',
        } as Record<string, string>
      )[state] ?? 'Unknown'
    );
  }
}
