import { historySummary } from './asset-field';

describe('InfraGIS asset history summary', () => {
  const t = (key: string) => `[${key}]`;

  it('lists each changed field with its old and new value', () => {
    const row = {
      changes: {
        geometry: { from: { latitude: -3.1 }, to: { latitude: -3.15, longitude: -60.05 } },
        name: { from: 'POSTE 1', to: 'POSTE 1B' },
        properties: { from: {}, to: { altura: 9 } },
        externalId: { from: null, to: 'P-1' },
      },
    };
    expect(historySummary(row, t)).toBe(
      '[Name]: POSTE 1 → POSTE 1B; [External ID]: — → P-1; [Properties]; [Geometry]: -3.15, -60.05',
    );
  });

  it('shows the file of an attachment and nothing for an empty record', () => {
    expect(historySummary({ changes: { fileName: 'poste.jpg', kind: 'PHOTO' } }, t)).toBe(
      '[File]: poste.jpg',
    );
    expect(historySummary({ changes: null }, t)).toBe('');
  });

  it('prints the values of a created asset', () => {
    const created = {
      name: 'POSTE 1',
      layer: 'POSTES',
      geometry: { type: 'POINT', latitude: -3.1, longitude: -60 },
    };
    expect(historySummary({ changes: created }, t)).toBe(
      '[Name]: POSTE 1; [Layer]: POSTES; [Geometry]: -3.1, -60',
    );
  });
});
