import {
  batches,
  buildRows,
  coerceProperties,
  detectFormat,
  guessMapping,
  normalizeGeometry,
  parseCsv,
  parseCsvFile,
  parseImportFile,
  parseWkt,
} from './import-parsers';
import { propertiesTemplate, schemaSummary } from '../infragis-properties';
import { strToU8, zipSync } from 'fflate';

describe('InfraGIS import parsers', () => {
  it('detects the format by extension', () => {
    expect(detectFormat('rede.KMZ')).toBe('kmz');
    expect(detectFormat('postes.json')).toBe('geojson');
    expect(detectFormat('base.zip')).toBe('shapefile');
    expect(detectFormat('mapa.dwg')).toBeNull();
  });

  it('reads CSV with semicolons, quotes and decimal commas', () => {
    expect(parseCsv('a;b\n"x;1";"di""z"\r\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'di"z'],
    ]);
    const file = parseCsvFile('nome;latitude;longitude;portas\nCTO 1;-3,1;-60,2;8\n');
    expect(file.features[0].geometry).toEqual({ type: 'Point', coordinates: [-60.2, -3.1] });
    expect(file.features[0].properties).toEqual({ nome: 'CTO 1', portas: '8' });
    expect(file.columns).toEqual(['nome', 'portas']);
  });

  it('reads WKT and GeoJSON geometry columns and drops altitude', () => {
    expect(parseWkt('LINESTRING (0 0, 1 1)')).toEqual({
      type: 'LineString',
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    });
    expect(parseWkt('POINT Z (1 2 3)')?.coordinates).toEqual([1, 2, 3]);
    expect(parseWkt('MULTIPOINT ((1 2), (3 4))')?.coordinates).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(parseWkt('POLYGON((0 0,1 0,1 1,0 0))')?.type).toBe('Polygon');
    expect(parseWkt('CIRCLE(1)')).toBeNull();
    const file = parseCsvFile('name,wkt\nP,POINT Z (1 2 3)\n');
    expect(file.features[0].geometry).toEqual({ type: 'Point', coordinates: [1, 2] });
    expect(file.warnings).toContain('Altitude values were ignored (two-dimensional import).');
    expect(
      normalizeGeometry({
        type: 'GeometryCollection',
        geometries: [{ type: 'Point', coordinates: [1, 2] }],
      }),
    ).toEqual({
      type: 'Point',
      coordinates: [1, 2],
    });
  });

  it('reads a GeoJSON file and guesses the mapping of an InfraGIS export', async () => {
    const content = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [-60, -3, 12] },
          properties: {
            id: 'u1',
            name: 'CTO-1',
            externalId: 'E1',
            layer: 'caixas',
            type: 'cto',
            portas: '16',
          },
        },
      ],
    });
    const parsed = await parseImportFile(new File([content], 'export.geojson'));
    expect(parsed.features.length).toBe(1);
    const mapping = guessMapping(parsed.columns);
    expect([mapping.name, mapping.externalId, mapping.layerCode, mapping.typeCode]).toEqual([
      'name',
      'externalId',
      'layer',
      'type',
    ]);
    const rows = buildRows(
      parsed.features,
      mapping,
      new Map([['cto', { properties: { portas: { type: 'number' } } }]]),
      (row) => `Asset ${row}`,
    );
    expect(rows[0]).toEqual({
      row: 1,
      name: 'CTO-1',
      externalId: 'E1',
      layerCode: 'caixas',
      typeCode: 'cto',
      statusCode: null,
      properties: { portas: 16 },
      geometry: { type: 'Point', coordinates: [-60, -3] },
    });
  });

  it('reads a KMZ (doc.kml) with extended data and drops styles and altitude', async () => {
    const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>CTOs</name>
<Placemark><name>CTO-7</name><styleUrl>#s</styleUrl>
<ExtendedData><Data name="portas"><value>8</value></Data></ExtendedData>
<Point><coordinates>-60.1,-3.2,0</coordinates></Point></Placemark>
<Placemark><name>Cabo</name><LineString><coordinates>-60,-3 -60.1,-3.1</coordinates></LineString></Placemark>
</Folder></Document></kml>`;
    const zip = zipSync({ 'doc.kml': strToU8(kml), 'files/icon.png': new Uint8Array([1]) });
    const parsed = await parseImportFile(new File([zip as Uint8Array<ArrayBuffer>], 'rede.kmz'));
    expect(parsed.format).toBe('kmz');
    expect(parsed.features.map((feature) => feature.geometry?.type)).toEqual([
      'Point',
      'LineString',
    ]);
    expect(parsed.features[0].geometry?.coordinates).toEqual([-60.1, -3.2]);
    expect(parsed.features[0].properties['name']).toBe('CTO-7');
    expect(parsed.features[0].properties['portas']).toBe('8');
    expect(parsed.features[0].properties['styleUrl']).toBeUndefined();
  });

  it('falls back to the fixed type and a generated name', () => {
    const rows = buildRows(
      [{ row: 7, geometry: null, properties: { altura: '9' } }],
      { ...guessMapping([]), fixedTypeCode: 'poste', keepProperties: true },
      new Map(),
      (row) => `Asset ${row}`,
    );
    expect([rows[0].name, rows[0].typeCode, rows[0].properties]).toEqual([
      'Asset 7',
      'poste',
      { altura: '9' },
    ]);
  });

  it('coerces values to the schema types', () => {
    const schema = {
      properties: { n: { type: 'number' }, b: { type: 'boolean' }, s: { type: 'string' } },
    };
    expect(coerceProperties({ n: '1,5', b: 'Sim', s: 12, x: '0012' }, schema)).toEqual({
      n: 1.5,
      b: true,
      s: '12',
      x: '0012',
    });
  });

  it('splits batches by rows and size', () => {
    const rows = Array.from({ length: 1201 }, (_, index) => ({
      row: index + 1,
      name: 'x',
      externalId: null,
      layerCode: null,
      typeCode: null,
      statusCode: null,
      properties: null,
      geometry: null,
    }));
    expect(batches(rows).map((batch) => batch.length)).toEqual([500, 500, 201]);
  });

  it('summarizes the schema and fills the required fields', () => {
    const schema = JSON.stringify({
      type: 'object',
      properties: {
        portas: { type: 'number', title: 'Portas', minimum: 1 },
        splitter: { type: 'string', enum: ['1:8', '1:16'] },
      },
      required: ['portas', 'splitter'],
    });
    expect(schemaSummary(schema)).toBe('Portas (portas): number *; splitter: 1:8 | 1:16 *');
    expect(JSON.parse(propertiesTemplate(schema, '{"obs":"x"}'))).toEqual({
      obs: 'x',
      portas: 1,
      splitter: '1:8',
    });
  });
});
