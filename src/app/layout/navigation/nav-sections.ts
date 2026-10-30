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
