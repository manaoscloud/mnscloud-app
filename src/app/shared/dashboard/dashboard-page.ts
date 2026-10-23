import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../refresh-button/refresh-button';

@Component({
  selector: 'mns-dashboard-page',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, TranslocoPipe, RefreshButtonComponent],
  template: `
    <section class="app-page dashboard-page" animate.enter="app-fade-in">
      <mat-card class="app-card dashboard-shell">
        <header class="app-header">
          <div>
            <h1>{{ title() | transloco }}</h1>
            <p>{{ description() | transloco }}</p>
          </div>
          <div class="header-actions">
            @if (customizable()) {
              <button
                mat-stroked-button
                type="button"
                class="dashboard-customize-button"
                [disabled]="!hasData()"
                (click)="customize.emit()"
              >
                <mat-icon aria-hidden="true">tune</mat-icon>
                {{ 'Customize' | transloco }}
              </button>
            }
            <app-refresh-button [loading]="loading()" (refresh)="refresh.emit()" />
          </div>
        </header>
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
  readonly loading = input(false);
  readonly error = input<unknown>(undefined);
  readonly hasData = input(false);
  readonly refresh = output<void>();
  /** App home only (check:dashboard): a second header action that opens the layout dialog. */
  readonly customizable = input(false);
  readonly customize = output<void>();
}
