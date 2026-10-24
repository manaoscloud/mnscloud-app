import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  ScaleControl,
} from 'maplibre-gl';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../../services/api.service';
import { DateTimeFormatService } from '../../../services/date-time-format.service';
import { openCrudComponentDialog } from '../../../shared/dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../../../shared/support-report-dialog/report-problem-button';
import {
  ensureMapLibreAssets,
  infraGisMapBase,
  type InfraGisMapConfig,
} from '../../infragis/map/map-base';

/** A punch with the location captured by Pulse (already returned by the punches list). */
export type PunchLocation = {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  employee: string;
  type: string;
  occurredAt: string;
};

export type PunchMapDialogData = { title: string; punches: readonly PunchLocation[] };

const SOURCE = 'hr-punches';
const BLANK: InfraGisMapConfig = {
  provider: 'none',
  styleUrl: null,
  pmtilesUrl: null,
  attribution: null,
  centerLatitude: -14.235,
  centerLongitude: -51.9253,
  zoom: 3.5,
  accessToken: null,
};

/** Punch rows with a captured location, as map points (rows without coordinates are skipped). */
export function punchLocations(
  rows: readonly Record<string, unknown>[],
  typeLabel: (type: unknown) => string,
): PunchLocation[] {
  return rows.flatMap((row) => {
    const latitude = Number(row['Latitude']);
    const longitude = Number(row['Longitude']);
    if (
      row['Latitude'] === null ||
      row['Latitude'] === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    )
      return [];
    const accuracy = Number(row['AccuracyMeters']);
    return [
      {
        id: String(row['TimePunchUUID'] ?? `${latitude},${longitude}`),
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) && row['AccuracyMeters'] !== null ? accuracy : null,
        employee: String(row['EmployeeName'] ?? ''),
        type: typeLabel(row['Type']),
        occurredAt: String(row['OccurredAt'] ?? ''),
      },
    ];
  });
}

/**
 * Locations captured with Pulse punches over the platform base map (the InfraGIS MapProvider
 * boundary, `infragis/map/config`). Without access to that configuration the points are drawn
 * over a plain background. Shows only punches the user already read in the list.
 */
