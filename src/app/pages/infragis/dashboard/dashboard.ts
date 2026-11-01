import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgStyle } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';

type Asset = {
  IgaUUID: string;
  IgaName: string;
  IgmLatitude: number | string;
  IgmLongitude: number | string;
  Color?: string;
};
type Feature = {
  id: string;
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, any>;
};
type Summary = Partial<
  Record<
    'ProjectCount' | 'LayerCount' | 'AssetCount' | 'AssetTypeCount' | 'ActiveAssetCount',
    number
  >
>;

@Component({
  selector: 'app-infragis-dashboard',
  standalone: true,
  imports: [
    DashboardPageComponent,
    NgStyle,
    RouterLink,
    MatIconModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './dashboard.html',
})
export class InfraGisDashboardPage {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  /** Counters of one InfraGIS account (opened from InfraGIS › Accounts); empty = every account. */
  readonly accountUUID = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('accountUUID') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('accountUUID') ?? '' },
  );
  readonly accountName = signal('');
  readonly dashboardResource = dashboardResource({
    defaultValue: { summary: {} as Summary, assets: [] as Asset[] },
    params: () => ({ account: this.accountUUID() }),
    loader: async ({ params }) => {
      const account = params.account;
      const scoped = account ? `accountUUID=${encodeURIComponent(account)}` : '';
      const [summary, assets, item] = await Promise.all([
        this.api.get<{ data: { summary: Summary } }>(
          `infragis/dashboard${scoped ? `?${scoped}` : ''}`,
          { timeout: 30000 },
        ),
        account ? this.accountAssets(scoped) : this.allAssets(),
        account
          ? this.api.get<{ data: { item?: { IgcName?: string } } }>(
              `infragis/accounts/${encodeURIComponent(account)}`,
            )
          : Promise.resolve(null),
      ]);
      this.accountName.set(item?.data?.item?.IgcName ?? '');
      return { summary: summary.data.summary, assets };
    },
  });
  private async allAssets(): Promise<Asset[]> {
    const result = await this.api.get<{ data: { items: Asset[] } }>(
      'infragis/map/assets?limit=1000',
      { timeout: 30000 },
    );
    return result.data.items;
  }

  /** Preview points of one account: the first vertex of each map feature of the account. */
  private async accountAssets(scoped: string): Promise<Asset[]> {
    const result = await this.api.get<{ data: { features: Feature[] } }>(
      `infragis/map/features?${scoped}`,
      { timeout: 30000 },
    );
    return (result.data.features ?? []).slice(0, 1000).flatMap((feature) => {
      const point = firstVertex(feature.geometry?.coordinates);
      return point
        ? [
            {
              IgaUUID: String(feature.properties?.['IgaUUID'] ?? feature.id),
              IgaName: String(feature.properties?.['IgaName'] ?? ''),
              IgmLongitude: point[0],
              IgmLatitude: point[1],
              Color: feature.properties?.['Color'],
            },
          ]
        : [];
    });
  }

  readonly metrics = computed(() => {
    const summary = this.dashboardResource.value().summary;
    return [
      { label: 'Projects', value: summary.ProjectCount },
      { label: 'Layers', value: summary.LayerCount },
      { label: 'Assets', value: summary.AssetCount },
      { label: 'Assets in operation', value: summary.ActiveAssetCount },
    ];
  });
  readonly empty = computed(() => {
    const summary = this.dashboardResource.value().summary;
    return summary.ProjectCount === 0 && summary.AssetCount === 0;
  });
  readonly mapAssets = computed(() =>
    this.dashboardResource
      .value()
      .assets.map((asset) => ({
        ...asset,
        lat: Number(asset.IgmLatitude),
        lng: Number(asset.IgmLongitude),
      }))
      .filter((asset) => Number.isFinite(asset.lat) && Number.isFinite(asset.lng)),
  );
  /** Preview frame: the bounding box of the loaded assets, so nearby assets do not overlap. */
  private readonly frame = computed(() => {
    const assets = this.mapAssets();
    const lats = assets.map((asset) => asset.lat);
    const lngs = assets.map((asset) => asset.lng);
    const minLat = Math.min(...lats);
    const minLng = Math.min(...lngs);
    return {
      minLat,
      minLng,
      latSpan: Math.max(Math.max(...lats) - minLat, 0.0001),
      lngSpan: Math.max(Math.max(...lngs) - minLng, 0.0001),
    };
  });

  mapPointStyle(asset: { lat: number; lng: number; Color?: string }) {
    const { minLat, minLng, latSpan, lngSpan } = this.frame();
    return {
      left: `${4 + ((asset.lng - minLng) / lngSpan) * 92}%`,
      top: `${8 + (1 - (asset.lat - minLat) / latSpan) * 84}%`,
      background: asset.Color || null,
    };
  }
}

/** First [lng, lat] of a GeoJSON Point, LineString or Polygon coordinate array. */
export function firstVertex(coordinates: unknown): [number, number] | null {
  let value = coordinates;
  while (Array.isArray(value) && Array.isArray(value[0])) value = value[0];
  return Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number'
    ? [value[0], value[1]]
    : null;
}
