import { websiteOfferPayload, websiteOfferRow } from './offers';

describe('Website offers mapping', () => {
  it('flattens texts per locale and keeps a display name', () => {
    const row = websiteOfferRow({
      offerUUID: 'u-1',
      slug: 'vps-basica',
      texts: { 'en-US': { name: 'Basic VPS', summary: 'Start', features: ['1 vCPU', 'SSD'] } },
    });
    expect(row['nameEn']).toBe('Basic VPS');
    expect(row['featuresEn']).toBe('1 vCPU\nSSD');
    expect(row['namePt']).toBe('');
    expect(row['displayName']).toBe('Basic VPS');
  });

  it('builds the API body, skipping locales without a name and empty highlight lines', () => {
    const body = websiteOfferPayload(
      {
        slug: ' VPS-Basica ',
        kind: 'vps',
        planUUID: 'p-1',
        price: '99.9',
        setupFee: '',
        cycle: 'yearly',
        trialDays: '7',
        commitmentMonths: 0,
        approvalRequired: true,
        sortOrder: 2,
        namePt: 'VPS Básica',
        summaryPt: ' Para começar ',
        featuresPt: '1 vCPU\n\n SSD ',
        nameEn: '',
        summaryEn: 'ignored',
        revision: 4,
      },
      true,
    );
    expect(body['slug']).toBe('vps-basica');
    expect(body['price']).toBe(99.9);
    expect(body['setupFee']).toBe(0);
    expect(body['trialDays']).toBe(7);
    expect(body['approvalRequired']).toBeTrue();
    expect(body['revision']).toBe(4);
    expect(body['texts']).toEqual({
      'pt-BR': { name: 'VPS Básica', summary: 'Para começar', features: ['1 vCPU', 'SSD'] },
    });
  });

  it('omits the revision on create', () => {
    expect(websiteOfferPayload({ slug: 'a', revision: 3 }, false)['revision']).toBeUndefined();
  });
});
