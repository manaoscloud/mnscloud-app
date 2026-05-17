import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom, Subscription } from 'rxjs';

import { fadeIn } from '../../../../shared/animations/fade.animation';
import { StateMessageComponent } from '../../../../shared/state-message/state-message';
import { ApiService } from '../../../../services/api.service';
import { I18nService } from '../../../../services/i18n.service';
import { SnackbarService } from '../../../../services/snackbar.service';
import { SlowConfirmDialogComponent } from '../../../../shared/slow-confirm-dialog/slow-confirm-dialog';

export type GeoMapAsset = {
  IgbUUID: string;
  IgbID: string;
  IgbType: string;
  IspGeoMapAssetIgaUUID?: string | null;
  IgaID?: string | null;
  VendorModelName?: string | null;
  IgbName: string;
  IgbStatus: string;
  IgbColor?: string | null;
  IspGeoMapProjectIgpUUID?: string | null;
  IgbNotes?: string | null;
  IgbLat?: number | null;
  IgbLng?: number | null;
  IgbGeomWkt?: string | null;
};

export type GeoMapProject = {
  IgpUUID: string;
  IgpID: string;
  IgpName: string;
  IgpDescription?: string | null;
  IgpStatus: string;
};

export type GeoMapAssetType = {
  IatUUID?: string;
  IatCode: string;
  IatName: string;
  IatDefaultColor?: string | null;
  IatStatus?: string;
  IatSortOrder?: number;
};

export type GeoMapAssetModel = {
  IgaUUID: string;
  IgaID: string;
  IspGeoMapAssetTypeIatUUID?: string | null;
  IatCode?: string | null;
  VendorModelName?: string | null;
  VendorName?: string | null;
  IgaStatus?: string;
};

type GeoMapStyleMode = 'street' | 'satellite';

type StreetViewPoint = {
  lat: number;
  lng: number;
};

const GEO_MAP_ASSET_TYPES_FALLBACK = [
  { IatCode: 'CABLE', IatName: 'CABLE', IatDefaultColor: '#8B5CF6', IatSortOrder: 100 },
  { IatCode: 'CEO', IatName: 'CEO', IatDefaultColor: '#F97316', IatSortOrder: 110 },
  { IatCode: 'CTO', IatName: 'CTO', IatDefaultColor: '#22C55E', IatSortOrder: 120 },
  { IatCode: 'CUSTOMER', IatName: 'CUSTOMER', IatDefaultColor: '#F43F5E', IatSortOrder: 130 },
  { IatCode: 'DIO', IatName: 'DIO', IatDefaultColor: '#0EA5E9', IatSortOrder: 140 },
  { IatCode: 'OLT', IatName: 'OLT', IatDefaultColor: '#EAB308', IatSortOrder: 150 },
  { IatCode: 'PON', IatName: 'PON', IatDefaultColor: '#14B8A6', IatSortOrder: 160 },
  { IatCode: 'SPLITTER', IatName: 'SPLITTER', IatDefaultColor: '#A855F7', IatSortOrder: 170 },
] as const;

const GEO_MAP_TYPE_DEFAULT_COLORS: Record<string, string> = {
  CABLE: '#8B5CF6',
  CEO: '#F97316',
  CTO: '#22C55E',
  CUSTOMER: '#F43F5E',
  DIO: '#0EA5E9',
  OLT: '#EAB308',
  PON: '#14B8A6',
  SPLITTER: '#A855F7',
};

const GEO_MAP_STYLE_URLS: Record<GeoMapStyleMode, string> = {
  street: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};
const GEOMAP_LINE_NOTES_PREFIX = '[GEOMAP_LINE]';

const STREET_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M20.5 3l-5.5 2-6-2-5.5 2v16l5.5-2 6 2 5.5-2V3zm-11.5 2.38l4 1.33v11.91l-4-1.33V5.38zm-4 1.29l2-.73v11.91l-2 .73V6.67zm14 11.66l-2 .73V6.77l2-.73v11.56z"></path>
  </svg>
`;

const SATELLITE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 2c.9 0 1.76.13 2.58.37-.5.78-1.16 1.5-1.96 2.12-.47-.39-1.02-.7-1.62-.91V4zm-2.58.37c.82-.24 1.68-.37 2.58-.37v1.58c-.6.21-1.15.52-1.62.91-.8-.62-1.46-1.34-1.96-2.12zM4 12c0-1.64.49-3.17 1.33-4.44.8.72 1.72 1.31 2.74 1.74-.21.86-.31 1.78-.31 2.7s.1 1.84.31 2.7c-1.02.43-1.94 1.02-2.74 1.74C4.49 15.17 4 13.64 4 12zm6 7.63c-1.02-.43-1.94-1.02-2.74-1.74.5-.78 1.16-1.5 1.96-2.12.47.39 1.02.7 1.62.91v2.95zm2 0v-2.95c.6-.21 1.15-.52 1.62-.91.8.62 1.46 1.34 1.96 2.12-0.8.72-1.72 1.31-2.74 1.74zM14.6 12c0-.92-.1-1.84-.31-2.7 1.02-.43 1.94-1.02 2.74-1.74C19.51 8.83 20 10.36 20 12s-.49 3.17-1.33 4.44c-.8-.72-1.72-1.31-2.74-1.74.21-.86.31-1.78.31-2.7z"></path>
  </svg>
`;

const MEASURE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 9h2v6H3V9zm4 0h2v6H7V9zm4 0h2v6h-2V9zm4 0h2v6h-2V9zm4 0h2v6h-2V9zM3 7h18v2H3V7zm0 8h18v2H3v-2z"></path>
  </svg>
`;

const RECTANGLE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 6h14v12H5z" fill="none" stroke="currentColor" stroke-width="2"></path>
  </svg>
`;

const CLEAR_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M6 7h12M9 7V5h6v2M8 9l.7 10h6.6L16 9M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
`;

const FULLSCREEN_ENTER_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
`;

const FULLSCREEN_EXIT_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6M8 8l-5-5M16 8l5-5M16 16l5 5M8 16l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
`;

const EXPAND_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M14 3h7v7M10 21H3v-7M21 3l-8 8M3 21l8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
`;

const COLLAPSE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M10 3H3v7M14 21h7v-7M3 3l8 8M21 21l-8-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
  </svg>
`;

const STREET_VIEW_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 2.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z"></path>
    <circle cx="18.8" cy="5.2" r="2.2"></circle>
  </svg>
`;

class GeoMapStyleControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;
  private readonly handleClick = () => {
    this.options.onToggle();
    this.update();
  };

  constructor(
    private readonly options: {
      getNextMode: () => GeoMapStyleMode;
      onToggle: () => void;
    },
  ) {}

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group geomap-style-control';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'mapboxgl-ctrl-icon geomap-style-toggle';
    this.button.addEventListener('click', this.handleClick);

    this.container.appendChild(this.button);
    this.update();
    return this.container;
  }

  onRemove() {
    if (this.button) {
      this.button.removeEventListener('click', this.handleClick);
    }
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.button = undefined;
  }

  update() {
    if (!this.button) return;
    const nextMode = this.options.getNextMode();
    const nextLabel = nextMode === 'satellite' ? 'Switch to satellite view' : 'Switch to street view';
    this.button.setAttribute('aria-label', nextLabel);
    this.button.setAttribute('title', nextLabel);
    this.button.dataset['next'] = nextMode;
    this.button.innerHTML = nextMode === 'satellite' ? SATELLITE_ICON : STREET_ICON;
  }
}

class GeoMapMeasureControl {
  private container?: HTMLElement;
  private measureButton?: HTMLButtonElement;
  private rectangleButton?: HTMLButtonElement;
  private clearButton?: HTMLButtonElement;
  private readonly handleMeasureToggle = () => {
    this.options.onToggleMeasure();
    this.update();
  };
  private readonly handleRectangleToggle = () => {
    this.options.onToggleRectangle();
    this.update();
  };
  private readonly handleClear = () => {
    this.options.onClear();
    this.update();
  };

  constructor(
    private readonly options: {
      isMeasureActive: () => boolean;
      isRectangleActive: () => boolean;
      canClear: () => boolean;
      onToggleMeasure: () => void;
      onToggleRectangle: () => void;
      onClear: () => void;
    },
  ) {}

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group geomap-measure-control';

    this.measureButton = document.createElement('button');
    this.measureButton.type = 'button';
    this.measureButton.className = 'mapboxgl-ctrl-icon geomap-measure-toggle';
    this.measureButton.addEventListener('click', this.handleMeasureToggle);

    this.rectangleButton = document.createElement('button');
    this.rectangleButton.type = 'button';
    this.rectangleButton.className = 'mapboxgl-ctrl-icon geomap-rectangle-toggle';
    this.rectangleButton.addEventListener('click', this.handleRectangleToggle);

    this.clearButton = document.createElement('button');
    this.clearButton.type = 'button';
    this.clearButton.className = 'mapboxgl-ctrl-icon geomap-measure-clear';
    this.clearButton.addEventListener('click', this.handleClear);

    this.container.appendChild(this.measureButton);
    this.container.appendChild(this.rectangleButton);
    this.container.appendChild(this.clearButton);
    this.update();
    return this.container;
  }

  onRemove() {
    if (this.measureButton) {
      this.measureButton.removeEventListener('click', this.handleMeasureToggle);
    }
    if (this.rectangleButton) {
      this.rectangleButton.removeEventListener('click', this.handleRectangleToggle);
    }
    if (this.clearButton) {
      this.clearButton.removeEventListener('click', this.handleClear);
    }
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.measureButton = undefined;
    this.rectangleButton = undefined;
    this.clearButton = undefined;
  }

  update() {
    if (!this.measureButton || !this.rectangleButton || !this.clearButton) return;
    const measureActive = this.options.isMeasureActive();
    const rectangleActive = this.options.isRectangleActive();
    this.measureButton.dataset['active'] = measureActive ? 'true' : 'false';
    this.measureButton.setAttribute('aria-label', measureActive ? 'Stop distance measurement' : 'Measure distance');
    this.measureButton.setAttribute('title', measureActive ? 'Stop distance measurement' : 'Measure distance');
    this.measureButton.innerHTML = MEASURE_ICON;
    this.measureButton.toggleAttribute('disabled', rectangleActive);

    this.rectangleButton.dataset['active'] = rectangleActive ? 'true' : 'false';
    this.rectangleButton.setAttribute('aria-label', rectangleActive ? 'Stop rectangle drawing' : 'Draw rectangle');
    this.rectangleButton.setAttribute('title', rectangleActive ? 'Stop rectangle drawing' : 'Draw rectangle');
    this.rectangleButton.innerHTML = RECTANGLE_ICON;
    this.rectangleButton.toggleAttribute('disabled', measureActive);

    const canClear = this.options.canClear();
    this.clearButton.toggleAttribute('disabled', !canClear);
    this.clearButton.setAttribute('aria-label', 'Clear measurement and rectangle');
    this.clearButton.setAttribute('title', 'Clear measurement and rectangle');
    this.clearButton.innerHTML = CLEAR_ICON;
  }
}

class GeoMapViewControl {
  private container?: HTMLElement;
  private fullscreenButton?: HTMLButtonElement;
  private expandButton?: HTMLButtonElement;

  constructor(
    private readonly options: {
      getFullscreen: () => boolean;
      getExpanded: () => boolean;
      onToggleFullscreen: () => void;
      onToggleExpanded: () => void;
    },
  ) {}

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group geomap-view-control';

    this.fullscreenButton = document.createElement('button');
    this.fullscreenButton.type = 'button';
    this.fullscreenButton.className = 'mapboxgl-ctrl-icon geomap-fullscreen-toggle';
    this.fullscreenButton.addEventListener('click', () => this.options.onToggleFullscreen());

    this.expandButton = document.createElement('button');
    this.expandButton.type = 'button';
    this.expandButton.className = 'mapboxgl-ctrl-icon geomap-expand-toggle';
    this.expandButton.addEventListener('click', () => this.options.onToggleExpanded());

    this.container.appendChild(this.fullscreenButton);
    this.container.appendChild(this.expandButton);
    this.update();
    return this.container;
  }

  onRemove() {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.fullscreenButton = undefined;
    this.expandButton = undefined;
  }

  update() {
    if (this.fullscreenButton) {
      const isFullscreen = this.options.getFullscreen();
      this.fullscreenButton.title = isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen';
      this.fullscreenButton.setAttribute('aria-label', this.fullscreenButton.title);
      this.fullscreenButton.dataset['fullscreen'] = isFullscreen ? 'true' : 'false';
      this.fullscreenButton.innerHTML = isFullscreen
        ? FULLSCREEN_EXIT_ICON
        : FULLSCREEN_ENTER_ICON;
    }
    if (this.expandButton) {
      const isExpanded = this.options.getExpanded();
      this.expandButton.title = isExpanded ? 'Collapse map' : 'Expand map';
      this.expandButton.setAttribute('aria-label', this.expandButton.title);
      this.expandButton.dataset['expanded'] = isExpanded ? 'true' : 'false';
      this.expandButton.innerHTML = isExpanded ? COLLAPSE_ICON : EXPAND_ICON;
    }
  }
}

class GeoMapStreetViewControl {
  private container?: HTMLElement;
  private button?: HTMLButtonElement;

  constructor(
    private readonly options: {
      hasPoint: () => boolean;
      onOpen: () => void;
    },
  ) {}

