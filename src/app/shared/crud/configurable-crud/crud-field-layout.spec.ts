import { crudFieldSpan } from './crud-field-layout';

describe('crudFieldSpan', () => {
  it('keeps single-line controls at one column unless the field is a wide-field exception', () => {
    expect(crudFieldSpan('search-select', 2)).toBe(1);
    expect(crudFieldSpan('search-select', 2, true)).toBe(2);
    expect(crudFieldSpan('text', undefined, true)).toBe(1);
  });

  it('keeps text areas full width and composite controls at their declared span', () => {
    expect(crudFieldSpan('textarea', 1, true)).toBe(4);
    expect(crudFieldSpan('file', 2)).toBe(2);
  });
});
