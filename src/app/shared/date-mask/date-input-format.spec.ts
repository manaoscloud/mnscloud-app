import {
  applyDateInputMask,
  dateInputPattern,
  parseDateInput,
  toDateOnly,
} from './date-input-format';

describe('date input format', () => {
  it('uses the active locale order when masking a typed date', () => {
    expect(dateInputPattern('pt-BR').placeholder).toBe('DD/MM/YYYY');
    expect(applyDateInputMask('30051990', 'pt-BR')).toBe('30/05/1990');

    expect(dateInputPattern('en-US').placeholder).toBe('MM/DD/YYYY');
    expect(applyDateInputMask('05301990', 'en-US')).toBe('05/30/1990');
  });

  it('serializes valid locale dates as timezone-free YYYY-MM-DD values', () => {
    expect(toDateOnly('30/05/1990', 'pt-BR')).toBe('1990-05-30');
    expect(toDateOnly('05/30/1990', 'en-US')).toBe('1990-05-30');
  });

  it('rejects calendar-invalid dates', () => {
    expect(parseDateInput('31/02/2026', 'pt-BR')).toBeNull();
    expect(toDateOnly('02/31/2026', 'en-US')).toBeNull();
  });
});
