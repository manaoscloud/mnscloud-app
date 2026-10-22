import type { MnsSearchSelectFieldOption } from '../forms/mns-search-select-field/mns-search-select-field';
import { CANONICAL_TIMEZONES, buildTimezoneOptions } from './timezones';

describe('timezones', () => {
  it('contains valid IANA timezones recognized by Intl', () => {
    for (const option of CANONICAL_TIMEZONES) {
      expect(typeof option.value).toBe('string');
      expect((option.value as string).length).toBeGreaterThan(0);
      expect(() => {
        new Intl.DateTimeFormat('en-US', { timeZone: option.value as string }).format(new Date());
      }).not.toThrow();
    }
  });

  it('has unique timezone values without duplicates', () => {
    const values = CANONICAL_TIMEZONES.map((opt: MnsSearchSelectFieldOption) => opt.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('includes key reference timezones', () => {
    const values = new Set(CANONICAL_TIMEZONES.map((opt: MnsSearchSelectFieldOption) => opt.value));
    expect(values.has('UTC')).toBeTrue();
    expect(values.has('America/Sao_Paulo')).toBeTrue();
    expect(values.has('America/Manaus')).toBeTrue();
    expect(values.has('America/Belem')).toBeTrue();
    expect(values.has('America/Fortaleza')).toBeTrue();
    expect(values.has('America/Recife')).toBeTrue();
    expect(values.has('America/Cuiaba')).toBeTrue();
    expect(values.has('America/Rio_Branco')).toBeTrue();
    expect(values.has('America/New_York')).toBeTrue();
    expect(values.has('America/Chicago')).toBeTrue();
    expect(values.has('America/Los_Angeles')).toBeTrue();
    expect(values.has('Pacific/Honolulu')).toBeTrue();
    expect(values.has('Europe/Lisbon')).toBeTrue();
    expect(values.has('Europe/London')).toBeTrue();
    expect(values.has('Europe/Madrid')).toBeTrue();
    expect(values.has('Europe/Paris')).toBeTrue();
    expect(values.has('Europe/Berlin')).toBeTrue();
  });

  it('builds options with fallback label as empty string value', () => {
    const options = buildTimezoneOptions({ fallbackLabel: 'Master timezone' });
    expect(options[0].value).toBe('');
    expect(options[0].label).toBe('Master timezone');
    expect(options).toHaveSize(CANONICAL_TIMEZONES.length + 1);
  });

  it('preserves an existing custom timezone without replacing it', () => {
    const options = buildTimezoneOptions({
      fallbackLabel: 'Default',
      currentValue: 'Africa/Accra',
    });
    const found = options.find((opt: MnsSearchSelectFieldOption) => opt.value === 'Africa/Accra');
    expect(found).toBeDefined();
    expect(found?.value).toBe('Africa/Accra');
    expect(found?.label).toBe('Africa/Accra');
  });

  it('does not duplicate existing timezone if already in canonical list', () => {
    const options = buildTimezoneOptions({
      fallbackLabel: 'Default',
      currentValue: 'America/Sao_Paulo',
    });
    const matches = options.filter(
      (opt: MnsSearchSelectFieldOption) => opt.value === 'America/Sao_Paulo',
    );
    expect(matches).toHaveSize(1);
  });

  it('does not inject fallback value when currentValue is empty', () => {
    const options = buildTimezoneOptions({
      fallbackLabel: 'Default',
      currentValue: '',
    });
    expect(options[0].value).toBe('');
    const emptyMatches = options.filter(
      (opt: MnsSearchSelectFieldOption) => opt.value === '',
    );
    expect(emptyMatches).toHaveSize(1);
  });
});
