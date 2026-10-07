import { CRM_OPTIONS } from '../../src/app/pages/crm/crm-options.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { crmPayload, crmLocalDate, crmLocalTime } from '../../src/app/pages/crm/crm-input.ts';

function formConfigs() {
  return [...fs.globSync('src/app/pages/crm/*/*.ts')].flatMap((path) => {
    const source = ts.createSourceFile(
      path,
      fs.readFileSync(path, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const results = [];
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'defineCrud') {
        results.push({
          path,
          config: Function(
            'defineCrud',
            'crmActions',
            'crmPayload',
            'crmLocalDate',
            'crmLocalTime',
            'CRM_OPTIONS',
            `return ${node.arguments[0].getText(source)}`,
          )(
            (v) => v,
            () => [],
            crmPayload,
            crmLocalDate,
            crmLocalTime,
            CRM_OPTIONS,
          ),
        });
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    return results;
  });
}

test('every CRM form follows semantic controls, notes, widths and commercial defaults', () => {
  const configs = formConfigs();
  assert.equal(configs.length, 14);
  for (const { path, config } of configs) {
    const record = config.fields.filter((f) => !f.hidden && (!f.tab || f.tab === 'record'));
    assert.equal(record[0].type, 'status', `${path}: status first`);
    for (const field of config.fields) {
      const context = `${path}: ${field.key}`;
      if (field.hidden) continue;
      assert.notEqual(field.type, 'datetime', `${context}: datepicker and separate time required`);
      if (field.required && field.requiredWhen)
        assert.ok(field.requiredWhen({ values: {} }), context);
      if (field.source?.endsWith('Name')) assert.equal(field.span, 2, context);
      if (field.source?.endsWith('Notes')) {
        assert.equal(field.key, 'notes', context);
        assert.equal(field.tab, 'notes', context);
      }
      if (field.type === 'textarea') {
        assert.equal(field.span, 4, context);
        assert.equal(field.rows, 4, context);
      }
      if (field.source?.endsWith('Phone')) assert.equal(field.type, 'phone', context);
      if (field.type === 'currency' && field.currencyKey) {
        assert.ok(config.defaultCurrencyFields.includes(field.currencyKey), context);
      }
      if (field.type === 'time') {
        const date = config.fields.find((f) => f.key === field.source);
        assert.equal(date?.type, 'date', context);
        assert.ok(field.requiredWhen({ values: { [date.key]: '2099-05-17' } }), context);
      }
    }
  }
});

test('CRM notes retain existing wire keys and edit revisions', () => {
  for (const { config } of formConfigs()) {
    const notes = config.fields.find((f) => f.key === 'notes');
    if (!notes) continue;
    assert.equal(notes.payloadKey, notes.source);
    assert.equal(config.initialValues.notes, '');
    const revision = config.uuidField.slice(0, 3) + 'Revision';
    const payload = config.payload(
      { [notes.payloadKey]: 'Line one\nLine two', [revision]: 3 },
      true,
    );
    assert.equal(payload[notes.source], 'Line one\nLine two');
    assert.equal(payload[revision], 3);
  }
});

test('calendar/time pair round-trips local instants, clears both and rejects invalid dates', () => {
  const instant = '2099-05-17T15:42:00.000Z';
  const values = {
    When: crmLocalDate(instant),
    WhenTime: crmLocalTime(instant),
    Revision: 1,
    CopCurrency: ' usd ',
  };
  const payload = crmPayload(values, false, 'Revision', [], ['When']);
  assert.equal(payload.When, instant);
  assert.equal(payload.CopCurrency, 'USD');
  assert.ok(!('WhenTime' in payload));
  assert.ok(!('Revision' in payload));
  assert.equal(crmPayload({ When: '', WhenTime: '' }, false, 'Revision', [], ['When']).When, null);
  for (const [date, time] of [
    ['2099-02-30', '10:00'],
    ['2099-05-17', '25:00'],
    ['', '10:00'],
    ['2099-05-17', ''],
  ]) {
    assert.throws(
      () => crmPayload({ When: date, WhenTime: time }, false, 'Revision', [], ['When']),
      /CRM_INVALID_DATE/,
    );
  }
});
