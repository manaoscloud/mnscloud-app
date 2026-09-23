import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const compile = (path) =>
  ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
const asModule = (source) =>
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const defaults = asModule(compile('src/app/shared/crud/configurable-crud/define-crud.ts'));
const source = compile('src/app/shared/payment/payment-account-crud.ts').replace(
  "'../crud/configurable-crud/define-crud'",
  JSON.stringify(defaults),
);
const { paymentAccountConfig } = await import(asModule(source));
for (const platform of [true, false]) {
  const config = paymentAccountConfig(platform);
  test(`Pay ${platform ? 'platform' : 'tenant'} preserves stored secrets and unknown configuration`, () => {
    const values = {
      ...config.initialValues,
      name: 'Account',
      configJson: '{"custom":"keep"}',
      clientId: '',
      clientSecret: '',
      certPem: '',
      keyPem: '',
    };
    const payload = config.payload(values, true);
    assert.equal(payload.credentials, undefined);
    assert.equal(payload.config.custom, 'keep');
    assert.equal(payload.config.productMethod, 'pay');
    assert.equal(payload.provider, platform ? 'inter_business' : 'pay');
    assert.throws(
      () => config.payload({ ...values, clientId: 'partial' }, true),
      /all credential fields/,
    );
  });
  test(`Pay ${platform ? 'platform' : 'tenant'} switches editing modes without losing input`, () => {
    const values = {
      ...config.initialValues,
      configJson: '{"custom":"keep"}',
      scope: 'new.scope',
      clientId: 'id',
      clientSecret: 'secret',
      certPem: 'cert',
      keyPem: 'key',
    };
    const advanced = config.fieldChange('advanced', true, values);
    assert.equal(JSON.parse(advanced.configJson).scope, 'new.scope');
    const form = config.fieldChange('advanced', false, {
      ...advanced,
      configJson: '{"custom":"keep","scope":"edited"}',
    });
    assert.equal(form.scope, 'edited');
    assert.equal(form.clientSecret, 'secret');
    assert.equal(config.payload(form, true).config.custom, 'keep');
    assert.throws(() =>
      config.fieldChange('advanced', false, { ...advanced, configJson: 'broken' }),
    );
  });
}
