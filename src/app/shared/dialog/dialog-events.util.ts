import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription, takeUntil } from 'rxjs';

export function bindDialogEscape(
  ref: MatDialogRef<unknown>,
  onEscape: () => void,
  destroyRef?: DestroyRef,
): Subscription {
  const events = ref.keydownEvents().pipe(takeUntil(ref.afterClosed()));
  const source = destroyRef ? events.pipe(takeUntilDestroyed(destroyRef)) : events;

  return source.subscribe((event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onEscape();
  });
}

export function bindDialogClosed(
  ref: MatDialogRef<unknown>,
  onClosed: () => void,
  destroyRef?: DestroyRef,
): Subscription {
  const events = destroyRef
    ? ref.afterClosed().pipe(takeUntilDestroyed(destroyRef))
    : ref.afterClosed();
  return events.subscribe(() => onClosed());
}
