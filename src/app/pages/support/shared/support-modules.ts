import { ApiService } from '../../../services/api.service';
import { NAV_ITEMS, NavItem } from '../../../layout/navigation/nav-registry';
import type { ConfigurableCrudOption } from '../../../shared/crud/configurable-crud/configurable-crud-page-base';

/**
 * Ticket module: the commercial module a ticket is about (`moduleCode`, empty = general).
 * Requesters pick only modules their environment contracted (`help/modules`); the tenant desk
 * follows its own contract and the platform desk classifies with the whole catalog. Teams that
 * serve a module receive its new tickets (API routing).
 */

/** List filter value for tickets without a module. */
export const SUPPORT_MODULE_NONE = 'none';

export function supportModuleLabel(code: unknown, translate: (key: string) => string): string {
  const value = String(code ?? '').trim();
  if (!value) return '';
  const key = `commercial.module.${value}`;
  const label = translate(key);
  return label && label !== key ? label : value;
}

export function supportModuleOptions(
  codes: readonly string[],
  translate: (key: string) => string,
): ConfigurableCrudOption[] {
  return codes
    .map((code) => ({ value: code, label: supportModuleLabel(code, translate) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Filter options: "General" (no module) and every module. */
export function supportModuleFilterOptions(
  codes: readonly string[],
  translate: (key: string) => string,
): ConfigurableCrudOption[] {
  return [
    { value: SUPPORT_MODULE_NONE, label: translate('General') },
    ...supportModuleOptions(codes, translate),
  ];
}

/** Module codes of `help/modules`, `support/modules` or `system/support/modules`. */
export async function loadSupportModules(api: ApiService, endpoint: string): Promise<string[]> {
  try {
    const response = await api.get<{ data?: { items?: Array<{ code?: string }> } }>(endpoint);
    return (response?.data?.items ?? []).map((item) => String(item.code ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

function moduleOfEntitlement(code: string | undefined): string | null {
  const match = /^module\.([a-z0-9-]+)\./.exec(code ?? '');
  return match ? match[1] : null;
}

/**
 * Module of an App route from the menu: the deepest menu entry whose route contains it, with the
 * entitlement it declares or inherits (`module.voip.*` -> `voip`). Null outside module pages.
 */
export function supportModuleForRoute(
  route: string,
  items: readonly NavItem[] = NAV_ITEMS,
): string | null {
  const path = String(route ?? '')
    .split(/[?#]/)[0]
    .replace(/\/+$/, '');
  let best: { length: number; module: string } | null = null;
  const visit = (entries: readonly NavItem[], inherited: string | null) => {
    for (const item of entries) {
      const module = moduleOfEntitlement(item.entitlementCode) ?? inherited;
      for (const candidate of [item.route, item.masterRoute]) {
        const base = String(candidate ?? '').replace(/\/+$/, '');
        if (!base || !module) continue;
        if ((path === base || path.startsWith(`${base}/`)) && base.length > (best?.length ?? 0)) {
          best = { length: base.length, module };
        }
      }
      if (item.children) visit(item.children, module);
    }
  };
  visit(items, null);
  return (best as { length: number; module: string } | null)?.module ?? null;
}
