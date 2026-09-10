import { Component, input, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { RefreshButtonComponent } from '../refresh-button/refresh-button';

@Component({
  selector: 'mns-page-shell',
  standalone: true,
  imports: [MatCardModule, TranslocoPipe, RefreshButtonComponent],
  template: `
    <section class="erp-page content-page" animate.enter="app-fade-in">
      <mat-card class="erp-card content-shell">
        <header class="erp-header">
          <div>
            <h1>{{ title() | transloco }}</h1>
            @if (description()) {
              <p>{{ description() | transloco }}</p>
            }
            @if (identity()) {
              <p>
                {{ identity() }}<span class="record-uuid">{{ recordId() }}</span>
              </p>
            }
          </div>
          <div class="header-actions">
            <app-refresh-button
              [loading]="loading()"
              [disabled]="refreshDisabled()"
              (refresh)="refresh.emit()"
            />
          </div>
        </header>
        <div class="content-page-body" [attr.aria-busy]="loading()"><ng-content /></div>
        <ng-content select="[pageFooter]" />
      </mat-card>
    </section>
  `,
})
export class PageShellComponent {
  readonly title = input.required<string>();
  readonly description = input('');
  readonly identity = input('');
  readonly recordId = input('');
  readonly loading = input(false);
  readonly refreshDisabled = input(false);
  readonly refresh = output<void>();
}
