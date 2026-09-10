#!/usr/bin/env node
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseTemplate } from '@angular/compiler';

const root = process.cwd();
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const files = walk(join(root, 'src/app/pages')).filter((path) =>
  path.endsWith('/dashboard/dashboard.ts'),
);
const errors = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const htmlPath = file.replace(/\.ts$/, '.html');
  const html = existsSync(htmlPath)
    ? readFileSync(htmlPath, 'utf8')
    : source.match(/template:\s*`([\s\S]*?)`/)?.[1] || '';
  const name = relative(root, file);
  const parsed = parseTemplate(html, name);
  for (const error of parsed.errors || []) errors.push(`${name}: ${error.msg}`);
  if ((html.match(/<mns-dashboard-page\b/g) || []).length !== 1)
    errors.push(`${name}: use exactly one shared dashboard shell`);
  for (const binding of ['[loading]', '[error]', '[hasData]', '(refresh)']) {
    if (!html.includes(binding)) errors.push(`${name}: missing ${binding}`);
  }
  if (
    /\b(?:filter-grid|filter-actions)\b|<mat-form-field\b|<mat-select\b|<input\b|<button\b|<app-refresh-button\b|\bmat-(?:stroked|flat|icon)-button\b/.test(
      html,
    )
  ) {
    errors.push(
      `${name}: summary dashboards are refresh-only; management/analysis belongs on a separate route`,
    );
  }
  if (!source.includes('dashboardResource('))
    errors.push(`${name}: use the scoped dashboard read model`);
  if (
    /\b(?:applySearchFilters|clearSearchFilters|applyDashboardFilters|clearDashboardFilters|filterOptionsResource|MatTableDataSource)\b/.test(
      source,
    )
  )
    errors.push(`${name}: remove obsolete filter/CRUD state`);
  if (/\bstyleUrls?\s*:|\bstyles\s*:/.test(source) || existsSync(file.replace(/\.ts$/, '.scss')))
    errors.push(`${name}: reusable presentation belongs in shared styles`);
}
const shell = readFileSync(join(root, 'src/app/shared/dashboard/dashboard-page.ts'), 'utf8');
if (/dashboard-context|Last updated|readonly context|readonly updatedAt/.test(shell))
  errors.push('Dashboard shell must not render a metadata/context strip');
const scaffold = readFileSync(join(root, 'templates/dashboard/page.html'), 'utf8');
if (!scaffold.includes('<mns-dashboard-page'))
  errors.push('Dashboard scaffold must use the shared shell');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `Dashboard contract passed: ${files.length} pages, shared identity, refresh-only, scoped read models.`,
);
