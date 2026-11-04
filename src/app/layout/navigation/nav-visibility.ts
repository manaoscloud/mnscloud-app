import type { MenuScope, NavItem } from './nav-registry';

type Visibility = {
  permitted: (item: NavItem) => boolean;
  entitled: (code?: string) => boolean;
  context: (item: NavItem) => boolean;
};

/** Project each leaf's inherited scope and entitlement before deciding whether its group survives. */
export function visibleNavigation(
  items: NavItem[],
  checks: Visibility,
  inheritedScope?: MenuScope,
  inheritedEntitlement?: string,
): NavItem[] {
  return items.flatMap((item) => {
    const scope =
      item.scope ??
      (item.masterRoute && item.route
        ? 'both'
        : item.masterRoute
          ? 'master'
          : item.requiresEnvironment
            ? 'tenant'
            : (inheritedScope ?? 'public'));
    const entitlement = item.entitlementCode ?? inheritedEntitlement;
    const scoped = { ...item, scope };
    if (!checks.permitted(scoped)) return [];
    if (item.children?.length) {
      const children = visibleNavigation(item.children, checks, scope, entitlement);
      return children.length ? [{ ...scoped, children }] : [];
    }
    if ((scope === 'tenant' || scope === 'both') && !checks.entitled(entitlement)) return [];
    return checks.context(scoped) ? [scoped] : [];
  });
}
