import { Component, computed, ElementRef, inject, input, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';

import { PhoneDockService } from './phone-dock.service';

/**
 * Persistent phone panel of the App shell (desktop: floating panel; handset: full-screen sheet).
 * Minimizing only hides it: the PhoneWeb frame keeps running, so calls and registration survive
 * navigation.
 */
@Component({
  selector: 'mns-phone-dock',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './phone-dock.html',
  styleUrl: './phone-dock.scss',
})
export class PhoneDock {
  readonly dock = inject(PhoneDockService);
  readonly handset = input(false);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  readonly statusKey = computed(() => {
    const state = this.dock.state();
    if (this.dock.elsewhere()) return 'phoneDock.status.elsewhere';
    if (this.dock.poppedOut()) return 'phoneDock.status.poppedOut';
    if (!state) return 'phoneDock.status.starting';
    if (state.call?.answerable) return 'phoneDock.status.ringing';
    if (state.call?.established) return 'phoneDock.status.inCall';
    if (state.call) return 'phoneDock.status.calling';
    if (state.registration === 'registered') return 'phoneDock.status.ready';
    if (state.registration === 'registering') return 'phoneDock.status.registering';
    return state.signedIn ? 'phoneDock.status.offline' : 'phoneDock.status.signedOut';
  });

  onFrameLoad() {
    this.dock.attachFrame(this.frame()?.nativeElement.contentWindow ?? null);
  }
}
