import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
@Component({
  selector: 'app-authentication-dashboard',
  imports: [DashboardPageComponent, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class AuthenticationDashboardPage {
  private readonly api = inject(ApiService);
  readonly platform = inject(ActivatedRoute).snapshot.data['scope'] === 'master';
  readonly metrics = this.platform
    ? ['clusters', 'servers']
    : ['accounts', 'devices', 'accesses', 'profiles'];
  readonly dashboard = dashboardResource({
    defaultValue: {} as Record<string, number>,
    loader: async () =>
      (
        await this.api.get<{ data: Record<string, number> }>(
          `${this.platform ? 'system/' : ''}authentication/dashboard`,
          { timeout: 30000 },
        )
      ).data,
  });
}