  onAdd() {
    this.container = document.createElement('div');
    this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group geomap-street-view-control';

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'mapboxgl-ctrl-icon geomap-street-view-toggle';
    this.button.addEventListener('click', () => this.options.onOpen());

    this.container.appendChild(this.button);
    this.update();
    return this.container;
  }

  onRemove() {
    if (this.container?.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = undefined;
    this.button = undefined;
  }

  update() {
    if (!this.button) return;
    const hasPoint = this.options.hasPoint();
    const title = hasPoint
      ? 'Open Street View in Google'
      : 'Select a point to open Street View';
    this.button.setAttribute('aria-label', title);
    this.button.setAttribute('title', title);
    this.button.toggleAttribute('disabled', !hasPoint);
    this.button.innerHTML = STREET_VIEW_ICON;
  }
}

@Component({
  selector: 'app-isp-geomap-assets',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    StateMessageComponent,
  ],
  templateUrl: './assets.html',
  styleUrls: ['./assets.scss'],
  animations: [fadeIn],
})
export class IspGeoMapAssetsPage implements AfterViewInit, OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly snack = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);
  private mapboxgl?: any;
  private map: any;
  private draw: any;
  private readonly assetMarkers = new Map<string, any>();
  private readonly assetMarkerMeta = new Map<string, { signature: string }>();
  private measurePopup?: any;
  private measureFeatureId?: string | null;
  private bboxFeatureId?: string | null;
  private resizeObserver?: ResizeObserver;
  private styleControl?: GeoMapStyleControl;
  private measureControl?: GeoMapMeasureControl;
  private viewControl?: GeoMapViewControl;
  private streetViewControl?: GeoMapStreetViewControl;
  private geocoderControl?: any;
  private geocoderInputEl?: HTMLInputElement;
  private geocoderInputEnterHandler?: (event: KeyboardEvent) => void;
  private geolocateControl?: any;
  private geolocateRetryTimer?: number;
  private geolocateAttempt = 0;
  private assetCreatePanel?: HTMLElement;
  private bboxQueryTimer?: number;
  private bboxQueryInFlight = false;
  private bboxRateLimitUntil = 0;
  private lastBBoxQueryAt = 0;
  private lastBBoxQuerySignature = '';
  private lastBBox429NoticeAt = 0;
  private draftPulseFrame?: number;
  private filterFormSubscription?: Subscription;
  private lastAssets: GeoMapAsset[] = [];
  private allAssets: GeoMapAsset[] = [];
  private readonly assetModelsCache = new Map<string, GeoMapAssetModel[]>();
  private readonly cableGeometryCache = new Map<string, string>();
  private lastTouchMapTapAt = 0;
  private touchTapState: {
    active: boolean;
    moved: boolean;
    multiTouch: boolean;
    startX: number;
    startY: number;
    startedAt: number;
  } = {
    active: false,
    moved: false,
    multiTouch: false,
    startX: 0,
    startY: 0,
    startedAt: 0,
  };
  private mapStyle: GeoMapStyleMode = 'street';
  private draftCableFeatureId?: string | null;
  private assetCursorHandlers?: Array<{
    layerId: string;
    enter: () => void;
    move: () => void;
    leave: () => void;
  }>;
  private draftPoint: { lng: number; lat: number } | null = null;

  readonly loading = signal(false);
  readonly assetsLoading = signal(false);
  private assetsLoadingStartedAt = 0;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly mapError = signal<string | null>(null);
  readonly assetsCount = signal(0);
  readonly totalAssetsCount = signal(0);
  readonly mapExpanded = signal(false);
  readonly mapFullscreen = signal(false);
  readonly mapFullscreenFallback = signal(false);
  readonly measuring = signal(false);
  readonly cableDrawing = signal(false);
  readonly measuredDistance = signal<number | null>(null);
  readonly projects = signal<GeoMapProject[]>([]);
  readonly projectsLoading = signal(false);
  readonly projectError = signal<string | null>(null);
  readonly selectedProjectUUIDs = signal<string[]>([]);
  readonly activeProjectUUID = computed(() => this.selectedProjectUUIDs()[0] ?? null);
  readonly mapboxToken = signal<string | null>(null);
  readonly googleStreetViewEmbedApiKey = signal<string | null>(null);
  readonly streetViewPoint = signal<StreetViewPoint | null>(null);
  readonly streetViewLoading = signal(false);
  readonly streetViewError = signal<string | null>(null);
  readonly streetViewNonce = signal(0);
  readonly streetViewEmbedEnabled = computed<boolean>(() => Boolean(this.getGoogleStreetViewEmbedKey()));
  readonly streetViewEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const point = this.streetViewPoint();
    if (!point) return null;
    const key = this.getGoogleStreetViewEmbedKey();
    if (!key) return null;
    const url = this.buildGoogleStreetViewEmbedUrl(point, key, this.streetViewNonce());
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  readonly statusFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  readonly searchFilter = signal('');
  readonly assetTypes = signal<GeoMapAssetType[]>(
    GEO_MAP_ASSET_TYPES_FALLBACK.map((item) => ({ ...item, IatStatus: 'ACTIVE' })),
  );
  projectSearch = '';

  readonly dataSource = new MatTableDataSource<GeoMapAsset>([]);
  readonly displayedColumns = ['type', 'name', 'status', 'coords'];

  readonly bboxForm = this.fb.nonNullable.group({
    minLat: [-90, [Validators.required]],
    minLng: [-180, [Validators.required]],
    maxLat: [90, [Validators.required]],
    maxLng: [180, [Validators.required]],
    type: [''],
  });

  readonly filterForm = this.fb.nonNullable.group({
    type: [''],
    status: ['ALL'],
    search: [''],
  });


  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild('mapSectionRef') mapSectionRef?: ElementRef<HTMLElement>;

  ngOnInit() {
    const stored = localStorage.getItem('geomap_project_uuid');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.selectedProjectUUIDs.set(parsed.filter(item => typeof item === 'string'));
        } else if (typeof parsed === 'string') {
          this.selectedProjectUUIDs.set([parsed]);
        }
      } catch {
        this.selectedProjectUUIDs.set([stored]);
      }
    }
    void this.loadProjects();
    this.loadCableGeometryCache();
    void this.loadAssetTypes();
    void this.loadMapboxParameter();
    void this.loadStreetViewParameter();
    this.filterFormSubscription = this.filterForm.valueChanges.subscribe((value) => {
      this.statusFilter.set((value.status as 'ALL' | 'ACTIVE' | 'INACTIVE') ?? 'ALL');
      this.searchFilter.set(value.search ?? '');
      this.applyAssetFilters();
    });
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.waitForMapContainer();
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
    if (this.assetCreatePanel) {
      this.assetCreatePanel.remove();
      this.assetCreatePanel = undefined;
    }
    this.assetMarkers.forEach(marker => marker?.remove?.());
    this.assetMarkers.clear();
    this.assetMarkerMeta.clear();
    this.persistCableGeometryCache();
    this.filterFormSubscription?.unsubscribe();
    this.filterFormSubscription = undefined;
    if (this.geocoderControl && this.map) {
      this.map.removeControl(this.geocoderControl);
      this.geocoderControl = undefined;
    }
    if (this.geocoderInputEl && this.geocoderInputEnterHandler) {
      this.geocoderInputEl.removeEventListener('keydown', this.geocoderInputEnterHandler);
      this.geocoderInputEl = undefined;
      this.geocoderInputEnterHandler = undefined;
    }
    this.stopDraftPulse();
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    }
    document.body.style.overflow = '';
    if (this.map) {
      this.map.remove();
    }
    if (this.geolocateRetryTimer) {
      window.clearTimeout(this.geolocateRetryTimer);
      this.geolocateRetryTimer = undefined;
    }
    document.body.classList.remove('geomap-mobile-fullscreen');
  }

  @HostListener('document:keydown.escape')
  onEscapeKey() {
    if (this.mapFullscreen()) {
      void this.toggleMapFullscreen(false);
      return;
    }
    if (this.mapExpanded()) {
      this.toggleMapExpanded(false);
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    const anyDoc = document as any;
    this.mapFullscreen.set(Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement));
    this.viewControl?.update();
    setTimeout(() => this.scheduleMapResize(), 30);
  }

  async loadProjects() {
    this.projectsLoading.set(true);
    this.projectError.set(null);
    try {
      const response = await this.api.get<any>('isp/geomap/projects?limit=200');
      const items = response?.data?.items ?? [];
      this.projects.set(items);
      if (this.selectedProjectUUIDs().length === 0 && items.length) {
        this.setProjects([items[0].IgpUUID]);
      }
    } catch (err) {
      console.error('Failed to load projects.', err);
      this.projectError.set('Failed to load projects.');
    } finally {
      this.projectsLoading.set(false);
    }
  }

  async loadAssetTypes() {
    try {
      this.assetModelsCache.clear();
      const response = await this.api.get<any>('isp/geomap/asset-types?status=ACTIVE&limit=500');
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      if (!items.length) {
        this.assetTypes.set(GEO_MAP_ASSET_TYPES_FALLBACK.map((item) => ({ ...item, IatStatus: 'ACTIVE' })));
        return;
      }
      const normalized = items
        .map((item: any) => ({
          IatUUID: item?.IatUUID,
          IatCode: String(item?.IatCode ?? '').trim().toUpperCase(),
          IatName: String(item?.IatName ?? '').trim() || String(item?.IatCode ?? '').trim().toUpperCase(),
          IatDefaultColor: typeof item?.IatDefaultColor === 'string' ? item.IatDefaultColor : null,
          IatStatus: typeof item?.IatStatus === 'string' ? item.IatStatus : 'ACTIVE',
          IatSortOrder: Number.isFinite(Number(item?.IatSortOrder)) ? Number(item.IatSortOrder) : 100,
        }))
        .filter((item: GeoMapAssetType) => item.IatCode && item.IatStatus !== 'INACTIVE')
        .sort((a: GeoMapAssetType, b: GeoMapAssetType) => {
          const left = Number(a.IatSortOrder ?? 100);
          const right = Number(b.IatSortOrder ?? 100);
          if (left !== right) return left - right;
          return a.IatName.localeCompare(b.IatName);
        });

      if (normalized.length) {
        this.assetTypes.set(normalized);
      } else {
        this.assetTypes.set(GEO_MAP_ASSET_TYPES_FALLBACK.map((item) => ({ ...item, IatStatus: 'ACTIVE' })));
      }
    } catch (err) {
      console.error('Failed to load GeoMap asset types.', err);
      this.assetTypes.set(GEO_MAP_ASSET_TYPES_FALLBACK.map((item) => ({ ...item, IatStatus: 'ACTIVE' })));
    }
  }

  private async loadAssetModelsByType(typeCode: string): Promise<GeoMapAssetModel[]> {
    const normalizedType = String(typeCode ?? '')
      .trim()
      .toUpperCase();
    if (!normalizedType) return [];

    const cached = this.assetModelsCache.get(normalizedType);
    if (cached) return cached;

    const assetType = this.assetTypes().find((item) => item.IatCode === normalizedType);
    if (!assetType?.IatUUID) {
      this.assetModelsCache.set(normalizedType, []);
      return [];
    }

    try {
      const response = await this.api.get<any>(
        `isp/geomap/asset-models?assetTypeUUID=${encodeURIComponent(assetType.IatUUID)}&status=ACTIVE&limit=500`,
      );
      const items = Array.isArray(response?.data?.items) ? response.data.items : [];
      const normalized: GeoMapAssetModel[] = items
        .map((item: any) => ({
          IgaUUID: String(item?.IgaUUID ?? '').trim(),
          IgaID: String(item?.IgaID ?? '').trim(),
          IspGeoMapAssetTypeIatUUID:
            typeof item?.IspGeoMapAssetTypeIatUUID === 'string' ? item.IspGeoMapAssetTypeIatUUID : null,
          IatCode: typeof item?.IatCode === 'string' ? item.IatCode.toUpperCase() : null,
          VendorModelName: typeof item?.VendorModelName === 'string' ? item.VendorModelName : null,
          VendorName: typeof item?.VendorName === 'string' ? item.VendorName : null,
          IgaStatus: typeof item?.IgaStatus === 'string' ? item.IgaStatus : undefined,
        }))
        .filter(
          (item: GeoMapAssetModel) =>
            Boolean(item.IgaUUID) &&
            item.IgaStatus !== 'INACTIVE' &&
            (!item.IatCode || item.IatCode === normalizedType),
        )
        .sort((a: GeoMapAssetModel, b: GeoMapAssetModel) => {
          const aLabel = `${a.VendorModelName ?? ''} ${a.IgaID}`.trim();
          const bLabel = `${b.VendorModelName ?? ''} ${b.IgaID}`.trim();
          return aLabel.localeCompare(bLabel);
        });

      this.assetModelsCache.set(normalizedType, normalized);
      return normalized;
    } catch (err) {
      console.error('Failed to load GeoMap asset models.', err);
      this.assetModelsCache.set(normalizedType, []);
      return [];
    }
  }

  setProjects(uuids: string[] | null) {
    const next = Array.isArray(uuids) ? uuids.filter(Boolean) : [];
    this.selectedProjectUUIDs.set(next);
    if (next.length) {
      localStorage.setItem('geomap_project_uuid', JSON.stringify(next));
    } else {
      localStorage.removeItem('geomap_project_uuid');
    }
    this.setAssetsData([]);
    this.clearDraftPoint();
    this.scheduleBBoxQuery();
  }

  get filteredProjectOptions() {
    const search = this.projectSearch.trim().toLowerCase();
    const items = this.projects();
    if (!search) return items;
    return items.filter(item => {
      const name = item?.IgpName?.toLowerCase() ?? '';
      const id = item?.IgpID?.toLowerCase() ?? '';
      return name.includes(search) || id.includes(search);
    });
  }

  onProjectOpened(opened: boolean) {
    if (opened) {
      this.projectSearch = '';
    }
  }

  toggleMapExpanded(force?: boolean) {
    const next = force ?? !this.mapExpanded();
    this.mapExpanded.set(next);
    this.applyExpandedViewportBounds();
    this.viewControl?.update();
    requestAnimationFrame(() => this.applyExpandedViewportBounds());
    setTimeout(() => this.scheduleMapResize(), 30);
    setTimeout(() => this.scheduleMapResize(), 220);
  }

  @HostListener('window:resize')
  onWindowResize() {
    if (!this.mapExpanded()) return;
    this.applyExpandedViewportBounds();
    this.scheduleMapResize();
  }

  async toggleMapFullscreen(force?: boolean) {
    const mapSection = document.querySelector('.map-section') as HTMLElement | null;
    if (!mapSection) return;

    const anyDoc = document as any;
    const anyEl = mapSection as any;
    const isFullscreen = Boolean(document.fullscreenElement || anyDoc.webkitFullscreenElement);
    const next = force ?? !isFullscreen;
    if (next) {
      if (typeof mapSection.requestFullscreen === 'function') {
        await mapSection.requestFullscreen();
        this.mapFullscreen.set(true);
        this.mapFullscreenFallback.set(false);
        document.body.classList.remove('geomap-mobile-fullscreen');
        this.viewControl?.update();
      } else if (typeof anyEl.webkitRequestFullscreen === 'function') {
        await anyEl.webkitRequestFullscreen();
        this.mapFullscreen.set(true);
        this.mapFullscreenFallback.set(false);
        document.body.classList.remove('geomap-mobile-fullscreen');
        this.viewControl?.update();
      } else {
        this.mapFullscreen.set(true);
        this.mapFullscreenFallback.set(true);
        document.body.style.overflow = 'hidden';
        document.body.classList.add('geomap-mobile-fullscreen');
        this.viewControl?.update();
      }
    } else {
      if (isFullscreen) {
        if (typeof document.exitFullscreen === 'function') {
          await document.exitFullscreen();
        } else if (typeof anyDoc.webkitExitFullscreen === 'function') {
          await anyDoc.webkitExitFullscreen();
        }
      }
      this.mapFullscreen.set(false);
      this.mapFullscreenFallback.set(false);
      document.body.style.overflow = '';
      document.body.classList.remove('geomap-mobile-fullscreen');
      this.viewControl?.update();
    }
    setTimeout(() => this.scheduleMapResize(), 30);
    setTimeout(() => this.scheduleMapResize(), 220);
  }


  async initMap() {
    if (this.map) return;

    const token = await this.getMapboxToken();
    if (!token) {
      this.mapError.set('Mapbox token missing in system parameters (MAPBOX_TOKEN).');
      return;
    }
    this.mapError.set(null);

    const mapboxgl = (await import('mapbox-gl')).default;
    const MapboxDraw = (await import('@mapbox/mapbox-gl-draw')).default;
    const MapboxGeocoder = (await import('@mapbox/mapbox-gl-geocoder')).default;

    mapboxgl.accessToken = token;
    this.mapboxgl = mapboxgl;

    this.map = new mapboxgl.Map({
      container: 'geomap-assets-map',
      style: GEO_MAP_STYLE_URLS.street,
      center: [-46.6333, -23.5505],
      zoom: 13,
      attributionControl: false,
    });

    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');
    this.map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    this.geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      trackUserLocation: false,
      showUserHeading: true,
      fitBoundsOptions: { maxZoom: 16 },
    });
    this.map.addControl(this.geolocateControl, 'top-right');
    this.viewControl = new GeoMapViewControl({
      getFullscreen: () => this.mapFullscreen() || this.mapFullscreenFallback(),
      getExpanded: () => this.mapExpanded(),
      onToggleFullscreen: () => void this.toggleMapFullscreen(),
      onToggleExpanded: () => this.toggleMapExpanded(),
    });
    this.map.addControl(this.viewControl, 'top-right');
    this.geolocateControl.on('geolocate', () => {
      this.geolocateAttempt = 0;
      if (this.geolocateRetryTimer) {
        window.clearTimeout(this.geolocateRetryTimer);
        this.geolocateRetryTimer = undefined;
      }
    });
    this.geolocateControl.on('error', (err: any) => {
      console.warn('Geolocate error', err);
      const code = err?.code;
      let message = 'Location unavailable. Check your device location services and try again.';
      if (code === 1) {
        message = 'Location permission denied. Allow access in your browser and try again.';
      } else if (code === 2) {
        message = 'Could not determine your position. Check network or GPS and try again.';
      } else if (code === 3) {
        message = 'Location request timed out. Try again.';
      }
      this.snack.warning(message);
      if (this.geolocateAttempt < 1) {
        this.geolocateAttempt += 1;
        this.geolocateRetryTimer = window.setTimeout(() => {
          this.geolocateControl?.trigger?.();
        }, 800);
      }
    });
    this.styleControl = new GeoMapStyleControl({
      getNextMode: () => (this.mapStyle === 'street' ? 'satellite' : 'street'),
      onToggle: () => this.toggleMapStyle(),
    });
    this.map.addControl(this.styleControl, 'top-right');
    this.streetViewControl = new GeoMapStreetViewControl({
      hasPoint: () => Boolean(this.streetViewPoint()),
      onOpen: () => this.openStreetViewExternalGoogle(),
    });
    this.map.addControl(this.streetViewControl, 'top-right');
    this.geocoderControl = new MapboxGeocoder({
      accessToken: token,
      mapboxgl,
      marker: false,
      placeholder: 'Search address or coordinates',
      language: this.i18n.language(),
      autocomplete: true,
      minLength: 2,
      limit: 6,
      types: 'address,place,locality,neighborhood,poi,region,postcode',
      localGeocoder: ((query: string) => {
        const coords = this.parseCoordinatesInput(query);
        if (!coords) return [];
        return [
          {
            id: `coords.${coords.lat}.${coords.lng}`,
            type: 'Feature',
            place_type: ['coordinate'],
            center: [coords.lng, coords.lat],
            geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
            place_name: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
            properties: {},
            text: `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
          } as any,
        ];
      }) as any,
    });
    this.map.addControl(this.geocoderControl, 'top-left');
    const geocoderContainer = this.map
      .getContainer?.()
      ?.querySelector?.('.mapboxgl-ctrl-geocoder') as HTMLElement | null;
    this.geocoderInputEl = geocoderContainer?.querySelector?.('input') as HTMLInputElement | undefined;
    if (this.geocoderInputEl) {
      this.geocoderInputEnterHandler = (event: KeyboardEvent) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        event.stopPropagation();
        const query = this.geocoderInputEl?.value?.trim();
        if (!query) return;
        void this.searchTypedAddress(query);
      };
      this.geocoderInputEl.addEventListener('keydown', this.geocoderInputEnterHandler);
    }
    this.geocoderControl.on('result', (event: any) => {
      const center = event?.result?.center ?? event?.result?.geometry?.coordinates ?? [];
      const lng = Number(center?.[0]);
      const lat = Number(center?.[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      this.focusMapPosition(lng, lat);
    });
    this.geocoderControl.on('error', (error: any) => {
      console.error('Mapbox geocoder failed.', error);
      this.snack.warning('Failed to search address.');
    });
    this.geocoderControl.on('clear', () => {
      this.clearDraftPoint();
    });

    const drawStyles = [
      {
        id: 'gl-draw-line-inactive',
        type: 'line',
        filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#00e5ff',
          'line-width': 3,
        },
      },
      {
        id: 'gl-draw-line-active',
        type: 'line',
        filter: ['all', ['==', '$type', 'LineString'], ['==', 'active', 'true']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#00e5ff',
          'line-width': 3,
        },
      },
      {
        id: 'gl-draw-polygon-fill',
        type: 'fill',
        filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        paint: {
          'fill-color': '#00e5ff',
          'fill-opacity': 0.15,
        },
      },
      {
        id: 'gl-draw-polygon-stroke',
        type: 'line',
        filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#00e5ff',
          'line-width': 2,
        },
      },
      {
        id: 'gl-draw-polygon-midpoint',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
        paint: {
          'circle-radius': 3,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#00e5ff',
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'gl-draw-polygon-vertex',
        type: 'circle',
        filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']],
        paint: {
          'circle-radius': 4,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#00e5ff',
          'circle-stroke-width': 2,
        },
      },
    ];

    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
      styles: drawStyles,
    });

    this.map.addControl(this.draw, 'top-left');
    this.updateDrawControls();
    this.measureControl = new GeoMapMeasureControl({
      isMeasureActive: () => this.measuring(),
      isRectangleActive: () => this.draw?.getMode?.() === 'draw_polygon',
      canClear: () => this.canClearTools(),
      onToggleMeasure: () => this.toggleMeasure(),
      onToggleRectangle: () => this.toggleRectangle(),
      onClear: () => this.clearTools(),
    });
    this.map.addControl(this.measureControl, 'top-left');

    this.map.on('load', () => {
      this.scheduleMapResize();
      this.ensureAssetLayer();
      this.ensureDraftPointLayer();
      this.renderDraftPoint();
      this.registerAssetHoverCursor();
      this.scheduleBBoxQuery();
    });
    this.map.on('style.load', () => {
      this.scheduleMapResize();
      this.ensureAssetLayer();
      this.ensureDraftPointLayer();
      this.renderDraftPoint();
      this.registerAssetHoverCursor();
      if (this.lastAssets.length) {
        this.updateAssetSource(this.lastAssets);
      }
    });
    this.map.on('moveend', () => this.scheduleBBoxQuery());
    this.map.on('zoomend', () => this.scheduleBBoxQuery());

    this.map.on('click', (event: any) => {
      if (Date.now() - this.lastTouchMapTapAt < 350) return;
      this.handleMapTap(event);
    });

    this.map.on('touchstart', (event: any) => {
      const point = event?.point ?? event?.points?.[0];
      const touches = Number(event?.originalEvent?.touches?.length ?? 1);
      this.touchTapState = {
        active: true,
        moved: false,
        multiTouch: touches > 1,
        startX: Number(point?.x ?? 0),
        startY: Number(point?.y ?? 0),
        startedAt: Date.now(),
      };
    });

    this.map.on('touchmove', (event: any) => {
      if (!this.touchTapState.active) return;
      const point = event?.point ?? event?.points?.[0];
      const touches = Number(event?.originalEvent?.touches?.length ?? 1);
      if (touches > 1) {
        this.touchTapState.multiTouch = true;
      }
      if (!point) return;
      const dx = Math.abs(Number(point.x ?? 0) - this.touchTapState.startX);
      const dy = Math.abs(Number(point.y ?? 0) - this.touchTapState.startY);
      if (dx > 10 || dy > 10) {
        this.touchTapState.moved = true;
      }
    });

    this.map.on('touchend', (event: any) => {
      if (!this.touchTapState.active) return;
      const elapsed = Date.now() - this.touchTapState.startedAt;
      const isTap = !this.touchTapState.moved && !this.touchTapState.multiTouch && elapsed < 350;
      this.touchTapState.active = false;
      if (!isTap) return;
      this.lastTouchMapTapAt = Date.now();
      this.handleMapTap(event);
    });

    this.map.on('touchcancel', () => {
      this.touchTapState.active = false;
    });

    this.map.on('draw.create', (event: any) => this.onDrawCreate(event));
    this.map.on('draw.update', (event: any) => this.onDrawUpdate(event));
    this.map.on('draw.delete', (event: any) => this.onDrawDelete(event));
    this.map.on('draw.selectionchange', () => this.updateDrawControls());
    this.map.on('draw.modechange', () => {
      if (this.measuring() && this.draw?.getMode?.() !== 'draw_line_string') {
        this.measuring.set(false);
      }
      if (this.measuring() && this.draw?.getMode?.() === 'draw_polygon') {
        this.draw.changeMode('simple_select');
      }
      this.updateDrawControls();
      this.measureControl?.update();
    });

    this.map.on('draw.render', () => {
      if (!this.measureFeatureId || this.measuring()) return;
      const feature = this.draw?.get?.(this.measureFeatureId);
      if (feature) this.updateMeasureFromFeature(feature);
    });

    this.map.on('mousemove', (event: any) => {
      if (!this.measuring()) return;
      this.updateMeasurePreview(event?.lngLat);
    });

  }

  private handleMapTap(event: any) {
    if (this.isDrawActive() || this.measuring()) return;
    const point = event?.point ?? event?.points?.[0];
    const lngLat = event?.lngLat ?? event?.lngLats?.[0];
    if (!point || !lngLat) return;

    const queryBounds = point
      ? [
        [Number(point.x) - 10, Number(point.y) - 10],
        [Number(point.x) + 10, Number(point.y) + 10],
      ]
      : undefined;
    const hit = queryBounds
      ? this.map?.queryRenderedFeatures?.(queryBounds, {
        layers: [
          'geomap-assets-layer',
          'geomap-assets-line-layer',
          'geomap-assets-line-hit-layer',
          'geomap-assets-label-layer',
        ],
      }) ?? []
      : this.map?.queryRenderedFeatures?.(point, {
      layers: [
        'geomap-assets-layer',
        'geomap-assets-line-layer',
        'geomap-assets-line-hit-layer',
        'geomap-assets-label-layer',
      ],
      }) ?? [];
    if (hit.length) {
      const featureWithUUID = hit.find((feature: any) => Boolean(feature?.properties?.uuid));
      const uuid = featureWithUUID?.properties?.uuid;
      const asset = uuid ? this.findAssetByUUID(uuid) : null;
      const coords = featureWithUUID?.geometry?.coordinates ?? [];
      const isPointFeature = featureWithUUID?.geometry?.type === 'Point';
      if (asset) {
        if (isPointFeature && coords.length >= 2) {
          this.openAssetPopup({ lng: coords[0], lat: coords[1] }, asset);
          this.setStreetViewPoint(coords[0], coords[1]);
        } else if (asset?.IgbLat !== null && asset?.IgbLng !== null) {
          this.openAssetPopup({ lng: asset.IgbLng as number, lat: asset.IgbLat as number }, asset);
          this.setStreetViewPoint(asset.IgbLng as number, asset.IgbLat as number);
        } else {
          this.openAssetPopup({ lng: lngLat.lng, lat: lngLat.lat }, asset);
          this.setStreetViewPoint(lngLat.lng, lngLat.lat);
        }
        return;
      }
    }

    this.placeAssetMarker(lngLat);
    this.setStreetViewPoint(lngLat.lng, lngLat.lat);
    this.openAssetPopup(lngLat);
  }

  toggleMeasure() {
    if (!this.map || !this.draw) return;
    if (this.cableDrawing()) {
      this.cancelCableDrawing();
    }
    if (this.measuring()) {
      this.measuring.set(false);
      this.draw.changeMode('simple_select');
      this.clearMeasurePreview();
      this.updateDrawControls();
      this.measureControl?.update();
      return;
    }

    if (this.draw.getMode?.() === 'draw_polygon') {
      this.draw.changeMode('simple_select');
    }
    this.clearMeasure();
    this.measuredDistance.set(null);
    this.measuring.set(true);
    this.draw.changeMode('draw_line_string');
    this.updateDrawControls();
    this.measureControl?.update();
    if (this.assetCreatePanel) {
      this.assetCreatePanel.remove();
      this.assetCreatePanel = undefined;
    }
  }

  clearMeasure() {
    if (this.measureFeatureId && this.draw) {
      this.draw.delete(this.measureFeatureId);
      this.measureFeatureId = null;
    }
    this.measuredDistance.set(null);
    this.clearMeasurePreview();
    this.updateDrawControls();
    this.measureControl?.update();
  }

  toggleRectangle() {
    if (!this.map || !this.draw) return;
    if (this.cableDrawing()) {
      this.cancelCableDrawing();
    }
    const mode = this.draw.getMode?.();
    if (mode === 'draw_polygon') {
      this.draw.changeMode('simple_select');
      this.updateDrawControls();
      this.measureControl?.update();
      return;
    }
    if (this.measuring()) {
      this.measuring.set(false);
      this.clearMeasurePreview();
      this.measureControl?.update();
    }
    this.draw.changeMode('draw_polygon');
    this.updateDrawControls();
    this.measureControl?.update();
  }

  clearTools() {
    if (!this.draw) return;
    this.cancelCableDrawing();
    if (this.measureFeatureId) {
      this.draw.delete(this.measureFeatureId);
      this.measureFeatureId = null;
    }
    if (this.bboxFeatureId) {
      this.draw.delete(this.bboxFeatureId);
      this.bboxFeatureId = null;
    }
    this.measuring.set(false);
    this.measuredDistance.set(null);
    this.clearMeasurePreview();
    this.draw.changeMode('simple_select');
    this.updateDrawControls();
    this.measureControl?.update();
  }

  private canClearTools() {
    return Boolean(
      this.measureFeatureId ||
      this.bboxFeatureId ||
      this.draftCableFeatureId ||
      this.measuredDistance() !== null,
    );
  }

  toggleCableDrawing() {
    if (!this.map || !this.draw) return;
    if (this.cableDrawing()) {
      this.cancelCableDrawing();
      return;
    }
    if (this.selectedProjectUUIDs().length === 0) {
      this.snack.warning('Select at least one project first.');
      return;
    }

    if (this.measuring()) {
      this.clearMeasure();
    }
    if (this.draw.getMode?.() === 'draw_polygon') {
      this.draw.changeMode('simple_select');
    }

    this.clearDraftPoint();
    this.clearCableDraftFeature();
    this.cableDrawing.set(true);
    this.draw.changeMode('draw_line_string');
    this.map?.dragPan?.enable?.();
    this.updateDrawControls();
    this.measureControl?.update();
    if (this.assetCreatePanel) {
      this.assetCreatePanel.remove();
      this.assetCreatePanel = undefined;
    }
    this.snack.info('Draw the cable path on map and double-click to finish.');
  }

  formatDistance(distance: number | null) {
    if (distance === null || distance === undefined) return '—';
    if (distance >= 1000) return `${(distance / 1000).toFixed(2)} km`;
    return `${distance.toFixed(0)} m`;
  }

  private waitForMapContainer(attempt = 0) {
    if (this.map) return;
    const container = document.getElementById('geomap-assets-map');
    if (!container) {
      if (attempt < 20) {
        setTimeout(() => this.waitForMapContainer(attempt + 1), 100);
      }
      return;
    }

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      if (attempt < 20) {
        setTimeout(() => this.waitForMapContainer(attempt + 1), 120);
      }
      return;
    }

    void this.initMap();
  }

  private toggleMapStyle() {
    if (!this.map) return;
    this.mapStyle = this.mapStyle === 'street' ? 'satellite' : 'street';
    this.map.setStyle(GEO_MAP_STYLE_URLS[this.mapStyle], { diff: false });
  }

  private scheduleMapResize() {
    if (!this.map) return;
    requestAnimationFrame(() => {
      this.map?.resize();
      setTimeout(() => this.map?.resize(), 300);
      setTimeout(() => this.map?.resize(), 1000);
    });

    const container = this.map.getContainer?.() as HTMLElement | undefined;
    if (!container || this.resizeObserver) return;
    this.resizeObserver = new ResizeObserver(() => {
      this.map?.resize();
    });
    this.resizeObserver.observe(container);
  }

  private applyExpandedViewportBounds() {
    const section = this.mapSectionRef?.nativeElement;
    if (!section) return;
    if (!this.mapExpanded()) {
      section.style.removeProperty('--geomap-expanded-top');
      section.style.removeProperty('--geomap-expanded-left');
      section.style.removeProperty('--geomap-expanded-right');
      section.style.removeProperty('--geomap-expanded-height');
      return;
    }

    const pageContent = section.closest('.page-content') as HTMLElement | null;
    const rect = (pageContent ?? section.parentElement)?.getBoundingClientRect();
    if (!rect) return;

    const spacing = 16;
    const top = Math.max(spacing, Math.round(rect.top) + spacing);
    const left = Math.max(spacing, Math.round(rect.left) + spacing);
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const right = Math.max(
      spacing,
      Math.round(window.innerWidth - rect.right) + spacing - scrollbarWidth,
    );
    const height = Math.max(320, Math.round(rect.height) - spacing * 2);

    section.style.setProperty('--geomap-expanded-top', `${top}px`);
    section.style.setProperty('--geomap-expanded-left', `${left}px`);
    section.style.setProperty('--geomap-expanded-right', `${right}px`);
    section.style.setProperty('--geomap-expanded-height', `${height}px`);
  }

  async searchBBox() {
    if (this.bboxForm.invalid) return;
    const selected = this.selectedProjectUUIDs();
    if (selected.length === 0) {
      this.snack.warning('Select at least one project first.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    const start = performance.now();

    try {
      const payload = this.bboxForm.getRawValue();
      const items = await this.queryAssetsByProjects(selected, payload);
      this.setAssetsData(items);
    } catch (err) {
      console.error('Failed to query assets.', err);
      this.error.set('Failed to query assets.');
    } finally {
      const elapsed = performance.now() - start;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.loading.set(false), waitMs);
      } else {
        this.loading.set(false);
      }
    }
  }

  formatCoords(asset: GeoMapAsset) {
    const lineCoords = this.getAssetLineCoords(asset);
    if (lineCoords.length >= 2) {
      return `${lineCoords.length} points`;
    }
    const point = this.getAssetPoint(asset);
    if (!point) {
      return '—';
    }
    return `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`;
  }

  statusLabel(asset: GeoMapAsset) {
    return asset?.IgbStatus === 'ACTIVE' ? 'Active' : 'Inactive';
  }

  focusAsset(asset: GeoMapAsset) {
    if (!this.map) return;
    const point = this.getAssetPoint(asset);
    if (point) {
      this.map.easeTo({ center: [point.lng, point.lat], zoom: 16, duration: 300 });
      this.setStreetViewPoint(point.lng, point.lat);
      this.openAssetPopup({ lng: point.lng, lat: point.lat }, asset);
      return;
    }

    const lineCoords = this.getAssetLineCoords(asset);
    if (lineCoords.length >= 2 && this.mapboxgl) {
      const bounds = new this.mapboxgl.LngLatBounds(lineCoords[0], lineCoords[0]);
      lineCoords.forEach((coord) => bounds.extend(coord));
      this.map.fitBounds(bounds, { padding: 80, duration: 350 });
      const focus = lineCoords[lineCoords.length - 1];
      this.setStreetViewPoint(focus[0], focus[1]);
      this.openAssetPopup({ lng: focus[0], lat: focus[1] }, asset);
    }
  }

  clearDisplayFilters() {
    this.filterForm.setValue({
      type: '',
      status: 'ALL',
      search: '',
    });
  }

  onTypeFilterChange() {
    this.scheduleBBoxQuery();
  }

  private async getMapboxToken(): Promise<string | null> {
    const current = this.mapboxToken();
    if (current && current.trim()) return current.trim();
    await this.loadMapboxParameter();
    const loaded = this.mapboxToken();
    return loaded && loaded.trim() ? loaded.trim() : null;
  }

  private parseCoordinatesInput(input: string): { lat: number; lng: number } | null {
    const normalized = input
      .replace(/[NSEW]/gi, ' ')
      .replace(/[;|]/g, ',')
      .trim();
    const parts = normalized
      .split(/[,\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length !== 2) return null;

    const first = Number(parts[0].replace(',', '.'));
    const second = Number(parts[1].replace(',', '.'));
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

    if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
      return { lat: first, lng: second };
    }
    if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
      return { lat: second, lng: first };
    }
    return null;
  }

  private async searchTypedAddress(query: string) {
    const coords = this.parseCoordinatesInput(query);
    if (coords) {
      this.focusMapPosition(coords.lng, coords.lat);
      return;
    }
    try {
      const result = await this.forwardGeocodeExact(query);
      if (!result) {
        this.snack.warning('Address not found.');
        return;
      }
      this.focusMapPosition(result.lng, result.lat);
    } catch (err) {
      console.error('Failed to search typed address.', err);
      this.snack.warning('Failed to search typed address.');
    }
  }

  private async forwardGeocodeExact(query: string): Promise<{ lat: number; lng: number } | null> {
    const token = await this.getMapboxToken();
    if (!token) return null;
    const endpoint =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${encodeURIComponent(token)}&autocomplete=false&limit=1&language=${encodeURIComponent(this.i18n.language())}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Geocoding error: ${response.status}`);
    }
    const body = await response.json();
    const center = body?.features?.[0]?.center;
    const lng = Number(center?.[0]);
    const lat = Number(center?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }

  private focusMapPosition(lng: number, lat: number) {
    this.map?.easeTo({ center: [lng, lat], zoom: 16, duration: 400 });
    this.placeAssetMarker({ lng, lat });
    this.setStreetViewPoint(lng, lat);
    this.scheduleBBoxQuery();
  }

  private setStreetViewPoint(lng: number, lat: number) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    this.streetViewPoint.set({
      lng: Number(lng.toFixed(6)),
      lat: Number(lat.toFixed(6)),
    });
    this.streetViewControl?.update();
    this.streetViewError.set(null);
    this.streetViewLoading.set(this.streetViewEmbedEnabled());
  }

  onStreetViewFrameLoad() {
    this.streetViewLoading.set(false);
    this.streetViewError.set(null);
  }

  onStreetViewFrameError() {
    this.streetViewLoading.set(false);
    this.streetViewError.set(
      'Could not load embedded Street View. Open it directly in Google Maps.',
    );
  }

  refreshStreetView() {
    const point = this.streetViewPoint();
    if (!point) return;
    if (!this.streetViewEmbedEnabled()) return;
    this.streetViewError.set(null);
    this.streetViewLoading.set(true);
    this.streetViewNonce.update((value) => value + 1);
  }

  openStreetViewExternalGoogle() {
    const point = this.streetViewPoint();
    if (!point) {
      this.snack.warning('Select a point on the map first.');
      return;
    }
    const url = this.buildGoogleMapsStreetViewUrl(point);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private async loadMapboxParameter() {
    const token = await this.resolveParameterValue('MAPBOX_TOKEN');
    this.mapboxToken.set(token);
  }

  private async loadStreetViewParameter() {
    const key = await this.resolveParameterValue('GOOGLE_MAPS_EMBED_API_KEY');
    if (key) {
      this.googleStreetViewEmbedApiKey.set(key);
    }
  }

  private async resolveParameterValue(key: string): Promise<string | null> {
    const endpoints = [
      `settings/parameters/resolve/${key}`,
      `system/parameters/resolve/${key}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await this.api.get<any>(endpoint);
        const row = Array.isArray(response)
          ? response[0]
          : Array.isArray(response?.data?.items)
            ? response.data.items[0]
            : null;
        const value = typeof row?.SprValue === 'string' ? row.SprValue.trim() : '';
        if (value) return value;
      } catch {
        // Try next endpoint.
      }
    }

    return null;
  }

  private getGoogleStreetViewEmbedKey(): string | null {
    const key =
      this.googleStreetViewEmbedApiKey() ||
      (window as any)?.GOOGLE_MAPS_EMBED_API_KEY ||
      (window as any)?.googleMapsEmbedApiKey ||
      localStorage.getItem('google_maps_embed_api_key') ||
      localStorage.getItem('GOOGLE_MAPS_EMBED_API_KEY');
    return key && key.trim() ? key.trim() : null;
  }

  private buildGoogleStreetViewEmbedUrl(point: StreetViewPoint, key: string, nonce = 0): string {
    const { lat, lng } = point;
    const params = new URLSearchParams({
      key,
      location: `${lat},${lng}`,
      heading: '0',
      pitch: '0',
      fov: '90',
      x: String(nonce),
    });
    return `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;
  }

  private buildGoogleMapsStreetViewUrl(point: StreetViewPoint): string {
    const { lat, lng } = point;
    return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  }

  private isDrawActive(): boolean {
    if (!this.draw?.getMode) return false;
    const mode = this.draw.getMode();
    return mode !== 'simple_select' && mode !== 'direct_select';
  }

  private placeAssetMarker(lngLat: { lng: number; lat: number }) {
    this.draftPoint = { lng: lngLat.lng, lat: lngLat.lat };
    this.renderDraftPoint();
  }

  private openAssetPopup(
    lngLat: { lng: number; lat: number },
    asset?: GeoMapAsset,
    options?: { geomWkt?: string | null; defaultType?: string; onClose?: () => void },
  ) {
    if (!this.map || !this.mapboxgl) return;
    if (this.selectedProjectUUIDs().length === 0) {
      this.snack.warning('Select at least one project first.');
      return;
    }
    if (this.assetCreatePanel) {
      this.assetCreatePanel.remove();
      this.assetCreatePanel = undefined;
    }

    const container = document.createElement('div');
    container.className = 'geomap-asset-panel geomap-asset-popup-content';

    const title = document.createElement('div');
    title.className = 'geomap-asset-popup-title';
    const isEdit = Boolean(asset?.IgbUUID);
    const lineCoords = this.parseLineStringWkt(options?.geomWkt ?? this.getAssetLineWkt(asset) ?? null);
    const isLineAsset = lineCoords.length >= 2;
    title.textContent = isEdit ? 'Edit asset' : isLineAsset ? 'New cable' : 'New asset';

    const latlng = document.createElement('div');
    latlng.className = 'geomap-asset-popup-coords';
    latlng.textContent = isLineAsset
      ? `Path points: ${lineCoords.length}`
      : `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;

    const typeField = document.createElement('div');
    typeField.className = 'geomap-asset-popup-field';
    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type';
    const typeSelect = document.createElement('select');
    const availableTypes = this.assetTypes();
    for (const type of availableTypes) {
      const option = document.createElement('option');
      option.value = type.IatCode;
      option.textContent = type.IatName || type.IatCode;
      typeSelect.appendChild(option);
    }
    if (asset?.IgbType && !availableTypes.some((type) => type.IatCode === asset.IgbType)) {
      const option = document.createElement('option');
      option.value = asset.IgbType;
      option.textContent = asset.IgbType;
      typeSelect.appendChild(option);
    }
    if (asset?.IgbType) {
      typeSelect.value = asset.IgbType;
    }
    const typeFromFilters = this.filterForm.getRawValue().type;
    const defaultType = options?.defaultType?.trim().toUpperCase() || '';
    if (!asset?.IgbType && defaultType) {
      typeSelect.value = defaultType;
    } else if (!asset?.IgbType && typeFromFilters) {
      typeSelect.value = typeFromFilters;
    }

    const modelField = document.createElement('div');
    modelField.className = 'geomap-asset-popup-field geomap-asset-popup-model';
    const modelLabel = document.createElement('label');
    modelLabel.textContent = 'Model';
    const modelSelect = document.createElement('select');
    modelSelect.disabled = true;

    const projectField = document.createElement('div');
    projectField.className = 'geomap-asset-popup-field geomap-asset-popup-project';
    const projectLabel = document.createElement('label');
    projectLabel.textContent = 'Project';
    const projectSelect = document.createElement('select');
    const projects = this.projects();
    for (const project of projects) {
      const option = document.createElement('option');
      option.value = project.IgpUUID;
      option.textContent = project.IgpName;
      projectSelect.appendChild(option);
    }
    const selectedProject = asset?.IspGeoMapProjectIgpUUID || this.activeProjectUUID();
    if (selectedProject) {
      projectSelect.value = selectedProject;
    }

    const nameField = document.createElement('div');
    nameField.className = 'geomap-asset-popup-field';
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Asset name';
    if (asset?.IgbName) {
      nameInput.value = asset.IgbName;
    }

    const statusField = document.createElement('div');
    statusField.className = 'geomap-asset-popup-field';
    const statusLabel = document.createElement('label');
    statusLabel.textContent = 'Status';
    const statusSelect = document.createElement('select');
    const activeOption = document.createElement('option');
    activeOption.value = 'ACTIVE';
    activeOption.textContent = 'Active';
    const inactiveOption = document.createElement('option');
    inactiveOption.value = 'INACTIVE';
    inactiveOption.textContent = 'Inactive';
    statusSelect.appendChild(activeOption);
    statusSelect.appendChild(inactiveOption);
    if (asset?.IgbStatus) {
      statusSelect.value = asset.IgbStatus;
    }

    const notesField = document.createElement('div');
    notesField.className = 'geomap-asset-popup-field';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes';
    const notesInput = document.createElement('textarea');
    notesInput.rows = 1;
    notesInput.placeholder = 'Optional notes';
    const cleanNotes = this.stripGeomMetadataFromNotes(asset?.IgbNotes);
    if (cleanNotes) notesInput.value = cleanNotes;

    const grid = document.createElement('div');
    grid.className = 'geomap-asset-popup-grid';

    const actions = document.createElement('div');
    actions.className = 'geomap-asset-popup-actions';
    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.textContent = isEdit ? 'Save' : 'Save';
    const editPathButton = document.createElement('button');
    editPathButton.type = 'button';
    editPathButton.textContent = 'Edit path';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';

    const error = document.createElement('div');
    error.className = 'geomap-asset-popup-error';
    let modelOptions: GeoMapAssetModel[] = [];
    let modelLoading = false;
    let pathEditEnabled = false;

    const setPathEditEnabled = (enabled: boolean) => {
      pathEditEnabled = enabled;
      editPathButton.textContent = enabled ? 'Stop editing path' : 'Edit path';
      latlng.textContent = enabled
        ? 'Path editing active. Drag points on map and click Save.'
        : isLineAsset
          ? `Path points: ${lineCoords.length}`
          : `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;
    };

    const renderModelOptions = (options: GeoMapAssetModel[], selectedUUID?: string | null) => {
      modelSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = options.length ? 'Select model' : 'No models for this type';
      modelSelect.appendChild(placeholder);

      for (const optionItem of options) {
        const option = document.createElement('option');
        option.value = optionItem.IgaUUID;
        option.textContent = optionItem.VendorModelName || 'Unnamed model';
        modelSelect.appendChild(option);
      }

      if (selectedUUID && !options.some((item) => item.IgaUUID === selectedUUID)) {
        const fallback = document.createElement('option');
        fallback.value = selectedUUID;
        fallback.textContent = asset?.VendorModelName || 'Selected model';
        modelSelect.appendChild(fallback);
      }

      modelSelect.value = selectedUUID ?? '';
      modelSelect.disabled = modelLoading || !options.length;
    };

    const refreshModelsForType = async (selectedUUID?: string | null) => {
      modelLoading = true;
      renderModelOptions([], selectedUUID);
      updateSaveState();
      modelOptions = await this.loadAssetModelsByType(typeSelect.value);
      modelLoading = false;
      renderModelOptions(modelOptions, selectedUUID);
      updateSaveState();
    };

    const updateSaveState = () => {
      const requiresModel = modelOptions.length > 0;
      const canSave =
        Boolean(projectSelect.value) &&
        Boolean(typeSelect.value) &&
        (!requiresModel || Boolean(modelSelect.value)) &&
        Boolean(nameInput.value.trim()) &&
        !modelLoading &&
        !this.saving();
      saveButton.toggleAttribute('disabled', !canSave);
      deleteButton.toggleAttribute('disabled', this.saving());
      editPathButton.toggleAttribute('disabled', this.saving());
    };

    const handleCancel = () => {
      this.assetCreatePanel?.remove();
      this.assetCreatePanel = undefined;
      if (pathEditEnabled) {
        this.clearCableDraftFeature();
      }
      if (!isEdit && !isLineAsset) this.clearDraftPoint();
      options?.onClose?.();
    };

    const handleSave = async () => {
      updateSaveState();
      if (saveButton.hasAttribute('disabled')) return;
      error.textContent = '';
      this.saving.set(true);
      updateSaveState();
      try {
        const basePayload = {
          IspGeoMapProjectIgpUUID: projectSelect.value,
          type: typeSelect.value,
          assetModelUUID: modelSelect.value || null,
          name: nameInput.value.trim(),
          status: statusSelect.value,
          notes: this.stripGeomMetadataFromNotes(notesInput.value),
        };
        const rawGeomWkt = (options?.geomWkt ?? this.getAssetLineWkt(asset) ?? '').trim();
        const draftGeomWkt = pathEditEnabled ? this.getDraftCableGeomWkt() : null;
        const resolvedGeomWkt = (draftGeomWkt || rawGeomWkt).trim();
        const hasLineGeom = this.parseLineStringWkt(resolvedGeomWkt).length >= 2;
        const notesWithGeom = hasLineGeom
          ? this.composeNotesWithGeom(basePayload.notes, resolvedGeomWkt)
          : basePayload.notes;
        const hasGeomWkt = rawGeomWkt.length > 0;
        const payload = hasGeomWkt || resolvedGeomWkt.length > 0
          ? { ...basePayload, geomWkt: resolvedGeomWkt, notes: notesWithGeom }
          : {
            ...basePayload,
            notes: notesWithGeom,
            lat: Number(lngLat.lat.toFixed(6)),
            lng: Number(lngLat.lng.toFixed(6)),
          };
        let item = asset;
        if (isEdit && asset?.IgbUUID) {
          const response = await this.api.put<any>(`isp/geomap/assets/base/${asset.IgbUUID}`, payload);
          const selectedModel = modelOptions.find((model) => model.IgaUUID === (payload.assetModelUUID ?? ''));
          item = response?.data?.item ?? {
            ...asset,
            ...payload,
            IspGeoMapAssetIgaUUID: payload.assetModelUUID,
            IgaID: selectedModel?.IgaID ?? null,
            VendorModelName: selectedModel?.VendorModelName ?? null,
          };
          if (resolvedGeomWkt && this.parseLineStringWkt(resolvedGeomWkt).length >= 2) {
            for (const cacheKey of this.getCableCacheKeys(asset)) {
              this.cableGeometryCache.set(cacheKey, resolvedGeomWkt);
            }
            this.persistCableGeometryCache();
            item = {
              ...(item as GeoMapAsset),
              IgbGeomWkt: resolvedGeomWkt,
              IgbNotes: notesWithGeom,
            };
          }
          item = this.mergeCachedCableGeometry(item as GeoMapAsset);
          this.replaceAsset(item as GeoMapAsset);
          this.snack.success('Asset updated.');
        } else {
          const response = await this.api.post<any>('isp/geomap/assets/base', payload);
          item = response?.data?.item;
          if (item && resolvedGeomWkt && this.parseLineStringWkt(resolvedGeomWkt).length >= 2) {
            for (const cacheKey of this.getCableCacheKeys(item as GeoMapAsset)) {
              this.cableGeometryCache.set(cacheKey, resolvedGeomWkt);
            }
            this.persistCableGeometryCache();
            item = {
              ...(item as GeoMapAsset),
              IgbGeomWkt: resolvedGeomWkt,
              IgbNotes: notesWithGeom,
            };
          }
          if (item) {
            item = this.mergeCachedCableGeometry(item as GeoMapAsset);
            const current = this.allAssets.slice();
            current.unshift(item);
            this.setAssetsData(current);
            this.fitToAssets([item]);
            this.snack.success('Asset created.');
          }
        }
        this.assetCreatePanel?.remove();
        this.assetCreatePanel = undefined;
        if (pathEditEnabled) {
          this.clearCableDraftFeature();
        }
        if (!isEdit && !isLineAsset) this.clearDraftPoint();
        options?.onClose?.();
      } catch (err) {
        console.error('Failed to create asset.', err);
        error.textContent = isEdit ? 'Failed to update asset.' : 'Failed to create asset.';
      } finally {
        this.saving.set(false);
        updateSaveState();
      }
    };

    typeSelect.addEventListener('change', () => {
      const selectedType = typeSelect.value || '';
      const activeFilterType = this.filterForm.controls.type.value ?? '';
      if (selectedType && selectedType !== activeFilterType) {
        this.filterForm.controls.type.setValue(selectedType);
      }
      void refreshModelsForType(null);
      updateSaveState();
    });
    modelSelect.addEventListener('change', updateSaveState);
    projectSelect.addEventListener('change', updateSaveState);
    nameInput.addEventListener('input', updateSaveState);
    saveButton.addEventListener('click', () => void handleSave());
    editPathButton.addEventListener('click', () => {
      if (!asset || !isEdit || !isLineAsset) return;
      if (pathEditEnabled) {
        this.clearCableDraftFeature();
        setPathEditEnabled(false);
        return;
      }
      const started = this.beginCablePathEdit(asset);
      if (!started) {
        this.snack.warning('Failed to start cable path editing.');
        return;
      }
      setPathEditEnabled(true);
      this.snack.info('Adjust cable vertices directly on map, then click Save.');
    });
    cancelButton.addEventListener('click', handleCancel);
    deleteButton.addEventListener('click', () => void this.confirmDelete(asset));

    typeField.appendChild(typeLabel);
    typeField.appendChild(typeSelect);
    modelField.appendChild(modelLabel);
    modelField.appendChild(modelSelect);
    projectField.appendChild(projectLabel);
    projectField.appendChild(projectSelect);
    statusField.appendChild(statusLabel);
    statusField.appendChild(statusSelect);
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesInput);

    grid.appendChild(statusField);
    grid.appendChild(typeField);
    grid.appendChild(modelField);
    grid.appendChild(projectField);

    actions.style.gridTemplateColumns = isEdit
      ? isLineAsset
        ? 'repeat(4, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))'
      : 'repeat(2, minmax(0, 1fr))';
    actions.appendChild(cancelButton);
    if (isEdit && isLineAsset) {
      actions.appendChild(editPathButton);
    }
    actions.appendChild(saveButton);
    if (isEdit) {
      actions.appendChild(deleteButton);
    }

    const header = document.createElement('div');
    header.className = 'geomap-asset-popup-header';
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'geomap-asset-popup-close';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', handleCancel);
    header.appendChild(title);
    header.appendChild(closeButton);

    container.appendChild(header);
    container.appendChild(latlng);
    container.appendChild(grid);
    container.appendChild(nameField);
    container.appendChild(notesField);
    container.appendChild(error);
    container.appendChild(actions);

    const mapContainer = this.map.getContainer?.() as HTMLElement | undefined;
    if (mapContainer) {
      mapContainer.appendChild(container);
      this.assetCreatePanel = container;
    }
    if (isEdit) {
      this.clearDraftPoint();
    }

    updateSaveState();
    void refreshModelsForType(asset?.IspGeoMapAssetIgaUUID ?? null);
  }

  private scheduleBBoxQuery() {
    if (!this.map) return;
    if (this.loading() || this.assetsLoading() || this.saving() || this.bboxQueryInFlight) return;
    const now = Date.now();
    if (now < this.bboxRateLimitUntil) return;
    if (this.bboxQueryTimer) window.clearTimeout(this.bboxQueryTimer);
    this.bboxQueryTimer = window.setTimeout(() => {
      void this.queryAssetsInView();
    }, 900);
  }

  private async queryAssetsInView(options: { fit?: boolean } = {}) {
    if (!this.map) return;
    const now = Date.now();
    if (now < this.bboxRateLimitUntil || this.bboxQueryInFlight) return;
    const selected = this.selectedProjectUUIDs();
    if (selected.length === 0) return;
    const bounds = this.map.getBounds?.();
    if (!bounds) return;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const type = this.bboxForm.getRawValue().type;
    const typeFilter = this.filterForm.getRawValue().type;
    const payload = {
      minLat: sw.lat,
      minLng: sw.lng,
      maxLat: ne.lat,
      maxLng: ne.lng,
      type: type || typeFilter || '',
    };
    const signature = [
      selected.join(','),
      payload.type || '',
      payload.minLat.toFixed(5),
      payload.minLng.toFixed(5),
      payload.maxLat.toFixed(5),
      payload.maxLng.toFixed(5),
    ].join('|');
    if (signature === this.lastBBoxQuerySignature && now - this.lastBBoxQueryAt < 1600) {
      return;
    }

    try {
      this.bboxQueryInFlight = true;
      this.lastBBoxQueryAt = now;
      this.lastBBoxQuerySignature = signature;
      const items = await this.queryAssetsByProjects(selected, payload);
      this.setAssetsData(items);
      if (options.fit) {
        this.fitToAssets(items);
      }
    } catch (err) {
      const status = this.extractHttpStatus(err);
      if (status === 429) {
        this.bboxRateLimitUntil = Date.now() + 6000;
        if (Date.now() - this.lastBBox429NoticeAt > 6000) {
          this.lastBBox429NoticeAt = Date.now();
          this.snack.warning('Too many map refresh requests. Pausing auto-refresh for 6 seconds.');
        }
      }
      console.error('Failed to query assets.', err);
    } finally {
      this.bboxQueryInFlight = false;
    }
  }

  async loadAssetsInView() {
    const selected = this.selectedProjectUUIDs();
    if (selected.length === 0) {
      this.snack.warning('Select at least one project first.');
      return;
    }
    this.assetsLoadingStartedAt = performance.now();
    this.assetsLoading.set(true);
    try {
      await this.queryAllAssetsByProject(selected, { fit: true });
      this.snack.success('Assets loaded.');
    } finally {
      const elapsed = performance.now() - this.assetsLoadingStartedAt;
      const minMs = 600;
      const waitMs = Math.max(0, minMs - elapsed);
      if (waitMs) {
        setTimeout(() => this.assetsLoading.set(false), waitMs);
      } else {
        this.assetsLoading.set(false);
      }
    }
  }

  private async queryAllAssetsByProject(projects: string[], options: { fit?: boolean } = {}) {
    if (projects.length === 0) return;
    const type = this.bboxForm.getRawValue().type;
    const typeFilter = this.filterForm.getRawValue().type;
    const payload = {
      minLat: -90,
      minLng: -180,
      maxLat: 90,
      maxLng: 180,
      type: type || typeFilter || '',
    };

    try {
      const items = await this.queryAssetsByProjects(projects, payload);
      this.setAssetsData(items);
      if (options.fit) {
        this.fitToAssets(items);
      }
    } catch (err) {
      console.error('Failed to query assets.', err);
    }
  }

  private async queryAssetsByProjects(projects: string[], payload: Record<string, unknown>) {
    const results = await Promise.allSettled(
      projects.map(projectUUID =>
        this.api.post<any>('isp/geomap/assets/query/bbox', {
          ...payload,
          IspGeoMapProjectIgpUUID: projectUUID,
        }),
      ),
    );
    const items: GeoMapAsset[] = [];
    let has429 = false;
    for (const result of results) {
      if (result.status === 'fulfilled') {
        items.push(...(result.value?.data?.items ?? []));
      } else {
        if (this.extractHttpStatus(result.reason) === 429) {
          has429 = true;
        }
        console.error('Failed to query assets for project.', result.reason);
      }
    }
    if (!items.length && has429) {
      throw { status: 429 };
    }
    const seen = new Set<string>();
    return items
      .filter(item => {
      const key = item?.IgbUUID ?? `${item?.IgbLat ?? ''}:${item?.IgbLng ?? ''}:${item?.IgbName ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
      })
      .map((item) => this.mergeCachedCableGeometry(item));
  }

  private extractHttpStatus(error: unknown): number | null {
    const directStatus = Number((error as any)?.status);
    if (Number.isFinite(directStatus)) return directStatus;
    const nestedStatus = Number((error as any)?.error?.status);
    if (Number.isFinite(nestedStatus)) return nestedStatus;
    return null;
  }

  private fitToAssets(items: GeoMapAsset[]) {
    if (!this.map || !this.mapboxgl) return;
    const coords: Array<{ lat: number; lng: number }> = [];
    for (const item of items) {
      const point = this.getAssetPoint(item);
      if (point) {
        coords.push(point);
      }
      const lineCoords = this.parseLineStringWkt(item?.IgbGeomWkt);
      for (const [lng, lat] of lineCoords) {
        coords.push({ lat, lng });
      }
    }

    if (!coords.length) {
      this.snack.warning('No valid coordinates to focus.');
      return;
    }

    if (coords.length === 1) {
      this.map.easeTo({ center: [coords[0].lng, coords[0].lat], zoom: 16, duration: 400 });
      return;
    }

    const bounds = new this.mapboxgl.LngLatBounds(
      [coords[0].lng, coords[0].lat],
      [coords[0].lng, coords[0].lat],
    );
    coords.forEach(point => bounds.extend([point.lng, point.lat]));
    this.map.fitBounds(bounds, { padding: 80, duration: 400 });
  }

  private renderAssetMarkers(items: GeoMapAsset[]) {
    if (!this.map || !this.mapboxgl) return;
    this.lastAssets = items.slice();
    this.updateAssetSource(items);
    const seen = new Set<string>();
    let invalidCount = 0;
    let nonPointCount = 0;
    for (const item of items) {
      const point = this.getAssetPoint(item);
      if (!point) {
        if (this.parseLineStringWkt(item?.IgbGeomWkt).length >= 2) {
          nonPointCount += 1;
          continue;
        }
        invalidCount += 1;
        continue;
      }
      const { lat, lng } = point;
      const key = item?.IgbUUID || `${lng.toFixed(6)}:${lat.toFixed(6)}:${item?.IgbName ?? 'asset'}`;
      seen.add(key);
      const existing = this.assetMarkers.get(key);
      const coords = { lat, lng };
      const markerSignature =
        `${coords.lng.toFixed(6)}:${coords.lat.toFixed(6)}:` +
        `${this.resolveAssetColor(item?.IgbColor, item?.IgbType)}:` +
        `${item?.IgbType ?? ''}:${item?.IgbStatus ?? ''}:${item?.IgbName ?? ''}`;
      const markerMeta = this.assetMarkerMeta.get(key);
      if (existing) {
        if (markerMeta?.signature !== markerSignature) {
          existing.setLngLat(coords);
          const existingEl = existing.getElement?.() as HTMLElement | undefined;
          if (existingEl) {
            existingEl.style.background = this.resolveAssetColor(item?.IgbColor, item?.IgbType);
            const iconEl = existingEl.querySelector('.geomap-pin-icon');
            if (iconEl) {
              iconEl.innerHTML = this.getTypeIconSvg(item?.IgbType);
            }
            existingEl.title = item?.IgbName ? `${item.IgbName} (${item.IgbType ?? 'Asset'})` : 'Asset';
          }
          this.assetMarkerMeta.set(key, { signature: markerSignature });
        }
        continue;
      }
      const el = this.buildPinElement(item?.IgbType, item?.IgbColor);
      el.classList.add('geomap-pin-saved');
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      const marker = new this.mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat(coords)
        .addTo(this.map);
      el.title = item?.IgbName ? `${item.IgbName} (${item.IgbType ?? 'Asset'})` : 'Asset';
      el.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const markerPosition = marker.getLngLat();
        const liveAsset = item.IgbUUID ? this.findAssetByUUID(item.IgbUUID) : item;
        this.openAssetPopup(
          { lng: markerPosition.lng, lat: markerPosition.lat },
          liveAsset ?? item,
        );
      });
      if (item?.IgbUUID) {
        let dragStartCoords = { ...coords };
        marker.on('dragstart', () => {
          el.style.cursor = 'grabbing';
          const pos = marker.getLngLat();
          dragStartCoords = { lat: pos.lat, lng: pos.lng };
          this.map?.dragPan?.disable?.();
        });
        marker.on('dragend', async () => {
          el.style.cursor = 'pointer';
          this.map?.dragPan?.enable?.();
          const pos = marker.getLngLat();
          await this.updateAssetLocation(item.IgbUUID, pos.lat, pos.lng, dragStartCoords);
        });
      }
      this.assetMarkers.set(key, marker);
      this.assetMarkerMeta.set(key, { signature: markerSignature });
    }

    for (const [uuid, marker] of this.assetMarkers.entries()) {
      if (!seen.has(uuid)) {
        marker.remove();
        this.assetMarkers.delete(uuid);
        this.assetMarkerMeta.delete(uuid);
      }
    }

    if (items.length && invalidCount === items.length && nonPointCount === 0) {
      this.snack.warning('Assets loaded, but coordinates look invalid.');
    }
  }

  private async updateAssetLocation(uuid: string, lat: number, lng: number, previous: { lat: number; lng: number }) {
    try {
      const payload = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
      await this.api.put<any>(`isp/geomap/assets/base/${uuid}`, payload);
      const current = this.allAssets.slice();
      const next = current.map(item =>
        item.IgbUUID === uuid ? { ...item, IgbLat: payload.lat, IgbLng: payload.lng } : item,
      );
      this.setAssetsData(next);
      this.snack.success('Asset location updated.');
    } catch (err) {
      console.error('Failed to update asset location.', err);
      const marker = this.assetMarkers.get(uuid);
      marker?.setLngLat(previous);
      this.snack.error('Failed to update asset location.');
    }
  }

  private parseCoord(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim();
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  private loadCableGeometryCache() {
    try {
      const raw = localStorage.getItem('geomap_cable_wkt_cache');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, wkt] of Object.entries(parsed ?? {})) {
        const cacheKey = this.toCableCacheKey(key);
        if (!cacheKey || typeof wkt !== 'string') continue;
        if (!this.parseLineStringWkt(wkt).length) continue;
        this.cableGeometryCache.set(cacheKey, wkt);
      }
    } catch {
      this.cableGeometryCache.clear();
    }
  }

  private persistCableGeometryCache() {
    try {
      const payload: Record<string, string> = {};
      for (const [uuid, wkt] of this.cableGeometryCache.entries()) {
        payload[uuid] = wkt;
      }
      localStorage.setItem('geomap_cable_wkt_cache', JSON.stringify(payload));
    } catch {
      // Ignore storage errors.
    }
  }

  private mergeCachedCableGeometry(item: GeoMapAsset): GeoMapAsset {
    const cacheKeys = this.getCableCacheKeys(item);
    if (!cacheKeys.length) return item;
    const existingLine = this.parseLineStringWkt(item?.IgbGeomWkt);
    if (existingLine.length >= 2) {
      for (const key of cacheKeys) {
        this.cableGeometryCache.set(key, item.IgbGeomWkt as string);
      }
      return item;
    }
    const lineFromNotes = this.extractLineStringFromNotes(item?.IgbNotes);
    if (lineFromNotes && this.parseLineStringWkt(lineFromNotes).length >= 2) {
      for (const key of cacheKeys) {
        this.cableGeometryCache.set(key, lineFromNotes);
      }
      return { ...item, IgbGeomWkt: lineFromNotes };
    }
    const cached = cacheKeys
      .map((key) => this.cableGeometryCache.get(key))
      .find((value) => typeof value === 'string' && this.parseLineStringWkt(value).length >= 2) ?? null;
    if (!cached) return item;
    if (!this.parseLineStringWkt(cached).length) return item;
    return {
      ...item,
      IgbGeomWkt: cached,
    };
  }

  private toCableCacheKey(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const normalizedUuid = trimmed
      .replace(/^urn:uuid:/i, '')
      .replace(/[^0-9a-f]/gi, '')
      .toLowerCase();
    if (normalizedUuid.length === 32) {
      return `uuid:${normalizedUuid}`;
    }
    return `id:${trimmed.toUpperCase()}`;
  }

  private getCableCacheKeys(item: Pick<GeoMapAsset, 'IgbUUID' | 'IgbID'>): string[] {
    const signatureKey = this.toCableSignatureKey(item as GeoMapAsset);
    const nameTypeKey = this.toCableNameTypeKey(item as GeoMapAsset);
    const keys = [
      this.toCableCacheKey(item?.IgbUUID),
      this.toCableCacheKey(item?.IgbID),
      signatureKey,
      nameTypeKey,
    ].filter((value): value is string => Boolean(value));
    return Array.from(new Set(keys));
  }

  private toCableSignatureKey(item?: GeoMapAsset | null): string | null {
    if (!item) return null;
    const project = String(item.IspGeoMapProjectIgpUUID ?? '').trim().toLowerCase();
    const type = String(item.IgbType ?? '').trim().toUpperCase();
    const name = String(item.IgbName ?? '').trim().toLowerCase();
    if (!project || !type || !name) return null;
    return `sig:${project}|${type}|${name}`;
  }

  private toCableNameTypeKey(item?: GeoMapAsset | null): string | null {
    if (!item) return null;
    const type = String(item.IgbType ?? '').trim().toUpperCase();
    const name = String(item.IgbName ?? '').trim().toLowerCase();
    if (!type || !name) return null;
    return `name:${type}|${name}`;
  }

  private extractLineStringFromNotes(notes: unknown): string | null {
    if (typeof notes !== 'string' || !notes.trim()) return null;
    const line = notes
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(GEOMAP_LINE_NOTES_PREFIX));
    if (!line) return null;
    const wkt = line.slice(GEOMAP_LINE_NOTES_PREFIX.length).trim();
    return this.parseLineStringWkt(wkt).length >= 2 ? wkt : null;
  }

  private stripGeomMetadataFromNotes(notes: unknown): string {
    if (typeof notes !== 'string' || !notes.trim()) return '';
    return notes
      .split(/\r?\n/)
      .map((entry) => entry.trimEnd())
      .filter((entry) => !entry.trim().startsWith(GEOMAP_LINE_NOTES_PREFIX))
      .join('\n')
      .trim();
  }

  private composeNotesWithGeom(notes: string, geomWkt: string): string {
    const clean = this.stripGeomMetadataFromNotes(notes);
    const metadata = `${GEOMAP_LINE_NOTES_PREFIX}${geomWkt.trim()}`;
    if (!clean) return metadata;
    return `${clean}\n${metadata}`;
  }

  private getAssetLineWkt(asset?: GeoMapAsset | null): string | null {
    if (!asset) return null;
    const fromGeom = typeof asset.IgbGeomWkt === 'string' ? asset.IgbGeomWkt.trim() : '';
    if (this.parseLineStringWkt(fromGeom).length >= 2) return fromGeom;
    return this.extractLineStringFromNotes(asset.IgbNotes);
  }

  private getAssetLineCoords(asset?: GeoMapAsset | null): Array<[number, number]> {
    const wkt = this.getAssetLineWkt(asset);
    return this.parseLineStringWkt(wkt);
  }

  private getAssetPoint(asset: GeoMapAsset): { lat: number; lng: number } | null {
    const lat = this.parseCoord(asset?.IgbLat);
    const lng = this.parseCoord(asset?.IgbLng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
    const wktPoint = this.parsePointWkt(asset?.IgbGeomWkt);
    if (wktPoint) {
      return { lat: wktPoint[1], lng: wktPoint[0] };
    }
    return null;
  }

  private parsePointWkt(wkt: unknown): [number, number] | null {
    if (typeof wkt !== 'string' || !wkt.trim()) return null;
    const normalized = wkt.trim().replace(/^SRID=\d+;/i, '').trim();
    const match = normalized.match(/^POINT\s*\(\s*([+-]?\d+(\.\d+)?)\s+([+-]?\d+(\.\d+)?)\s*\)$/i);
    if (!match) return null;
    const lng = Number(match[1]);
    const lat = Number(match[3]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
  }

  private parseLineStringWkt(wkt: unknown): Array<[number, number]> {
    if (typeof wkt !== 'string') return [];
    const trimmed = wkt.trim().replace(/^SRID=\d+;/i, '').trim();
    if (!trimmed) return [];
    const match = trimmed.match(/^LINESTRING\s*\(\s*(.+)\s*\)$/i);
    if (!match?.[1]) return [];
    return match[1]
      .split(',')
      .map((segment) => segment.trim())
      .map((segment) => segment.split(/\s+/))
      .map((parts) => {
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        return Number.isFinite(lng) && Number.isFinite(lat) ? ([lng, lat] as [number, number]) : null;
      })
      .filter((coord): coord is [number, number] => Boolean(coord));
  }

  private buildLineStringWkt(coords: unknown): string | null {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const points = coords
      .map((coord) => {
        if (!Array.isArray(coord)) return null;
        const lng = Number(coord[0]);
        const lat = Number(coord[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return `${lng.toFixed(6)} ${lat.toFixed(6)}`;
      })
      .filter((point): point is string => Boolean(point));
    if (points.length < 2) return null;
    return `LINESTRING(${points.join(', ')})`;
  }

  private setAssetsData(items: GeoMapAsset[]) {
    this.allAssets = items.slice();
    this.totalAssetsCount.set(this.allAssets.length);
    this.applyAssetFilters();
  }

  private applyAssetFilters() {
    const typeFilter = String(this.filterForm.controls.type.value ?? '')
      .trim()
      .toUpperCase();
    const statusFilter = this.statusFilter();
    const searchFilter = this.searchFilter().trim().toLowerCase();

    const filtered = this.allAssets.filter((item) => {
      const itemType = String(item?.IgbType ?? '')
        .trim()
        .toUpperCase();
      if (typeFilter && itemType !== typeFilter) return false;

      const itemStatus = String(item?.IgbStatus ?? '')
        .trim()
        .toUpperCase();
      if (statusFilter !== 'ALL' && itemStatus !== statusFilter) return false;

      if (!searchFilter) return true;
      const searchText = [
        item?.IgbID,
        item?.IgbName,
        item?.IgbType,
        item?.IgbStatus,
        item?.VendorModelName,
      ]
        .map((value) => String(value ?? '').toLowerCase())
        .join(' ');
      return searchText.includes(searchFilter);
    });

    this.dataSource.data = filtered;
    this.assetsCount.set(filtered.length);
    this.renderAssetMarkers(filtered);
  }

  private ensureAssetLayer() {
    if (!this.map) return;
    const sourceId = 'geomap-assets-source';
    const lineHitLayerId = 'geomap-assets-line-hit-layer';
    const lineLayerId = 'geomap-assets-line-layer';
    const layerId = 'geomap-assets-layer';
    const labelLayerId = 'geomap-assets-label-layer';
    if (!this.map.getSource?.(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!this.map.getLayer?.(lineHitLayerId)) {
      this.map.addLayer({
        id: lineHitLayerId,
        type: 'line',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#000000',
          'line-width': 28,
          'line-opacity': 0.01,
        },
      });
    }
    if (!this.map.getLayer?.(lineLayerId)) {
      this.map.addLayer({
        id: lineLayerId,
        type: 'line',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#8B5CF6'],
          'line-width': 4,
          'line-opacity': 0.95,
        },
      });
    }
    if (!this.map.getLayer?.(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': ['coalesce', ['get', 'color'], '#22C55E'],
          'circle-stroke-color': '#0f172a',
          'circle-stroke-width': 1,
        },
      });
    }
    if (!this.map.getLayer?.(labelLayerId)) {
      this.map.addLayer({
        id: labelLayerId,
        type: 'symbol',
        source: sourceId,
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: 12,
        layout: {
          'text-field': ['coalesce', ['get', 'name'], ''],
          'text-size': 12,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, -1.2],
          'text-anchor': 'bottom',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.2,
          'text-halo-blur': 0.5,
        },
      });
    }
  }

  private ensureDraftPointLayer() {
    if (!this.map) return;
    const sourceId = 'geomap-draft-point-source';
    const pulseLayerId = 'geomap-draft-point-pulse-layer';
    const layerId = 'geomap-draft-point-layer';
    if (!this.map.getSource?.(sourceId)) {
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!this.map.getLayer?.(pulseLayerId)) {
      this.map.addLayer({
        id: pulseLayerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 10,
          'circle-color': '#0ea5e9',
          'circle-opacity': 0.2,
        },
      });
    }
    if (!this.map.getLayer?.(layerId)) {
      this.map.addLayer({
        id: layerId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': 8,
          'circle-color': '#0ea5e9',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
    }
  }

  private renderDraftPoint() {
    if (!this.map) return;
    const source = this.map.getSource?.('geomap-draft-point-source');
    if (!source || !('setData' in source)) return;
    if (!this.draftPoint) {
      (source as any).setData({ type: 'FeatureCollection', features: [] });
      this.stopDraftPulse();
      return;
    }
    (source as any).setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [this.draftPoint.lng, this.draftPoint.lat] },
          properties: {},
        },
      ],
    });
    this.startDraftPulse();
  }

  private clearDraftPoint() {
    this.draftPoint = null;
    this.renderDraftPoint();
  }

  private startDraftPulse() {
    if (this.draftPulseFrame) return;
    const animate = () => {
      if (!this.map || !this.draftPoint) {
        this.draftPulseFrame = undefined;
        return;
      }
      const layerId = 'geomap-draft-point-pulse-layer';
      if (this.map.getLayer?.(layerId)) {
        const phase = (performance.now() % 1400) / 1400;
        const radius = 10 + phase * 10;
        const opacity = 0.3 * (1 - phase);
        this.map.setPaintProperty(layerId, 'circle-radius', radius);
        this.map.setPaintProperty(layerId, 'circle-opacity', opacity);
      }
      this.draftPulseFrame = requestAnimationFrame(animate);
    };
    this.draftPulseFrame = requestAnimationFrame(animate);
  }

  private stopDraftPulse() {
    if (this.draftPulseFrame) {
      cancelAnimationFrame(this.draftPulseFrame);
      this.draftPulseFrame = undefined;
    }
    if (this.map?.getLayer?.('geomap-draft-point-pulse-layer')) {
      this.map.setPaintProperty('geomap-draft-point-pulse-layer', 'circle-radius', 10);
      this.map.setPaintProperty('geomap-draft-point-pulse-layer', 'circle-opacity', 0.2);
    }
  }

  private findAssetByUUID(uuid: string): GeoMapAsset | null {
    return (
      this.allAssets.find(item => item.IgbUUID === uuid) ||
      this.dataSource.data.find(item => item.IgbUUID === uuid) ||
      this.lastAssets.find(item => item.IgbUUID === uuid) ||
      null
    );
  }

  private replaceAsset(item: GeoMapAsset) {
    const mergedItem = this.mergeCachedCableGeometry(item);
    const selectedProjects = this.selectedProjectUUIDs();
    const current = this.allAssets.slice();
    const idx = current.findIndex(row => row.IgbUUID === mergedItem.IgbUUID);
    if (
      selectedProjects.length > 0 &&
      mergedItem.IspGeoMapProjectIgpUUID &&
      !selectedProjects.includes(mergedItem.IspGeoMapProjectIgpUUID)
    ) {
      if (idx >= 0) {
        current.splice(idx, 1);
      }
    } else if (idx >= 0) {
      current[idx] = { ...current[idx], ...mergedItem };
    } else {
      current.unshift(mergedItem);
    }
    this.setAssetsData(current);
  }

  private async confirmDelete(asset?: GeoMapAsset) {
    if (!asset?.IgbUUID) return;
    const ref = this.dialog.open(SlowConfirmDialogComponent, {
      data: {
        title: 'Delete asset',
        message: `Delete ${asset.IgbName || 'this asset'}? This action cannot be undone.`,
        confirmLabel: 'Delete',
      },
      panelClass: 'slow-confirm-dialog',
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;
    try {
      await this.api.delete<any>(`isp/geomap/assets/base/${asset.IgbUUID}`);
      for (const cacheKey of this.getCableCacheKeys(asset)) {
        this.cableGeometryCache.delete(cacheKey);
      }
      this.persistCableGeometryCache();
      const next = this.allAssets.filter(item => item.IgbUUID !== asset.IgbUUID);
      this.setAssetsData(next);
      this.assetCreatePanel?.remove();
      this.assetCreatePanel = undefined;
      this.snack.success('Asset deleted.');
    } catch (err) {
      console.error('Failed to delete asset.', err);
      this.snack.error('Failed to delete asset.');
    }
  }

  private updateAssetSource(items: GeoMapAsset[]) {
    if (!this.map) return;
    const source = this.map.getSource?.('geomap-assets-source');
    if (!source || !('setData' in source)) return;
    const features = items
      .map(item => {
        const lineCoords = this.parseLineStringWkt(item?.IgbGeomWkt);
        if (lineCoords.length >= 2) {
          return {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: lineCoords },
            properties: {
              uuid: item?.IgbUUID ?? null,
              name: item?.IgbName ?? null,
              type: item?.IgbType ?? null,
              color: this.resolveAssetColor(item?.IgbColor, item?.IgbType),
            },
          };
        }

        const point = this.getAssetPoint(item);
        if (!point) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: {
            uuid: item?.IgbUUID ?? null,
            name: item?.IgbName ?? null,
            type: item?.IgbType ?? null,
            color: this.resolveAssetColor(item?.IgbColor, item?.IgbType),
          },
        };
      })
      .filter(Boolean);
    (source as any).setData({ type: 'FeatureCollection', features });
  }

  private registerAssetHoverCursor() {
    if (!this.map) return;
    if (this.assetCursorHandlers) {
      for (const handler of this.assetCursorHandlers) {
        this.map.off('mouseenter', handler.layerId, handler.enter);
        this.map.off('mousemove', handler.layerId, handler.move);
        this.map.off('mouseleave', handler.layerId, handler.leave);
      }
    }
    const layerIds = [
      'geomap-assets-line-hit-layer',
      'geomap-assets-line-layer',
      'geomap-assets-layer',
      'geomap-assets-label-layer',
      'geomap-draft-point-layer',
      'geomap-draft-point-pulse-layer',
    ];
    this.assetCursorHandlers = layerIds.map(layerId => {
      const enter = () => {
        const canvas = this.map?.getCanvas?.();
        if (canvas) canvas.style.cursor = 'pointer';
      };
      const move = () => {
        const canvas = this.map?.getCanvas?.();
        if (canvas) canvas.style.cursor = 'pointer';
      };
      const leave = () => {
        const canvas = this.map?.getCanvas?.();
        if (canvas) canvas.style.cursor = 'crosshair';
      };
      this.map.on('mouseenter', layerId, enter);
      this.map.on('mousemove', layerId, move);
      this.map.on('mouseleave', layerId, leave);
      return { layerId, enter, move, leave };
    });
  }

  private onDrawCreate(event: any) {
    const feature = event?.features?.[0];
    if (!feature) return;

    if (feature.geometry?.type === 'LineString' && this.measuring()) {
      this.measureFeatureId = feature.id as string;
      this.measuring.set(false);
      this.updateMeasureFromFeature(feature);
      this.draw.changeMode('simple_select', { featureIds: [feature.id] });
      this.measureControl?.update();
      return;
    }

    if (feature.geometry?.type === 'LineString' && this.cableDrawing()) {
      const coords = Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates : [];
      const geomWkt = this.buildLineStringWkt(coords);
      if (!geomWkt) {
        this.draw.delete(feature.id);
        this.cableDrawing.set(false);
        this.snack.warning('Cable path must have at least 2 points.');
        this.updateDrawControls();
        return;
      }
      this.draftCableFeatureId = feature.id as string;
      this.cableDrawing.set(false);
      this.draw.changeMode('simple_select', { featureIds: [feature.id] });
      const last = coords[coords.length - 1];
      if (last?.length >= 2) {
        this.setStreetViewPoint(Number(last[0]), Number(last[1]));
        this.openAssetPopup(
          { lng: Number(last[0]), lat: Number(last[1]) },
          undefined,
          {
            geomWkt,
            defaultType: 'CABLE',
            onClose: () => this.clearCableDraftFeature(),
          },
        );
      }
      this.updateDrawControls();
      return;
    }

    if (feature.geometry?.type === 'Polygon') {
      if (this.bboxFeatureId && this.bboxFeatureId !== feature.id) {
        this.draw.delete(this.bboxFeatureId);
      }
      this.bboxFeatureId = feature.id as string;
      this.updateBBoxFromPolygon(feature);
    }
    this.updateDrawControls();
  }

  private onDrawUpdate(event: any) {
    const features = event?.features ?? [];
    for (const feature of features) {
      if (feature.geometry?.type === 'LineString' && feature.id === this.measureFeatureId) {
        this.updateMeasureFromFeature(feature);
      }
      if (feature.geometry?.type === 'Polygon' && feature.id === this.bboxFeatureId) {
        this.updateBBoxFromPolygon(feature);
      }
    }
    this.updateDrawControls();
  }

  private onDrawDelete(event: any) {
    const features = event?.features ?? [];
    for (const feature of features) {
      if (feature.id === this.measureFeatureId) {
        this.measureFeatureId = null;
        this.measuredDistance.set(null);
        this.clearMeasurePreview();
        this.measureControl?.update();
      }
      if (feature.id === this.bboxFeatureId) {
        this.bboxFeatureId = null;
      }
      if (feature.id === this.draftCableFeatureId) {
        this.draftCableFeatureId = null;
        this.cableDrawing.set(false);
      }
    }
    this.updateDrawControls();
  }

  private updateDrawControls() {
    if (!this.map) return;
    const mode = this.draw?.getMode?.();
    if (this.measuring() && mode && mode !== 'draw_line_string') {
      this.measuring.set(false);
      this.clearMeasurePreview();
      this.measureControl?.update();
    }
    if (this.cableDrawing() && mode && mode !== 'draw_line_string') {
      this.cableDrawing.set(false);
    }
    this.measureControl?.update();
  }

  private clearCableDraftFeature() {
    if (this.draftCableFeatureId && this.draw) {
      this.draw.delete(this.draftCableFeatureId);
    }
    this.draftCableFeatureId = null;
  }

  private beginCablePathEdit(asset: GeoMapAsset): boolean {
    if (!this.draw) return false;
    const coords = this.getAssetLineCoords(asset);
    if (coords.length < 2) return false;

    this.clearCableDraftFeature();
    const featureIds = this.draw.add({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
      properties: {},
    });
    const nextId = Array.isArray(featureIds) ? featureIds[0] : featureIds;
    if (!nextId) return false;

    this.draftCableFeatureId = String(nextId);
    this.draw.changeMode('direct_select', { featureId: this.draftCableFeatureId });
    this.updateDrawControls();
    return true;
  }

  private getDraftCableGeomWkt(): string | null {
    if (!this.draw || !this.draftCableFeatureId) return null;
    const feature = this.draw.get?.(this.draftCableFeatureId);
    if (feature?.geometry?.type !== 'LineString') return null;
    return this.buildLineStringWkt(feature.geometry.coordinates);
  }

  private cancelCableDrawing() {
    if (this.draw?.getMode?.() === 'draw_line_string') {
      this.draw.changeMode('simple_select');
    }
    this.cableDrawing.set(false);
    this.clearCableDraftFeature();
    this.map?.dragPan?.enable?.();
    this.updateDrawControls();
  }

  private updateMeasurePreview(lngLat: { lng: number; lat: number } | undefined) {
    if (!lngLat || !this.draw) return;
    const line = this.getActiveLineFeature();
    if (!line) return;
    const coords = Array.isArray(line.geometry?.coordinates) ? line.geometry.coordinates : [];
    const distance = this.calculateDistanceFromCoords([...coords, [lngLat.lng, lngLat.lat]]);
    this.measuredDistance.set(distance);
    this.showMeasurePopup(lngLat, distance);
  }

  private updateMeasureFromFeature(feature: any) {
    const coords = feature?.geometry?.coordinates ?? [];
    const distance = this.calculateDistanceFromCoords(coords);
    this.measuredDistance.set(distance);
    const last = coords[coords.length - 1];
    if (last) {
      this.showMeasurePopup({ lng: last[0], lat: last[1] }, distance);
    }
    this.measureControl?.update();
  }

  private getActiveLineFeature(): any | null {
    if (!this.draw?.getAll) return null;
    const data = this.draw.getAll();
    if (!data?.features?.length) return null;
    if (this.measureFeatureId) {
      return data.features.find((f: any) => f.id === this.measureFeatureId) ?? null;
    }
    return data.features.find((f: any) => f.geometry?.type === 'LineString') ?? null;
  }

  private updateBBoxFromPolygon(feature: any) {
    const coords = feature?.geometry?.coordinates?.[0] ?? [];
    if (!coords.length) return;
    const lats = coords.map((point: number[]) => point[1]);
    const lngs = coords.map((point: number[]) => point[0]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    this.bboxForm.patchValue({
      minLat,
      minLng,
      maxLat,
      maxLng,
    });
  }

  private calculateDistanceFromCoords(coords: number[][]): number {
    if (!Array.isArray(coords) || coords.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
      const [lng1, lat1] = coords[i - 1];
      const [lng2, lat2] = coords[i];
      total += this.haversineDistance(lat1, lng1, lat2, lng2);
    }
    return total;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private showMeasurePopup(lngLat: { lng: number; lat: number }, distance: number) {
    if (!this.map) return;
    const mapboxgl = this.mapboxgl;
    if (!mapboxgl) return;
    if (!this.measurePopup) {
      this.measurePopup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'geomap-measure-popup',
        offset: 8,
      });
    }
    this.measurePopup.setLngLat(lngLat).setHTML(this.formatDistance(distance)).addTo(this.map);
  }

  private clearMeasurePreview() {
    if (this.measurePopup) {
      this.measurePopup.remove();
      this.measurePopup = undefined;
    }
  }

  private resolveAssetColor(color?: string | null, type?: string | null) {
    const normalized = typeof color === 'string' ? color.trim().toUpperCase() : '';
    if (/^#[0-9A-F]{6}$/.test(normalized)) {
      return normalized;
    }
    const key = (type ?? '').toUpperCase();
    return this.resolveTypeDefaultColor(key) ?? GEO_MAP_TYPE_DEFAULT_COLORS[key] ?? '#22C55E';
  }

  private resolveTypeDefaultColor(type?: string | null): string | null {
    const key = (type ?? '').trim().toUpperCase();
    if (!key) return null;
    const match = this.assetTypes().find((item) => item.IatCode === key);
    const color = typeof match?.IatDefaultColor === 'string' ? match.IatDefaultColor.trim().toUpperCase() : '';
    if (/^#[0-9A-F]{6}$/.test(color)) {
      return color;
    }
    return null;
  }

  private getTypeIconSvg(type?: string | null) {
    const key = (type ?? '').toUpperCase();
    const icons: Record<string, string> = {
      CABLE:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      CEO:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l3.2 6.5 7.2 1-5.2 5 1.2 7.1L12 19l-6.4 3.6 1.2-7.1-5.2-5 7.2-1L12 3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      CTO:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 12h8M8 15h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      CUSTOMER:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5.5 19c1.3-3.2 4-5 6.5-5s5.2 1.8 6.5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
      DIO:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 10v4M12 10v4M16 10v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      OLT:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      PON:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      SPLITTER:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v6M12 10l-6 6M12 10l6 6M6 16h4M14 16h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };
    return (
      icons[key] ??
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>'
    );
  }

  private buildPinElement(type?: string | null, color?: string | null) {
    const icon = this.getTypeIconSvg(type);
    const fill = this.resolveAssetColor(color, type);
    const el = document.createElement('div');
    el.className = 'geomap-pin';
    el.style.background = fill;
    el.innerHTML = `<span class="geomap-pin-icon">${icon}</span>`;
    return el;
  }
}
