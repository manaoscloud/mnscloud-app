import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

export function classifyCrud(ts, html = '') {
  if (!ts.includes('@Component')) return null;
  if (/extends\s+ConfigurableCrudPageBase\b/.test(ts)) return 'generic';
  if (
    /MatTableDataSource/.test(ts) ||
    (/mat-table/.test(html + ts) && /erp-page|startEdit|openEdit|FormDialog/.test(html + ts))
  )
    return 'legacy';
  return null;
}
export function directoryCrud(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((n) => n.endsWith('.ts'))
    .flatMap((name) => {
      const path = join(directory, name);
      if (!statSync(path).isFile()) return [];
      const ts = readFileSync(path, 'utf8');
      const template = ts.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/);
      const target = template && resolve(directory, template[1]);
      const html = target && existsSync(target) ? readFileSync(target, 'utf8') : '';
      const kind = classifyCrud(ts, html);
      return kind ? [{ path, kind }] : [];
    });
}
export function assertCrudTargets(targets, root = process.cwd()) {
  const directories = new Set();
  function walk(path) {
    if (!existsSync(path)) throw new Error(`CRUD target does not exist: ${path}`);
    if (statSync(path).isFile()) {
      directories.add(dirname(path));
      return;
    }
    directories.add(path);
    for (const item of readdirSync(path, { withFileTypes: true }))
      if (item.isDirectory()) walk(join(path, item.name));
  }
  for (const target of targets) walk(resolve(root, target));
  const components = [...directories].flatMap(directoryCrud);
  if (!components.length)
    throw new Error('No CRUD components were recognized; validation cannot pass without coverage.');
  const legacy = components.filter((c) => c.kind === 'legacy');
  if (legacy.length)
    throw new Error(
      'CRUD/list components must extend ConfigurableCrudPageBase and use the shared template:\n' +
        legacy.map((c) => c.path).join('\n'),
    );
  for (const { path } of components) {
    const source = readFileSync(path, 'utf8');
    if (
      !/templateUrl\s*:\s*['"][^'"]*configurable-crud-page\.html['"]/.test(source) ||
      !/styleUrls\s*:\s*\[\s*['"][^'"]*configurable-crud-page\.scss['"]\s*\]/.test(source)
    )
      throw new Error(`CRUD must reuse the shared HTML and SCSS: ${path}`);
  }
  return components;
}
