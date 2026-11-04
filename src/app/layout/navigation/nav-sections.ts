// Section titles of the sidebar (app.md → Navigation Structure): an area title above the first
// visible root module of each area and a category title above the first visible entry of each
// category. Titles are computed on the menu the user actually sees (after permissions,
// entitlements and search), so a title never shows above an empty section.

export interface SectionedEntry {
  area?: string;
  category?: string;
  /** Translated area title shown above this root module. */
  areaTitle?: string;
  /** Translated category title shown above this entry. */
  categoryTitle?: string;
  children?: SectionedEntry[];
}

export const navAreaKey = (area: string) => `nav.area.${area}`;
export const navCategoryKey = (category: string) => `nav.category.${category}`;

function withCategoryTitles<T extends SectionedEntry>(items: T[], t: (key: string) => string): T[] {
  let previous: string | undefined;
  return items.map((item) => {
    const categoryTitle =
      item.category && item.category !== previous ? t(navCategoryKey(item.category)) : undefined;
    previous = item.category;
    const children = item.children
      ? withCategoryTitles(item.children as T[], t)
      : (item.children as T[] | undefined);
    return { ...item, categoryTitle, children };
  });
}

/** Copies of the root modules with `areaTitle`/`categoryTitle` set where a section starts. */
export function withSectionTitles<T extends SectionedEntry>(
  items: T[],
  t: (key: string) => string,
): T[] {
  let previous: string | undefined;
  return items.map((item) => {
    const areaTitle = item.area && item.area !== previous ? t(navAreaKey(item.area)) : undefined;
    previous = item.area;
    const children = item.children
      ? withCategoryTitles(item.children as T[], t)
      : (item.children as T[] | undefined);
    return { ...item, areaTitle, categoryTitle: undefined, children };
  });
}

/**
 * Icon of each category group in the expanded sidebar. Data only: `npm run check:nav` requires one
 * Material Symbols name for every category of nav-glossary.json and no other key.
 */
export const NAV_CATEGORY_ICONS: Record<string, string> = {
  operation: 'work',
  registry: 'folder_open',
  reports: 'bar_chart',
  settings: 'settings',
  resale: 'storefront',
  platform: 'admin_panel_settings',
  pipeline: 'filter_alt',
  people: 'group',
  organization: 'corporate_fare',
  classifications: 'label',
  catalog: 'menu_book',
  contracting: 'assignment',
  credits: 'account_balance_wallet',
  access: 'key',
  environment: 'tune',
  integrations: 'hub',
  content: 'article',
  utilities: 'electric_bolt',
  network: 'lan',
  addressing: 'pin',
  equipment: 'router',
  numbering: 'dialpad',
  services: 'apps',
  'call-center': 'support_agent',
  'call-flow': 'call_split',
  threats: 'gpp_maybe',
  protection: 'shield',
  'web-filter': 'filter_list',
  customers: 'groups',
  help: 'help',
};

/** Id of the category group of `category` inside `parentId` (never a registry id: `/@`). */
export const navCategoryGroupId = (parentId: string, category: string) =>
  `${parentId}/@${category}`;

/** Category group ids are display-only nodes created by {@link withCategoryGroups}. */
export const isNavCategoryGroupId = (id: string) => id.includes('/@');

export interface GroupableEntry {
  id: string;
  category?: string;
  categoryTitle?: string;
  categoryGroup?: boolean;
  children?: GroupableEntry[];
}

/**
 * Expanded-sidebar view of the visible menu: inside every group, each category with two or more
 * visible entries becomes a collapsible group node (id {@link navCategoryGroupId}) in the place of
 * its first entry; a category with a single visible entry shows that entry directly. No category
 * title is left, because the group row names the category. Registry ids, routes and visibility are
 * untouched; `group` builds the node from the parent, the category and its entries.
 */
export function withCategoryGroups<T extends GroupableEntry>(
  items: T[],
  group: (parent: T, category: string, children: T[]) => T,
): T[] {
  const regroup = (parent: T): T => {
    if (!parent.children?.length) return parent;
    const children = parent.children as T[];
    const sizes = new Map<string, number>();
    for (const child of children) {
      if (child.category) sizes.set(child.category, (sizes.get(child.category) ?? 0) + 1);
    }
    const groups = new Map<string, T[]>();
    const list: (T | { pending: string })[] = [];
    for (const child of children) {
      const entry = { ...regroup(child), categoryTitle: undefined };
      const category = child.category;
      if (!category || (sizes.get(category) ?? 0) < 2) {
        list.push(entry);
        continue;
      }
      if (!groups.has(category)) {
        groups.set(category, []);
        list.push({ pending: category });
      }
      groups.get(category)!.push(entry);
    }
    const resolved = list.map((entry) =>
      'pending' in entry ? group(parent, entry.pending, groups.get(entry.pending)!) : entry,
    );
    return { ...parent, children: resolved };
  };
  return items.map(regroup);
}

export interface AccordionEntry {
  id: string;
  children?: AccordionEntry[];
}

/**
 * Expanded sidebar accordion (app.md → Navigation Structure): opening an entry closes every open
 * sibling at the same level, including the one on the path of the current page, together with all
 * the entries open below it, so a reopened sibling starts collapsed. Closing an entry only closes
 * it (its open descendants show again when it reopens, as before). `items` is the menu as rendered.
 */
export function toggleNavSection(
  items: AccordionEntry[],
  expanded: ReadonlySet<string>,
  id: string,
): Set<string> {
  const next = new Set(expanded);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  const closeBranch = (entry: AccordionEntry) => {
    next.delete(entry.id);
    entry.children?.forEach(closeBranch);
  };
  const siblingsOf = (list: AccordionEntry[]): AccordionEntry[] | null => {
    if (list.some((entry) => entry.id === id)) return list;
    for (const entry of list) {
      const found = entry.children?.length ? siblingsOf(entry.children) : null;
      if (found) return found;
    }
    return null;
  };
  for (const sibling of siblingsOf(items) ?? []) {
    if (sibling.id !== id) closeBranch(sibling);
  }
  next.add(id);
  return next;
}

/** Height of one compact flyout row, category title and the panel padding (main-layout.scss). */
export const COMPACT_FLYOUT_ROW_PX = 42;
export const COMPACT_FLYOUT_TITLE_PX = 26;
export const COMPACT_FLYOUT_PADDING_PX = 14;

/** Estimated height of a compact flyout listing `entries` (rows plus their category titles). */
export function estimateCompactFlyoutHeight(
  entries: readonly { id: string; categoryTitle?: string }[],
): number {
  const titles = entries.filter((entry) => entry.categoryTitle).length;
  return (
    entries.length * COMPACT_FLYOUT_ROW_PX +
    titles * COMPACT_FLYOUT_TITLE_PX +
    COMPACT_FLYOUT_PADDING_PX
  );
}

/**
 * Vertical placement of a compact flyout: it starts at its anchor row when it fits, otherwise moves
 * up just enough to end `margin` above the viewport bottom; taller than the viewport, it takes the
 * whole height and scrolls. Rows never shrink (main-layout.scss), so nothing is squeezed or cut.
 */
export function fitCompactFlyout(
  anchorTop: number,
  height: number,
  viewportHeight: number,
  margin = 16,
): { top: number; maxHeight: number } {
  const maxHeight = Math.max(112, viewportHeight - margin * 2);
  const visible = Math.min(height, maxHeight);
  const top = Math.max(margin, Math.min(anchorTop, viewportHeight - margin - visible));
  return { top: Math.round(top), maxHeight: Math.round(maxHeight) };
}
