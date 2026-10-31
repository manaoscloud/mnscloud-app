import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readCategoryIcons,
  readRegistry,
  sidebarView,
  validateCategoryIcons,
  validateLabelWidths,
  validateNavigation,
  validateSingleWordGroups,
  validateNavigationAt,
} from './validate-nav-labels.mjs';

const glossary = JSON.parse(
  readFileSync(new URL('../src/app/layout/navigation/nav-glossary.json', import.meta.url), 'utf8'),
);

function check(tree, labels) {
  const dictionaries = {};
  for (const [index, locale] of glossary.locales.entries()) {
    dictionaries[locale] = Object.fromEntries(
      Object.entries(labels).map(([key, values]) => [key, values[index]]),
    );
  }
  return validateNavigation({ items: tree, dictionaries, glossary });
}

const support = (children) => [{ id: 'support', label: 'nav.support', children }];
const leaf = (id) => ({ id, label: `nav.${id.replace(/\//g, '.')}`, route: `/${id}` });
const base = { 'nav.support': ['Suporte', 'Support', 'Soporte'] };

test('the current registry satisfies the contract', () => {
  assert.deepEqual(validateNavigationAt(process.cwd()).errors, []);
});

test('a contextual short label passes', () => {
  const errors = check(support([leaf('support/origins'), leaf('support/teams')]), {
    ...base,
    'nav.support.origins': ['Origens', 'Sources', 'Orígenes'],
    'nav.support.teams': ['Equipes', 'Teams', 'Equipos'],
  });
  assert.deepEqual(errors, []);
});

test('repeating ancestor context fails, including identical child labels', () => {
  const errors = check(support([leaf('support/teams'), leaf('support/list')]), {
    ...base,
    'nav.support.teams': ['Equipes de suporte', 'Support teams', 'Equipos de soporte'],
    'nav.support.list': ['Suporte', 'Support', 'Soporte'],
  });
  assert.equal(errors.filter((e) => e.includes('repeats ancestor context')).length, 6);
});

test('length budget, sentence case and glossary terms are enforced per locale', () => {
  const errors = check(support([leaf('support/a'), leaf('support/dashboard')]), {
    ...base,
    'nav.support.a': ['Prioridades de Chamado longas', 'Ticket Priorities', 'Visão'],
    'nav.support.dashboard': ['Visão geral', 'Dashboard', 'Panel'],
  });
  assert.ok(errors.some((e) => e.includes('[pt-BR]') && e.includes('budget of 22')));
  assert.ok(errors.some((e) => e.includes('[en-US]') && e.includes('sentence case')));
  assert.ok(errors.some((e) => e.includes('"Visão geral" is not a glossary term')));
  assert.ok(errors.some((e) => e.includes('must use the canonical "Painel"')));
});

test('single-child groups, wrong keys, missing translations and orphan keys fail', () => {
  const errors = check(
    [{ id: 'support', label: 'nav.support', children: [{ id: 'support/x', label: 'Teams' }] }],
    { ...base, 'nav.unused': ['A', 'A', 'A'] },
  );
  assert.ok(errors.some((e) => e.includes('at least 2 children')));
  assert.ok(errors.some((e) => e.includes('label must be the key "nav.support.x"')));
  assert.ok(errors.some((e) => e.includes('missing pt-BR translation')));
  assert.ok(errors.some((e) => e.includes('orphan navigation key "nav.unused"')));
});

test('the registry must stay data only', () => {
  assert.throws(
    () => readRegistry("export const NAV_ITEMS = [{ id: 'a', label: t('a') }];"),
    /must be literals/,
  );
});

test('word stems of an ancestor are repetition too (Faturamento › Faturas, Webhosts › Hosts)', () => {
  const tree = [
    {
      id: 'billing',
      label: 'nav.billing',
      children: [leaf('billing/invoices'), leaf('billing/list')],
    },
  ];
  const errors = check(tree, {
    'nav.billing': ['Faturamento', 'Webhosts', 'Facturación'],
    'nav.billing.invoices': ['Faturas', 'Hosts', 'Facturas'],
    'nav.billing.list': ['Lista', 'List', 'Lista'],
  });
  assert.equal(errors.filter((e) => e.includes('repeats ancestor context')).length, 3);
});

