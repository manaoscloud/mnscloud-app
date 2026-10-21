import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  brandColor,
  onBrandColor,
  loginText,
  safeAppearanceUrl,
} from '../../src/app/shared/auth-shell/login-appearance.ts';
test('custom brand colors retain readable button foregrounds', () => {
  assert.equal(onBrandColor('#ffffff'), '#101828');
  assert.equal(onBrandColor('#000000'), '#ffffff');
  assert.equal(brandColor('var(--injected)'), '#1264ed');
});
test('text uses only the selected language; empty copy falls back to the product', () => {
  const config = { texts: { 'pt-BR': { title: 'Equipe' }, 'en-US': { title: '' } } };
  assert.equal(loginText(config, 'pt-BR', 'title'), 'Equipe');
  assert.equal(loginText(config, 'en-US', 'title'), null);
  assert.equal(loginText(config, 'es-ES', 'title'), null);
});
test('appearance links reject executable schemes, user info and insecure origins', () => {
  for (const value of [
    'javascript:alert(1)',
    '//example.com',
    'http://example.com',
    'https://user:secret@example.com',
  ])
    assert.equal(safeAppearanceUrl(value), null);
  assert.equal(safeAppearanceUrl('https://example.com/help'), 'https://example.com/help');
});
