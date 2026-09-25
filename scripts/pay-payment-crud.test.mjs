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
const load = async (path) =>
  import(
    asModule(
      compile(path).replace(
        /'(?:\.\.\/)+shared\/crud\/configurable-crud\/define-crud'/,
        JSON.stringify(defaults),
      ),
    )
  );

const { bankPartnersConfig } = await load(
  'src/app/pages/system/pay/bank-partners/bank-partners-crud.ts',
);
const { paymentGatewayConfig } = await load(
  'src/app/pages/erp/financial/payment/gateway/payment-gateway-crud.ts',
);

test('Pay bank partner (Inter) payload is typed and never carries free-form config', () => {
  const config = bankPartnersConfig;
  const values = {
    ...config.initialValues,
    name: ' Inter principal ',
    accountNumber: '123.456-7',
    autoCancelDays: '15',
    clientId: 'id',
    clientSecret: 'secret',
    certPem: '-----BEGIN CERTIFICATE-----',
    keyPem: '-----BEGIN PRIVATE KEY-----',
  };
  const created = config.payload(values, false);
  assert.deepEqual(Object.keys(created).sort(), [
    'accountNumber',
    'autoCancelDays',
    'credentials',
    'environment',
    'isDefault',
    'name',
    'provider',
    'receiveMethods',
    'status',
  ]);
  assert.equal(created.provider, 'inter_business');
  assert.equal(created.accountNumber, '1234567');
  assert.equal(created.autoCancelDays, 15);
  assert.equal(created.name, 'Inter principal');
  assert.deepEqual(Object.keys(created.credentials).sort(), [
    'certPem',
    'clientId',
    'clientSecret',
    'keyPem',
  ]);
  const fieldKeys = config.fields.map((field) => field.key);
  for (const removed of [
    'advanced',
    'configJson',
    'credentialsJson',
    'apiBaseUrl',
    'tokenUrl',
    'scope',
  ])
    assert.ok(!fieldKeys.includes(removed), removed);
});

test('Pay bank partner edit keeps stored credentials unless all are replaced', () => {
  const config = bankPartnersConfig;
  const values = { ...config.initialValues, name: 'X', accountNumber: '1' };
  const edited = config.payload(values, true);
  assert.equal(edited.credentials, undefined);
  assert.equal(edited.provider, undefined);
  assert.throws(() => config.payload({ ...values, clientId: 'partial' }, true), /together/);
});

test('Tenant gateway preserves stored secrets and unknown configuration', () => {
  const config = paymentGatewayConfig();
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
  assert.equal(payload.provider, 'pay');
  assert.throws(
    () => config.payload({ ...values, clientId: 'partial' }, true),
    /all credential fields/,
  );
});

test('Tenant gateway switches editing modes without losing input', () => {
  const config = paymentGatewayConfig();
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
  assert.throws(() => config.fieldChange('advanced', false, { ...advanced, configJson: 'broken' }));
});
