/**
 * One DID input field for a single number or an inclusive range, without a create-mode choice.
 *
 * A range is detected only when a separator (`-`, `–`, `—`, `..`, ` a `, ` até `, ` to `) splits the
 * text into two valid E.164 numbers. That keeps a formatted single number such as
 * `55 92 3042-3000` a single number: its right side (`3000`) is not a valid E.164 number.
 * Short-end notation (`559230423000-049`) is not supported because it is ambiguous with such
 * formatted numbers. The API repeats every rule; this only drives the form.
 */

export const DID_RANGE_MAX = 100;

export type DidNumberInput =
  | { kind: 'empty' }
  | { kind: 'single'; number: string }
  | { kind: 'range'; start: string; end: string; total: number }
  | { kind: 'invalid'; reason: DidNumberInputError };

export type DidNumberInputError = 'format' | 'sameLength' | 'order' | 'maxSize' | 'ambiguous';

const E164 = /^[1-9]\d{7,14}$/;
const SEPARATOR = /\s*(?:\.\.|[-–—]|\s(?:a|até|ate|to)\s)\s*/gi;

function digits(value: string): string {
  return value.replace(/\D+/g, '');
}

export function parseDidNumberInput(value: unknown): DidNumberInput {
  const text = String(value ?? '').trim();
  if (!text) return { kind: 'empty' };

  const pairs: Array<{ start: string; end: string }> = [];
  for (const match of text.matchAll(SEPARATOR)) {
    const index = match.index ?? 0;
    const start = digits(text.slice(0, index));
    const end = digits(text.slice(index + match[0].length));
    if (E164.test(start) && E164.test(end)) pairs.push({ start, end });
  }

  if (!pairs.length) {
    const number = digits(text);
    return E164.test(number) ? { kind: 'single', number } : { kind: 'invalid', reason: 'format' };
  }
  if (pairs.length > 1) return { kind: 'invalid', reason: 'ambiguous' };

  const { start, end } = pairs[0];
  if (start.length !== end.length) return { kind: 'invalid', reason: 'sameLength' };
  const total = BigInt(end) - BigInt(start) + 1n;
  if (total < 1n) return { kind: 'invalid', reason: 'order' };
  if (total === 1n) return { kind: 'single', number: start };
  if (total > BigInt(DID_RANGE_MAX)) return { kind: 'invalid', reason: 'maxSize' };
  return { kind: 'range', start, end, total: Number(total) };
}

/** Translation keys of the parser errors (PT/EN/ES dictionaries). */
export const DID_NUMBER_INPUT_ERRORS: Record<DidNumberInputError, string> = {
  format: 'Enter a DID number in E.164 format or a range start-end.',
  sameLength: 'DID range start and end must have the same number of digits.',
  order: 'DID range start must not be greater than its end.',
  maxSize: 'DID range exceeds the maximum of 100 numbers.',
  ambiguous: 'Enter the DID range as two full numbers separated by a hyphen.',
};
