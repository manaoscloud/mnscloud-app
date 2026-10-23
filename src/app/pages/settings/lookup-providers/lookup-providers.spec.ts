import {
  INTEGRATION_SLOTS,
  type LookupProviderField,
  lookupProviderPayload,
  lookupTypeLabel,
  setLookupKindCatalog,
  slotField,
} from './lookup-providers';
import {
  durationLabel,
  providerOptions,
  setLookupTypeProviders,
} from '../lookup-types/lookup-types';

/** Catalog entry as listed by the API (`GET system/lookups/provider-kinds`). */
const kindOf = (kind: string, fields: LookupProviderField[] = []) => ({
  kind,
  label: kind.toUpperCase(),
  types: kind === 'viacep' ? ['postal_code'] : ['company_realtime'],
  paid: kind !== 'viacep',
  host: `${kind}.example.test`,
  fields,
});

describe('data lookup settings helpers', () => {
  beforeEach(() =>
    setLookupKindCatalog([
      kindOf('paidcnpj', [
        { key: 'plan', label: 'Plan', type: 'select', required: true, secret: false },
        { key: 'apiKey', label: 'API key', type: 'password', required: true, secret: true },
      ]),
      kindOf('viacep'),
    ]),
  );

  it('shows the fields the selected kind declares, slot by slot', () => {
    expect(slotField({ kind: 'paidcnpj' }, 1)?.key).toBe('apiKey');
    expect(slotField({ kind: 'viacep' }, 0)).toBeUndefined();
    expect(INTEGRATION_SLOTS).toBeGreaterThanOrEqual(2);
  });

  it('sends configuration and secrets apart; a blank secret keeps the stored one', () => {
    const typed = lookupProviderPayload({
      kind: 'paidcnpj',
      name: 'X',
      status: 1,
      timeoutMs: 5000,
      integration0: 'pro',
      integration1: ' key ',
    });
    expect(typed['config']).toEqual({ plan: 'pro' });
    expect(typed['secrets']).toEqual({ apiKey: 'key' });
    const kept = lookupProviderPayload({ kind: 'paidcnpj', name: 'X', integration0: 'pro' });
    expect('secrets' in kept).toBeFalse();
    expect(kept['timeoutMs']).toBe(4000);
  });

  it('offers only providers that answer the type, without the active one as failover', () => {
    setLookupTypeProviders([
      { DataLookupProviderUUID: 'a', Name: 'VIACEP', Types: ['postal_code'] },
      { DataLookupProviderUUID: 'b', Name: 'OPENCEP', Types: ['postal_code'] },
      { DataLookupProviderUUID: 'c', Name: 'OPENCNPJ', Types: ['company'] },
    ]);
    expect(providerOptions('postal_code', null).map((option) => option.value)).toEqual(['a', 'b']);
    expect(providerOptions('postal_code', 'a').map((option) => option.value)).toEqual(['b']);
    expect(lookupTypeLabel('company')).toBe('Company (CNPJ)');
    expect([
      durationLabel(7776000),
      durationLabel(3600),
      durationLabel(900),
      durationLabel(0),
    ]).toEqual(['90 d', '1 h', '15 min', '-']);
  });
});
