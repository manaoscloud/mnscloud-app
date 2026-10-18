import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import type { HelpVideo } from '../../services/help-video.service';
import { openCrudComponentDialog } from '../dialog/crud-dialog.util';
import { ReportProblemButtonComponent } from '../support-report-dialog/report-problem-button';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Language names shown when the page has no video in the user language. */
const LANGUAGE_LABELS: Record<string, string> = {
  'pt-BR': 'Portuguese',
  'en-US': 'English',
  'es-ES': 'Spanish',
};

/** youtube-nocookie embed URL of a validated video id (never a stored URL). */
export function helpVideoEmbedUrl(videoId: string, language: string): string | null {
  if (!VIDEO_ID.test(videoId)) return null;
  const params = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    hl: language,
    cc_lang_pref: language.slice(0, 2),
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Plays a tutorial video inside the App, over the page or dialog it explains, like the attachment
 * preview: the user never leaves the App or the window.
 */
@Component({
  selector: 'mns-help-video-dialog',
  standalone: true,
  imports: [
    ReportProblemButtonComponent,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `
    <div class="crud-dialog help-video-dialog">
      <header class="dialog-header">
        <div>
          <h2>{{ video.Title }}</h2>
          <p>
            {{ 'Tutorial video' | transloco }}
            @if (otherLanguage()) {
              · {{ otherLanguage()! | transloco }}
            }
          </p>
        </div>
        <mns-report-problem-button [helpVideo]="false" />
      </header>

      <div class="dialog-content">
        <div class="dialog-scroll help-video-scroll">
          @if (embedUrl(); as url) {
            <div class="help-video-frame">
              <iframe
                [src]="url"
                [title]="video.Title"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
              ></iframe>
            </div>
          }
        </div>
      </div>

      <mat-dialog-actions class="form-actions">
        <div class="secondary-actions">
          <button mat-stroked-button type="button" mat-dialog-close>
            {{ 'Close' | transloco }}
          </button>
        </div>
      </mat-dialog-actions>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
    .help-video-dialog {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
    }
    .help-video-dialog .dialog-header h2 {
      overflow-wrap: anywhere;
    }
    .help-video-scroll {
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1 1 auto;
      min-height: 0;
      padding: 0.5rem;
    }
    .help-video-frame {
      width: 100%;
      max-width: 1280px;
      aspect-ratio: 16 / 9;
      max-height: 100%;
      border-radius: 8px;
      overflow: hidden;
      background: #000;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }
    .help-video-frame iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
    }
  `,
})
export class HelpVideoDialogComponent {
  readonly video = inject<HelpVideo>(MAT_DIALOG_DATA);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly language = inject(TranslocoService).getActiveLang();

  readonly embedUrl = computed(() => {
    const url = helpVideoEmbedUrl(this.video.YoutubeVideoId, this.language);
    // The id is validated and the host is fixed, so the resource URL is safe to trust.
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });
  /** Language of the video when it is not the user language (no video in that language yet). */
  readonly otherLanguage = computed(() =>
    this.video.Locale !== this.language ? (LANGUAGE_LABELS[this.video.Locale] ?? null) : null,
  );
}

export function openHelpVideo(dialog: MatDialog, video: HelpVideo): void {
  const binding = openCrudComponentDialog(dialog, HelpVideoDialogComponent, 'crud-form-dialog', {
    data: video,
  });
  void firstValueFrom(binding.ref.afterClosed()).finally(() => binding.stop());
}
