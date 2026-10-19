import { Component, computed, input, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** One series of a trend: `key` matches `TrendPoint.values`, `label` is a translation key. */
export interface TrendSeries {
  key: string;
  label: string;
}

/** One day of a trend (ISO date) with a value per series key; missing keys count as zero. */
export interface TrendPoint {
  day: string;
  values: Record<string, number>;
}

export type TrendKind = 'bars' | 'stacked' | 'line';

const CHART_HEIGHT = 160;
const VIEW_WIDTH = 600;

/** Rounds the axis top up to 1, 2, 2.5 or 5 × 10ⁿ so ticks read as clean numbers. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * base >= value) ?? 10;
  return step * base;
}

/**
 * Shared daily trend chart (App home tabs and module dashboards). Presentation only: callers
 * pass filled days, translated labels and the value formatter. Columns use HTML so bars keep a
 * fixed 4px rounded end at any width; lines use SVG with non-scaling strokes. Identity never
 * depends on color alone: two or more series always render a legend, and every value is in the
 * screen-reader list and the hover tooltip.
 */
@Component({
  selector: 'mns-trend-chart',
  standalone: true,
  imports: [TranslocoPipe],
  template: `
    <figure class="mns-trend-chart" [attr.aria-labelledby]="captionId">
      <figcaption [id]="captionId">
        <strong>{{ title() | transloco }}</strong>
        @if (series().length > 1) {
          <span class="mns-trend-legend">
            @for (item of series(); track item.key; let i = $index) {
              <span class="mns-trend-legend-item">
                <i [class]="'mns-trend-swatch series-' + i" aria-hidden="true"></i>
                {{ item.label | transloco }}
              </span>
            }
          </span>
        }
      </figcaption>
      <div class="mns-trend-plot" aria-hidden="true">
        <div class="mns-trend-y">
          <span>{{ format()(yMax()) }}</span>
          <span>{{ format()(yMax() / 2) }}</span>
          <span>{{ format()(0) }}</span>
        </div>
        <div class="mns-trend-area" (mouseleave)="hovered.set(null)">
          @if (kind() === 'line') {
            <svg [attr.viewBox]="'0 0 ' + viewWidth + ' ' + height" preserveAspectRatio="none">
              @for (item of lines(); track item.key; let i = $index) {
                <polyline
                  [class]="'series-' + i"
                  [attr.points]="item.points"
                  vector-effect="non-scaling-stroke"
                />
              }
            </svg>
          }
          <div class="mns-trend-columns" [class.is-line]="kind() === 'line'">
            @for (column of columns(); track column.day; let index = $index) {
              <div
                class="mns-trend-column"
                [class.is-hovered]="hovered() === index"
                (mouseenter)="hovered.set(index)"
              >
                @if (kind() !== 'line') {
                  <div class="mns-trend-stack" [class.is-grouped]="kind() === 'bars'">
                    @for (segment of column.segments; track segment.key) {
                      <i [class]="'series-' + segment.index" [style.height.%]="segment.percent"></i>
                    }
                  </div>
                }
              </div>
            }
          </div>
          @if (tooltip(); as tip) {
            <div class="mns-trend-tooltip" [style.left.%]="tip.left">
              <strong>{{ tip.day }}</strong>
              @for (row of tip.rows; track row.key) {
                <span
                  ><i [class]="'mns-trend-swatch series-' + row.index"></i
                  >{{ row.label | transloco }}: {{ row.value }}</span
                >
              }
            </div>
          }
        </div>
        <div class="mns-trend-x">
          @for (label of xLabels(); track $index) {
            <span>{{ label }}</span>
          }
        </div>
      </div>
      <ul class="mns-trend-sr">
        @for (column of columns(); track column.day) {
          <li>
            {{ column.label }}:
            @for (segment of column.values; track segment.key; let last = $last) {
              {{ segment.label | transloco }} {{ segment.value }}{{ last ? '' : ',' }}
            }
          </li>
        }
      </ul>
    </figure>
  `,
})
export class TrendChartComponent {
  private static nextId = 0;
  readonly title = input.required<string>();
  readonly kind = input<TrendKind>('bars');
  readonly series = input.required<TrendSeries[]>();
  readonly points = input.required<TrendPoint[]>();
  readonly format = input<(value: number) => string>((value) => String(Math.round(value)));
  readonly language = input('en-US');

  readonly captionId = `mns-trend-${TrendChartComponent.nextId++}`;
  readonly height = CHART_HEIGHT;
  readonly viewWidth = VIEW_WIDTH;
  readonly hovered = signal<number | null>(null);

  private readonly dayFormat = computed(
    () =>
      new Intl.DateTimeFormat(this.language(), {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
      }),
  );

  private dayLabel(day: string) {
    const date = new Date(`${day}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? day : this.dayFormat().format(date);
  }

  readonly yMax = computed(() => {
    const points = this.points();
    const keys = this.series().map((item) => item.key);
    const peak = points.reduce((max, point) => {
      const values = keys.map((key) => point.values[key] ?? 0);
      const top =
        this.kind() === 'stacked' ? values.reduce((a, b) => a + b, 0) : Math.max(0, ...values);
      return Math.max(max, top);
    }, 0);
    return niceMax(peak);
  });

  readonly columns = computed(() => {
    const max = this.yMax();
    return this.points().map((point) => {
      const values = this.series().map((item, index) => ({
        key: item.key,
        index,
        label: item.label,
        raw: point.values[item.key] ?? 0,
        value: this.format()(point.values[item.key] ?? 0),
      }));
      // Stacked segments render top-down (last series on top); grouped bars side by side.
      const ordered = this.kind() === 'stacked' ? [...values].reverse() : values;
      return {
        day: point.day,
        label: this.dayLabel(point.day),
        values,
        segments: ordered.map((value) => ({
          key: value.key,
          index: value.index,
          percent: Math.min(100, (value.raw / max) * 100),
        })),
      };
    });
  });

  readonly lines = computed(() => {
    const points = this.points();
    const max = this.yMax();
    const step = points.length > 1 ? this.viewWidth / (points.length - 1) : 0;
    return this.series().map((item) => ({
      key: item.key,
      points: points
        .map((point, index) => {
          const y = this.height - ((point.values[item.key] ?? 0) / max) * this.height;
          return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' '),
    }));
  });

  readonly xLabels = computed(() => {
    const points = this.points();
    if (!points.length) return [];
    const middle = points[Math.floor((points.length - 1) / 2)];
    return [points[0], middle, points[points.length - 1]].map((point) => this.dayLabel(point.day));
  });

  readonly tooltip = computed(() => {
    const index = this.hovered();
    const columns = this.columns();
    if (index === null || !columns[index]) return null;
    const column = columns[index];
    const left = columns.length > 1 ? (index / (columns.length - 1)) * 100 : 50;
    return { day: column.label, left: Math.min(Math.max(left, 12), 88), rows: column.values };
  });
}
