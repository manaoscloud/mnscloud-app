import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';

function resolveNextVersion(versions) {
  const code = `
const versions = Deno.args.filter(Boolean);
const parse = (value) => {
  const match = value.match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(\`invalid semantic version: \${value}\`);
  return match.slice(1, 4).map(Number);
};
const highest = versions.map((value) => ({ value, parts: parse(value) })).sort((a, b) =>
  b.parts[0] - a.parts[0] || b.parts[1] - a.parts[1] || b.parts[2] - a.parts[2],
)[0];
const [major, minor, patch] = highest.parts;
if (patch >= 999) {
  console.log(\`\${major}.\${minor + 1}.0\`);
} else {
  console.log(\`\${major}.\${minor}.\${patch + 1}\`);
}
`;
  return execFileSync('deno', ['eval', code, ...versions], { encoding: 'utf8' }).trim();
}

test('patch increments normally when patch is less than 999', () => {
  assert.equal(resolveNextVersion(['0.1.992', '0.1.993']), '0.1.994');
  assert.equal(resolveNextVersion(['0.1.998']), '0.1.999');
});

test('patch >= 999 rolls over to next minor and resets patch to 0', () => {
  assert.equal(resolveNextVersion(['0.1.999']), '0.2.0');
  assert.equal(resolveNextVersion(['0.1.594', '0.1.999']), '0.2.0');
  assert.equal(resolveNextVersion(['0.2.999']), '0.3.0');
});

test('version progression continues smoothly after rollover', () => {
  assert.equal(resolveNextVersion(['0.2.0']), '0.2.1');
  assert.equal(resolveNextVersion(['0.2.0', '0.1.999']), '0.2.1');
  assert.equal(resolveNextVersion(['0.2.1']), '0.2.2');
});
