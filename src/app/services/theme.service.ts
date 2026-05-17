import { effect, Injectable, Injector, runInInjectionContext, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'mnscloud-theme';

  /** Tema atual */
  readonly theme = signal<ThemeMode>('system');

  constructor(private injector: Injector) {
    runInInjectionContext(this.injector, () => {
      const initial = this.loadInitialTheme();
      this.theme.set(initial);
      this.applyTheme(initial);

      effect(() => {
        const mode = this.theme();
        this.applyTheme(mode);
        if (this.hasWindow()) {
          localStorage.setItem(this.STORAGE_KEY, mode);
        }
      });

      if (this.hasWindow()) {
        const media = window.matchMedia('(prefers-color-scheme: dark)');
        media.addEventListener('change', () => {
          if (this.theme() === 'system') {
            this.applyTheme('system');
          }
        });

        window.addEventListener('storage', (event: StorageEvent) => {
          if (event.key === this.STORAGE_KEY && event.newValue) {
            const next = event.newValue as ThemeMode;
            if (next !== this.theme()) {
              this.theme.set(next);
            }
          }
        });
      }
    });
  }

  private hasWindow(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  private loadInitialTheme(): ThemeMode {
    if (!this.hasWindow()) return 'system';

    const saved = localStorage.getItem(this.STORAGE_KEY) as ThemeMode | null;
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      return saved;
    }

    return 'system';
  }

  setTheme(mode: ThemeMode) {
    this.theme.set(mode);
  }

  toggleTheme() {
    const sequence: ThemeMode[] = ['light', 'dark', 'system'];
    const current = this.theme();
    const next = sequence[(sequence.indexOf(current) + 1) % sequence.length];
    this.theme.set(next);
  }

  private applyTheme(mode: ThemeMode) {
    if (!this.hasWindow()) return;

    /** ESSENCIAL — aplica literal "light|dark|system" */
    document.documentElement.dataset['theme'] = mode;
  }
}
