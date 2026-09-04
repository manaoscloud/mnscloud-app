import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { SessionUiCleanupService } from './session-ui-cleanup.service';
import {
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
  writeStoredEnvironmentUUID,
} from '../core/environment/environment-context';

const AUTH_STATE = 'mnscloud_auth';
const LEGACY_JWT_KEY = 'mnscloud_jwt';
const USER_KEY = 'mnscloud_user';

function storageAvailable(storage: Storage | undefined): storage is Storage {
  return typeof storage !== 'undefined';
}

function readAuthValue(key: string): string | null {
  const localStore = globalThis.localStorage;
  const sessionStore = globalThis.sessionStorage;
  if (storageAvailable(localStore)) {
    const local = localStore.getItem(key);
    if (local !== null) return local;
  }
  return storageAvailable(sessionStore) ? sessionStore.getItem(key) : null;
}

function writeAuthValue(key: string, value: string, rememberMe: boolean) {
  const target = rememberMe ? globalThis.localStorage : globalThis.sessionStorage;
  const other = rememberMe ? globalThis.sessionStorage : globalThis.localStorage;
  if (storageAvailable(target)) target.setItem(key, value);
  if (storageAvailable(other)) other.removeItem(key);
}

function removeAuthValue(key: string) {
  const localStore = globalThis.localStorage;
  const sessionStore = globalThis.sessionStorage;
  if (storageAvailable(localStore)) localStore.removeItem(key);
  if (storageAvailable(sessionStore)) sessionStore.removeItem(key);
}

function isRememberedSession(): boolean {
  const localStore = globalThis.localStorage;
  return storageAvailable(localStore) && localStore.getItem(AUTH_STATE) !== null;
}

export type AppRole = 'MASTER' | 'OWNER' | 'ADMIN' | 'USER';

export interface AuthUser {
  uuid: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  avatarVersion?: number | null;

  // ✅ (menu/guards)
  role?: AppRole;
  EnvironmentUUID?: string | null;
  permissions?: string[];
}

