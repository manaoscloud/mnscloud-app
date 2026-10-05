import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRegistry, validateNavigation, validateNavigationAt } from './validate-nav-labels.mjs';

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
