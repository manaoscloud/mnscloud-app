import { Component, computed, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import { RouterLink } from '@angular/router';
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
  readonly dashboardResource = dashboardResource({
    defaultValue: { summary: {} as Summary, assets: [] as Asset[] },
    loader: async () => {
      const [summary, map] = await Promise.all([
        this.api.get<{ data: { summary: Summary } }>('infragis/dashboard', { timeout: 30000 }),
        this.api.get<{ data: { items: Asset[] } }>('infragis/map/assets?limit=1000', {
          timeout: 30000,
        }),
      ]);
      return { summary: summary.data.summary, assets: map.data.items };
    },
  });
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
