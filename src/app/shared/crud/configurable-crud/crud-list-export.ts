/** Rows fetched for a list export (CSV / print): the current filters, every page, capped. */
export const LIST_EXPORT_CAP = 5000;
export const LIST_EXPORT_PAGE = 100;

export type ListExportPage<T> = { items: T[]; total: number };

/**
 * Fetches consecutive pages until the endpoint total (or an empty page) is reached or the cap is
 * hit. `capped` is true when more rows exist than were collected.
 */
export async function fetchAllListPages<T>(
  fetchPage: (limit: number, offset: number) => Promise<ListExportPage<T>>,
  cap = LIST_EXPORT_CAP,
  pageSize = LIST_EXPORT_PAGE,
): Promise<{ rows: T[]; capped: boolean }> {
  const rows: T[] = [];
  let total = Number.POSITIVE_INFINITY;
  while (rows.length < cap && rows.length < total) {
    const page = await fetchPage(Math.min(pageSize, cap - rows.length), rows.length);
    if (!page.items.length) return { rows, capped: false };
    rows.push(...page.items);
    if (Number.isFinite(page.total) && page.total > 0) total = page.total;
    else if (page.items.length < pageSize) return { rows, capped: false };
  }
  return { rows, capped: Number.isFinite(total) && total > rows.length };
}
