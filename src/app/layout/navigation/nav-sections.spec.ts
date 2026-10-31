import {
  isNavCategoryGroupId,
  navCategoryGroupId,
  withCategoryGroups,
  withSectionTitles,
  type GroupableEntry,
  type SectionedEntry,
} from './nav-sections';

const t = (key: string) => `T(${key})`;

describe('withSectionTitles', () => {
  it('titles the first visible root of each area and the first entry of each category', () => {
    const items: (SectionedEntry & { id: string })[] = [
      { id: 'dashboard' },
      { id: 'crm', area: 'commercial', children: [] },
      { id: 'sale', area: 'commercial' },
      {
        id: 'voip',
        area: 'telecom',
        children: [
          { id: 'voip/dashboard' } as SectionedEntry,
          { id: 'voip/did', category: 'numbering' } as SectionedEntry,
          { id: 'voip/portability', category: 'numbering' } as SectionedEntry,
          {
            id: 'voip/pabx',
            category: 'services',
            children: [
              { id: 'voip/pabx/cdr', category: 'reports' } as SectionedEntry,
              { id: 'voip/pabx/parameters', category: 'settings' } as SectionedEntry,
            ],
          } as SectionedEntry,
        ],
      },
    ];

    const result = withSectionTitles(items, t);

    expect(result.map((item) => item.areaTitle)).toEqual([
      undefined,
      'T(nav.area.commercial)',
      undefined,
      'T(nav.area.telecom)',
    ]);
    const voip = result[3].children ?? [];
    expect(voip.map((child) => child.categoryTitle)).toEqual([
      undefined,
      'T(nav.category.numbering)',
      undefined,
      'T(nav.category.services)',
    ]);
    expect(voip[3].children?.map((child) => child.categoryTitle)).toEqual([
      'T(nav.category.reports)',
      'T(nav.category.settings)',
    ]);
  });

  it('moves a title to the next visible entry when the first one is filtered out', () => {
    const visible: SectionedEntry[] = [
      { area: 'telecom', children: [{ category: 'reports' }, { category: 'settings' }] },
    ];
    const [voip] = withSectionTitles(visible, t);
    expect(voip.areaTitle).toBe('T(nav.area.telecom)');
    expect(voip.children?.[0].categoryTitle).toBe('T(nav.category.reports)');
  });

  it('does not mutate the input', () => {
    const items: SectionedEntry[] = [{ area: 'system', children: [{ category: 'access' }] }];
    withSectionTitles(items, t);
    expect(items[0].areaTitle).toBeUndefined();
    expect(items[0].children?.[0].categoryTitle).toBeUndefined();
  });
});

describe('withCategoryGroups', () => {
  type Entry = GroupableEntry & { label?: string; children?: Entry[] };
  const group = (parent: Entry, category: string, children: Entry[]): Entry => ({
    id: navCategoryGroupId(parent.id, category),
    label: `T(${category})`,
    category,
    categoryGroup: true,
    children,
  });

  it('turns categories with 2+ entries into groups and keeps single entries inline', () => {
    const items: Entry[] = [
      { id: 'dashboard' },
      {
        id: 'crm',
        children: [
          { id: 'crm/dashboard' },
          { id: 'crm/leads', category: 'pipeline', categoryTitle: 'Funil' },
          { id: 'crm/opportunities', category: 'pipeline' },
          { id: 'crm/accounts', category: 'registry', categoryTitle: 'Cadastros' },
          { id: 'crm/pipelines', category: 'settings', categoryTitle: 'Config' },
          { id: 'crm/stages', category: 'settings' },
        ],
      },
    ];

    const [dashboard, crm] = withCategoryGroups(items, group);

    expect(dashboard).toEqual({ id: 'dashboard' });
    expect(crm.children?.map((child) => child.id)).toEqual([
      'crm/dashboard',
      'crm/@pipeline',
      'crm/accounts',
      'crm/@settings',
    ]);
    expect(crm.children?.[1].children?.map((child) => child.id)).toEqual([
      'crm/leads',
      'crm/opportunities',
    ]);
    // No category title survives: the group row names the category.
    expect(crm.children?.[2].categoryTitle).toBeUndefined();
    expect(crm.children?.[1].children?.[0].categoryTitle).toBeUndefined();
  });

  it('groups categories inside nested groups too', () => {
    const items: Entry[] = [
      {
        id: 'voip',
        children: [
          { id: 'voip/dashboard' },
          {
            id: 'voip/pabx',
            category: 'services',
            children: [
              { id: 'voip/pabx/a', category: 'registry' },
              { id: 'voip/pabx/b', category: 'registry' },
              { id: 'voip/pabx/cdr', category: 'reports' },
            ],
          },
          { id: 'voip/sbc', category: 'services', children: [{ id: 'x' }, { id: 'y' }] },
        ],
      },
    ];

    const [voip] = withCategoryGroups(items, group);
    const services = voip.children?.[1];
    expect(services?.id).toBe('voip/@services');
    expect(services?.children?.[0].children?.map((child) => child.id)).toEqual([
      'voip/pabx/@registry',
      'voip/pabx/cdr',
    ]);
    expect(isNavCategoryGroupId('voip/pabx/@registry')).toBeTrue();
    expect(isNavCategoryGroupId('voip/pabx')).toBeFalse();
  });

  it('does not mutate the input', () => {
    const items: Entry[] = [
      {
        id: 'm',
        children: [
          { id: 'm/a', category: 'registry' },
          { id: 'm/b', category: 'registry' },
        ],
      },
    ];
    const snapshot = JSON.stringify(items);
    withCategoryGroups(items, group);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
