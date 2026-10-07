import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { DashboardPageComponent } from '../../../shared/dashboard/dashboard-page';
import { dashboardResource } from '../../../shared/dashboard/dashboard-resource';
@Component({
  selector: 'app-crm-dashboard',
  imports: [DashboardPageComponent, TranslocoPipe],
  templateUrl: './dashboard.html',
})
export class CrmDashboardPage {
  private readonly api = inject(ApiService);
  readonly dashboard = dashboardResource({
    defaultValue: {
      leads: null as number | null,
      opportunities: null as number | null,
      overdue: null as number | null,
      handoffs: null as number | null,
    },
    loader: async () =>
      (
        await this.api.get<{
          data: { leads: number; opportunities: number; overdue: number; handoffs: number };
        }>('crm/summary')
      ).data,
  });
}
