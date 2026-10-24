import { companyLookupConflicts } from './company-lookup';
import { isValidCpf, normalizeCpf, personLookupButton, personLookupValues } from './person-lookup';

const spec = {
  feature: 'registry.customer',
  documentKey: 'document',
  typeKey: 'type',
  nameKey: 'name',
  legalNameKey: 'legalName',
  birthDateKey: 'legalDate',
};

describe('person (CPF) lookup helpers', () => {
  it('validates CPF check digits like the API', () => {
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735');
    expect(isValidCpf('11144477735')).toBeTrue();
    expect(isValidCpf('40442820135')).toBeTrue();
    expect(isValidCpf('11144477736')).toBeFalse();
    expect(isValidCpf('11111111111')).toBeFalse();
    expect(isValidCpf('1114447773')).toBeFalse();
  });

  it('maps the canonical answer to the form keys, preferring the social name', () => {
    expect(
      personLookupValues(spec, {
        document: '40442820135',
        name: 'NOME DO CPF 404.428.201-35',
        socialName: null,
        birthDate: '1960-12-03',
        registrationStatus: 'regular',
      }),
    ).toEqual({
      document: '40442820135',
      name: 'NOME DO CPF 404.428.201-35',
      legalName: 'NOME DO CPF 404.428.201-35',
      legalDate: '1960-12-03',
    });
    expect(
      personLookupValues(spec, { name: 'MARIA SILVA', socialName: 'JOÃO SILVA', birthDate: null }),
    ).toEqual({ name: 'JOÃO SILVA', legalName: 'MARIA SILVA' });
  });

  it('reports only filled fields with other values as conflicts', () => {
    const values = personLookupValues(spec, {
      document: '11144477735',
      name: 'ANA',
      birthDate: '1990-01-02',
    });
    expect(
      companyLookupConflicts(
        { document: '111.444.777-35', name: 'ana', legalName: '', legalDate: '1991-01-01' },
        values,
        'document',
      ),
    ).toEqual(['legalDate']);
  });

  it('shows the button only for people', () => {
    const button = personLookupButton(spec);
    expect(button.visibleWhen?.({ editing: false, values: { type: 'person' } })).toBeTrue();
    expect(button.visibleWhen?.({ editing: false, values: { type: 'company' } })).toBeFalse();
  });
});
