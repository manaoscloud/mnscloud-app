export type DateInputPart = 'day' | 'month' | 'year';

export type DateInputPattern = {
  order: DateInputPart[];
  separator: string;
  placeholder: string;
};

const PART_LENGTH: Record<DateInputPart, number> = {
  day: 2,
  month: 2,
  year: 4,
};

export function dateInputPattern(locale: string): DateInputPattern {
  const sample = new Date(2001, 10, 22);
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(sample);
  const order = parts
    .filter(
      (part): part is Intl.DateTimeFormatPart & { type: DateInputPart } =>
        part.type === 'day' || part.type === 'month' || part.type === 'year',
    )
    .map((part) => part.type);

  const resolvedOrder = order.length === 3 ? order : (['month', 'day', 'year'] as DateInputPart[]);
  const separator = parts.find((part) => part.type === 'literal')?.value || '/';

  return {
    order: resolvedOrder,
    separator,
    placeholder: resolvedOrder
      .map((part) => (part === 'year' ? 'YYYY' : part === 'month' ? 'MM' : 'DD'))
      .join(separator),
  };
}

export function applyDateInputMask(value: string, locale: string): string {
  const digits = value.replace(/\D/g, '');
  const pattern = dateInputPattern(locale);
  let output = '';
  let position = 0;

  for (const [index, part] of pattern.order.entries()) {
    const size = PART_LENGTH[part];
    const chunk = digits.slice(position, position + size);
    if (!chunk) break;
    output += chunk;
    position += chunk.length;
    if (chunk.length === size && index < pattern.order.length - 1) {
      output += pattern.separator;
    }
  }

  return output;
}

export function parseDateInput(value: unknown, locale: string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value !== 'string') return null;

  const input = value.trim();
  if (!input) return null;

  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) return createLocalDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const compact = input.match(/^\d{8}$/);
  const parts = compact
    ? [compact[0], compact[0].slice(0, 2), compact[0].slice(2, 4), compact[0].slice(4, 8)]
    : input.match(/^(\d{1,2})\D+(\d{1,2})\D+(\d{4})$/);
  if (!parts) return null;

  const values = new Map<DateInputPart, number>();
  dateInputPattern(locale).order.forEach((part, index) =>
    values.set(part, Number(parts[index + 1])),
  );
  return createLocalDate(values.get('year'), values.get('month'), values.get('day'));
}

export function formatDateInput(value: Date, locale: string): string {
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export function toDateOnly(value: unknown, locale: string): string | null {
  const date = parseDateInput(value, locale);
  if (!date) return null;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) =>
      index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'),
    )
    .join('-');
}

function createLocalDate(year?: number, month?: number, day?: number): Date | null {
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
