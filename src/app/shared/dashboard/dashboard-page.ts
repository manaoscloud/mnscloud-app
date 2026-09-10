import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../refresh-button/refresh-button';
import { MnsDateTimePipe } from '../date-time/date-time.pipe';

@Component({
  selector: 'mns-dashboard-page',
  standalone: true,
  imports: [MatCardModule, TranslocoPipe, RefreshButtonComponent, MnsDateTimePipe],
  template: `
    <section class="erp-page dashboard-page" animate.enter="app-fade-in">
      <mat-card class="erp-card dashboard-shell">
        <header class="erp-header">
          <div>
            <h1>{{ title() | transloco }}</h1>
            <p>{{ description() | transloco }}</p>
          </div>
          <div class="header-actions">
            <app-refresh-button [loading]="loading()" (refresh)="refresh.emit()" />
          </div>
        </header>
        <div class="dashboard-context">
          @if (updatedAt()) {
            <span>{{ 'Last updated' | transloco }} · {{ updatedAt() | mnsDateTime }}</span>
          }
          @if (context()) {
            <span>{{ context() | transloco }}</span>
          }
        </div>
        @if (error()) {
          <p class="dashboard-message" role="alert">
            {{ 'Unable to refresh dashboard.' | transloco }}
            @if (hasData()) {
              {{ 'Showing the last successful update.' | transloco }}
            }
          </p>
        }
        @if (loading() && !hasData()) {
          <div class="dashboard-skeleton" role="status" [attr.aria-label]="'Loading' | transloco">
            @for (tile of [1, 2, 3, 4]; track tile) {
              <div></div>
            }
          </div>
        }
        <div class="dashboard-body" [hidden]="!hasData()" [attr.aria-busy]="loading()">
          <ng-content />
        </div>
      </mat-card>
    </section>
  `,
})
export class DashboardPageComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly context = input('');
  readonly loading = input(false);
  readonly error = input<unknown>(undefined);
  readonly hasData = input(false);
  readonly updatedAt = input<string | null>(null);
  readonly refresh = output<void>();
}
