import { computed, inject, Injectable, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { ApiService } from '../../services/api.service';
import { AppUpdateService } from '../../services/app-update.service';
import { SnackbarService } from '../../services/snackbar.service';
import {
  dialableNumber,
  PHONEWEB_PATH,
  phoneCommand,
  PhoneBridgeCommand,
  PhoneState,
  phoneFrameUrl,
  readPhoneBridgeMessage,
  toPhoneState,
} from './phone-bridge';

const LOCK_NAME = 'mnscloud-phone-dock';
const CHANNEL_NAME = 'mnscloud-phone-dock';
const POPOUT_NAME = 'mnscloud-phoneweb';

type DockChannelMessage =
  | { type: 'takeover' }
  | { type: 'released' }
  | { type: 'refused' }
  | { type: 'status'; callActive: boolean };

interface LockManagerLike {
  request(
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<void> | void,
  ): Promise<unknown>;
}

/**
 * App phone dock: PhoneWeb in a same-origin frame that survives navigation (it lives in the
 * layout, outside the router outlet). One browser registers the lines once: the tab holding the
 * Web Lock owns the phone; other tabs show where it is and can take it over. No secret crosses
 * the bridge; sign-in uses the single-use App handoff code in the frame URL fragment.
 */
@Injectable({ providedIn: 'root' })
export class PhoneDockService {
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(SnackbarService);
  private readonly sanitizer = inject(DomSanitizer);

  /** Tenant has the PhoneWeb entitlement (set by the layout). */
  readonly available = signal(false);
  /** This tab holds the phone frame. */
  readonly mounted = signal(false);
  /** The dock panel is shown. */
  readonly visible = signal(false);
  /** Another tab of this browser holds the phone. */
  readonly elsewhere = signal(false);
  readonly elsewhereCallActive = signal(false);
  /** The phone was moved to its own window. */
  readonly poppedOut = signal(false);
  readonly frameUrl = signal<SafeResourceUrl | null>(null);
  readonly frameReady = signal(false);
  readonly state = signal<PhoneState | null>(null);
  readonly opening = signal(false);

  readonly callActive = computed(() => Boolean(this.state()?.call));
  readonly ringing = computed(() => Boolean(this.state()?.call?.answerable));
  /** Reloading or leaving would drop the phone (and any call) of this tab. */
  readonly holdsPhone = computed(() => this.mounted());

  private frame: Window | null = null;
  private environmentId: string | null | undefined = undefined;
  private releaseLock: (() => void) | null = null;
  private popout: Window | null = null;
  private pending: Array<{ type: PhoneBridgeCommand; payload?: Record<string, unknown> }> = [];
  private sequence = 0;
  private readonly replies = new Map<string, (payload?: Record<string, unknown>) => void>();
  private readonly channel: BroadcastChannel | null =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);

  constructor() {
    // A pending App update never reloads this tab on its own while it holds the phone.
    inject(AppUpdateService).registerBusySource('phoneDock.updateOpenWork', () =>
      this.holdsPhone(),
    );
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => this.onFrameMessage(event));
      window.addEventListener('pagehide', () => this.unmount());
    }
    this.channel?.addEventListener('message', (event) =>
      this.onChannelMessage(event.data as DockChannelMessage),
    );
  }

  toggle() {
    if (this.visible()) this.visible.set(false);
    else void this.open();
  }

  async open() {
    this.visible.set(true);
    if (this.mounted() || this.opening()) return;
    if (this.poppedOut() && this.popout && !this.popout.closed) {
      this.popout.focus();
      return;
    }
    this.poppedOut.set(false);
    this.opening.set(true);
    try {
      if (!(await this.acquire())) {
        this.elsewhere.set(true);
        return;
      }
      this.elsewhere.set(false);
      this.frameUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(phoneFrameUrl(await this.handoffCode())),
      );
      this.mounted.set(true);
      this.broadcast({ type: 'status', callActive: false });
    } finally {
      this.opening.set(false);
    }
  }

  minimize() {
    this.visible.set(false);
  }

  /** Turns the phone off in this tab (refused during a call). */
  close() {
    if (this.callActive()) {
      this.snackbar.warning('phoneDock.callInProgress');
      return;
    }
    this.unmount();
    this.visible.set(false);
  }

  /** Moves the phone to its own window, which survives App reloads (refused during a call). */
  popOut() {
    if (this.callActive()) {
      this.snackbar.warning('phoneDock.callInProgress');
      return;
    }
    this.unmount();
    this.popout = window.open(PHONEWEB_PATH, POPOUT_NAME, 'popup=yes,width=420,height=760');
    this.poppedOut.set(Boolean(this.popout));
    if (!this.popout) this.snackbar.warning('phoneDock.popupBlocked');
  }

  /** Another tenant: its phone identity differs, so the phone restarts on next open. */
  environmentChanged(environmentId: string | null) {
    if (this.environmentId !== undefined && environmentId !== this.environmentId) {
      if (!this.callActive()) {
        this.unmount();
        this.visible.set(false);
      }
    }
    this.environmentId = environmentId;
  }

  /** Asks the tab that holds the phone to release it, then takes it here. */
  takeOver() {
    this.broadcast({ type: 'takeover' });
  }

  /** Click-to-call entry point for any page. */
  async dial(number: string) {
    const dialable = dialableNumber(number);
    if (!dialable) {
      this.snackbar.warning('phoneDock.invalidNumber');
      return;
    }
    await this.open();
    this.send('phone.dial', { number: dialable });
  }

  answer() {
    this.send('phone.answer');
  }

  hangup() {
    this.send('phone.hangup');
  }

  /** App sign-out: ends the phone's MNSCloud session in the frame, then turns the phone off. */
  async signOut() {
    if (this.mounted() && this.frame && this.frameReady()) {
      await Promise.race([
        this.request('phone.signOut'),
        new Promise((resolve) => setTimeout(resolve, 2000)),
      ]);
    }
    this.unmount();
    this.visible.set(false);
    this.poppedOut.set(false);
  }

  /** Called by the dock component when the frame (re)loads. */
  attachFrame(frame: Window | null) {
    this.frame = frame;
    this.frameReady.set(false);
  }

  private send(type: PhoneBridgeCommand, payload?: Record<string, unknown>): string | null {
    if (!this.mounted()) return null;
    if (!this.frame || !this.frameReady()) {
      this.pending.push({ type, payload });
      return null;
    }
    const id = `app-${++this.sequence}`;
    this.frame.postMessage(phoneCommand(id, type, payload), window.location.origin);
    return id;
  }

  private request(type: PhoneBridgeCommand): Promise<Record<string, unknown> | undefined> {
    const id = this.send(type);
    if (!id) return Promise.resolve(undefined);
    return new Promise((resolve) => this.replies.set(id, resolve));
  }

  private onFrameMessage(event: MessageEvent) {
    const message = readPhoneBridgeMessage(event, this.frame, window.location.origin);
    if (!message) return;
    switch (message.type) {
      case 'ready': {
        this.frameReady.set(true);
        const queued = this.pending;
        this.pending = [];
        for (const command of queued) this.send(command.type, command.payload);
        break;
      }
      case 'state':
        this.state.set(toPhoneState(message.payload));
        this.broadcast({ type: 'status', callActive: this.callActive() });
        break;
      case 'call.ringing':
        this.visible.set(true);
        break;
      case 'reply':
        if (message.id && this.replies.has(message.id)) {
          this.replies.get(message.id)?.(message.payload);
          this.replies.delete(message.id);
          break;
        }
        if (message.payload?.['ok'] === false && message.payload?.['error'] !== 'NO_CALL') {
          this.snackbar.warning(`phoneDock.error.${String(message.payload['error'])}`);
        }
        break;
    }
  }

  private onChannelMessage(message: DockChannelMessage) {
    switch (message?.type) {
      case 'takeover':
        if (!this.mounted()) return;
        if (this.callActive()) {
          this.broadcast({ type: 'refused' });
          return;
        }
        this.unmount();
        this.visible.set(false);
        this.broadcast({ type: 'released' });
        break;
      case 'released':
        if (this.elsewhere()) {
          this.elsewhere.set(false);
          void this.open();
        }
        break;
      case 'refused':
        if (this.elsewhere()) this.snackbar.warning('phoneDock.callInProgressElsewhere');
        break;
      case 'status':
        if (!this.mounted()) this.elsewhereCallActive.set(message.callActive);
        break;
    }
  }

  private broadcast(message: DockChannelMessage) {
    this.channel?.postMessage(message);
  }

  private unmount() {
    if (!this.mounted()) return;
    this.mounted.set(false);
    this.frameUrl.set(null);
    this.frameReady.set(false);
    this.state.set(null);
    this.frame = null;
    this.pending = [];
    this.releaseLock?.();
    this.releaseLock = null;
    this.broadcast({ type: 'status', callActive: false });
  }

  /** Web Lock held while this tab owns the phone; browsers without it act as a single tab. */
  private acquire(): Promise<boolean> {
    const locks = (navigator as Navigator & { locks?: LockManagerLike }).locks;
    if (!locks) return Promise.resolve(true);
    return new Promise((resolve) => {
      void locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
        if (!lock) {
          resolve(false);
          return;
        }
        resolve(true);
        return new Promise<void>((release) => (this.releaseLock = release));
      });
    });
  }

  /** Single-use sign-in code for PhoneWeb; without it PhoneWeb shows its own sign-in. */
  private async handoffCode(): Promise<string | null> {
    try {
      const response = await this.api.post<{ data?: { code?: string } }>(
        'voip/phone/handoffs',
        {},
        // Every code is single use; a user without a phone identity just gets PhoneWeb sign-in.
        { idempotencyKey: crypto.randomUUID(), silent: true },
      );
      return response?.data?.code ?? null;
    } catch {
      return null;
    }
  }
}
