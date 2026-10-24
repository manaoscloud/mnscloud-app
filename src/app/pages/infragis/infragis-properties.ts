import type { ConfigurableCrudRecord } from '../../shared/crud/configurable-crud/configurable-crud-page-base';

/** Properties schema of an asset type (JSON Schema subset validated by the database). */
type Schema = {
  properties?: Record<
    string,
    { type?: string; title?: string; enum?: unknown[]; minimum?: number; 'x-unit'?: string }
  >;
  required?: string[];
};

function parse(value: unknown): Schema | null {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? (parsed as Schema) : null;
  } catch {
    return null;
  }
}

/** InfraGIS payloads: numeric status flag and empty strings sent as null (clears on update). */
export function emptyToNull(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
  const next: ConfigurableCrudRecord = { ...payload, status: Number(payload['status'] ?? 1) };
  for (const [key, value] of Object.entries(next)) if (value === '') next[key] = null;
  return next;
}

/** "Portas (portas, number, required), Splitter (splitter: 1:8 | 1:16)" for the field help. */
export function schemaSummary(value: unknown): string {
  const schema = parse(value);
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {})
    .map(([key, property]) => {
      const detail = property.enum?.length
        ? property.enum.join(' | ')
        : [property.type, property['x-unit']].filter(Boolean).join(', ');
      const title = property.title && property.title !== key ? `${property.title} (${key})` : key;
      return `${title}: ${detail}${required.has(key) ? ' *' : ''}`;
    })
    .join('; ');
}

/** Current properties plus every required field of the schema still missing, as JSON text. */
export function propertiesTemplate(schemaValue: unknown, currentValue: unknown): string {
  const schema = parse(schemaValue);
  let current: Record<string, unknown> = {};
  try {
    const parsed =
      typeof currentValue === 'string' && currentValue.trim()
        ? JSON.parse(currentValue)
        : currentValue;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) current = { ...parsed };
  } catch {
    current = {};
  }
  for (const key of schema?.required ?? []) {
    if (key in current) continue;
    const property = schema?.properties?.[key] ?? {};
    let initial: unknown = property.enum?.[0] ?? '';
    if (property.type === 'boolean') initial = false;
    if (property.type === 'number') initial = property.minimum ?? 0;
    current[key] = initial;
  }
  return JSON.stringify(current, null, 2);
}
