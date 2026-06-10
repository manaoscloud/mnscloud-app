import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly intervalMs = 10 * 60 * 1000; // 10 minutos
  private heartbeatHandle = signal<any | null>(null);

  constructor() {
    // Observa login/logout e inicia/para o heartbeat
    effect(() => {
      const isLogged = this.auth.isLoggedIn();
      if (isLogged) {
        this.startHeartbeat();
      } else {
        this.stopHeartbeat();
      }
    });
    this.destroyRef.onDestroy(() => this.stopHeartbeat());
  }

  private startHeartbeat() {
    if (this.heartbeatHandle()) return;

    const handle = setInterval(() => {
      this.ping();
    }, this.intervalMs);

    this.heartbeatHandle.set(handle);
  }

  private stopHeartbeat() {
    const handle = this.heartbeatHandle();
    if (handle) {
      clearInterval(handle);
      this.heartbeatHandle.set(null);
    }
  }

  private async ping() {
    try {
      await this.api.getMe();
      // se der 401, o interceptor global já trata (logout + redirect)
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        this.auth.logout();
        if (this.router.url !== '/signin') {
          void this.router.navigate(['/signin']);
        }
        return;
      }
      console.error('Session heartbeat failed', err);
      // não faz logout direto aqui, deixa o interceptor atuar
    }
  }
}
