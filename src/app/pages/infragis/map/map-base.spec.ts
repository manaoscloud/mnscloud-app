import { infraGisMapBase, type InfraGisMapConfig } from './map-base';

const config = (patch: Partial<InfraGisMapConfig>): InfraGisMapConfig => ({
  provider: 'style',
  styleUrl: 'https://tiles.example.invalid/style.json',
  pmtilesUrl: null,
  attribution: null,
  centerLatitude: '-3.1',
  centerLongitude: '-60.0',
  zoom: '11.50',
  accessToken: null,
  ...patch,
});

describe('InfraGIS map base (MapProvider boundary)', () => {
  it('uses the style URL and the initial view of the settings', () => {
    const base = infraGisMapBase(config({}));
    expect(base.style).toBe('https://tiles.example.invalid/style.json');
    expect(base.center).toEqual([-60, -3.1]);
    expect(base.zoom).toBe(11.5);
    expect(base.transformRequest).toBeUndefined();
  });

  it('renders an own PMTiles file with the Protomaps flavor', () => {
    const base = infraGisMapBase(
      config({
        provider: 'pmtiles',
        styleUrl: null,
        pmtilesUrl: 'https://tiles.example.invalid/br.pmtiles',
      }),
    );
    const style = base.style as any;
    expect(style.sources.protomaps.url).toBe('pmtiles://https://tiles.example.invalid/br.pmtiles');
    expect(style.layers.length).toBeGreaterThan(10);
  });

  it('adds the Mapbox public token only to Mapbox API requests', () => {
    const base = infraGisMapBase(config({ provider: 'mapbox', accessToken: 'pk.test' }));
    expect(base.transformRequest!('https://api.mapbox.com/styles/v1/a/b', 'Style' as any)).toEqual({
      url: 'https://api.mapbox.com/styles/v1/a/b?access_token=pk.test',
    });
    expect(base.transformRequest!('https://other.example.invalid/x', 'Tile' as any)).toEqual({
      url: 'https://other.example.invalid/x',
    });
  });

  it('falls back to a plain background without a base map', () => {
    const base = infraGisMapBase(config({ provider: 'none', styleUrl: null }));
    expect((base.style as any).layers[0].type).toBe('background');
  });
});
