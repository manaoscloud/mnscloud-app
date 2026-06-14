#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const targets = process.argv.slice(2).filter((arg) => arg !== '--strict');
const strict = process.argv.includes('--strict');
const roots = targets.length ? targets : ['src/app', 'templates'];

function walk(target) {
  const full = resolve(root, target);
  if (!existsSync(full)) return [];
  const stat = statSync(full);
  if (stat.isFile()) return [full];
  return readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const path = join(full, entry.name);
    if (entry.isDirectory()) return walk(path);
    return [path];
  });
}

const hardChecks = [
  ['legacy structural directive', ['.html'], /\*ngIf|\*ngFor|\*ngSwitch/],
  ['decorator input/output/query', ['.ts'], /@Input\(|@Output\(|@ViewChild\b|@ViewChildren\b/],
  ['manual change detection', ['.ts'], /ChangeDetectorRef|\bdetectChanges\s*\(/],
  ['explicit OnPush change detection', ['.ts'], /ChangeDetectionStrategy\.OnPush/],
  [
    'old animation package',
    ['.ts', '.json'],
    /@angular\/animations|provideAnimations|animations:\s*\[/,
  ],
  [
    'legacy translation layer',
    ['.ts', '.html', '.json'],
    /ngx-translate|TranslateService|TranslateModule|\|\s*t\b/,
  ],
  [
    'constructor dependency injection',
    ['.ts'],
    /constructor\s*\([^)]*(private|public|protected|readonly)\s+/s,
  ],
  ['RouterTestingModule residue', ['.ts'], /RouterTestingModule/],
  ['direct observable subscription', ['.ts'], /\.subscribe\s*\(/],
];

const hardCheckAllowedFiles = new Map([
  [
    'direct observable subscription',
    new Set([
      'src/app/shared/dialog/dialog-events.util.ts',
      'src/app/pages/voip/pabx/media-files/media-files.ts',
    ]),
  ],
]);

const migrationChecks = [
  [
    'component lifecycle hook',
    ['.ts'],
    /\bimplements\s+(?:OnInit|AfterViewInit|OnDestroy)\b|\bngOnInit\s*\(|\bngAfterViewInit\s*\(|\bngOnDestroy\s*\(/,
  ],
  [
    'Reactive Forms usage',
    ['.ts'],
    /ReactiveFormsModule|FormBuilder|FormGroup|FormControl|FormArray|Validators/,
  ],
  ['manual list loader', ['.ts'], /\bloadItems\s*\(|\bload[A-Z][A-Za-z0-9]*\s*\(\)\s*\{/],
];

function applies(file, extensions) {
  return extensions.includes(extname(file));
}

function scan(files, checks) {
  const findings = [];
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const [name, extensions, pattern] of checks) {
      if (!applies(file, extensions)) continue;
      if (name === 'manual change detection' && file.endsWith('.spec.ts')) continue;
      const allowedFiles = hardCheckAllowedFiles.get(name);
      if (allowedFiles?.has(relative(root, file))) continue;
      const firstAngularDecorator = ['@Component', '@Directive', '@Pipe', '@Injectable']
        .map((marker) => content.indexOf(marker))
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0];
      const searchable =
        name === 'constructor dependency injection' && firstAngularDecorator !== undefined
          ? content.slice(firstAngularDecorator)
          : content;
      const matches = searchable.match(pattern);
      if (matches) findings.push({ file, name });
    }
  }
  return findings;
}

function printFindings(title, findings) {
  if (!findings.length) return;
  console.error(`\n${title}`);
  for (const finding of findings) {
    console.error(`  ${relative(root, finding.file)}: ${finding.name}`);
  }
}

const files = roots
  .flatMap(walk)
  .filter((file) => ['.ts', '.html', '.json'].includes(extname(file)));
const hardFindings = scan(files, hardChecks);
const migrationFindings = scan(files, migrationChecks);

printFindings('Angular baseline violations', hardFindings);

if (strict) {
  printFindings('Angular migration backlog', migrationFindings);
}

if (hardFindings.length || (strict && migrationFindings.length)) {
  process.exit(1);
}

console.log(
  `Angular baseline check passed for ${roots.join(', ')}${
    migrationFindings.length ? ` (${migrationFindings.length} migration backlog item(s))` : ''
  }.`,
);
