/**
 * InfraGIS import files read in the browser: GeoJSON, KML, KMZ, CSV (latitude/longitude columns,
 * GeoJSON or WKT column) and zipped Shapefiles (reprojected to WGS 84 from their .prj). Every
 * geometry leaves as two-dimensional GeoJSON (longitude first); the API and the database validate
 * each row again.
 */

export type ImportFormat = 'geojson' | 'kml' | 'kmz' | 'csv' | 'shapefile';
export type ImportGeometry = { type: string; coordinates?: unknown; geometries?: ImportGeometry[] };
export type ParsedFeature = {
  row: number;
  geometry: ImportGeometry | null;
  properties: Record<string, unknown>;
};
export type ParsedFile = {
  format: ImportFormat;
  features: ParsedFeature[];
  columns: string[];
  /** Translatable notes about what the reader changed or ignored. */
  warnings: string[];
};
export type ImportMapping = {
  name: string | null;
  externalId: string | null;
  layerCode: string | null;
  typeCode: string | null;
  statusCode: string | null;
  /** Type code used when the row has none (no column or an empty value). */
  fixedTypeCode: string | null;
  fixedStatusCode: string | null;
  keepProperties: boolean;
};
export type ImportRow = {
  row: number;
  name: string;
  externalId: string | null;
  layerCode: string | null;
  typeCode: string | null;
  statusCode: string | null;
  properties: Record<string, unknown> | null;
  geometry: ImportGeometry | null;
};
/** Properties schema of an asset type (subset used to coerce imported values). */
export type PropertiesSchema = {
  properties?: Record<string, { type?: string }>;
};

const EXTENSIONS: Record<string, ImportFormat> = {
  geojson: 'geojson',
  json: 'geojson',
  kml: 'kml',
  kmz: 'kmz',
  csv: 'csv',
  txt: 'csv',
  zip: 'shapefile',
};

export const IMPORT_ACCEPT = '.geojson,.json,.kml,.kmz,.csv,.txt,.zip';
/** Rows per batch and approximate JSON size per batch (the API accepts up to 1000 rows). */
export const BATCH_ROWS = 500;
export const BATCH_BYTES = 3_000_000;

export function detectFormat(fileName: string): ImportFormat | null {
  const extension = fileName.toLowerCase().split('.').pop() ?? '';
  return EXTENSIONS[extension] ?? null;
}

/** Drops altitude and measures so the database receives two-dimensional coordinates. */
function flatten(value: unknown, dropped: { count: number }): unknown {
  if (!Array.isArray(value)) return value;
  if (typeof value[0] === 'number') {
    if (value.length > 2) dropped.count++;
    return value.slice(0, 2).map(Number);
  }
  return value.map((item) => flatten(item, dropped));
}

export function normalizeGeometry(
  geometry: unknown,
  counter?: { count: number },
): ImportGeometry | null {
  const dropped = counter ?? { count: 0 };
  if (!geometry || typeof geometry !== 'object') return null;
  const source = geometry as ImportGeometry;
  if (source.type === 'GeometryCollection') {
    const parts = (source.geometries ?? [])
      .map((part) => normalizeGeometry(part, dropped))
      .filter((part): part is ImportGeometry => !!part);
    // A collection of one geometry is that geometry; mixed collections stay as they are.
    if (parts.length === 1) return parts[0];
    return parts.length ? { type: 'GeometryCollection', geometries: parts } : null;
  }
  if (!source.type || source.coordinates === undefined) return null;
  return { type: source.type, coordinates: flatten(source.coordinates, dropped) };
}

function featuresFromGeoJson(value: unknown): { geometry: unknown; properties: unknown }[] {
  if (Array.isArray(value)) return value.flatMap(featuresFromGeoJson);
  if (!value || typeof value !== 'object') return [];
  const object = value as Record<string, any>;
  if (object['type'] === 'FeatureCollection') {
    return featuresFromGeoJson(object['features'] ?? []);
  }
  if (object['type'] === 'Feature') {
    return [{ geometry: object['geometry'], properties: object['properties'] }];
  }
  if (typeof object['type'] === 'string') return [{ geometry: object, properties: {} }];
  return [];
}

function finish(
  format: ImportFormat,
  raw: { geometry: unknown; properties: unknown }[],
  warnings: string[] = [],
): ParsedFile {
  const dropped = { count: 0 };
  const features = raw.map((feature, index) => ({
    row: index + 1,
    geometry: normalizeGeometry(feature.geometry, dropped),
    properties:
      feature.properties && typeof feature.properties === 'object'
        ? { ...(feature.properties as Record<string, unknown>) }
        : {},
  }));
  if (dropped.count) warnings.push('Altitude values were ignored (two-dimensional import).');
  if (features.some((feature) => !feature.geometry)) {
    warnings.push('Some rows have no geometry and will be refused.');
  }
  const columns = [...new Set(features.flatMap((feature) => Object.keys(feature.properties)))];
  return { format, features, columns, warnings };
}

