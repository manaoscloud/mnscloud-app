/** RFC-style quoted CSV. Values remain plain strings, including spreadsheet formulas. */
export function parseLeadCsv(text: string): string[][] {
  if (new TextEncoder().encode(text).length > 512 * 1024) throw new Error('size');
  text = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let closed = false;
  const push = () => {
    row.push(cell);
    cell = '';
    closed = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error('csv');
      quoted = true;
    } else if (c === ',') push();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      push();
      rows.push(row);
      row = [];
    } else {
      if (closed) throw new Error('csv');
      cell += c;
    }
  }
  if (quoted) throw new Error('csv');
  if (cell || row.length || closed) {
    push();
    rows.push(row);
  }
  if (rows.length < 2 || rows.length > 101 || rows.some((r) => r.length !== rows[0].length))
    throw new Error('rows');
  if (rows[0].some((v) => !v.trim()) || new Set(rows[0]).size !== rows[0].length)
    throw new Error('headers');
  return rows;
}
export const LEAD_IMPORT_FIELDS = [
  'CleName',
  'CleEmail',
  'ClePhone',
  'CleDocument',
  'CleNeed',
] as const;
export function mapLeadCsv(csv: string[][], mapping: Record<string, unknown>) {
  for (const key of LEAD_IMPORT_FIELDS) {
    const index = mapping[key];
    if (index === '' || index == null) {
      if (key === 'CleName') throw new Error('mapping');
      continue;
    }
    if (
      !/^\d+$/.test(String(index)) ||
      !Number.isSafeInteger(Number(index)) ||
      Number(index) >= csv[0].length
    )
      throw new Error('mapping');
  }
  return csv.slice(1).map((cells, i) => ({
    rowKey: String(i + 1),
    data: Object.fromEntries(
      LEAD_IMPORT_FIELDS.filter((key) => mapping[key] !== '' && mapping[key] != null).map((key) => [
        key,
        cells[Number(mapping[key])],
      ]),
    ),
  }));
}
export function importRequestSize(body: unknown): number {
  return new TextEncoder().encode(JSON.stringify(body)).length;
}
