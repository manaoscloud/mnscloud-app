export type MetricsMonitorPoint = {
  metricKey: string;
  label: string;
  unit: string;
  bucketEpoch: number;
  average: number;
  minimum: number;
  maximum: number;
  observedAt: string;
  samples: number;
};

export type MetricsMonitorResourceOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

export type MetricsMonitorPeriodOption = {
  value: number;
  label: string;
};

export type MetricsMonitorSeriesLine = {
  metricKey: string;
  path: string;
  latest: MetricsMonitorPoint;
  color: string;
  x: number;
  y: number;
};

export type MetricsMonitorSeries = {
  key: string;
  points: MetricsMonitorPoint[];
  last: MetricsMonitorPoint;
  max: number;
  lines: MetricsMonitorSeriesLine[];
  start: Date;
  end: Date;
  stale: boolean;
};

export const METRICS_MONITOR_PERIODS: MetricsMonitorPeriodOption[] = [
  { value: 1, label: 'Last hour' },
  { value: 24, label: 'Last 24 hours' },
  { value: 168, label: 'Last 7 days' },
];

export function buildMetricsMonitorSeries(
  points: MetricsMonitorPoint[],
  hours: number,
  nowMs: number,
  groupKey: (metricKey: string) => string = defaultMetricGroupKey,
): MetricsMonitorSeries[] {
  const groups = new Map<string, Map<string, MetricsMonitorPoint[]>>();
  for (const point of points) {
    const group = groupKey(point.metricKey);
    if (!groups.has(group)) groups.set(group, new Map());
    const metrics = groups.get(group)!;
    metrics.set(point.metricKey, [...(metrics.get(point.metricKey) ?? []), point]);
  }

  const end = nowMs / 1000;
  const start = end - hours * 3600;
  return [...groups].map(([key, metrics]) => {
    const seriesPoints = [...metrics.values()].flat().sort((a, b) => a.bucketEpoch - b.bucketEpoch);
    const last = seriesPoints.at(-1)!;
    const max = Math.max(
      ...seriesPoints.map((p) => p.maximum),
      last.unit === 'percent' ? 100 : 1,
    );
    const lines = [...metrics].map(([metricKey, samples], index) => {
      let previous = -Infinity;
      const path = samples
        .map((point) => {
          const x = 8 + (584 * (point.bucketEpoch - start)) / (end - start);
          const y = 152 - (136 * point.average) / max;
          const command =
            point.bucketEpoch - previous > Math.max(180, hours * 90) ? 'M' : 'L';
          previous = point.bucketEpoch;
          return `${command}${Math.max(8, x)},${y}`;
        })
        .join(' ');
      const latest = samples.at(-1)!;
      return {
        metricKey,
        path,
        latest,
        color: index === 0 ? '#477ee8' : '#bd6200',
        x: Math.max(8, 8 + (584 * (latest.bucketEpoch - start)) / (end - start)),
        y: 152 - (136 * latest.average) / max,
      };
    });
    return {
      key,
      points: seriesPoints,
      last,
      max,
      lines,
      start: new Date(start * 1000),
      end: new Date(end * 1000),
      stale: seriesPoints.some(
        (p) =>
          p === metrics.get(p.metricKey)?.at(-1) &&
          nowMs - parseUtcDate(p.observedAt).getTime() > 180000,
      ),
    };
  });
}

export function defaultMetricGroupKey(metricKey: string): string {
  if (metricKey.startsWith('host.network.')) {
    return metricKey.replace(/\.(rx|tx)_/, '.');
  }
  if (metricKey.endsWith('.rx') || metricKey.endsWith('.tx')) {
    return metricKey.replace(/\.(rx|tx)$/, '');
  }
  if (metricKey.includes('.inbound') || metricKey.includes('.outbound')) {
    return metricKey.replace(/\.(inbound|outbound)/, '');
  }
  return metricKey;
}

export function parseUtcDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
}

export function formatMetricDisplay(
  value: number,
  unit: string,
  language: string,
  stateLabel = 'State',
): string {
  const base = unit === 'bytes' ? 1024 : 1000;
  const labels =
    unit === 'bytes'
      ? ['B', 'KiB', 'MiB', 'GiB', 'TiB']
      : unit === 'bps'
        ? ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
        : [formatMetricUnitLabel(unit, stateLabel)];
  let scaled = value;
  let index = 0;
  while (scaled >= base && index < labels.length - 1) {
    scaled /= base;
    index++;
  }
  return (
    new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(scaled) +
    ' ' +
    labels[index]
  );
}

export function formatMetricUnitLabel(unit: string, stateLabel = 'State'): string {
  return unit === 'percent'
    ? '%'
    : unit === 'per_second'
      ? '/s'
      : unit === 'state'
        ? stateLabel
        : unit === 'bytes'
          ? 'B'
          : unit === 'load'
            ? 'load'
            : unit === 'count'
              ? 'count'
              : unit;
}
