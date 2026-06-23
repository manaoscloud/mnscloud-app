import { computed, signal, type Signal } from '@angular/core';
import type { PageEvent } from '@angular/material/paginator';
import type { Sort } from '@angular/material/sort';

export type CrudSortValue<T> = (row: T, column: string) => string | number | boolean | null | undefined;

function normalizeSortValue(value: string | number | boolean | null | undefined): string | number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return String(value ?? '').toLowerCase();
}

export function compareCrudSortValues(
  left: string | number | boolean | null | undefined,
  right: string | number | boolean | null | undefined,
): number {
  const a = normalizeSortValue(left);
  const b = normalizeSortValue(right);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function createSignalCrudTable<T>(
  rows: Signal<readonly T[]>,
  sortValue: CrudSortValue<T>,
  initialPageSize = 5,
) {
  const sortActive = signal('');
  const sortDirection = signal<Sort['direction']>('');
  const pageIndex = signal(0);
  const pageSize = signal(initialPageSize);

  const sortedRows = computed(() => {
    const active = sortActive();
    const direction = sortDirection();
    const currentRows = [...rows()];
    if (!active || !direction) return currentRows;
    const multiplier = direction === 'asc' ? 1 : -1;
    return currentRows.sort(
      (a, b) => compareCrudSortValues(sortValue(a, active), sortValue(b, active)) * multiplier,
    );
  });

  const visibleRows = computed(() => {
    const start = pageIndex() * pageSize();
    return sortedRows().slice(start, start + pageSize());
  });

  function setSort(sort: Sort): void {
    sortActive.set(sort.active || '');
    sortDirection.set(sort.direction || '');
    pageIndex.set(0);
  }

  function setPage(page: PageEvent): void {
    pageIndex.set(page.pageIndex);
    pageSize.set(page.pageSize);
  }

  function resetPage(): void {
    pageIndex.set(0);
  }

  return {
    sortActive,
    sortDirection,
    pageIndex,
    pageSize,
    sortedRows,
    visibleRows,
    setSort,
    setPage,
    resetPage,
  };
}
