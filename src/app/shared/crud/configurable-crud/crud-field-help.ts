import type {
  ConfigurableCrudField,
  ConfigurableCrudFieldContext,
} from './configurable-crud-page-base';

/** Empty conditional guidance intentionally suppresses the static fallback. */
export function resolveCrudFieldHelp(
  field: Pick<ConfigurableCrudField, 'help' | 'helpWhen'>,
  context: ConfigurableCrudFieldContext,
  translate: (text: string) => string,
): string {
  const text = field.helpWhen?.(context) ?? field.help;
  return text ? translate(text) : '';
}
