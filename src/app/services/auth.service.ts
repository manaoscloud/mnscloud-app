import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';

const AUTH_STATE = 'mnscloud_auth';
const JWT_KEY = 'mnscloud_jwt';
const USER_KEY = 'mnscloud_user';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _loggedIn = signal<boolean>(this.readInitialState());
  readonly isLoggedIn = this._loggedIn.asReadonly();

  private _user = signal<AuthUser | null>(this.getUser());
  readonly user = this._user.asReadonly();

  constructor() {}

  private readInitialState(): boolean {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(JWT_KEY) !== null;
  }

  // ---------------------------------------------------------
  // LOGIN – salva JWT e carrega perfil completo + role (/user/me)
  // ---------------------------------------------------------
  async login(jwt: string, _ignoredUser: any, api: ApiService) {
    localStorage.setItem(JWT_KEY, jwt);
    localStorage.setItem(AUTH_STATE, 'true');
    this._loggedIn.set(true);

    // 1) Perfil (inclui avatar)
    await this.loadUserFromApi(api);

    // 2) Complementa com role/env (menus/guards)
    await this.loadMeFromApi(api);
  }

  // ---------------------------------------------------------
  // LOGOUT
  // ---------------------------------------------------------
  logout() {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_STATE);

    this._user.set(null);
    this._loggedIn.set(false);
  }

  // ---------------------------------------------------------
  // TOKEN
  // ---------------------------------------------------------
  getJwt(): string | null {
    return localStorage.getItem(JWT_KEY);
  }

  getToken(): string | null {
    return this.getJwt();
  }

  // ---------------------------------------------------------
  // USER (LOCAL)
  // ---------------------------------------------------------
  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
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

      const avatarVersion = serverAvatar && serverAvatar === prevUrl
        ? prev?.avatarVersion ?? Date.now()
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
        role: prev?.role,
        EnvironmentUUID: prev?.EnvironmentUUID ?? null,
      };

      localStorage.setItem(USER_KEY, JSON.stringify(updated));
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
        role: raw?.role ?? current.role ?? 'ADMIN',
        EnvironmentUUID: raw?.EnvironmentUUID ?? current.EnvironmentUUID ?? null,
      };

      localStorage.setItem(USER_KEY, JSON.stringify(merged));
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

    localStorage.setItem(USER_KEY, JSON.stringify(merged));
    this._user.set(merged);
  }
}
