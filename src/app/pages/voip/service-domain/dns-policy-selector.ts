import { DestroyRef, computed, effect, inject, resource, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../services/api.service';
import { AppI18nService } from '../../../services/app-i18n.service';

/** DNS publication policy offered by a module parameters page (one per DNS zone and service). */
export type DnsPolicyItem = {
  policyUUID: string;
  domainUUID?: string;
  base: string;
  zoneName?: string;
  status: boolean;
  eligible?: boolean;
};

/** The saved selection, resolved by the parameters endpoint even when it is not listed. */
export type SelectedDnsPolicy = {
  uuid: string | null;
  zoneName?: string | null;
  base?: string | null;
  eligible?: boolean | null;
};

const PAGE_SIZE = 50;

/**
 * Server-searched, paginated selector of the authorized DNS policies of one service
 * (`<module parameters endpoint>/dns-policies`). Call in an injection context.
 */
export function dnsPolicySelector(
  endpoint: () => string | null,
  selected: () => SelectedDnsPolicy,
  baseLabel: string,
) {
  const api = inject(ApiService);
  const translation = inject(TranslocoService);
  const i18n = inject(AppI18nService);
  const policies = signal<DnsPolicyItem[]>([]);
  const offset = signal(0);
  const term = signal('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  inject(DestroyRef).onDestroy(() => clearTimeout(timer));

  const source = resource({
    params: () => ({ endpoint: endpoint(), search: term(), offset: offset() }),
    defaultValue: { items: [] as DnsPolicyItem[], total: 0 },
    loader: async ({ params }) => {
      if (!params.endpoint) return { items: [] as DnsPolicyItem[], total: 0 };
      const query = new URLSearchParams({
        search: params.search,
        limit: String(PAGE_SIZE),
        offset: String(params.offset),
      });
      const result = await api.get<any>(`${params.endpoint}/dns-policies?${query}`);
      return { items: result?.data?.items ?? [], total: Number(result?.data?.total ?? 0) };
    },
  });
  effect(() => {
    if (source.hasValue()) policies.set(source.value().items);
  });

  const options = computed(() => {
    i18n.language();
    const list = policies();
    const current = selected();
    const realmBase = translation.translate(baseLabel);
    const result = list
      .filter((p) => p.status && p.eligible !== false)
      .map((p) => ({
        value: p.policyUUID,
        label: `${p.zoneName || p.base} — ${realmBase}: ${p.base}`,
        searchText: `${p.zoneName ?? ''} ${p.base}`,
      }));
    if (current.uuid && !result.some((o) => o.value === current.uuid)) {
      const policy = list.find((p) => p.policyUUID === current.uuid);
      const zoneName = policy?.zoneName || current.zoneName || '';
      const base = policy?.base || current.base || '';
      const suffix = current.eligible !== true ? ` (${translation.translate('Unavailable')})` : '';
      result.unshift({
        value: current.uuid,
        label:
          zoneName || base
            ? `${zoneName || base} — ${realmBase}: ${base}${suffix}`
            : `${current.uuid}${suffix}`,
        searchText: current.uuid,
      });
    }
    return result;
  });

  return {
    policies: policies.asReadonly(),
    options,
    offset: offset.asReadonly(),
    total: computed(() => source.value()?.total ?? 0),
    hasNext: computed(() => offset() + PAGE_SIZE < (source.value()?.total ?? 0)),
    loading: computed(() => source.isLoading()),
    loadError: computed(() => !!source.error()),
    search: (value: string) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        offset.set(0);
        term.set(value);
      }, 250);
    },
    page: (direction: number) =>
      offset.update((value) => Math.max(0, value + direction * PAGE_SIZE)),
    refresh: () => source.reload(),
    find: (uuid: string | null) =>
      uuid ? policies().find((p) => p.policyUUID === uuid) : undefined,
  };
}

export type DnsPolicySelector = ReturnType<typeof dnsPolicySelector>;
