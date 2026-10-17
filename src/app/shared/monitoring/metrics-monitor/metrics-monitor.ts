import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { DetailPageComponent } from '../../pages/detail-page';
import { MnsSearchSelectFieldComponent } from '../../forms/mns-search-select-field/mns-search-select-field';
import { RefreshButtonComponent } from '../../refresh-button/refresh-button';
import { MnsDateTimePipe } from '../../date-time/date-time.pipe';
import { AppI18nService } from '../../../services/app-i18n.service';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { GlobalTableComponent, defineGlobalTable } from '../../crud/configurable-crud/global-table';
import { ConfigurableCrudRecord } from '../../crud/configurable-crud/configurable-crud-page-base';
import {
  METRICS_MONITOR_PERIODS,
  MetricsMonitorPeriodOption,
  MetricsMonitorPoint,
  MetricsMonitorResourceOption,
  MetricsMonitorSeries,
  buildMetricsMonitorSeries,
  formatMetricDisplay,
  formatMetricUnitLabel,
  parseUtcDate,
} from './metrics-monitor.types';
import { ReportProblemButtonComponent } from '../../support-report-dialog/report-problem-button';

@Component({
  selector: 'mns-metrics-monitor',
  standalone: true,
  imports: [
    ReportProblemButtonComponent,
    NgTemplateOutlet,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
    DetailPageComponent,
    MnsSearchSelectFieldComponent,
    RefreshButtonComponent,
    MnsDateTimePipe,
    GlobalTableComponent,
  ],
  templateUrl: './metrics-monitor.html',
  styleUrl: './metrics-monitor.scss',
})
export class MetricsMonitorComponent {
  private readonly i18n = inject(AppI18nService);
  private readonly translate = inject(TranslocoService);

  readonly title = input.required<string>();
  /** What the monitored resource shows (Page Description Contract). */
  readonly description = input.required<string>();
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

  readonly clock = signal(Date.now());

  readonly series = computed(() =>
    buildMetricsMonitorSeries(this.points(), Number(this.hours()) || 1, this.clock()),
  );

  private readonly dateTime = inject(DateTimeFormatService);
  /** "View measurements" rows of each series, keyed for the read-only global table. */
  readonly measurementRows = computed(
    () =>
      new Map<MetricsMonitorSeries, ConfigurableCrudRecord[]>(
        this.series().map((item) => [
          item,
          item.points.map((point) => ({
            ...point,
            key: `${point.metricKey}:${point.bucketEpoch}`,
          })),
        ]),
      ),
  );
  readonly measurementTable = defineGlobalTable({
    key: 'monitoring/metrics/measurements',
    uuidField: 'key',
    emptyLabel: 'No monitoring samples available',
    columns: [
      { id: 'label', label: 'Metric', field: 'label', translateValue: true },
      {
        id: 'observedAt',
        label: 'Time',
        field: 'observedAt',
        value: (row) =>
          this.dateTime.formatDateTime(this.utc(String(row['observedAt'] ?? '')), 'short', 'short'),
      },
      {
        id: 'average',
        label: 'Average',
        field: 'average',
        kind: 'number',
        maximumFractionDigits: 2,
      },
      {
        id: 'minimum',
        label: 'Minimum',
        field: 'minimum',
        kind: 'number',
        maximumFractionDigits: 2,
      },
      {
        id: 'maximum',
        label: 'Maximum',
        field: 'maximum',
        kind: 'number',
        maximumFractionDigits: 2,
      },
    ],
  });

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
