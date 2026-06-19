import { Component, inject } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { NavigationLoadingService } from './navigation-loading.service';

@Component({
  selector: 'app-route-loader',
  standalone: true,
  imports: [MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './route-loader.html',
  styleUrls: ['./route-loader.scss'],
})
export class RouteLoader {
  private readonly navigationLoading = inject(NavigationLoadingService);

  readonly showProgressBar = this.navigationLoading.showProgressBar;
  readonly showOverlay = this.navigationLoading.showOverlay;
}
