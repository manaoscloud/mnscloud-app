import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export type ContextMode = 'master' | 'tenant';

const CONTEXT_MODE_STORAGE_KEY = 'mc_context_mode';

function readStoredMode(): ContextMode {
  try {
    if (typeof localStorage === 'undefined') return 'master';
    return localStorage.getItem(CONTEXT_MODE_STORAGE_KEY) === 'tenant' ? 'tenant' : 'master';
  } catch {
    return 'master';
  }
}

/**
 * The System/Tenant context switch of platform masters, shared by the layout (menu, scope
 * trigger) and pages that render a platform or tenant view of the same route (the home). It is
 * presentation state only: the API authorizes every request on its own.
 */
@Injectable({ providedIn: 'root' })
export class ContextModeService {
  private readonly auth = inject(AuthService);
  private readonly selected = signal<ContextMode>(readStoredMode());

  readonly mode = this.selected.asReadonly();
  readonly isMasterUser = computed(() =>
    (this.auth.user()?.permissions ?? []).includes('platform.master.access'),
  );
  /** Non-masters are always in tenant context. */
  readonly effectiveMode = computed<ContextMode>(() =>
    this.isMasterUser() ? this.selected() : 'tenant',
  );

  set(mode: ContextMode) {
    if (!this.isMasterUser()) return;
    this.selected.set(mode);
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(CONTEXT_MODE_STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this session only.
    }
  }
}
