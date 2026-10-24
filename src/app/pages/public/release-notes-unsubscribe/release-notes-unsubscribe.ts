import { Component, inject, resource } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

import { PageShellComponent } from '../../../shared/pages/page-shell';
import { ReleaseNoteService } from '../../../services/release-note.service';

/**
 * One-click unsubscribe from the weekly release notes digest (`/release-notes/unsubscribe?s=&t=`),
 * the link of every digest e-mail. No sign-in: the API checks the signed token.
 */
@Component({
  selector: 'app-release-notes-unsubscribe',
  standalone: true,
  imports: [PageShellComponent, MatButtonModule, RouterLink, TranslocoPipe],
  template: `
    <mns-page-shell
      title="releaseNotes.unsubscribeTitle"
      description="releaseNotes.unsubscribeDescription"
      [loading]="result.isLoading()"
      [refreshDisabled]="true"
    >
      @if (result.isLoading()) {
        <p>{{ 'releaseNotes.unsubscribeWorking' | transloco }}</p>
      } @else if (result.value()) {
        <p role="status">{{ 'releaseNotes.unsubscribeDone' | transloco }}</p>
      } @else {
        <p role="alert">{{ 'releaseNotes.unsubscribeInvalid' | transloco }}</p>
      }
      <a mat-stroked-button routerLink="/release-notes">{{
        'releaseNotes.pageTitle' | transloco
      }}</a>
    </mns-page-shell>
  `,
})
export class ReleaseNotesUnsubscribePage {
  private readonly notes = inject(ReleaseNoteService);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  readonly result = resource({
    params: () => ({ s: this.params.get('s') ?? '', t: this.params.get('t') ?? '' }),
    loader: async ({ params }) =>
      params.s && params.t ? this.notes.unsubscribe(params.s, params.t).catch(() => false) : false,
  });
}
