import type { ConfigurableCrudFieldType } from './configurable-crud-page-base';

/**
 * Form field layout baseline (app.md → Form Field Layout Baseline). The generic CRUD renderer owns
 * the grid width of every control, so no page can drift from it:
 *
 * - single-line controls (inputs, selects, FK selects, dates, status) always take one column
 *   (`span-1`) of the 4/3/2/1 grid;
 * - text areas always take the full row (`span-4`) with four visible rows.
 *
 * Only composite controls (file upload, checkbox group, permission tree, secret content) keep the
 * span they declare. `npm run check:crud:fields` rejects declarations that contradict this.
 */
export const SINGLE_LINE_FIELD_TYPES: ReadonlySet<ConfigurableCrudFieldType> = new Set([
  'text',
  'email',
  'password',
  'number',
  'currency',
  'phone',
  'date',
  'datetime',
  'time',
  'select',
  'search-select',
  'multi-select',
  'status',
]);

export const TEXTAREA_SPAN = 4;
export const TEXTAREA_ROWS = 4;

/** Grid columns of a field: fixed by its control type, declared only for composite controls. */
export function crudFieldSpan(
  type: ConfigurableCrudFieldType | undefined,
  declared: number | undefined,
): number {
  if (type === 'textarea') return TEXTAREA_SPAN;
  if (!type || SINGLE_LINE_FIELD_TYPES.has(type)) return 1;
  return declared ?? 1;
}
