/** Bind a child FK lookup to parent form values without losing the parent's draft. */
export function remoteLookupParameters(
  bindings: Readonly<Record<string, string>> | undefined,
  values: Readonly<Record<string, unknown>>,
): { ready: boolean; query: string } {
  const query = new URLSearchParams();
  for (const [parameter, field] of Object.entries(bindings ?? {})) {
    const value = values[field];
    if (value === undefined || value === null || value === '') return { ready: false, query: '' };
    query.set(parameter, String(value));
  }
  return { ready: true, query: query.toString() };
}
