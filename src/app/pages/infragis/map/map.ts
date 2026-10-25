import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  effect,
  inject,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import {
  TerraDraw,
  TerraDrawLineStringMode,
  TerraDrawPointMode,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  type GeoJSONStoreFeatures,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import { ApiService } from '../../../services/api.service';
import { SnackbarService } from '../../../services/snackbar.service';
import { DetailPageComponent } from '../../../shared/pages/detail-page';
import { MnsSearchSelectFieldComponent } from '../../../shared/forms/mns-search-select-field/mns-search-select-field';
import { ensureMapLibreAssets, infraGisMapBase, type InfraGisMapConfig } from './map-base';

type Option = { value: string; label: string };
type Geometry = GeoJSONStoreFeatures['geometry'];
type FeatureCollection = {
  type: 'FeatureCollection';
  features: { type: 'Feature'; id: string; geometry: Geometry; properties: Record<string, any> }[];
  total: number;
  truncated: boolean;
};
type DrawMode = 'point' | 'linestring' | 'polygon';

const SOURCE = 'infragis-assets';
const FEASIBILITY_SOURCE = 'infragis-feasibility';
const OUTAGE_SOURCE = 'infragis-outages';
/** Customer port occupancy of boxes: free, 70% or more, full (others keep their type color). */
const OCCUPANCY_COLORS = { ok: '#16A34A', high: '#F59E0B', full: '#DC2626' };
export type FeasibilityRow = Record<string, any>;

/** Circle of radiusM meters around a point as a GeoJSON polygon (64 vertices). */
export function radiusPolygon(lng: number, lat: number, radiusM: number) {
  const ring: number[][] = [];
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}
const OVERLAY_LAYERS = ['infragis-fill', 'infragis-outline', 'infragis-line', 'infragis-point'];
const EMPTY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [],
  total: 0,
  truncated: false,
};

/**
 * InfraGIS › Map: the tenant assets of the visible area over the platform map base. Drawing a
 * point, line or polygon opens the canonical asset form with the geometry; a selected asset can
 * have its geometry edited and saved. Records are edited in InfraGIS › Assets.
 */
