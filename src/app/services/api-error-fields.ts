/**
 * Field names an API validation failure points at (`VALIDATION_FAILED` contract in
 * mnscloud-api `docs/api-patterns.md`): `{ error, code, fields: string[] }`. Only plain
 * identifier-like names are accepted, so a malformed body never reaches a DOM selector.
 */
export function apiErrorFields(error: unknown): string[] {
  if (!error || typeof error !== 'object') return [];
  const body = (error as { error?: unknown }).error;
  if (!body || typeof body !== 'object') return [];
  const fields = (body as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  return [
    ...new Set(
      fields.filter(
        (name): name is string =>
          typeof name === 'string' && /^[A-Za-z_][A-Za-z0-9_.]{0,127}$/.test(name),
      ),
    ),
  ];
}
