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
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
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
import { infraGisMapBase, type InfraGisMapConfig } from './map-base';

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
const MAPLIBRE_STYLES_ID = 'mns-maplibre-styles';

/**
 * MapLibre CSS ships as the lazy `maplibre.css` bundle (angular.json, inject: false) and its module
 * worker as same-origin assets under `maplibre/`, as the edge CSP allows no `blob:` workers.
 */
function ensureMapLibreAssets() {
  setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
  if (document.getElementById(MAPLIBRE_STYLES_ID)) return;
  const link = document.createElement('link');
  link.id = MAPLIBRE_STYLES_ID;
  link.rel = 'stylesheet';
  link.href = 'maplibre.css';
  document.head.appendChild(link);
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
    MatIconModule,
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

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.moveTimer) clearTimeout(this.moveTimer);
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
    const color = ['coalesce', ['get', 'Color'], '#22C55E'] as any;
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
        'circle-color': color,
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
    if (this.drawMode() || this.editing()) return;
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

  private message(error: unknown, fallback: string): string {
    const body = (error as any)?.error?.error;
    if (typeof body === 'string' && body.trim()) return body;
    return this.transloco.translate(fallback);
  }
}