@Component({
  selector: 'app-infragis-map',
  standalone: true,
  imports: [
    DetailPageComponent,
    MnsSearchSelectFieldComponent,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './map.html',
  styleUrl: './map.scss',
  encapsulation: ViewEncapsulation.None,
})
export class InfraGisMapPage {
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly container = viewChild.required<ElementRef<HTMLDivElement>>('mapCanvas');

  private map: MapLibreMap | null = null;
  private draw: TerraDraw | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Zoom to the assets once the features of a newly selected project arrive. */
  private fitPending = false;
  /** Visible box once the map is ready; the features resource follows it and the project. */
  private readonly viewport = signal<{
    west: number;
    south: number;
    east: number;
    north: number;
  } | null>(null);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly projects = signal<Option[]>([]);
  readonly layers = signal<Option[]>([]);
  readonly projectUUID = signal('');
  readonly hiddenLayers = signal<ReadonlySet<string>>(new Set());
  /** Assets of the visible area (and project filter); the API caps the window at 2000 features. */
  private readonly features = resource({
    params: () => {
      const box = this.viewport();
      return box ? { ...box, projectUUID: this.projectUUID() } : undefined;
    },
    defaultValue: EMPTY,
    loader: async ({ params }) => {
      const query = new URLSearchParams({
        minLng: String(params.west),
        minLat: String(params.south),
        maxLng: String(params.east),
        maxLat: String(params.north),
      });
      if (params.projectUUID) query.set('projectUUID', params.projectUUID);
      return (await this.api.get<{ data: FeatureCollection }>(`infragis/map/features?${query}`))
        .data;
    },
  });
  readonly collection = computed(() => this.features.value() ?? EMPTY);
  readonly selected = signal<Record<string, any> | null>(null);
  readonly drawMode = signal<DrawMode | null>(null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly visibleCount = computed(() => this.collection().features.length);
  readonly feasibilityMode = signal(false);
  readonly feasibilityRadius = signal(300);
  readonly feasibility = signal<FeasibilityRow[] | null>(null);
  readonly feasibilityLoading = signal(false);
  readonly outagesOn = signal(false);
  readonly outages = signal<FeasibilityRow[]>([]);
  private outageTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.moveTimer) clearTimeout(this.moveTimer);
      if (this.outageTimer) clearInterval(this.outageTimer);
      this.draw?.stop();
      this.map?.remove();
    });
    effect(() => {
      const data = this.collection();
      (this.map?.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data as any);
      if (this.fitPending && !this.features.isLoading()) {
        this.fitPending = false;
        untracked(() => this.fitToAssets());
      }
    });
    effect(() => {
      const error = this.features.error();
      this.error.set(error ? this.message(error, 'Assets could not be loaded.') : null);
    });
    afterNextRender(() => void this.initialize());
  }

  private async initialize() {
    ensureMapLibreAssets();
    try {
      const [config, projects] = await Promise.all([
        this.api.get<{ data: { config: InfraGisMapConfig } }>('infragis/map/config'),
        this.api.get<{ data: { items: Record<string, any>[] } }>('infragis/projects?limit=500'),
      ]);
      this.projects.set(
        projects.data.items.map((item) => ({ value: item['IprUUID'], label: item['IprName'] })),
      );
      this.createMap(config.data.config);
    } catch (error) {
      this.error.set(this.message(error, 'The map could not be loaded.'));
      this.loading.set(false);
    }
  }

  private createMap(config: InfraGisMapConfig) {
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
      this.addOverlay(map);
      this.draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawPointMode(),
          new TerraDrawLineStringMode(),
          new TerraDrawPolygonMode(),
          new TerraDrawSelectMode({
            flags: {
              point: { feature: { draggable: true } },
              linestring: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true },
                },
              },
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true },
                },
              },
            },
          }),
        ],
      });
      this.draw.start();
      this.draw.on('finish', (id, context) => {
        if (context.action === 'draw') void this.createFromDrawing(id);
      });
      this.loading.set(false);
      this.trackViewport();
    });
    map.on('click', (event) => {
      if (this.feasibilityMode()) void this.checkFeasibility(event.lngLat.lng, event.lngLat.lat);
    });
    map.on('moveend', () => {
      if (this.moveTimer) clearTimeout(this.moveTimer);
      this.moveTimer = setTimeout(() => this.trackViewport(), 250);
    });
    map.on('error', (event) => {
      if (!this.map?.loaded())
        this.error.set(event.error?.message ?? 'The map could not be loaded.');
    });
    this.map = map;
  }

  private addOverlay(map: MapLibreMap) {
    map.addSource(SOURCE, { type: 'geojson', data: EMPTY, promoteId: 'IgaUUID' });
    map.addSource(FEASIBILITY_SOURCE, { type: 'geojson', data: EMPTY });
    map.addSource(OUTAGE_SOURCE, { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'infragis-outage',
      type: 'circle',
      source: OUTAGE_SOURCE,
      paint: {
        'circle-color': '#DC2626',
        'circle-opacity': 0.25,
        'circle-radius': 18,
        'circle-stroke-color': '#DC2626',
        'circle-stroke-width': 2,
      },
    });
    map.addLayer({
      id: 'infragis-feasibility',
      type: 'fill',
      source: FEASIBILITY_SOURCE,
      paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12, 'fill-outline-color': '#2563EB' },
    });
    const color = ['coalesce', ['get', 'Color'], '#22C55E'] as any;
    const ports = ['coalesce', ['get', 'PortCount'], 0];
    const occupancy = [
      'case',
      ['>', ports, 0],
      [
        'step',
        ['/', ['coalesce', ['get', 'OccupiedPortCount'], 0], ports],
        OCCUPANCY_COLORS.ok,
        0.7,
        OCCUPANCY_COLORS.high,
        1,
        OCCUPANCY_COLORS.full,
      ],
      color,
    ] as any;
    map.addLayer({
      id: 'infragis-fill',
      type: 'fill',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': color, 'fill-opacity': 0.25 },
    });
    map.addLayer({
      id: 'infragis-outline',
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'line-color': color, 'line-width': 2 },
    });
    map.addLayer({
      id: 'infragis-line',
      type: 'line',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': color, 'line-width': 3 },
    });
    map.addLayer({
      id: 'infragis-point',
      type: 'circle',
      source: SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-color': occupancy,
        'circle-radius': 6,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      },
    });
    for (const id of OVERLAY_LAYERS) {
      map.on('click', id, (event) => this.select(event.features?.[0]));
      map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
    }
  }

  private trackViewport() {
    const bounds = this.map?.getBounds();
    if (!bounds) return;
    const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
    this.viewport.set({
      west: clamp(bounds.getWest(), 180),
      south: clamp(bounds.getSouth(), 90),
      east: clamp(bounds.getEast(), 180),
      north: clamp(bounds.getNorth(), 90),
    });
  }

  async selectProject(value: unknown) {
    const uuid = String(value ?? '');
    this.hiddenLayers.set(new Set());
    this.applyLayerFilter();
    this.layers.set([]);
    this.fitPending = true;
    this.projectUUID.set(uuid);
    if (uuid) {
      const result = await this.api.get<{ data: { items: Record<string, any>[] } }>(
        `infragis/layers?projectUUID=${encodeURIComponent(uuid)}&limit=500`,
      );
      this.layers.set(
        result.data.items.map((item) => ({ value: item['IglUUID'], label: item['IglName'] })),
      );
    }
  }

  toggleLayer(uuid: string, visible: boolean) {
    this.hiddenLayers.update((hidden) => {
      const next = new Set(hidden);
      if (visible) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
    this.applyLayerFilter();
  }

  private applyLayerFilter() {
    const map = this.map;
    if (!map?.getLayer('infragis-point')) return;
    const hidden = [
      '!',
      ['in', ['get', 'InfraGisLayerIglUUID'], ['literal', [...this.hiddenLayers()]]],
    ];
    const geometry: Record<string, string> = {
      'infragis-fill': 'Polygon',
      'infragis-outline': 'Polygon',
      'infragis-line': 'LineString',
      'infragis-point': 'Point',
    };
    for (const id of OVERLAY_LAYERS) {
      map.setFilter(id, ['all', ['==', ['geometry-type'], geometry[id]], hidden] as any);
    }
  }

  /** Zooms to the loaded assets (all of the project after selecting one). */
  fitToAssets() {
    const map = this.map;
    const features = this.collection().features;
    if (!map || !features.length) return;
    let [west, south, east, north] = [180, 90, -180, -90];
    const visit = (coordinates: any) => {
      if (typeof coordinates[0] === 'number') {
        west = Math.min(west, coordinates[0]);
        east = Math.max(east, coordinates[0]);
        south = Math.min(south, coordinates[1]);
        north = Math.max(north, coordinates[1]);
        return;
      }
      for (const item of coordinates) visit(item);
    };
    for (const feature of features) visit((feature.geometry as any).coordinates ?? []);
    map.fitBounds([west, south, east, north], { padding: 48, maxZoom: 17, duration: 400 });
  }

  private select(feature: MapGeoJSONFeature | undefined) {
    if (this.drawMode() || this.editing() || this.feasibilityMode()) return;
    this.selected.set(feature ? { ...feature.properties } : null);
  }

  clearSelection() {
    this.cancelEdit();
    this.selected.set(null);
  }

  setDrawMode(mode: DrawMode | null) {
    if (!this.draw) return;
    this.cancelEdit();
    this.selected.set(null);
    this.drawMode.set(mode);
    this.draw.clear();
    this.draw.setMode(mode ?? 'static');
  }

  /** A finished drawing opens the canonical asset form with the drawn geometry. */
  private async createFromDrawing(id: string | number) {
    const feature = this.draw?.getSnapshotFeature(id);
    if (!feature) return;
    const geometry = feature.geometry;
    const point = geometry.type === 'Point' ? (geometry.coordinates as number[]) : null;
    const { openQuickCreate } =
      await import('../../../shared/crud/configurable-crud/configurable-crud-quick-create-host');
    const result = await openQuickCreate(this.dialog, {
      loadComponent: () => import('../management/management').then((m) => m.InfraGisManagementPage),
      routeData: { resource: 'assets' },
      initialValues: {
        ...(this.projectUUID() ? { projectUUID: this.projectUUID() } : {}),
        geoJson: JSON.stringify(geometry, null, 2),
        ...(point ? { longitude: point[0], latitude: point[1] } : {}),
      },
    });
    this.draw?.clear();
    this.setDrawMode(null);
    if (result) this.features.reload();
  }

  /** Puts the selected asset geometry into the editor (drag vertices, add midpoints). */
  startEdit() {
    const asset = this.selected();
    const feature = this.collection().features.find((item) => item.id === asset?.['IgaUUID']);
    if (!this.draw || !feature) return;
    const mode = { Point: 'point', LineString: 'linestring', Polygon: 'polygon' }[
      feature.geometry.type
    ];
    if (!mode) {
      this.snack.error('This geometry type cannot be edited on the map.');
      return;
    }
    this.draw.clear();
    this.draw.setMode('select');
    const [added] = this.draw.addFeatures([
      { id: feature.id, type: 'Feature', geometry: feature.geometry, properties: { mode } },
    ] as GeoJSONStoreFeatures[]);
    if (!added?.valid) {
      this.snack.error('This geometry type cannot be edited on the map.');
      return;
    }
    this.draw.selectFeature(feature.id);
    this.editing.set(true);
  }

  cancelEdit() {
    if (!this.editing()) return;
    this.draw?.clear();
    this.draw?.setMode('static');
    this.editing.set(false);
  }

  /** Saves only the geometry of the selected asset (partial update; the type follows the GeoJSON). */
  async saveGeometry() {
    const asset = this.selected();
    const feature = asset ? this.draw?.getSnapshotFeature(asset['IgaUUID']) : undefined;
    if (!asset || !feature || this.saving()) return;
    const point =
      feature.geometry.type === 'Point' ? (feature.geometry.coordinates as number[]) : null;
    this.saving.set(true);
    try {
      await this.api.put(`infragis/assets/${asset['IgaUUID']}`, {
        geometryType: '',
        geoJson: feature.geometry,
        latitude: point ? point[1] : null,
        longitude: point ? point[0] : null,
      });
      this.snack.success('Geometry saved.');
      this.cancelEdit();
      this.features.reload();
    } catch (error) {
      this.snack.error(this.message(error, 'The geometry could not be saved.'));
    } finally {
      this.saving.set(false);
    }
  }

  reload() {
    this.clearSelection();
    this.features.reload();
  }

  /** Feasibility mode: the next clicks on the map list boxes with free customer ports nearby. */
  toggleFeasibility() {
    const next = !this.feasibilityMode();
    if (next) this.setDrawMode(null);
    this.feasibilityMode.set(next);
    if (!next) this.clearFeasibility();
  }

  clearFeasibility() {
    this.feasibility.set(null);
    (this.map?.getSource(FEASIBILITY_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY as any);
  }

  setFeasibilityRadius(event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.feasibilityRadius.set(Math.min(Math.max(value, 1), 5000));
  }

  private async checkFeasibility(lng: number, lat: number) {
    const radius = this.feasibilityRadius();
    (this.map?.getSource(FEASIBILITY_SOURCE) as GeoJSONSource | undefined)?.setData({
      type: 'Feature',
      geometry: radiusPolygon(lng, lat, radius),
      properties: {},
    } as any);
    this.feasibilityLoading.set(true);
    try {
      const query = new URLSearchParams({
        latitude: lat.toFixed(7),
        longitude: lng.toFixed(7),
        radiusM: String(radius),
      });
      if (this.projectUUID()) query.set('projectUUID', this.projectUUID());
      const result = await this.api.get<{ data: { items: FeasibilityRow[] } }>(
        `infragis/feasibility?${query}`,
      );
      this.feasibility.set(result.data.items ?? []);
    } catch (error) {
      this.snack.error(this.message(error, 'Feasibility could not be checked.'));
    } finally {
      this.feasibilityLoading.set(false);
    }
  }

  /** Outage alerts: boxes whose accesses dropped together, refreshed every minute while shown. */
  toggleOutages() {
    const next = !this.outagesOn();
    this.outagesOn.set(next);
    if (this.outageTimer) clearInterval(this.outageTimer);
    this.outageTimer = null;
    if (next) {
      void this.refreshOutages();
      this.outageTimer = setInterval(() => void this.refreshOutages(), 60_000);
    } else {
      this.outages.set([]);
      (this.map?.getSource(OUTAGE_SOURCE) as GeoJSONSource | undefined)?.setData(EMPTY as any);
    }
  }

  private async refreshOutages() {
    try {
      const result = await this.api.get<{ data: { items: FeasibilityRow[] } }>(
        'infragis/outage-signals',
        { silent: true },
      );
      const rows = result.data.items ?? [];
      this.outages.set(rows);
      (this.map?.getSource(OUTAGE_SOURCE) as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: rows
          .filter((row) => row['IgmLongitude'] !== null && row['IgmLatitude'] !== null)
          .map((row) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [Number(row['IgmLongitude']), Number(row['IgmLatitude'])],
            },
            properties: { IgaUUID: row['IgaUUID'] },
          })),
      } as any);
    } catch (error) {
      this.snack.error(this.message(error, 'Outage alerts could not be loaded.'));
    }
  }

  flyTo(row: FeasibilityRow) {
    const lat = Number(row['IgmLatitude']);
    const lng = Number(row['IgmLongitude']);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      this.map?.flyTo({ center: [lng, lat], zoom: Math.max(this.map.getZoom(), 17) });
    }
  }

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    return this.transloco.translate(fallback);
  }
}
