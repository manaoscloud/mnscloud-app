import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';
import { Component, input, output } from '@angular/core';
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
  id?: string;
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
  imports: [
    MatChipsModule,
    TranslocoPipe,
    MnsDateTimePipe,
    MatSelectModule,
    MatFormFieldModule,
    MatPaginatorModule,
  ],
  template: `
    <section class="dashboard-panel">
      <div class="panel-header">
        <h2>{{ title() | transloco }}</h2>
        @if (sortOptions().length) {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'Sort by' | transloco }}</mat-label>
            <mat-select
              [value]="sortActive() + ':' + sortDirection()"
              (selectionChange)="changeSort($event.value)"
            >
              @for (option of sortOptions(); track option.key) {
                <mat-option [value]="option.key + ':asc'"
                  >{{ option.label | transloco }} · {{ 'Ascending' | transloco }}</mat-option
                >
                <mat-option [value]="option.key + ':desc'"
                  >{{ option.label | transloco }} · {{ 'Descending' | transloco }}</mat-option
                >
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
      @if (items().length) {
        <div class="inventory-list">
          @for (row of items(); track row.id ?? row.name + ':' + row.meta) {
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
      @if (total() !== null) {
        <mat-paginator
          class="mobile-paginator"
          [length]="total() ?? 0"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[5, 10, 25]"
          (page)="page.emit($event)"
          showFirstLastButtons
        />
      }
      <ng-content />
    </section>
  `,
})
export class DashboardRecordListComponent {
  readonly sortOptions = input<{ key: string; label: string }[]>([]);
  readonly sortActive = input('');
  readonly sortDirection = input<Sort['direction']>('');
  readonly sortChange = output<Sort>();
  readonly total = input<number | null>(null);
  readonly pageIndex = input(0);
  readonly pageSize = input(5);
  readonly page = output<PageEvent>();
  changeSort(value: string) {
    const [active, direction] = value.split(':');
    this.sortChange.emit({ active, direction: direction === 'desc' ? 'desc' : 'asc' });
  }
  readonly title = input.required<string>();
  readonly items = input.required<DashboardRecord[]>();
  readonly emptyLabel = input('No records found.');
}
