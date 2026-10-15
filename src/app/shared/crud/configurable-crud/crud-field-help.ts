import type {
  ConfigurableCrudField,
  ConfigurableCrudFieldContext,
} from './configurable-crud-page-base';

/** Empty conditional guidance intentionally suppresses the static fallback. */
export function resolveCrudFieldHelp(
  field: Pick<ConfigurableCrudField, 'help' | 'helpWhen' | 'helpParams'>,
  context: ConfigurableCrudFieldContext,
  translate: (text: string, params?: Record<string, string | number>) => string,
): string {
  const text = field.helpWhen?.(context) ?? field.help;
  if (!text) return '';
  const params = field.helpParams?.(context);
  return params ? translate(text, params) : translate(text);
}
