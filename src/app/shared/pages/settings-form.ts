import { computed, effect, inject, resource, signal } from '@angular/core';

import { ApiService } from '../../services/api.service';
import { apiErrorFields } from '../../services/api-error-fields';
import { FieldRules } from '../forms/field-validation';
import { injectRevealInvalidFields } from '../forms/reveal-invalid-fields';

export interface SettingsFormOptions<F extends object, K extends string> {
  /** API endpoint read with GET and saved with PUT (`data.item` in both answers). */
  endpoint: string;
  /** Form value before the first load. */
  initial: F;
  /** Maps the API item to the form value. */
  read: (item: Record<string, any>) => F;
  /** Maps the form value to the PUT body. */
  payload: (form: F) => unknown;
  /** Client rules per field key; each returns true when the field is valid. */
  rules: (form: () => F) => Readonly<Record<K, () => boolean>>;
}

/** Message of an API error, or the fallback text. */
export function settingsErrorMessage(error: unknown, fallback: string): string {
  const body = (error as any)?.error?.error;
  if (typeof body === 'string' && body.trim()) return body;
  const raw = (error as any)?.message;
  return typeof raw === 'string' && raw.trim() ? raw : fallback;
}

/**
 * State of a `mns-settings-page` form bound to one GET/PUT endpoint: load, dirty check, client and
 * server field errors, refresh, cancel and save. Call it in an injection context (field initializer).
 */
export function injectSettingsForm<F extends object, K extends string>(
  options: SettingsFormOptions<F, K>,
) {
  const api = inject(ApiService);
  const revealInvalid = injectRevealInvalidFields();

  const form = signal<F>(options.initial);
  const baseline = signal(JSON.stringify(options.initial));
  const saving = signal(false);
  const feedback = signal<string | null>(null);
  const success = signal<string | null>(null);
  const serverInvalid = signal<ReadonlySet<string>>(new Set());
  const rules = new FieldRules<K>(options.rules(form));
  const parameters = resource({
    loader: async () => (await api.get<any>(options.endpoint))?.data?.item ?? {},
  });
  const loading = computed(() => parameters.isLoading());

  const apply = (item: Record<string, any>) => {
    const value = options.read(item);
    form.set(value);
    baseline.set(JSON.stringify(value));
    serverInvalid.set(new Set());
  };
  const clearMessages = () => {
    feedback.set(null);
    success.set(null);
  };

  effect(() => {
    if (parameters.hasValue()) apply(parameters.value());
  });
  effect(() => {
    const error = parameters.error();
    if (error) feedback.set(settingsErrorMessage(error, 'Failed to load parameters.'));
  });

  return {
    form: form.asReadonly(),
    saving: saving.asReadonly(),
    feedback: feedback.asReadonly(),
    success: success.asReadonly(),
    loading,
    hasChanges: computed(() => JSON.stringify(form()) !== baseline()),

    update(patch: Partial<F>) {
      form.update((current) => ({ ...current, ...patch }));
      const keys = Object.keys(patch);
      if (keys.some((key) => serverInvalid().has(key))) {
        serverInvalid.update((set) => new Set([...set].filter((key) => !keys.includes(key))));
      }
    },

    invalid(key: K): boolean {
      return rules.invalid(key) || serverInvalid().has(key);
    },

    refresh() {
      if (saving()) return;
      clearMessages();
      parameters.reload();
    },

    cancel() {
      form.set(JSON.parse(baseline()));
      rules.reset();
      serverInvalid.set(new Set());
      clearMessages();
    },

    async save() {
      if (saving() || loading()) return;
      clearMessages();
      if (!rules.check()) return revealInvalid();
      saving.set(true);
      try {
        const result = await api.put<any>(options.endpoint, options.payload(form()));
        apply(result?.data?.item ?? {});
        rules.reset();
        success.set('Parameters saved successfully.');
      } catch (error) {
        const fields = apiErrorFields(error);
        if (fields.length) {
          serverInvalid.set(new Set(fields));
          revealInvalid();
        }
        feedback.set(settingsErrorMessage(error, 'Failed to save parameters.'));
      } finally {
        saving.set(false);
      }
    },
  };
}