function normalizeAppRole(value: unknown): AppRole | undefined {
  const role = String(value ?? '').toUpperCase();
  return role === 'MASTER' || role === 'OWNER' || role === 'ADMIN' || role === 'USER'
    ? role
    : undefined;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly sessionUiCleanup = inject(SessionUiCleanupService);

  private _loggedIn = signal<boolean>(this.readInitialState());
  readonly isLoggedIn = this._loggedIn.asReadonly();

  private _user = signal<AuthUser | null>(this.getUser());
  readonly user = this._user.asReadonly();
  private bootstrapBearerToken: string | null = null;

  constructor() {}

  private readInitialState(): boolean {
    return readAuthValue(AUTH_STATE) === 'true';
  }

  // ---------------------------------------------------------
  // LOGIN – sessão em cookie HttpOnly + perfil completo + role (/user/me)
  // ---------------------------------------------------------
  async login(
    initialUser: any,
    api: ApiService,
    rememberMe = false,
    bootstrapToken?: string | null,
    options?: { deferProfileLoad?: boolean },
  ) {
    this.bootstrapBearerToken =
      typeof bootstrapToken === 'string' && bootstrapToken.trim() ? bootstrapToken.trim() : null;
    writeAuthValue(AUTH_STATE, 'true', rememberMe);
    this._loggedIn.set(true);

    const initialEnvironmentUUID = normalizeEnvironmentUUID(initialUser?.EnvironmentUUID);
    if (initialEnvironmentUUID) {
      writeStoredEnvironmentUUID(initialEnvironmentUUID);
    }

    if (initialUser) {
      const seedUser: AuthUser = {
        uuid: initialUser.uuid ?? initialUser.UserUUID ?? '',
        email: initialUser.email ?? initialUser.Email ?? '',
        firstName: initialUser.firstName ?? initialUser.FirstName ?? initialUser.name ?? '',
        lastName: initialUser.lastName ?? initialUser.LastName ?? '',
        role: normalizeAppRole(initialUser.role),
        EnvironmentUUID: initialEnvironmentUUID,
        permissions: Array.isArray(initialUser.permissions) ? initialUser.permissions : [],
      };

      writeAuthValue(USER_KEY, JSON.stringify(seedUser), rememberMe);
      this._user.set(seedUser);
    }

    if (options?.deferProfileLoad) {
      this.bootstrapBearerToken = null;
      return !!initialUser;
    }

    try {
      // 1) Perfil (inclui avatar)
      const profileLoaded = await this.loadUserFromApi(api);
      if (!profileLoaded) return false;

      // 2) Complementa com role/env (menus/guards)
      const meLoaded = await this.loadMeFromApi(api);
      return meLoaded;
    } finally {
      this.bootstrapBearerToken = null;
    }
  }

  sessionBootstrapToken(): string | null {
    return this.bootstrapBearerToken;
  }

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
  logout() {
    this.sessionUiCleanup.closeSessionUi();

    removeAuthValue(LEGACY_JWT_KEY);
    removeAuthValue(USER_KEY);
    removeAuthValue(AUTH_STATE);
    writeStoredEnvironmentUUID(null);

    this._user.set(null);
    this._loggedIn.set(false);
  }

  expireSession() {
    this.logout();
    if (this.router.url !== '/signin') {
      void this.router.navigate(['/signin'], { replaceUrl: true });
    }
  }

  // ---------------------------------------------------------
  // USER (LOCAL)
  // ---------------------------------------------------------
  getUser(): AuthUser | null {
    const raw = readAuthValue(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  // ---------------------------------------------------------
  // CARREGAR PERFIL VIA API (user/profile)
  // ---------------------------------------------------------
  async loadUserFromApi(api: ApiService): Promise<boolean> {
    try {
      const response = await api.get<any>('user/profile');
      const raw = response.data;

      const serverAvatar = raw.AvatarUrl ?? raw.Avatar ?? null;

      const prev = this.getUser();
      const prevUrl = prev?.avatarUrl ?? null;

      const avatarVersion =
        serverAvatar && serverAvatar === prevUrl
          ? (prev?.avatarVersion ?? Date.now())
          : serverAvatar
            ? Date.now()
            : null;

      const updated: AuthUser = {
        uuid: raw.UserUUID,
        email: raw.Email ?? '',
        firstName: raw.FirstName ?? '',
        lastName: raw.LastName ?? '',
        avatarUrl: serverAvatar,
        avatarVersion,

        // ✅ preserva role/env
        role: normalizeAppRole(prev?.role),
        EnvironmentUUID:
          readStoredEnvironmentUUID() ?? normalizeEnvironmentUUID(prev?.EnvironmentUUID) ?? null,
        permissions: prev?.permissions ?? [],
      };

      writeAuthValue(USER_KEY, JSON.stringify(updated), isRememberedSession());
      this._user.set(updated);
      this._loggedIn.set(true);

      return true;
    } catch (err) {
      console.error('❌ Failed to load user/profile', err);
      this.expireSession();
      return false;
    }
  }

  // ---------------------------------------------------------
  // ✅ CARREGAR /user/me (role + EnvironmentUUID)
  // ---------------------------------------------------------
  async loadMeFromApi(api: ApiService): Promise<boolean> {
    try {
      const resp = await api.get<any>('user/me');
      const raw = resp?.data;

      const current = this.getUser();
      if (!current) return false;

      const merged: AuthUser = {
        ...current,
        role: normalizeAppRole(raw?.role) ?? normalizeAppRole(current.role) ?? 'ADMIN',
        EnvironmentUUID:
          normalizeEnvironmentUUID(raw?.EnvironmentUUID) ??
          readStoredEnvironmentUUID() ??
          normalizeEnvironmentUUID(current.EnvironmentUUID) ??
          null,
        permissions: Array.isArray(raw?.permissions) ? raw.permissions : current.permissions ?? [],
      };

      writeAuthValue(USER_KEY, JSON.stringify(merged), isRememberedSession());
      this._user.set(merged);
      return true;
    } catch (err) {
      console.warn('⚠️ Failed to load user/me (role/env)', err);
      return false;
    }
  }

  // ---------------------------------------------------------
  // ATUALIZAÇÃO PARCIAL DO USER
  // ---------------------------------------------------------
  updateUser(patch: Partial<AuthUser>) {
    const current = this.getUser();
    if (!current) return;

    const merged: AuthUser = { ...current, ...patch };

    writeAuthValue(USER_KEY, JSON.stringify(merged), isRememberedSession());
    this._user.set(merged);
  }
}
