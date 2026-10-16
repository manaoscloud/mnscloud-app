import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppUpdateService } from '../../services/app-update.service';

/**
 * Calm, non-blocking notice shown when a newer App version is deployed while the tab is open.
 * It never reloads by itself: the user finishes the current work, then updates or postpones.
 */
@Component({
  selector: 'mns-app-update-notice',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  templateUrl: './app-update-notice.html',
  styleUrl: './app-update-notice.scss',
})
export class AppUpdateNotice {
  protected readonly update = inject(AppUpdateService);
  /** Set when "Update now" found an open dialog: ask before discarding that work. */
  protected readonly confirmOpenWork = signal(false);

  constructor() {
    this.update.start();
  }

  protected reload() {
    if (this.update.hasOpenWork() && !this.confirmOpenWork()) {
      this.confirmOpenWork.set(true);
      return;
    }
    this.update.reloadNow();
  }

  protected later() {
    this.confirmOpenWork.set(false);
    this.update.postpone();
  }
}
