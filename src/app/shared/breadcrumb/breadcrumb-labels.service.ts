import { Injectable, signal } from '@angular/core';

/** Page-owned labels for identifier segments; never changes navigation or stores entity data. */
@Injectable({ providedIn: 'root' })
export class BreadcrumbLabelsService {
  private readonly entries = signal(new Map<string, { label: string }>());

  labelFor(path: string): string | undefined {
    return this.entries().get(path)?.label;
  }

  register(path: string, label: string): () => void {
    const entry = { label };
    this.entries.update((entries) => new Map(entries).set(path, entry));
    return () => {
      this.entries.update((entries) => {
        if (entries.get(path) !== entry) return entries;
        const next = new Map(entries);
        next.delete(path);
        return next;
      });
    };
  }
}
