#!/usr/bin/env node
// Form Field Layout Baseline (app.md): app-wide, no allowlist.
//
// Generic CRUD field declarations (`fields: [...]` of defineCrud/ConfigurableCrud configs):
// - single-line controls (inputs, selects, FK selects, dates, status) are `span: 1`;
// - text areas are `span: 4` with the default four rows (no other `rows`);
// - a text area labelled `Notes` lives in the Notes tab (`tab: 'notes'`), unless the line above
//   it says `// notes-tab-exempt: <why>` (for example the only input of an action dialog);
// - a text area labelled `Description` is a business description, never an annotation: it says
//   `// business-description: <why>` on the line above, otherwise use `Notes` in the Notes tab.
// Hand-written page templates: a `mat-form-field`/`mns-*-field` that holds an input or select is
// `span-1`; one that holds a textarea is `span-4`.
//
//   node scripts/validate-crud-fields.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Keep in sync with src/app/shared/crud/configurable-crud/crud-field-layout.ts.
export const SINGLE_LINE_FIELD_TYPES = new Set([
  'text',
  'email',
  'password',
  'number',
  'currency',
  'phone',
  'date',
  'datetime',
  'time',
  'select',
  'search-select',
  'multi-select',
  'status',
]);
const COMPOSITE_FIELD_TYPES = new Set([
  'file',
  'checkbox-group',
  'permission-tree',
  'secret-content',
]);

function literal(node) {
  let current = node;
  while (current && (ts.isAsExpression(current) || ts.isParenthesizedExpression(current))) {
    current = current.expression;
  }
  if (!current) return undefined;
  if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))
    return current.text;
  if (ts.isNumericLiteral(current)) return Number(current.text);
  return undefined;
}

function leadingComments(source, node) {
  return (ts.getLeadingCommentRanges(source, node.getFullStart()) ?? [])
    .map((range) => source.slice(range.pos, range.end))
    .join('\n');
}

/** Field layout violations of one TypeScript source. */
export function findFieldViolations(file, source) {
  if (!/\bkey\s*:/.test(source)) return [];
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const problems = [];
  const report = (node, message) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart());
    problems.push(`${file}:${line + 1}: ${message}`);
  };
  const visit = (node) => {
    if (
      ts.isObjectLiteralExpression(node) &&
      node.parent &&
      ts.isArrayLiteralExpression(node.parent)
    ) {
      const holder =
        node.parent.parent && ts.isPropertyAssignment(node.parent.parent)
          ? node.parent.parent.name.getText()
          : '';
      const props = new Map();
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop)) {
          props.set(prop.name.getText().replace(/['"]/g, ''), prop.initializer);
        }
      }
      const isField =
        props.has('key') &&
        (props.has('label') || props.has('source')) &&
        !props.has('field') &&
        holder !== 'listFilters' &&
        !props.has('typeWhen');
      const type = props.has('type') ? literal(props.get('type')) : 'text';
      if (isField && typeof type === 'string' && !COMPOSITE_FIELD_TYPES.has(type)) {
        const span = props.has('span') ? literal(props.get('span')) : undefined;
        const label = literal(props.get('label'));
        const tab = props.has('tab') ? literal(props.get('tab')) : undefined;
        const comments = leadingComments(source, node);
        if (SINGLE_LINE_FIELD_TYPES.has(type) && props.has('span') && span !== 1) {
          report(node, `${type} field must be span 1 (single-line controls take one column)`);
        }
        if (type === 'textarea') {
          if (props.has('span') && span !== 4) report(node, 'textarea must be span 4 (full row)');
          if (props.has('rows') && literal(props.get('rows')) !== 4) {
            report(node, 'textarea keeps the default four rows (remove rows)');
          }
          if (label === 'Notes' && tab !== 'notes' && !/notes-tab-exempt:\s*\S/.test(comments)) {
            report(node, "Notes textarea belongs in the Notes tab (tab: 'notes')");
          }
          if (label === 'Description' && !/business-description:\s*\S/.test(comments)) {
            report(
              node,
              "annotations are Notes (key 'notes', label 'Notes', tab 'notes'); a business " +
                'description says `// business-description: <why>` on the line above',
            );
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return problems;
}

/** Hand-written page templates: single-line controls span-1, text areas span-4. */
export function findTemplateViolations(file, source) {
  const problems = [];
  const tag =
    /<(mat-form-field|mns-[a-z-]*field)\b[^>]*?\b(?:class|fieldClass)="[^"]*\bspan-([1-4])\b/g;
  let match;
  while ((match = tag.exec(source))) {
    const [, name, span] = match;
    if (/^mns-(secret-content|checkbox-group|permission-tree)-field$/.test(name)) continue;
    const end = name === 'mat-form-field' ? source.indexOf('</mat-form-field>', tag.lastIndex) : -1;
    const body = end > 0 ? source.slice(tag.lastIndex, end) : '';
    const textarea = name === 'mns-textarea-field' || /<textarea\b/.test(body);
    const line = source.slice(0, match.index).split('\n').length;
    if (textarea && span !== '4') problems.push(`${file}:${line}: textarea must be span-4`);
    if (!textarea && span !== '1') {
      problems.push(`${file}:${line}: single-line control must be span-1`);
    }
  }
  return problems;
}

/** Source files under a directory (walked directly: no external command). */
function sourceFiles(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) && !entry.name.endsWith('.spec.ts')
      ? [path]
      : [];
  });
}

function main() {
  const problems = [];
  for (const file of sourceFiles('src/app', ['.ts'])) {
    problems.push(...findFieldViolations(file, readFileSync(file, 'utf8')));
  }
  // The shared CRUD template binds fieldClass(field); signup keeps its own auth-shell layout.
  for (const file of sourceFiles('src/app/pages', ['.html', '.ts'])) {
    if (file.startsWith('src/app/pages/signup/')) continue;
    problems.push(...findTemplateViolations(file, readFileSync(file, 'utf8')));
  }
  if (problems.length) {
    console.error(problems.join('\n'));
    console.error(
      `\n${problems.length} form field layout violation(s). See app.md → Form Field Layout Baseline.`,
    );
    process.exit(1);
  }
  console.log('Form field layout baseline OK.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
