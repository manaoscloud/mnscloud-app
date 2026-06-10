import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly destroyRef = inject(DestroyRef);

  readonly online = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  constructor() {
    if (typeof window !== 'undefined') {
      const handleOnline = () => this.online.set(true);
      const handleOffline = () => this.online.set(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      });
    }
  }
}
