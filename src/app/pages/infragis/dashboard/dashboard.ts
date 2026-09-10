import { Component, computed, inject } from '@angular/core';
import { NgStyle } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';

type Asset = {
  IgaUUID: string;
  IgaName: string;
  IgmLatitude: number;
  IgmLongitude: number;
  Color?: string;
};
@Component({
  selector: 'app-infragis-dashboard',
  standalone: true,
  imports: [DashboardPageComponent, NgStyle, MatTooltipModule, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class InfraGisDashboardPage {
  private readonly api = inject(ApiService);
  readonly dashboardResource = dashboardResource({
    defaultValue: { summary: {} as Record<string, number>, assets: [] as Asset[] },
    loader: async () => {
      const [summary, map] = await Promise.all([
        this.api.get<{ data: { summary: Record<string, number> } }>('infragis/', {
          timeout: 30000,
        }),
        this.api.get<{ data: { items: Asset[] } }>('infragis/map/assets?limit=1000', {
          timeout: 30000,
        }),
      ]);
      return { summary: summary.data.summary, assets: map.data.items };
    },
  });
  readonly metrics = computed(() => [
    { label: 'Projects', value: this.dashboardResource.value().summary['ProjectCount'] },
    { label: 'Layers', value: this.dashboardResource.value().summary['LayerCount'] },
    { label: 'Assets', value: this.dashboardResource.value().summary['AssetCount'] },
    { label: 'Active assets', value: this.dashboardResource.value().summary['ActiveAssetCount'] },
  ]);
  readonly mapAssets = computed(() => this.dashboardResource.value().assets);
  mapPointStyle(asset: Asset) {
    const latitude = Number(asset.IgmLatitude);
    const longitude = Number(asset.IgmLongitude);
    const lat = Number.isFinite(latitude) ? latitude : 0;
    const lng = Number.isFinite(longitude) ? longitude : 0;
    return {
      left: `${Math.min(96, Math.max(4, ((lng + 180) / 360) * 100))}%`,
      top: `${Math.min(92, Math.max(8, ((90 - lat) / 180) * 100))}%`,
    };
  }
}
