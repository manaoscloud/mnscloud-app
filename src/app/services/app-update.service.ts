import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { NavigationError, NavigationStart, Router } from '@angular/router';
import { APP_BUILD_INFO } from '../app-build-info';

/** Same-origin build metadata written by the App installer on every node (`/build.json`). */
export const APP_BUILD_METADATA_PATH = '/build.json';
/** Background check cadence while the tab is visible (jittered to spread load). */
export const APP_UPDATE_POLL_MS = 5 * 60_000;
/** Minimum spacing between checks triggered by focus, navigation or network events. */
export const APP_UPDATE_MIN_CHECK_GAP_MS = 60_000;
/** A new version must be read twice, this far apart, before it is announced (rolling rollout). */
export const APP_UPDATE_CONFIRM_DELAY_MS = 45_000;
/** "Later" hides the notice for this long; a different version shows it again at once. */
export const APP_UPDATE_SNOOZE_MS = 4 * 60 * 60_000;

const SNOOZE_STORAGE_KEY = 'mnscloud_app_update_snooze';
const CHUNK_RELOAD_STORAGE_KEY = 'mnscloud_app_chunk_reload';
const CHANNEL_NAME = 'mnscloud-app-update';
const CHUNK_ERROR_PATTERN =
  /Loading chunk|ChunkLoadError|dynamically imported module|Importing a module script failed|error loading dynamically imported/i;

export type DeployedAppBuild = { version: string; buildRef: string | null };

type Snooze = { version: string; until: number };

