import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import {
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
  writeStoredEnvironmentUUID,
} from '../core/environment/environment-context';

const AUTH_STATE = 'mnscloud_auth';
const JWT_KEY = 'mnscloud_jwt';
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
  return storageAvailable(localStore) && localStore.getItem(JWT_KEY) !== null;
}

export type AppRole = 'MASTER' | 'OWNER' | 'ADMIN' | 'USER';

export interface AuthUser {
  uuid: string;
  email: string;
  firstName: string;
  lastName: string;
  token: string;
  avatarUrl?: string | null;
  avatarVersion?: number | null;

  // ✅ (menu/guards)
  role?: AppRole;
  EnvironmentUUID?: string | null;
}

function normalizeAppRole(value: unknown): AppRole | undefined {
  const role = String(value ?? '').toUpperCase();
  return role === 'MASTER' || role === 'OWNER' || role === 'ADMIN' || role === 'USER'
    ? role
    : undefined;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _loggedIn = signal<boolean>(this.readInitialState());
  readonly isLoggedIn = this._loggedIn.asReadonly();

  private _user = signal<AuthUser | null>(this.getUser());
  readonly user = this._user.asReadonly();

  constructor() {}

  private readInitialState(): boolean {
    return readAuthValue(JWT_KEY) !== null;
  }

  // ---------------------------------------------------------
  // LOGIN – salva JWT e carrega perfil completo + role (/user/me)
  // ---------------------------------------------------------
  async login(jwt: string, initialUser: any, api: ApiService, rememberMe = false) {
    writeAuthValue(JWT_KEY, jwt, rememberMe);
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
        token: jwt,
        firstName: initialUser.firstName ?? initialUser.FirstName ?? initialUser.name ?? '',
        lastName: initialUser.lastName ?? initialUser.LastName ?? '',
        role: normalizeAppRole(initialUser.role),
        EnvironmentUUID: initialEnvironmentUUID,
      };

      writeAuthValue(USER_KEY, JSON.stringify(seedUser), rememberMe);
      this._user.set(seedUser);
    }

    // 1) Perfil (inclui avatar)
    await this.loadUserFromApi(api);

    // 2) Complementa com role/env (menus/guards)
    await this.loadMeFromApi(api);
  }

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
  logout() {
    removeAuthValue(JWT_KEY);
    removeAuthValue(USER_KEY);
    removeAuthValue(AUTH_STATE);
    writeStoredEnvironmentUUID(null);

    this._user.set(null);
    this._loggedIn.set(false);
  }

  // ---------------------------------------------------------
  // TOKEN
  // ---------------------------------------------------------
  getJwt(): string | null {
    return readAuthValue(JWT_KEY);
  }

  getToken(): string | null {
    return this.getJwt();
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
    const jwt = this.getJwt();
    if (!jwt) {
      this.logout();
      return false;
    }

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
        token: jwt,
        firstName: raw.FirstName ?? '',
        lastName: raw.LastName ?? '',
        avatarUrl: serverAvatar,
        avatarVersion,

        // ✅ preserva role/env
        role: normalizeAppRole(prev?.role),
        EnvironmentUUID:
          readStoredEnvironmentUUID() ?? normalizeEnvironmentUUID(prev?.EnvironmentUUID) ?? null,
      };

      writeAuthValue(USER_KEY, JSON.stringify(updated), isRememberedSession());
      this._user.set(updated);
      this._loggedIn.set(true);

      return true;
    } catch (err) {
      console.error('❌ Failed to load user/profile', err);
      this.logout();
      return false;
    }
  }

  // ---------------------------------------------------------
  // ✅ CARREGAR /user/me (role + EnvironmentUUID)
  // ---------------------------------------------------------
  async loadMeFromApi(api: ApiService): Promise<boolean> {
    const jwt = this.getJwt();
    if (!jwt) return false;

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
