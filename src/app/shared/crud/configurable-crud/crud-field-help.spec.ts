import { resolveCrudFieldHelp } from './crud-field-help';

describe('Global CRUD field guidance', () => {
  const translate = (key: string) => `translated:${key}`;
  it('translates static guidance without putting it in form values', () => {
    const values = { name: 'Unchanged' };
    expect(
      resolveCrudFieldHelp({ help: 'About this field' }, { editing: false, values }, translate),
    ).toBe('translated:About this field');
    expect(values).toEqual({ name: 'Unchanged' });
  });
  it('preserves edit-only secret guidance and suppresses static text on an empty conditional result', () => {
    const field = {
      help: 'Fallback',
      helpWhen: ({ editing }: { editing: boolean }) => (editing ? 'Keep stored credentials' : ''),
    };
    expect(resolveCrudFieldHelp(field, { editing: false, values: {} }, translate)).toBe('');
    expect(resolveCrudFieldHelp(field, { editing: true, values: {} }, translate)).toBe(
      'translated:Keep stored credentials',
    );
  });
  it('recomputes provider guidance from the current editor values', () => {
    const field = {
      helpWhen: ({ values }: { values: Record<string, unknown> }) =>
        values['provider'] === 'first' ? 'First provider' : 'Second provider',
    };
    expect(
      resolveCrudFieldHelp(field, { editing: false, values: { provider: 'first' } }, translate),
    ).toBe('translated:First provider');
    expect(
      resolveCrudFieldHelp(field, { editing: false, values: { provider: 'second' } }, translate),
    ).toBe('translated:Second provider');
    expect(resolveCrudFieldHelp({}, { editing: false, values: {} }, translate)).toBe('');
  });
});
