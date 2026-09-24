import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fieldViolations,
  registryEntries,
  templateViolations,
} from './validate-crud-fk-quick-create.mjs';

const registry = new Set(['CustomerCusUUID']);

test('registered FK source passes and unregistered FK source fails', () => {
  const source = `const fields = [
    { key: 'customerUUID', source: 'CustomerCusUUID', label: 'Customer', type: 'search-select' },
    { key: 'serverUUID', source: 'VoipPabxServerVpsUUID', label: 'Server', type: 'search-select' },
  ];`;
  const violations = fieldViolations(source, registry);
  assert.deepEqual(
    violations.map((violation) => violation.key),
    ['serverUUID'],
  );
});

test('explicit binding passes; exemption requires a reason', () => {
  const source = `const fields = [
    { key: 'pabxUUID', source: 'pabxUUID', type: 'search-select', quickCreate: quickCreateFor('VoipPabxAccountVpaUUID') },
    { key: 'tenantUUID', source: 'UserUsrUUID', type: 'search-select', quickCreate: false },
    { key: 'userUUID', source: 'userUUID', type: 'search-select', quickCreate: false, quickCreateExemptReason: 'Invited' },
  ];`;
  const violations = fieldViolations(source, registry);
  assert.deepEqual(
    violations.map((violation) => [violation.key, violation.message]),
    [['tenantUUID', 'quickCreate: false requires quickCreateExemptReason']],
  );
});

test('list filters and non-FK selects are ignored', () => {
  const source = `const config = {
    listFilters: [{ key: 'serverUUID', label: 'Server', type: 'search-select', span: 1 }],
    fields: [
      { key: 'timezone', source: 'VpaTimezone', type: 'search-select', options: timezones },
    ],
  };
  this.listFilterValue({ key: 'pabxUUID', label: 'PABX', type: 'search-select' });`;
  assert.deepEqual(fieldViolations(source, registry), []);
});

test('hand-written FK search select needs canCreate or an exemption', () => {
  const html = `
    <mns-search-select-field [field]="form.customerUUID" [options]="customers()" />
    <mns-search-select-field [field]="form.supplierUUID" [canCreate]="true" />
    <mns-search-select-field [value]="view().selected?.uuid ?? ''" />`;
  assert.deepEqual(
    templateViolations(html).map((violation) => violation.key),
    ['form.customerUUID'],
  );
});

test('registry entries expose key, lazy import path and page class', () => {
  const source = `export const QUICK_CREATE_REGISTRY = {
  CustomerCusUUID: {
    label: 'Create customer',
    loadComponent: () =>
      import('../../../pages/erp/customer/customer').then((m) => m.ErpCustomerPage),
    permission: MASTER_PERMISSION,
  },
};`;
  assert.deepEqual(registryEntries(source), [
    {
      key: 'CustomerCusUUID',
      importPath: '../../../pages/erp/customer/customer',
      exportName: 'ErpCustomerPage',
    },
  ]);
});
