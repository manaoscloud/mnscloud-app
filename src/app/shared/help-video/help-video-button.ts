import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { HelpVideoService } from '../../services/help-video.service';

/**
 * "Tutorial video" beside "Report problem" (topbar, page and dialog headers). Shown only when the
 * open page has an active video; it plays inside the App without leaving the window.
 */
@Component({
  selector: 'mns-help-video-button',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  template: `
    @if (helpVideos.current(); as video) {
      <button
        mat-icon-button
        type="button"
        class="help-video-button"
        [matTooltip]="'Tutorial video' | transloco"
        [attr.aria-label]="'Tutorial video' | transloco"
        (click)="open()"
      >
        <mat-icon>smart_display</mat-icon>
      </button>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class HelpVideoButtonComponent {
  readonly helpVideos = inject(HelpVideoService);
  private readonly dialog = inject(MatDialog);

  async open() {
    const video = this.helpVideos.current();
    if (!video) return;
    // Loaded on demand: the dialog header also carries "Report problem", which hosts this button.
    const { openHelpVideo } = await import('./help-video-dialog');
    openHelpVideo(this.dialog, video);
  }
}
