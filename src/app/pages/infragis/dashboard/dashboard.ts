import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { fadeIn } from '../../../shared/animations/fade.animation';
import { TranslatePipe } from '../../../shared/i18n/translate.pipe';

type InfraGisReadinessItem = {
  label: string;
  detail: string;
  icon: string;
  state: 'ready' | 'planned';
};

@Component({
  selector: 'app-infragis-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss'],
  animations: [fadeIn],
})
export class InfraGisDashboardPage {
  readonly readiness: InfraGisReadinessItem[] = [
    {
      label: 'API contract',
      detail: 'Planned under /api/v1/infragis.',
      icon: 'api',
      state: 'planned',
    },
    {
      label: 'Mobile client',
      detail: 'Public Flutter repository created.',
      icon: 'phone_iphone',
      state: 'ready',
    },
    {
      label: 'Offline sync',
      detail: 'SQLite-first sync contract documented.',
      icon: 'sync',
      state: 'planned',
    },
    {
      label: 'Map provider',
      detail: 'Mapbox provider boundary documented.',
      icon: 'map',
      state: 'planned',
    },
  ];
}
