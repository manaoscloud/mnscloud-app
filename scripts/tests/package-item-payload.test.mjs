import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function extractPackageItemPayload() {
  const path = 'src/app/pages/billing/system/packages/packages.ts';
  const code = fs.readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);

  let payloadFn = null;
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'payload') {
      const keyProp = node.parent.properties.find(
        (prop) => prop.name?.getText(source) === 'key',
      );
      if (keyProp?.initializer?.text === 'packageItems') {
        const numberOrNull = (value) => {
          if (value === null || value === undefined || value === '') return null;
          const parsed = Number(value);
          return Number.isNaN(parsed) ? null : parsed;
        };
        payloadFn = Function(
          'numberOrNull',
          `return (${node.initializer.getText(source)})`,
        )(numberOrNull);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return payloadFn;
}

test('packageItems related collection preserves productUUID and item fields in payload', () => {
  const payloadFn = extractPackageItemPayload();
  assert.ok(payloadFn, 'packageItems payload function must be extractable from packages.ts');

  // Case 1: Values mapped by buildPayload() to payloadKey ('productUUID')
  // This reproduces the exact scenario of Ticket TKT-4PHY-2LME-37QM where
  // the user selects "MÓDULO - POS" (UUID) in the product selector.
  const payloadFromBuildPayload = payloadFn({
    productUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    entitlementCode: 'module.pos.*',
    includedQuantity: -1,
    required: 1,
  });

  assert.deepEqual(payloadFromBuildPayload, {
    productUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    entitlementCode: 'module.pos.*',
    includedQuantity: -1,
    required: 1,
    status: 1,
  });

  // Case 2: Values with custom positive quantity and no entitlement override
  const payloadWithPositiveQty = payloadFn({
    productUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    entitlementCode: null,
    includedQuantity: 10,
    required: 0,
  });

  assert.deepEqual(payloadWithPositiveQty, {
    productUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    entitlementCode: null,
    includedQuantity: 10,
    required: 0,
    status: 1,
  });

  // Case 3: Raw values using field keys ('itemProductUUID')
  const payloadFromFieldKeys = payloadFn({
    itemProductUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    itemEntitlementCode: '',
    itemIncludedQuantity: -1,
    itemRequired: 1,
  });

  assert.deepEqual(payloadFromFieldKeys, {
    productUUID: '0192e2b3-7649-7c85-b9aa-33e1d683a48e',
    entitlementCode: null,
    includedQuantity: -1,
    required: 1,
    status: 1,
  });
});