/**
 * Detects that the App served by this environment changed while the tab stays open.
 *
 * The App nodes publish `/build.json`; the tab compares it with the bundle it is running. During
 * a rolling rollout the nodes behind the edge answer different versions, so a new version is
 * accepted only after two consecutive reads agree. The tab never reloads on its own while the
 * user works: it shows a calm notice and, when an update is pending, turns the next safe menu
 * navigation into a full page load of the target route.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly runningVersion = normalizeVersion(APP_BUILD_INFO.version);
  /** Version confirmed as deployed in this environment (null until known). */
  readonly deployed = signal<DeployedAppBuild | null>(null);
  readonly updateAvailable = computed(() => {
    const deployed = this.deployed();
    return Boolean(deployed && deployed.version !== this.runningVersion);
  });
  private readonly snooze = signal<Snooze | null>(readSnooze());
  private readonly now = signal(Date.now());
  /** The notice is visible when an update is pending and it was not postponed for that version. */
  readonly noticeVisible = computed(() => {
    const deployed = this.deployed();
    if (!deployed || !this.updateAvailable()) return false;
    const snooze = this.snooze();
    return !snooze || snooze.version !== deployed.version || snooze.until <= this.now();
  });

  private started = false;
  private lastCheckAt = 0;
  private inFlight: Promise<void> | null = null;
  private candidate: { version: string; buildRef: string | null; seenAt: number } | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private confirmTimer: ReturnType<typeof setTimeout> | null = null;
  private channel: BroadcastChannel | null = null;

  /** Starts background detection once per tab. Safe to call more than once. */
  start() {
    if (this.started || typeof window === 'undefined') return;
    this.started = true;

    const onVisible = () => {
      this.now.set(Date.now());
      if (document.visibilityState === 'visible') void this.check();
    };
    const onFocusOrOnline = () => {
      this.now.set(Date.now());
      void this.check();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SNOOZE_STORAGE_KEY) this.snooze.set(readSnooze());
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    window.addEventListener('storage', onStorage);

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (event: MessageEvent<DeployedAppBuild>) => {
        const version = normalizeVersion(event.data?.version);
        if (version) this.accept({ version, buildRef: event.data?.buildRef ?? null }, false);
      };
    }

    const routerEvents = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) this.onNavigationStart(event);
      if (event instanceof NavigationError) this.onNavigationError(event);
    });

    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      window.removeEventListener('storage', onStorage);
      routerEvents.unsubscribe();
      this.channel?.close();
      this.clearTimers();
    });

    this.schedulePoll();
    void this.check(true);
  }

  /** Reads the deployed build. Throttled unless `force` is set; never throws. */
  check(force = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const now = Date.now();
    if (!force && now - this.lastCheckAt < APP_UPDATE_MIN_CHECK_GAP_MS) return Promise.resolve();
    this.lastCheckAt = now;
    this.now.set(now);
    this.inFlight = fetchDeployedBuild()
      .then((build) => {
        if (build) this.observe(build, Date.now());
      })
      .finally(() => {
        this.inFlight = null;
      });
    return this.inFlight;
  }

  /** "Later": hide the notice for this version for a few hours (shared by every tab). */
  postpone() {
    const deployed = this.deployed();
    if (!deployed) return;
    const snooze = { version: deployed.version, until: Date.now() + APP_UPDATE_SNOOZE_MS };
    this.snooze.set(snooze);
    writeStorage(SNOOZE_STORAGE_KEY, JSON.stringify(snooze));
  }

  /** Shows the notice again (for example from the version footer). */
  showNotice() {
    this.snooze.set(null);
    removeStorage(SNOOZE_STORAGE_KEY);
  }

  /** True while a dialog is open, i.e. reloading could interrupt the user's work. */
  hasOpenWork() {
    return this.dialog.openDialogs.length > 0;
  }

  reloadNow() {
    window.location.reload();
  }

  /** Internal: feeds one `/build.json` read into the confirmation state. */
  observe(build: DeployedAppBuild, at: number) {
    const current = this.deployed();
    if (build.version === (current?.version ?? this.runningVersion)) {
      // Nothing changed (or one node of an unfinished rollout answered): stay as we are.
      this.candidate = null;
      this.clearConfirmTimer();
      if (!current) this.deployed.set(build);
      return;
    }
    const candidate = this.candidate;
    if (candidate && candidate.version === build.version) {
      if (at - candidate.seenAt >= APP_UPDATE_CONFIRM_DELAY_MS) this.accept(build, true);
      return;
    }
    this.candidate = { ...build, seenAt: at };
    this.clearConfirmTimer();
    this.confirmTimer = setTimeout(() => void this.check(true), APP_UPDATE_CONFIRM_DELAY_MS);
  }

  private accept(build: DeployedAppBuild, broadcast: boolean) {
    this.candidate = null;
    this.clearConfirmTimer();
    const current = this.deployed();
    if (current?.version === build.version && current.buildRef === build.buildRef) return;
    this.deployed.set(build);
    if (broadcast) this.channel?.postMessage(build);
  }

  private onNavigationStart(event: NavigationStart) {
    if (event.navigationTrigger === 'imperative' || event.navigationTrigger === 'popstate') {
      if (this.shouldReloadOnNavigation(event)) {
        window.location.assign(event.url);
        return;
      }
    }
    void this.check();
  }

  /** A pending update turns a safe route change into a full page load of the same target. */
  private shouldReloadOnNavigation(event: NavigationStart) {
    if (!this.updateAvailable() || this.hasOpenWork()) return false;
    if (this.router.currentNavigation()?.extras.state) return false;
    return pathOf(event.url) !== pathOf(this.router.url);
  }

  /** A lazy chunk that no longer exists means a newer build: load the target route fresh, once. */
  private onNavigationError(event: NavigationError) {
    const message = event.error instanceof Error ? event.error.message : String(event.error ?? '');
    if (!CHUNK_ERROR_PATTERN.test(message)) return;
    if (readStorage(CHUNK_RELOAD_STORAGE_KEY, 'session') === event.url) return;
    writeStorage(CHUNK_RELOAD_STORAGE_KEY, event.url, 'session');
    window.location.assign(event.url);
  }

  private schedulePoll() {
    const jitter = Math.round((Math.random() - 0.5) * 60_000);
    this.pollTimer = setTimeout(() => {
      if (document.visibilityState === 'visible') void this.check();
      this.schedulePoll();
    }, APP_UPDATE_POLL_MS + jitter);
  }

  private clearConfirmTimer() {
    if (this.confirmTimer) clearTimeout(this.confirmTimer);
    this.confirmTimer = null;
  }

  private clearTimers() {
    this.clearConfirmTimer();
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
  }
}

export function normalizeVersion(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
}

export function parseBuildMetadata(value: unknown): DeployedAppBuild | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (row['product'] !== APP_BUILD_INFO.product) return null;
  const version = normalizeVersion(row['version']);
  if (!/^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version)) return null;
  const buildRef = typeof row['buildRef'] === 'string' ? row['buildRef'].trim() || null : null;
  return { version, buildRef };
}

async function fetchDeployedBuild(): Promise<DeployedAppBuild | null> {
  try {
    const response = await fetch(`${APP_BUILD_METADATA_PATH}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return parseBuildMetadata(await response.json());
  } catch {
    return null;
  }
}

function pathOf(url: string) {
  return url.split(/[?#]/)[0] || '/';
}

function readSnooze(): Snooze | null {
  try {
    const value = JSON.parse(readStorage(SNOOZE_STORAGE_KEY) ?? 'null') as Snooze | null;
    return value && typeof value.version === 'string' && typeof value.until === 'number'
      ? value
      : null;
  } catch {
    return null;
  }
}

function storage(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readStorage(key: string, kind: 'local' | 'session' = 'local') {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, kind: 'local' | 'session' = 'local') {
  try {
    storage(kind)?.setItem(key, value);
  } catch {
    // Storage may be blocked (private mode); the notice still works for this tab.
  }
}

function removeStorage(key: string) {
  try {
    storage('local')?.removeItem(key);
  } catch {
    // ignore
  }
}
