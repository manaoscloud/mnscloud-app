import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';
import { ApiService } from '../../services/api.service';
import { SnackbarService } from '../../services/snackbar.service';
import { readStoredEnvironmentUUID } from '../../core/environment/environment-context';

export interface AsyncOperation {
  operationUUID: string;
  state: string;
  canRecheck?: boolean;
  scope?: 'platform' | 'tenant';
  errorCode?: string | null;
  environmentUUID?: string | null;
  updatedAt?: string | null;
}

const IN_FLIGHT = new Set(['queued', 'running', 'verifying', 'waiting_retry']);
const ATTENTION = new Set(['blocked', 'failed']);
const SUCCESS_RETENTION_MS = 10_000;

export function acceptedOperations(response: unknown): AsyncOperation[] {
  const data = (
    response as {
      data?: { operation?: AsyncOperation; accepted?: { operation: AsyncOperation }[] };
    }
  )?.data;
  const operations = data?.operation
    ? [data.operation]
    : (data?.accepted?.map((item) => item.operation) ?? []);
  return operations.filter(
    (item) =>
      typeof item?.operationUUID === 'string' &&
      /^(?:[a-f\d]{32}|[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i.test(item.operationUUID),
  );
}

function isInFlight(state: string) {
  return IN_FLIGHT.has(state);
}

function needsAttention(state: string) {
  return ATTENTION.has(state);
}

function shouldResume(operation: AsyncOperation) {
  if (isInFlight(operation.state)) return true;
  if (needsAttention(operation.state) && operation.canRecheck !== false) return true;
  return false;
}

@Injectable({ providedIn: 'root' })
export class AsyncOperationsService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tenants = inject(TenantService);
  private readonly snack = inject(SnackbarService);
  private readonly watched = new WeakMap<DestroyRef, Set<string>>();
  readonly states = signal<Record<string, AsyncOperation>>({});
  private readonly polling = new Set<string>();
  private readonly listeners = new Map<string, Map<DestroyRef, () => void>>();
  private readonly stops = new Map<string, () => void>();
  private readonly clearTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private activeRequests = 0;
  readonly rechecking = signal<ReadonlySet<string>>(new Set());

  async recheck(operation: AsyncOperation, destroy: DestroyRef) {
    if (this.rechecking().has(operation.operationUUID)) return;
    this.rechecking.update((value) => new Set([...value, operation.operationUUID]));
    try {
      const response = await this.api.post(
        `user/operations/${operation.operationUUID}/recheck${operation.scope === 'platform' ? '?scope=platform' : ''}`,
        {},
      );
      if (!destroy.destroyed) this.observe(response, destroy, () => {});
    } finally {
      this.rechecking.update((value) => {
        const next = new Set(value);
        next.delete(operation.operationUUID);
        return next;
      });
    }
  }

  constructor() {
    const context = () => [
      this.tenants.selectedTenant(),
      this.auth.isLoggedIn(),
      this.auth.sessionGeneration(),
    ];
    let previous = context();
    effect(() => {
      const current = context();
      if (current.every((value, index) => value === previous[index])) return;
      previous = current;
      for (const stop of [...this.stops.values()]) stop();
      for (const timer of this.clearTimers.values()) clearTimeout(timer);
      this.clearTimers.clear();
      this.states.set({});
    });
  }

  async resume(destroy: DestroyRef) {
    const environment = readStoredEnvironmentUUID();
    const session = this.auth.sessionGeneration();
    const platform = this.router.url.split('?')[0].startsWith('/system/');
    if (!this.auth.isLoggedIn() || (!environment && !platform)) return;
    try {
      const response = await this.api.get<{ data: { items: AsyncOperation[] } }>(
        `user/operations?limit=50&offset=0${platform ? '&scope=platform' : ''}`,
        { timeout: 10000 },
      );
      if (
        destroy.destroyed ||
        !this.auth.isLoggedIn() ||
        session !== this.auth.sessionGeneration() ||
        environment !== readStoredEnvironmentUUID()
      )
        return;
      for (const operation of [...response.data.items].reverse()) {
        if (!shouldResume(operation)) continue;
        this.watch(operation, destroy, () => {});
      }
    } catch {
      // An unavailable status read never resubmits a business action.
    }
  }

  dismiss(operationUUID: string) {
    this.clearSuccessTimer(operationUUID);
    this.stops.get(operationUUID)?.();
    this.states.update((current) => {
      if (!(operationUUID in current)) return current;
      const remaining = { ...current };
      delete remaining[operationUUID];
      return remaining;
    });
  }

  private remember(operation: AsyncOperation, environment: string | null) {
    this.clearSuccessTimer(operation.operationUUID);
    this.states.update((current) => {
      const next = {
        ...current,
        [operation.operationUUID]: { ...operation, environmentUUID: environment },
      };
      for (const key of Object.keys(next)) {
        if (Object.keys(next).length <= 100) break;
        if (!this.polling.has(key) && !needsAttention(next[key].state)) delete next[key];
      }
      return next;
    });
  }

  private scopedOperations() {
    this.tenants.selectedTenant();
    const environment = readStoredEnvironmentUUID();
    return Object.values(this.states()).filter((item) => item.environmentUUID === environment);
  }

  /** Panel list: in-flight, attention, and briefly retained successes. */
  readonly visible = computed(() => this.scopedOperations().slice(-20));

  readonly badgeCount = computed(
    () =>
      this.scopedOperations().filter(
        (item) => isInFlight(item.state) || needsAttention(item.state),
      ).length,
  );

  readonly hasActivity = computed(() => this.visible().length > 0);

  observe(response: unknown, destroy: DestroyRef, onSettled: () => void): boolean {
    const operations = acceptedOperations(response);
    if (!operations.length) return false;
    this.snack.info('Operation accepted. Processing in the background.');
    for (const operation of operations) this.watch(operation, destroy, onSettled);
    return true;
  }

  watch(operation: AsyncOperation, destroy: DestroyRef, onSettled: () => void) {
    let watched = this.watched.get(destroy);
    if (!watched) {
      watched = new Set();
      this.watched.set(destroy, watched);
    }
    if (destroy.destroyed || !this.auth.isLoggedIn()) return;
    const id = operation.operationUUID;
    let listeners = this.listeners.get(id);
    if (!listeners) {
      if (this.polling.size >= 100) return;
      listeners = new Map();
      this.listeners.set(id, listeners);
    }
    if (!listeners.has(destroy)) {
      const registeredListeners = listeners;
      destroy.onDestroy(() => {
        registeredListeners.delete(destroy);
        watched.delete(id);
        // Keep root polling alive for the shell Activity Center; session/tenant
        // changes and terminal retention still call stop() explicitly.
      });
    }
    listeners.set(destroy, onSettled);
    watched.add(id);
    if (this.polling.has(id)) return;
    this.polling.add(id);
    const environment = readStoredEnvironmentUUID();
    const session = this.auth.sessionGeneration();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 3000;
    this.remember(operation, environment);
    const stop = (remove = true) => {
      stopped = true;
      clearTimeout(timer);
      for (const owner of listeners.keys()) this.watched.get(owner)?.delete(id);
      this.listeners.delete(id);
      this.stops.delete(id);
      this.polling.delete(id);
      if (remove) {
        this.clearSuccessTimer(id);
        this.states.update((current) => {
          const remaining = { ...current };
          delete remaining[operation.operationUUID];
          return remaining;
        });
      }
    };
    this.stops.set(id, stop);
    const settled = (state: string) => {
      const callbacks = [...listeners].flatMap(([owner, callbacks]) =>
        owner.destroyed ? [] : [callbacks],
      );
      if (state === 'succeeded') {
        stop(false);
        this.scheduleSuccessClear(id);
      } else if (needsAttention(state)) {
        stop(false);
      } else {
        stop(true);
      }
      for (const callback of callbacks) callback();
    };
    if (['succeeded', 'failed', 'blocked', 'cancelled'].includes(operation.state)) {
      settled(operation.state);
      return;
    }
    const poll = async () => {
      if (
        stopped ||
        readStoredEnvironmentUUID() !== environment ||
        !this.auth.isLoggedIn() ||
        this.auth.sessionGeneration() !== session
      ) {
        stop();
        return;
      }
      if (this.activeRequests >= 8) {
        timer = setTimeout(() => void poll(), 1000);
        return;
      }
      this.activeRequests++;
      try {
        const response = await this.api.get<{ data: AsyncOperation }>(
          `user/operations/${operation.operationUUID}${operation.scope === 'platform' ? '?scope=platform' : ''}`,
          { timeout: 10000 },
        );
        if (
          stopped ||
          readStoredEnvironmentUUID() !== environment ||
          !this.auth.isLoggedIn() ||
          this.auth.sessionGeneration() !== session
        ) {
          stop();
          return;
        }
        const result = response.data;
        this.remember(result, environment);
        if (['succeeded', 'blocked', 'failed', 'cancelled'].includes(result.state)) {
          if (result.state === 'succeeded') this.snack.success('Operation completed.');
          else
            this.snack.warning(
              'Operation requires attention. Check its status before trying again.',
            );
          settled(result.state);
          return;
        }
        delay = 3000;
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if ([400, 401, 403, 404].includes(status ?? 0)) {
          stop();
          return;
        }
        delay = Math.min(30000, delay * 2);
      } finally {
        this.activeRequests--;
      }
      if (!stopped) timer = setTimeout(() => void poll(), delay);
    };
    timer = setTimeout(() => void poll(), delay);
  }

  private scheduleSuccessClear(operationUUID: string) {
    this.clearSuccessTimer(operationUUID);
    this.clearTimers.set(
      operationUUID,
      setTimeout(() => {
        this.clearTimers.delete(operationUUID);
        this.states.update((current) => {
          const item = current[operationUUID];
          if (!item || item.state !== 'succeeded') return current;
          const remaining = { ...current };
          delete remaining[operationUUID];
          return remaining;
        });
      }, SUCCESS_RETENTION_MS),
    );
  }

  private clearSuccessTimer(operationUUID: string) {
    const timer = this.clearTimers.get(operationUUID);
    if (!timer) return;
    clearTimeout(timer);
    this.clearTimers.delete(operationUUID);
  }
}
