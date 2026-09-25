import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function missingKeys(keys, dictionaries) {
  return Object.entries(dictionaries).flatMap(([lang, dict]) =>
    [...keys].filter((key) => !Object.hasOwn(dict, key)).map((key) => `${lang}: ${key}`),
  );
}
export function visibleKeys(source) {
  return new Set([
    ...[...source.matchAll(/(?:label|pageTitle|hint)\s*:\s*'([^']+)'/g)].map((m) => m[1]),
    ...[...source.matchAll(/\.t\(\s*'([^']+)'/g)].map((m) => m[1]),
    ...[
      ...source.matchAll(
        /\['[a-zA-Z]+',\s*'([^']+)',\s*'(?:text|password|secret-content|select)'\]/g,
      ),
    ].map((m) => m[1]),
  ]);
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dicts = Object.fromEntries(
    ['pt-BR', 'en-US', 'es-ES'].map((lang) => [
      lang,
      JSON.parse(readFileSync(`public/i18n/${lang}.json`, 'utf8')),
    ]),
  );
  const menu = readFileSync('src/app/layout/main-layout/main-layout.ts', 'utf8');
  const source =
    menu +
    readFileSync('src/app/services/paginator-intl.service.ts', 'utf8') +
    readFileSync('src/app/pages/system/pay/bank-partners/bank-partners-crud.ts', 'utf8') +
    readFileSync('src/app/pages/erp/financial/payment/gateway/payment-gateway-crud.ts', 'utf8');
  const keys = visibleKeys(source);
  for (const key of [
    'System',
    'Pay',
    'Erp',
    'Financial',
    'Invoicing',
    'Boletos',
    'Payment Gateway',
    'Fee Plans',
    'Fee Plan Assignments',
    'Fee Accruals',
  ])
    keys.add(key);
  for (const key of [
    ...readFileSync('src/app/shared/payment/pay-error.ts', 'utf8').matchAll(
      /['"]?PAY_[A-Z_]+['"]?:\s*['"]([^'"]+)['"]/g,
    ),
  ].map((m) => m[1]))
    keys.add(key);
  const missing = missingKeys(keys, dicts);
  if (missing.length) {
    console.error(missing.join('\n'));
    process.exitCode = 1;
  } else
    console.log(`Menu, paginator and dynamic field translations: ${keys.size} keys × 3 languages.`);
}
