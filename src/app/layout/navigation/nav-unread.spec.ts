import type { NavItem } from './nav-registry';
import { navUnreadCounts, routePath } from './nav-unread';

const tree: NavItem[] = [
  { id: 'dashboard', label: 'nav.dashboard', route: '/dashboard' },
  {
    id: 'support',
    label: 'nav.support',
    children: [
      { id: 'support/requests', label: 'nav.support.requests', route: '/support/requests' },
      {
        id: 'support/platform',
        label: 'nav.support.platform',
        children: [
          {
            id: 'support/platform/ai',
            label: 'nav.support.platform.ai',
            children: [
              {
                id: 'support/platform/ai/settings',
                label: 'nav.support.platform.ai.settings',
                route: '/support/platform/ai/settings',
              },
            ],
          },
        ],
      },
    ],
  },
];
const routeOf = (item: NavItem) => item.route;

describe('navUnreadCounts', () => {
  it('normalizes route paths', () => {
    expect(routePath('/support/requests?ticket=1')).toBe('/support/requests');
    expect(routePath('/support/requests/#x')).toBe('/support/requests');
    expect(routePath('')).toBe('/');
  });

  it('lights the leaf and every ancestor of its path', () => {
    const counts = navUnreadCounts(
      tree,
      routeOf,
      new Map([
        ['/support/requests', 2],
        ['/support/platform/ai/settings', 1],
      ]),
    );
    expect(Object.fromEntries(counts)).toEqual({
      support: 3,
      'support/requests': 2,
      'support/platform': 1,
      'support/platform/ai': 1,
      'support/platform/ai/settings': 1,
    });
  });

  it('falls back to the deepest leaf that contains a detail page', () => {
    const counts = navUnreadCounts(tree, routeOf, new Map([['/support/requests/abc', 1]]));
    expect(counts.get('support/requests')).toBe(1);
    expect(counts.get('support')).toBe(1);
  });

  it('ignores pages without a visible leaf and zero counts', () => {
    const counts = navUnreadCounts(
      tree,
      routeOf,
      new Map([
        ['/billing/subscriptions', 4],
        ['/support/requests', 0],
      ]),
    );
    expect(counts.size).toBe(0);
  });

  it('never lights an item hidden from the visible tree', () => {
    const hidden = (item: NavItem) =>
      item.id.startsWith('support/platform') ? undefined : item.route;
    const counts = navUnreadCounts(tree, hidden, new Map([['/support/platform/ai/settings', 1]]));
    expect(counts.size).toBe(0);
  });
});