@Component({
  selector: 'app-hr-punch-map-dialog',
  standalone: true,
  imports: [MatButtonModule, ReportProblemButtonComponent, TranslocoPipe],
  template: `
    <div class="crud-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ data.title | transloco }}</h2>
          <p>
            {{
              'Locations captured by Pulse when the punch was recorded; the circle is the accuracy reported by the device.'
                | transloco
            }}
          </p>
        </div>
        <mns-report-problem-button />
      </header>
      <div class="dialog-content">
        <div class="dialog-scroll">
          @if (baseUnavailable()) {
            <p class="dashboard-message" role="status">
              {{ 'The base map is unavailable; the points are shown without it.' | transloco }}
            </p>
          }
          @if (error(); as message) {
            <p class="dashboard-message" role="alert">{{ message | transloco }}</p>
          }
          <div
            #mapCanvas
            class="hr-punch-map-canvas"
            role="img"
            [attr.aria-label]="'Punch locations' | transloco"
          ></div>
          <p class="hr-punch-map-count">
            {{ 'Punches with location' | transloco }}: {{ data.punches.length }}
          </p>
        </div>
      </div>
      <div class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" (click)="close()">
            {{ 'Close' | transloco }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .hr-punch-map-canvas {
      height: min(60vh, 32rem);
      min-height: 18rem;
      border: 1px solid var(--mat-sys-color-outline-variant);
      border-radius: 0.75rem;
      overflow: hidden;
    }
    .hr-punch-map-count {
      margin: 0.5rem 0 0;
      color: var(--mat-sys-color-on-surface-variant);
    }
  `,
})
export class PunchMapDialogComponent {
  readonly data = inject<PunchMapDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<PunchMapDialogComponent>);
  private readonly api = inject(ApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly dateTime = inject(DateTimeFormatService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapCanvas');
  private map: MapLibreMap | null = null;

  readonly baseUnavailable = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.map?.remove());
    afterNextRender(() => void this.initialize());
  }

  close(): void {
    this.dialogRef.close();
  }

  private async initialize(): Promise<void> {
    ensureMapLibreAssets();
    let config = BLANK;
    try {
      const response = await this.api.get<{ data: { config: InfraGisMapConfig } }>(
        'infragis/map/config',
        { silent: true },
      );
      config = response.data.config ?? BLANK;
    } catch {
      this.baseUnavailable.set(true);
    }
    try {
      this.createMap(config);
    } catch {
      this.error.set('The map could not be loaded.');
    }
  }

  private createMap(config: InfraGisMapConfig): void {
    const base = infraGisMapBase(config, this.transloco.getActiveLang().slice(0, 2));
    const map = new MapLibreMap({
      container: this.container().nativeElement,
      style: base.style,
      center: base.center,
      zoom: base.zoom,
      transformRequest: base.transformRequest,
      attributionControl: false,
    });
    map.addControl(
      new AttributionControl({ compact: true, customAttribution: base.attribution ?? undefined }),
    );
    map.addControl(new NavigationControl(), 'top-right');
    map.addControl(new ScaleControl(), 'bottom-left');
    map.on('load', () => {
      map.addSource(SOURCE, { type: 'geojson', data: this.features() });
      map.addLayer({
        id: 'hr-punch-accuracy',
        type: 'circle',
        source: SOURCE,
        paint: {
          // Accuracy radius in meters converted to pixels at the current zoom (Web Mercator).
          'circle-radius': [
            'interpolate',
            ['exponential', 2],
            ['zoom'],
            0,
            0,
            22,
            ['/', ['coalesce', ['get', 'accuracy'], 0], 0.0373],
          ],
          'circle-color': '#2563EB',
          'circle-opacity': 0.12,
          'circle-stroke-color': '#2563EB',
          'circle-stroke-opacity': 0.4,
          'circle-stroke-width': 1,
        },
      });
      map.addLayer({
        id: 'hr-punch-point',
        type: 'circle',
        source: SOURCE,
        paint: {
          'circle-radius': 6,
          'circle-color': '#2563EB',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.on('click', 'hr-punch-point', (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const coordinates = (feature.geometry as unknown as { coordinates: [number, number] })
          .coordinates;
        new Popup({ closeButton: true })
          .setLngLat(coordinates)
          .setDOMContent(this.popupContent(feature.properties ?? {}))
          .addTo(map);
      });
      map.on('mouseenter', 'hr-punch-point', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'hr-punch-point', () => (map.getCanvas().style.cursor = ''));
      this.fit(map);
    });
    map.on('error', (event) => {
      if (!map.loaded()) this.error.set(event.error?.message ?? 'The map could not be loaded.');
    });
    this.map = map;
  }

  private features() {
    return {
      type: 'FeatureCollection' as const,
      features: this.data.punches.map((punch) => ({
        type: 'Feature' as const,
        id: punch.id,
        geometry: { type: 'Point' as const, coordinates: [punch.longitude, punch.latitude] },
        properties: {
          employee: punch.employee,
          type: punch.type,
          occurredAt: punch.occurredAt,
          accuracy: punch.accuracy,
        },
      })),
    };
  }

  /** Popup text built as DOM text nodes: record data is never parsed as HTML. */
  private popupContent(properties: Record<string, unknown>): HTMLElement {
    const box = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = String(properties['employee'] ?? '');
    box.appendChild(title);
    const lines = [
      String(properties['type'] ?? ''),
      this.dateTime.formatDateTime(String(properties['occurredAt'] ?? '')),
      properties['accuracy'] !== null && properties['accuracy'] !== undefined
        ? `± ${Math.round(Number(properties['accuracy']))} m`
        : '',
    ];
    for (const line of lines.filter(Boolean)) {
      const item = document.createElement('div');
      item.textContent = line;
      box.appendChild(item);
    }
    return box;
  }

  private fit(map: MapLibreMap): void {
    const punches = this.data.punches;
    if (!punches.length) return;
    if (punches.length === 1) {
      map.jumpTo({ center: [punches[0].longitude, punches[0].latitude], zoom: 16 });
      return;
    }
    const bounds = new LngLatBounds();
    for (const punch of punches) bounds.extend([punch.longitude, punch.latitude]);
    map.fitBounds(bounds, { padding: 48, maxZoom: 17, duration: 0 });
  }
}

export async function openPunchMapDialog(dialog: MatDialog, data: PunchMapDialogData) {
  const binding = openCrudComponentDialog(dialog, PunchMapDialogComponent, 'crud-form-dialog', {
    data,
  });
  try {
    await firstValueFrom(binding.ref.afterClosed());
  } finally {
    binding.stop();
  }
}
