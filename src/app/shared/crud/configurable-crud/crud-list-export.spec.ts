import { fetchAllListPages } from './crud-list-export';

describe('fetchAllListPages', () => {
  const source = (n: number) => Array.from({ length: n }, (_, i) => i);
  const pager = (n: number) => async (limit: number, offset: number) => ({
    items: source(n).slice(offset, offset + limit),
    total: n,
  });

  it('collects every page', async () => {
    const result = await fetchAllListPages(pager(250));
    expect(result.rows.length).toBe(250);
    expect(result.capped).toBe(false);
  });

  it('caps and reports it', async () => {
    const result = await fetchAllListPages(pager(900), 300, 100);
    expect(result.rows.length).toBe(300);
    expect(result.capped).toBe(true);
  });

  it('handles an empty list', async () => {
    expect((await fetchAllListPages(pager(0))).rows).toEqual([]);
  });
});