// ---------------- CSV ----------------

/** Most frequent of comma, semicolon and tab in the header line. */
function csvDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? '';
  return [',', ';', '\t']
    .map((candidate) => ({ candidate, count: header.split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate;
}

/** RFC 4180 rows; the delimiter is the most frequent of comma, semicolon and tab in the header. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\ufeff/, '');
  const delimiter = csvDelimiter(clean);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    if (row.some((value) => value !== '')) rows.push(row);
    row = [];
    cell = '';
  };
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      const escaped = char === '"' && clean[i + 1] === '"';
      if (escaped) i++;
      if (char === '"' && !escaped) quoted = false;
      else cell += char;
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += char;
    }
  }
  endRow();
  return rows;
}

const number = (value: string) => Number(value.trim().replace(',', '.'));

type WktNode = number[] | WktNode[];

const WKT_TYPES: Record<string, string> = {
  POINT: 'Point',
  LINESTRING: 'LineString',
  POLYGON: 'Polygon',
  MULTIPOINT: 'MultiPoint',
  MULTILINESTRING: 'MultiLineString',
  MULTIPOLYGON: 'MultiPolygon',
};

/**
 * Nested lists of a WKT body: `(1 2, 3 4)` is [[1, 2], [3, 4]] and `((…), (…))` a list of those.
 * Returns the node and the index after its closing parenthesis; throws on malformed input.
 */
function wktList(text: string, start: number): [WktNode, number] {
  const items: WktNode[] = [];
  let tuple: number[] = [];
  let token = '';
  const flushToken = () => {
    if (!token) return;
    const value = Number(token);
    if (!Number.isFinite(value)) throw new Error('Invalid WKT number');
    tuple.push(value);
    token = '';
  };
  const flushTuple = () => {
    flushToken();
    if (tuple.length) items.push(tuple);
    tuple = [];
  };
  for (let i = start + 1; i < text.length; i++) {
    const char = text[i];
    if (char === '(') {
      const [child, next] = wktList(text, i);
      items.push(child);
      i = next - 1;
    } else if (char === ')') {
      flushTuple();
      return [items, i + 1];
    } else if (char === ',') {
      flushTuple();
    } else if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      flushToken();
    } else {
      token += char;
    }
  }
  throw new Error('Unbalanced WKT');
}

/** WKT (2D, optional Z/M ignored) of POINT, LINESTRING, POLYGON and their MULTI forms. */
export function parseWkt(source: string): ImportGeometry | null {
  const text = source.trim().replace(/^SRID=\d+;/i, '');
  const open = text.indexOf('(');
  if (open < 0) return null;
  const header = text.slice(0, open).trim().toUpperCase().split(/\s+/);
  const type = WKT_TYPES[header[0] ?? ''];
  if (!type || header.length > 2 || (header[1] && !['Z', 'M', 'ZM'].includes(header[1]))) {
    return null;
  }
  try {
    const [body, end] = wktList(text, open);
    if (text.slice(end).trim()) return null;
    // POINT(x y) reads as [[x, y]]; MULTIPOINT((x y), (x y)) as [[[x, y]], ...].
    let coordinates: unknown = body;
    if (type === 'Point') coordinates = (body as WktNode[])[0];
    if (type === 'MultiPoint') {
      coordinates = (body as WktNode[]).map((item) =>
        Array.isArray(item[0]) ? (item as WktNode[])[0] : item,
      );
    }
    return { type, coordinates };
  } catch {
    return null;
  }
}

const LATITUDE = ['latitude', 'lat', 'y', 'coord_y'];
const LONGITUDE = ['longitude', 'lng', 'lon', 'long', 'x', 'coord_x'];
const GEOMETRY = ['geometry', 'geojson', 'geom', 'the_geom', 'wkt', 'shape'];

export function parseCsvFile(text: string): ParsedFile {
  const [header = [], ...lines] = parseCsv(text);
  const columns = header.map((name) => name.trim());
  const find = (candidates: string[]) => {
    const index = columns.findIndex((column) => candidates.includes(column.toLowerCase()));
    return index >= 0 ? index : null;
  };
  const latitude = find(LATITUDE);
  const longitude = find(LONGITUDE);
  const geometryColumn = find(GEOMETRY);
  const warnings: string[] = [];
  if (geometryColumn === null && (latitude === null || longitude === null)) {
    warnings.push('No latitude/longitude or geometry column was found.');
  }
  const geometryColumns = new Set(
    [latitude, longitude, geometryColumn].filter((index): index is number => index !== null),
  );
  const raw = lines.map((cells) => {
    let geometry: unknown = null;
    const source = geometryColumn !== null ? (cells[geometryColumn] ?? '').trim() : '';
    if (source.startsWith('{')) {
      try {
        geometry = JSON.parse(source);
      } catch {
        geometry = null;
      }
    } else if (source) {
      geometry = parseWkt(source);
    }
    if (!geometry && latitude !== null && longitude !== null) {
      const lat = number(cells[latitude] ?? '');
      const lng = number(cells[longitude] ?? '');
      if (Number.isFinite(lat) && Number.isFinite(lng) && (cells[latitude] ?? '').trim()) {
        geometry = { type: 'Point', coordinates: [lng, lat] };
      }
    }
    const properties: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      const value = cells[index] ?? '';
      if (!geometryColumns.has(index) && column && value !== '') properties[column] = value;
    });
    return { geometry, properties };
  });
  return finish('csv', raw, warnings);
}

