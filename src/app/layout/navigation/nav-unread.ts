import type { NavItem } from './nav-registry';

/** Path of an App route without query string, hash or trailing slash. */
export function routePath(route: string): string {
  const path = route.split(/[?#]/)[0]?.replace(/\/+$/, '');
  return path || '/';
}

/**
 * Projects unread notifications per App page onto the visible menu tree.
 *
 * A page lights the visible leaves whose route is that page (exact) or, when none is exact, the
 * deepest leaf route that contains it; every ancestor sums its children, so the path from the
 * module icon to the leaf is marked at every level. Items hidden by permission, scope or
 * entitlement are not in `items`, so they never light an ancestor; pages without a visible leaf
 * light only the bell.
 *
 * @returns unread count per nav item id (absent = nothing unread).
 */
export function navUnreadCounts(
  items: readonly NavItem[],
  routeOf: (item: NavItem) => string | undefined,
  unreadByRoute: ReadonlyMap<string, number>,
): Map<string, number> {
  const leaves: { id: string; path: string; ancestors: string[] }[] = [];
  const walk = (list: readonly NavItem[], ancestors: string[]) => {
    for (const item of list) {
      if (item.children?.length) {
        walk(item.children, [...ancestors, item.id]);
        continue;
      }
      const route = routeOf(item);
      if (route) leaves.push({ id: item.id, path: routePath(route), ancestors });
    }
  };
  walk(items, []);

  const counts = new Map<string, number>();
  for (const [route, count] of unreadByRoute) {
    if (!(count > 0)) continue;
    const path = routePath(route);
    let targets = leaves.filter((leaf) => leaf.path === path);
    if (!targets.length) {
      const prefixed = leaves.filter(
        (leaf) => leaf.path !== '/' && path.startsWith(`${leaf.path}/`),
      );
      const deepest = Math.max(0, ...prefixed.map((leaf) => leaf.path.length));
      targets = prefixed.filter((leaf) => leaf.path.length === deepest);
    }
    const lit = new Set<string>();
    for (const leaf of targets) {
      for (const id of [leaf.id, ...leaf.ancestors]) lit.add(id);
    }
    for (const id of lit) counts.set(id, (counts.get(id) ?? 0) + count);
  }
  return counts;
}
