import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApiService } from '../../src/app/services/api.service';
import { DashboardPageComponent } from '../../src/app/shared/dashboard/dashboard-page';
import { dashboardResource } from '../../src/app/shared/dashboard/dashboard-resource';

// Adjust imports and endpoint when creating a page. Never copy a legacy dashboard.
@Component({
  selector: 'app-example-dashboard',
  imports: [DashboardPageComponent, TranslocoPipe],
  templateUrl: './page.html',
})
export class ExampleDashboardPage {
  private readonly api = inject(ApiService);
  readonly dashboard = dashboardResource({
    defaultValue: { total: null as number | null },
    loader: async () => {
      const response = await this.api.get<{ data: { total: number } }>('example/summary', {
        timeout: 30000,
      });
      return response.data;
    },
  });
}
