import {
  tenantIdentityLine,
  tenantIdentityParts,
} from '../../../../core/environment/environment-context';
import { firstInvalidTab, normalizeTaxId, TaxIdType, taxIdTypesFor } from './identity';

const type = (item: Partial<TaxIdType>): TaxIdType => ({
  TaxIdType: 'other',
  CountryCode: '*',
  PartyType: 'any',
  Label: 'Tax ID',
  Pattern: '^[0-9A-Z]{2,32}$',
  DisplayFormat: null,
  Prefix: null,
  IsRequired: 0,
  ...item,
});

const CATALOG = [
  type({ TaxIdType: 'br_cpf', CountryCode: 'BR', PartyType: 'individual', IsRequired: 1 }),
  type({ TaxIdType: 'br_cnpj', CountryCode: 'BR', PartyType: 'business', IsRequired: 1 }),
  type({ TaxIdType: 'ar_cuit', CountryCode: 'AR', PartyType: 'any' }),
  type({ TaxIdType: 'eu_vat', CountryCode: 'GR', PartyType: 'business', Prefix: 'EL' }),
  type({}),
];

describe('tenant tax identity helpers', () => {
  it('normalizes like the database, adding the VAT prefix', () => {
    expect(normalizeTaxId('12.abc.345/01de-35', null)).toBe('12ABC34501DE35');
    expect(normalizeTaxId('123 456 789', CATALOG[3])).toBe('EL123456789');
    expect(normalizeTaxId('el123456789', CATALOG[3])).toBe('EL123456789');
  });

  it('offers the types of the country and party, or the generic type', () => {
    expect(taxIdTypesFor(CATALOG, 'BR', 'business').map((t) => t.TaxIdType)).toEqual(['br_cnpj']);
    expect(taxIdTypesFor(CATALOG, 'AR', 'individual').map((t) => t.TaxIdType)).toEqual(['ar_cuit']);
    expect(taxIdTypesFor(CATALOG, 'JP', 'business').map((t) => t.TaxIdType)).toEqual(['other']);
  });

  it('selects the tab of the first invalid field', () => {
    const invalid =
      (...keys: string[]) =>
      (key: string) =>
        keys.includes(key);
    expect(firstInvalidTab(invalid())).toBe(-1);
    expect(firstInvalidTab(invalid(), true)).toBe(0);
    expect(firstInvalidTab(invalid('addressZip', 'legalName'))).toBe(0);
    expect(firstInvalidTab(invalid('addressCity', 'billingEmail'))).toBe(1);
    expect(firstInvalidTab(invalid('addressZip'))).toBe(2);
  });

  it('builds the tenant switcher identity line', () => {
    expect(
      tenantIdentityLine({
        TaxIdLabel: 'CPF',
        TaxIdDisplay: '***.982.247-**',
        TenantCode: 'TEN-7K3Q-X9M2-HD4P',
      }),
    ).toBe('CPF ***.982.247-** · TEN-7K3Q-X9M2-HD4P');
    expect(tenantIdentityLine({ TenantCode: 'TEN-7K3Q-X9M2-HD4P' })).toBe('TEN-7K3Q-X9M2-HD4P');
    expect(tenantIdentityLine(null)).toBe('');
  });

  it('splits the identity into unbreakable switcher parts', () => {
    expect(
      tenantIdentityParts({
        TaxIdLabel: 'CNPJ',
        TaxIdDisplay: '53.372.251/0001-63',
        TenantCode: 'TEN-NNQ2-PJKQ-HUD3',
      }),
    ).toEqual(['CNPJ 53.372.251/0001-63', 'TEN-NNQ2-PJKQ-HUD3']);
    expect(tenantIdentityParts({ TenantCode: 'TEN-3TCJ-52AF-PMLB' })).toEqual([
      'TEN-3TCJ-52AF-PMLB',
    ]);
    expect(tenantIdentityParts({ TenantCode: null })).toEqual([]);
    expect(tenantIdentityParts(undefined)).toEqual([]);
  });
});
