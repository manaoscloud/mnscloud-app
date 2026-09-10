import {
  computed,
  inject,
  linkedSignal,
  resource,
  type PromiseResourceOptions,
  type Signal,
} from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TenantService } from '../../services/tenant.service';

export interface DashboardResource<T> {
  value: Signal<T>;
  error: Signal<Error | undefined>;
  isLoading: Signal<boolean>;
  hasData: Signal<boolean>;
  updatedAt: Signal<string | null>;
  hasValue(): boolean;
  reload(): boolean;
}

/** A page-scoped read model. Retained data never survives an identity/environment change. */
export function dashboardResource<T, R>(
  options: Omit<PromiseResourceOptions<T, R>, 'equal'> & { defaultValue: T },
): DashboardResource<T>;
export function dashboardResource<T, R>(
  options: Omit<PromiseResourceOptions<T, R>, 'equal'>,
): DashboardResource<T | undefined>;
export function dashboardResource<T, R>(
  options: Omit<PromiseResourceOptions<T, R>, 'equal'>,
): DashboardResource<T | undefined> {
  const auth = inject(AuthService);
  const tenant = inject(TenantService);
  const scope = computed(() =>
    JSON.stringify([auth.user(), tenant.selectedTenant()?.EnvironmentUUID]),
  );
  const { defaultValue, ...config } = options;
  const source = resource({
    ...config,
    params: (ctx) => ({ request: options.params?.(ctx), scope: scope() }),
    loader: async (ctx) => ({
      data: await options.loader({ ...ctx, params: ctx.params.request as Exclude<R, undefined> }),
      scope: ctx.params.scope,
      updatedAt: new Date().toISOString(),
    }),
  });
  const view = linkedSignal({
    source: () => ({
      scope: scope(),
      status: source.status(),
      value: source.hasValue() ? source.value() : undefined,
    }),
    computation: (
      current,
      previous,
    ): { scope: string; value: T | undefined; updatedAt: string | null } => {
      if (
        (current.status === 'resolved' || current.status === 'local') &&
        current.value?.scope === current.scope
      ) {
        return {
          scope: current.scope,
          value: current.value.data,
          updatedAt: current.value.updatedAt,
        };
      }
      if (previous?.value.scope === current.scope) return previous.value;
      return { scope: current.scope, value: defaultValue, updatedAt: null };
    },
  });
  return {
    value: computed(() => view().value),
    error: source.error,
    isLoading: source.isLoading,
    hasData: computed(() => view().updatedAt !== null),
    updatedAt: computed(() => view().updatedAt),
    hasValue: () => view().value !== undefined,
    reload: () => source.reload(),
  };
}
