import {
  companyLookupConflicts,
  companyLookupValues,
  isValidCnpj,
  normalizeCnpj,
} from './company-lookup';

const spec = {
  feature: 'registry.customer',
  documentKey: 'document',
  nameKey: 'name',
  legalNameKey: 'legalName',
  tradeNameKey: 'tradeName',
  openingDateKey: 'legalDate',
  emailKey: 'email',
  phoneKey: 'phone',
  address: {
    zip: 'addressMainZip',
    street: 'addressMainStreet',
    number: 'addressMainNumber',
    complement: 'addressMainComplement',
    district: 'addressMainDistrict',
    city: 'addressMainCity',
    state: 'addressMainState',
    country: 'addressMainCountry',
    municipalityCode: 'addressMainMunicipalityCode',
  },
};

describe('company (CNPJ) lookup helpers', () => {
  it('validates numeric and alphanumeric CNPJ check digits like the API', () => {
    expect(normalizeCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(isValidCnpj('12ABC34501DE35')).toBeTrue();
    expect(isValidCnpj('33683111000280')).toBeTrue();
    expect(isValidCnpj('33683111000281')).toBeFalse();
    expect(isValidCnpj('00000000000000')).toBeFalse();
  });

  it('maps the canonical answer to the form keys and skips empty values', () => {
    const values = companyLookupValues(spec, {
      document: '33683111000280',
      legalName: 'ACME LTDA',
      tradeName: 'ACME',
      openingDate: '1967-06-30',
      email: null,
      phones: ['6134939002'],
      address: {
        postalCode: '70836900',
        street: 'AVENIDA L2',
        city: 'BRASILIA',
        state: 'DF',
        ibgeCode: null,
      },
    });
    expect(values['name']).toBe('ACME');
    expect(values['tradeName']).toBe('ACME');
    expect(values['legalName']).toBe('ACME LTDA');
    expect(values['phone']).toBe('6134939002');
    expect(values['addressMainCountry']).toBe('BR');
    expect('email' in values).toBeFalse();
    expect('addressMainMunicipalityCode' in values).toBeFalse();
  });

  it('reports only filled fields that would change', () => {
    const values = {
      document: '33683111000280',
      name: 'ACME',
      email: 'a@b.c',
      addressMainCity: 'BRASILIA',
    };
    const current = {
      document: '33.683.111/0002-80',
      name: 'acme',
      email: 'x@y.z',
      addressMainCity: '',
    };
    expect(companyLookupConflicts(current, values, 'document')).toEqual(['email']);
  });
});
