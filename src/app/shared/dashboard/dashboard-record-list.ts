import { Component, input } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { TranslocoPipe } from '@jsverse/transloco';
import { MnsDateTimePipe } from '../date-time/date-time.pipe';

export interface DashboardRecordDetail {
  label: string;
  value: string;
  format?: 'text' | 'datetime';
  translate?: boolean;
}
export interface DashboardRecord {
  name: string;
  meta: string;
  translateMeta?: boolean;
  status: string;
  tone: 'success' | 'danger' | 'running' | 'skipped';
  details: DashboardRecordDetail[];
}

/** Presentation only: callers own mapping, scope, requests and status semantics. */
@Component({
  selector: 'mns-dashboard-record-list',
  standalone: true,
  imports: [MatChipsModule, TranslocoPipe, MnsDateTimePipe],
  template: `
    <section class="dashboard-panel">
      <h2>{{ title() | transloco }}</h2>
      @if (items().length) {
        <div class="inventory-list">
          @for (row of items(); track row.name + ':' + row.meta) {
            <article class="inventory-row">
              <div class="inventory-title">
                <div>
                  <strong>{{ row.name }}</strong
                  ><span>{{ row.translateMeta ? (row.meta | transloco) : row.meta }}</span>
                </div>
                <mat-chip
                  class="status-pill state-chip"
                  [class.chip-success]="row.tone === 'success'"
                  [class.chip-danger]="row.tone === 'danger'"
                  [class.chip-running]="row.tone === 'running'"
                  [class.chip-skipped]="row.tone === 'skipped'"
                  [class.is-active]="row.tone === 'success'"
                  [class.is-inactive]="row.tone !== 'success'"
                >
                  {{ row.status | transloco }}
                </mat-chip>
              </div>
              <dl>
                @for (detail of row.details; track detail.label) {
                  <div>
                    <dt>{{ detail.label | transloco }}</dt>
                    <dd>
                      @if (detail.format === 'datetime') {
                        {{ detail.value ? (detail.value | mnsDateTime) : '-' }}
                      } @else {
                        {{ detail.translate ? (detail.value | transloco) : detail.value || '-' }}
                      }
                    </dd>
                  </div>
                }
              </dl>
            </article>
          }
        </div>
      } @else {
        <p class="empty-state">{{ emptyLabel() | transloco }}</p>
      }
    </section>
  `,
})
export class DashboardRecordListComponent {
  readonly title = input.required<string>();
  readonly items = input.required<DashboardRecord[]>();
  readonly emptyLabel = input('No records found.');
}