// ---------------- KML / KMZ / Shapefile ----------------

async function kmlText(text: string, format: ImportFormat): Promise<ParsedFile> {
  const [{ kml }, xmldom] = await Promise.all([
    import('@tmcw/togeojson'),
    import('@xmldom/xmldom'),
  ]);
  // xmldom is CommonJS: the bundler may expose it as the default export.
  const XmlParser =
    xmldom.DOMParser ?? (xmldom as unknown as { default: typeof xmldom }).default.DOMParser;
  // A detached XML document parsed in JavaScript: never part of the page DOM, nothing executes.
  let document: Document;
  try {
    document = new XmlParser().parseFromString(text, 'text/xml') as unknown as Document;
  } catch {
    throw new Error('The KML file could not be read.');
  }
  const collection = kml(document);
  return finish(
    format,
    collection.features.map((feature) => ({
      geometry: feature.geometry,
      // Styles are presentation of the source system, not asset attributes.
      properties: Object.fromEntries(
        Object.entries(feature.properties ?? {}).filter(
          ([key]) =>
            !/^(styleUrl|styleHash|styleMapHash|stroke|fill|icon|marker-|label-)/.test(key),
        ),
      ),
    })),
  );
}

async function kmzBuffer(buffer: ArrayBuffer): Promise<ParsedFile> {
  const { unzipSync, strFromU8 } = await import('fflate');
  const files = unzipSync(new Uint8Array(buffer), {
    filter: (file) => file.name.toLowerCase().endsWith('.kml'),
  });
  const names = Object.keys(files).sort((a, b) => a.localeCompare(b));
  // The main document of a KMZ is doc.kml; other KML files are linked overlays.
  const main = names.find((name) => name.toLowerCase().endsWith('doc.kml')) ?? names[0];
  if (!main) throw new Error('The KMZ file has no KML document.');
  return kmlText(strFromU8(files[main]), 'kmz');
}

async function shapefileBuffer(buffer: ArrayBuffer): Promise<ParsedFile> {
  const { default: shp } = await import('shpjs');
  const result = await shp(buffer);
  const collections = Array.isArray(result) ? result : [result];
  const warnings: string[] = [];
  if (collections.length > 1) warnings.push('Every shapefile of the zip was read.');
  return finish(
    'shapefile',
    collections.flatMap((collection) =>
      (collection.features ?? []).map((feature: any) => ({
        geometry: feature.geometry,
        properties: feature.properties,
      })),
    ),
    warnings,
  );
}

export async function parseImportFile(file: File): Promise<ParsedFile> {
  const format = detectFormat(file.name);
  if (!format) throw new Error('Unsupported file format.');
  switch (format) {
    case 'geojson': {
      let value: unknown;
      try {
        value = JSON.parse(await file.text());
      } catch {
        throw new Error('The GeoJSON file could not be read.');
      }
      return finish('geojson', featuresFromGeoJson(value));
    }
    case 'kml':
      return kmlText(await file.text(), 'kml');
    case 'kmz':
      return kmzBuffer(await file.arrayBuffer());
    case 'csv':
      return parseCsvFile(await file.text());
    default:
      return shapefileBuffer(await file.arrayBuffer());
  }
}

// ---------------- Mapping ----------------

const GUESSES: Record<
  keyof Omit<ImportMapping, 'fixedTypeCode' | 'fixedStatusCode' | 'keepProperties'>,
  string[]
> = {
  name: ['name', 'nome', 'descricao', 'description', 'label', 'titulo', 'title'],
  externalId: [
    'externalid',
    'external_id',
    'id_externo',
    'codigo',
    'code',
    'cod',
    'fid',
    'objectid',
    'id',
  ],
  layerCode: ['layer', 'layercode', 'camada', 'folder', 'pasta'],
  typeCode: ['type', 'typecode', 'tipo', 'asset_type', 'categoria'],
  statusCode: ['status', 'statuscode', 'situacao', 'estado'],
};