test('verbs, English leftovers, first-word case and dashboard position fail', () => {
  const errors = check(support([leaf('support/teams'), leaf('support/dashboard')]), {
    ...base,
    'nav.support.teams': ['Permitir/bloquear', 'reconcile', 'Leads abiertos'],
    'nav.support.dashboard': ['Painel', 'Dashboard', 'Panel'],
  });
  assert.ok(errors.some((e) => e.includes('[pt-BR]') && e.includes('not the action')));
  assert.ok(errors.some((e) => e.includes('[en-US]') && e.includes('upper-case letter')));
  assert.ok(errors.some((e) => e.includes('dashboard entry must be the first child')));
  const english = check(support([leaf('support/teams'), leaf('support/list')]), {
    ...base,
    'nav.support.teams': ['Pools', 'Pools', 'Pools'],
    'nav.support.list': ['Lista', 'List', 'Lista'],
  });
  assert.equal(english.filter((e) => e.includes('English word')).length, 2);
});

// Navigation Structure: area titles of the root modules and category titles inside a module.
const titled = (id, category, extra = {}) => ({ ...leaf(id), category, ...extra });
const structureLabels = {
  ...base,
  'nav.category.operation': ['Operação', 'Operations', 'Operación'],
  'nav.category.settings': ['Configurações', 'Settings', 'Configuración'],
  'nav.category.platform': ['Plataforma', 'Platform', 'Plataforma'],
  'nav.support.a': ['Chamados', 'Tickets', 'Tickets'],
  'nav.support.b': ['Equipes', 'Teams', 'Equipos'],
  'nav.support.c': ['Tipos', 'Types', 'Tipos'],
  'nav.support.d': ['Origens', 'Sources', 'Orígenes'],
  'nav.support.e': ['Servidores', 'Servers', 'Servidores'],
};

test('categories in standard order, in one block each, pass and use their own keys', () => {
  const errors = check(
    support([
      titled('support/a', 'operation'),
      titled('support/b', 'settings'),
      titled('support/c', 'settings'),
      titled('support/d', 'settings'),
      titled('support/e', 'platform', { route: undefined, masterRoute: '/system/e' }),
    ]),
    structureLabels,
  );
  assert.deepEqual(errors, []);
});

test('split, out-of-order, unknown and late-uncategorized categories fail', () => {
  const errors = check(
    support([
      titled('support/a', 'settings'),
      titled('support/b', 'operation'),
      titled('support/c', 'settings'),
      leaf('support/d'),
      titled('support/e', 'nope'),
    ]),
    structureLabels,
  );
  assert.ok(errors.some((e) => e.includes('out of the standard order')));
  assert.ok(errors.some((e) => e.includes('is split')));
  assert.ok(errors.some((e) => e.includes('go before the first category title')));
  assert.ok(errors.some((e) => e.includes('unknown category "nope"')));
});

test('platform holds master-only entries and small lists only use resale/platform', () => {
  const errors = check(
    support([titled('support/a', 'operation'), titled('support/e', 'platform')]),
    structureLabels,
  );
  assert.ok(errors.some((e) => e.includes('only uses the resale/platform categories')));
  assert.ok(errors.some((e) => e.includes('platform category holds only master-only entries')));
});

test('a category title is ancestor context of its entries and needs translations', () => {
  const errors = check(
    support([
      titled('support/a', 'settings'),
      titled('support/b', 'settings'),
      titled('support/c', 'settings'),
      titled('support/d', 'settings'),
      titled('support/e', 'operation'),
    ]),
    {
      ...Object.fromEntries(
        Object.entries(structureLabels).filter(([key]) => key !== 'nav.category.operation'),
      ),
      'nav.support.a': ['Configurações gerais', 'General settings', 'Configuración general'],
    },
  );
  assert.ok(errors.some((e) => e.includes('support/a') && e.includes('repeats ancestor context')));
  assert.ok(
    errors.some((e) => e.includes('missing pt-BR translation for "nav.category.operation"')),
  );
});

