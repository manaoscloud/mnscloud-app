import { Component, DestroyRef, computed, effect, inject, input, model, output } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { DetailPageComponent } from '../../pages/detail-page';
import { MnsSearchSelectFieldComponent } from '../../forms/mns-search-select-field/mns-search-select-field';
import { RefreshButtonComponent } from '../../refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../date-time/date-time.pipe';
import { AppI18nService } from '../../../services/app-i18n.service';
import {
  METRICS_MONITOR_PERIODS,
  MetricsMonitorPeriodOption,
  MetricsMonitorPoint,
  MetricsMonitorResourceOption,
  buildMetricsMonitorSeries,
  formatMetricDisplay,
  formatMetricUnitLabel,
  parseUtcDate,
} from './metrics-monitor.types';

@Component({
  selector: 'mns-metrics-monitor',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    DetailPageComponent,
    MnsSearchSelectFieldComponent,
    RefreshButtonComponent,
    MnsDateTimePipe,
  ],
  templateUrl: './metrics-monitor.html',
  styleUrl: './metrics-monitor.scss',
})
export class MetricsMonitorComponent {
  private readonly i18n = inject(AppI18nService);
  private readonly translate = inject(TranslocoService);

  readonly title = input.required<string>();
  readonly identity = input('');
  readonly recordId = input('');
  readonly points = input<MetricsMonitorPoint[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly message = input<string | null>(null);
  readonly statusLabel = input<string | null>(null);
  readonly statusValue = input<string | null>(null);
  readonly emptyLabel = input('No monitoring samples available');
  readonly multiSeriesTitle = input('Receive and send');
  readonly showResourceFilter = input(false);
  readonly resourceOptions = input<MetricsMonitorResourceOption[]>([]);
  readonly periods = input<MetricsMonitorPeriodOption[]>(METRICS_MONITOR_PERIODS);
  readonly fullPageEnabled = input(true);
  readonly autoRefresh = input(true);
  readonly dialogMode = input(false);

  readonly hours = model(1);
  readonly selectedResource = model('');

  readonly refresh = output<void>();
  readonly fullPage = output<void>();
  readonly closeRequest = output<void>();

  private readonly clock = model(Date.now());

  readonly series = computed(() =>
    buildMetricsMonitorSeries(this.points(), Number(this.hours()) || 1, this.clock()),
  );

  constructor() {
    effect((onCleanup) => {
      if (!this.autoRefresh()) return;
      let failures = 0;
      let timer: ReturnType<typeof setTimeout>;
      const tick = () => {
        this.clock.set(Date.now());
        if (!document.hidden && !this.loading()) {
          failures = this.error() ? Math.min(failures + 1, 3) : 0;
          this.refresh.emit();
        }
        timer = setTimeout(tick, 30000 * 2 ** failures);
      };
      timer = setTimeout(tick, 30000);
      onCleanup(() => clearTimeout(timer));
    });
    inject(DestroyRef);
  }

  display(value: number, unit: string) {
    return formatMetricDisplay(
      value,
      unit,
      this.i18n.language(),
      this.translate.translate('State'),
    );
  }

  unitLabel(unit: string) {
    return formatMetricUnitLabel(unit, this.translate.translate('State'));
  }

  utc(value: string) {
    return parseUtcDate(value);
  }

  emitRefresh() {
    this.clock.set(Date.now());
    this.refresh.emit();
  }

  openFullPage() {
    this.fullPage.emit();
  }

  closeDialog() {
    this.closeRequest.emit();
  }
}