/** Columns written by the InfraGIS export that are not asset attributes. */
const EXPORT_META = new Set([
  'id',
  'project',
  'layerName',
  'typeName',
  'statusName',
  'geometryType',
  'latitude',
  'longitude',
  'geometry',
]);

export function guessMapping(columns: readonly string[]): ImportMapping {
  const lower = new Map(columns.map((column) => [column.toLowerCase(), column]));
  const pick = (candidates: string[]) =>
    candidates.map((candidate) => lower.get(candidate)).find((column) => !!column) ?? null;
  return {
    name: pick(GUESSES.name),
    externalId: pick(GUESSES.externalId),
    layerCode: pick(GUESSES.layerCode),
    typeCode: pick(GUESSES.typeCode),
    statusCode: pick(GUESSES.statusCode),
    fixedTypeCode: null,
    fixedStatusCode: null,
    keepProperties: true,
  };
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const result = (typeof value === 'object' ? JSON.stringify(value) : String(value)).trim();
  return result || null;
}

const code = (value: unknown) => text(value)?.toLowerCase() ?? null;
const TRUE_WORDS = ['true', '1', 'sim', 'yes', 's', 'y'];
const FALSE_WORDS = ['false', '0', 'nao', 'não', 'no', 'n'];

function coerce(kind: string | undefined, value: unknown): unknown {
  if (kind === 'number' && typeof value === 'string' && value.trim()) {
    const parsed = number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  if (kind === 'boolean' && typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (TRUE_WORDS.includes(normalized)) return true;
    if (FALSE_WORDS.includes(normalized)) return false;
    return value;
  }
  if (kind === 'string' && typeof value === 'number') return String(value);
  return value;
}

/**
 * Values typed by the asset type schema: numeric text becomes a number and yes/no text a boolean
 * (CSV and DBF cells are text); anything else is kept as read.
 */
export function coerceProperties(
  properties: Record<string, unknown>,
  schema: PropertiesSchema | null | undefined,
): Record<string, unknown> {
  const declared = schema?.properties ?? {};
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, coerce(declared[key]?.type, value)]),
  );
}

/** Columns kept as properties: not mapped, not export metadata and not empty. */
function extraProperties(
  properties: Record<string, unknown>,
  mapped: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(properties).filter(
      ([key, item]) => !mapped.has(key) && !EXPORT_META.has(key) && item !== null && item !== '',
    ),
  );
}

/** Rows in the API shape. `fallbackName` names rows without a name or external ID. */
export function buildRows(
  features: readonly ParsedFeature[],
  mapping: ImportMapping,
  schemas: ReadonlyMap<string, PropertiesSchema | null>,
  fallbackName: (row: number) => string,
): ImportRow[] {
  const mapped = new Set(
    [
      mapping.name,
      mapping.externalId,
      mapping.layerCode,
      mapping.typeCode,
      mapping.statusCode,
    ].filter((column): column is string => !!column),
  );
  return features.map((feature) => {
    const value = (column: string | null) => (column ? feature.properties[column] : undefined);
    const externalId = text(value(mapping.externalId))?.slice(0, 120) ?? null;
    const typeCode = code(value(mapping.typeCode)) ?? mapping.fixedTypeCode;
    const properties = mapping.keepProperties ? extraProperties(feature.properties, mapped) : {};
    const schema = typeCode ? schemas.get(typeCode) : null;
    return {
      row: feature.row,
      name: (text(value(mapping.name)) ?? externalId ?? fallbackName(feature.row)).slice(0, 160),
      externalId,
      layerCode: code(value(mapping.layerCode)),
      typeCode,
      statusCode: code(value(mapping.statusCode)) ?? mapping.fixedStatusCode,
      properties: Object.keys(properties).length ? coerceProperties(properties, schema) : null,
      geometry: feature.geometry,
    };
  });
}

/** Batches of at most BATCH_ROWS rows and about BATCH_BYTES of JSON. */
export function batches(rows: readonly ImportRow[]): ImportRow[][] {
  const result: ImportRow[][] = [];
  let current: ImportRow[] = [];
  let size = 0;
  for (const row of rows) {
    const bytes = JSON.stringify(row).length;
    if (current.length && (current.length >= BATCH_ROWS || size + bytes > BATCH_BYTES)) {
      result.push(current);
      current = [];
      size = 0;
    }
    current.push(row);
    size += bytes;
  }
  if (current.length) result.push(current);
  return result;
}

/** Geometry families of the parsed features, for the preview. */
export function geometrySummary(features: readonly ParsedFeature[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const feature of features) {
    const key = feature.geometry?.type ?? 'None';
    summary[key] = (summary[key] ?? 0) + 1;
  }
  return summary;
}