test('root modules need an area after the first one, in area order, never split', () => {
  const root = (id, area) => ({ id, label: `nav.${id}`, route: `/${id}`, area });
  const labels = {
    'nav.dashboard': ['Painel', 'Dashboard', 'Panel'],
    'nav.crm': ['CRM', 'CRM', 'CRM'],
    'nav.voip': ['VoIP', 'VoIP', 'VoIP'],
    'nav.area.commercial': ['Comercial', 'Commercial', 'Comercial'],
    'nav.area.telecom': ['Telecom', 'Telecom', 'Telecom'],
  };
  assert.deepEqual(
    check(
      [
        { id: 'dashboard', label: 'nav.dashboard', route: '/' },
        root('crm', 'commercial'),
        root('voip', 'telecom'),
      ],
      labels,
    ),
    [],
  );
  const errors = check(
    [
      { id: 'dashboard', label: 'nav.dashboard', route: '/' },
      root('voip', 'telecom'),
      root('crm', 'commercial'),
      root('hr'),
    ],
    { ...labels, 'nav.hr': ['Pessoal', 'People', 'Personal'] },
  );
  assert.ok(errors.some((e) => e.includes('crm') && e.includes('out of order')));
  assert.ok(errors.some((e) => e.includes('hr: root modules after the first need an area')));
});

test('every category has one group icon and no icon is orphan', () => {
  const glossary = { categories: { standard: ['registry'], domain: ['pipeline'] } };
  assert.deepEqual(
    validateCategoryIcons({ registry: 'folder_open', pipeline: 'filter_alt' }, glossary),
    [],
  );
  const errors = validateCategoryIcons({ registry: 'folder_open', extra: 'x' }, glossary);
  assert.equal(errors.length, 2);
  assert.match(errors[0], /pipeline/);
  assert.match(errors[1], /extra/);
  assert.deepEqual(
    readCategoryIcons("export const NAV_CATEGORY_ICONS: Record<string, string> = { a: 'b' };"),
    { a: 'b' },
  );
});

const tinyGlossary = { locales: ['pt-BR'] };
const tree = [
  {
    id: 'm',
    label: 'nav.m',
    children: [
      { id: 'm/a', label: 'nav.m.a', category: 'people' },
      { id: 'm/b', label: 'nav.m.b', category: 'people' },
      { id: 'm/c', label: 'nav.m.c', category: 'settings' },
      { id: 'm/g', label: 'nav.m.g', children: [{ id: 'm/g/x', label: 'nav.m.g.x' }] },
    ],
  },
];

test('sidebarView groups categories with 2+ entries like the shell', () => {
  const [m] = sidebarView(tree);
  assert.deepEqual(
    m.children.map((child) => child.id),
    ['m/@people', 'm/c', 'm/g'],
  );
  assert.equal(m.children[0].label, 'nav.category.people');
});

test('rows that open a group are one word in every locale', () => {
  const dict = {
    'nav.category.people': 'Pessoas e empresas',
    'nav.m.g': 'Bancos de dados',
    'nav.m': 'Recursos humanos',
  };
  const errors = validateSingleWordGroups({
    items: tree,
    dictionaries: { 'pt-BR': dict },
    glossary: tinyGlossary,
  });
  assert.equal(errors.length, 2);
  assert.match(errors[0], /Pessoas e empresas/);
  assert.match(errors[1], /Bancos de dados/);
});

test('a label wider than its sidebar row fails, a short one passes', () => {
  const widths = {
    safetyPx: 2,
    sidebar: {
      width: 260,
      reserve: 13,
      fontPx: 10,
      rowChrome: 56,
      chevron: 20,
      countMargin: 8,
      countDigitPx: 6.5,
      wrappers: { children: 21, category: 13, grand: 29, great: 21 },
    },
    flyout: { width: 234, reserve: 12, fontPx: 10, rowChrome: 60.8, chevron: 32 },
    glyphs500: { a: 1 },
    glyphs400: { a: 0.1 },
  };
  const dict = (people) => ({
    'nav.m': 'a',
    'nav.m.a': 'a',
    'nav.m.b': 'a',
    'nav.m.c': 'a',
    'nav.m.g': 'a',
    'nav.m.g.x': 'a',
    'nav.category.people': people,
  });
  const run = (people) =>
    validateLabelWidths({
      items: tree,
      dictionaries: { 'pt-BR': dict(people) },
      glossary: tinyGlossary,
      widths,
    });
  // Category row: 260 - 13 - 21 - 56 - 20 - 8 - 6.5 = 135.5px; 13 glyphs = 130px + 2 fits, 14 do not.
  assert.deepEqual(run('a'.repeat(13)), []);
  const errors = run('a'.repeat(14));
  assert.equal(errors.length, 1);
  assert.match(errors[0], /m\/@people: .* needs 140px but the sidebar row has 135px/);
});
