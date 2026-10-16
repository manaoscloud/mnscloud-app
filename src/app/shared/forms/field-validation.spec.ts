import { apiErrorFields } from '../../services/api-error-fields';
import {
  FieldRules,
  FlagErrorStateMatcher,
  fieldFocusTarget,
  focusFirstInvalidField,
  invalidFieldsToast,
  isBlankFieldValue,
  missingFieldsToast,
  signalFieldErrorKey,
} from './field-validation';

function nextFrames(count = 3): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => (left ? requestAnimationFrame(() => step(left - 1)) : resolve());
    step(count);
  });
}

describe('Required field feedback helpers', () => {
  it('treats null, blank text and empty lists as missing, keeping 0 and false as values', () => {
    expect(isBlankFieldValue(null)).toBeTrue();
    expect(isBlankFieldValue(undefined)).toBeTrue();
    expect(isBlankFieldValue('   ')).toBeTrue();
    expect(isBlankFieldValue([])).toBeTrue();
    expect(isBlankFieldValue(0)).toBeFalse();
    expect(isBlankFieldValue(false)).toBeFalse();
    expect(isBlankFieldValue('x')).toBeFalse();
  });

  it('names the first missing field and counts the others', () => {
    expect(missingFieldsToast(['Name'])).toEqual({
      key: 'form.validation.missingOne',
      params: { field: 'Name' },
    });
    expect(missingFieldsToast(['Name', 'Host', 'Port'])).toEqual({
      key: 'form.validation.missingMany',
      params: { field: 'Name', count: 2 },
    });
    expect(invalidFieldsToast(['E-mail', 'Phone']).key).toBe('form.validation.checkMany');
  });

  it('turns the error state on from a flag, without a form control', () => {
    let invalid = false;
    const matcher = new FlagErrorStateMatcher(() => invalid);
    expect(matcher.isErrorState(null, null)).toBeFalse();
    invalid = true;
    expect(matcher.isErrorState(null, null)).toBeTrue();
  });

  it('reads only identifier-like field names from an API validation failure', () => {
    expect(apiErrorFields({ error: { fields: ['name', 'config.host', 'name'] } })).toEqual([
      'name',
      'config.host',
    ]);
    expect(apiErrorFields({ error: { fields: ['"]<x>', 3, 'ok'] } })).toEqual(['ok']);
    expect(apiErrorFields({ error: { error: 'Name is required.' } })).toEqual([]);
    expect(apiErrorFields(null)).toEqual([]);
  });

  it('maps signal-forms errors to translated message keys', () => {
    expect(signalFieldErrorKey([])).toBe('');
    expect(signalFieldErrorKey([{ kind: 'required' }])).toBe('form.validation.required');
    expect(signalFieldErrorKey([{ kind: 'email' }])).toBe('form.validation.email');
    expect(signalFieldErrorKey([{ kind: 'pattern' }])).toBe('form.validation.invalid');
  });

  it('marks plain signal fields only after a save attempt', () => {
    let to = '';
    const rules = new FieldRules({ to: () => !!to.trim() });
    expect(rules.invalid('to')).toBeFalse();
    expect(rules.check()).toBeFalse();
    expect(rules.invalid('to')).toBeTrue();
    to = 'a@b.c';
    expect(rules.invalid('to')).toBeFalse();
    expect(rules.check()).toBeTrue();
  });

  it('focuses the control inside a field marker, waiting for the first key to render', async () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-field-key="other"><input id="other" /></div>
      <mns-search-select-field data-field-key="plan">
        <div role="combobox" tabindex="0" id="plan"></div>
      </mns-search-select-field>`;
    document.body.appendChild(root);
    try {
      expect(fieldFocusTarget(root, 'plan')?.id).toBe('plan');

      // The first key renders late (tab switch): it still wins over an already rendered key.
      const late = document.createElement('div');
      focusFirstInvalidField(() => [root], ['late', 'other']);
      await nextFrames(2);
      late.setAttribute('data-field-key', 'late');
      late.innerHTML = '<input id="late" />';
      root.appendChild(late);
      await nextFrames(4);
      expect(document.activeElement?.id).toBe('late');
    } finally {
      root.remove();
    }
  });
});
