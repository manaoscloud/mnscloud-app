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
  dropped = { count: 0 },
): ImportGeometry | null {
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

/** RFC 4180 rows; the delimiter is the most frequent of comma, semicolon and tab in the header. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '');
  const header = clean.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = [',', ';', '\t']
    .map((candidate) => ({ candidate, count: header.split(candidate).length }))
    .sort((a, b) => b.count - a.count)[0].candidate;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

const number = (value: string) => Number(value.trim().replace(',', '.'));

/** WKT (2D, optional Z/M ignored) of POINT, LINESTRING, POLYGON and their MULTI forms. */
export function parseWkt(text: string): ImportGeometry | null {
  const match =
    /^\s*(MULTIPOINT|MULTILINESTRING|MULTIPOLYGON|POINT|LINESTRING|POLYGON)\s*(?:Z|M|ZM)?\s*(\(.*\))\s*$/i.exec(
      text.replace(/^SRID=\d+;/i, ''),
    );
  if (!match) return null;
  const type = match[1].toUpperCase();
  let tokens: string;
  try {
    tokens = match[2]
      .replace(/\(\s*/g, '[')
      .replace(/\s*\)/g, ']')
      .replace(
        /(-?[\d.eE+-]+)(?:\s+(-?[\d.eE+-]+))+/g,
        (group) => `[${group.trim().split(/\s+/).join(',')}]`,
      );
    const parsed = JSON.parse(tokens);
    const names: Record<string, string> = {
      POINT: 'Point',
      LINESTRING: 'LineString',
      POLYGON: 'Polygon',
      MULTIPOINT: 'MultiPoint',
      MULTILINESTRING: 'MultiLineString',
      MULTIPOLYGON: 'MultiPolygon',
    };
    // POINT(x y) parses as [[x, y]]; MULTIPOINT((x y), (x y)) as [[[x, y]], ...].
    let coordinates = parsed;
    if (type === 'POINT') coordinates = parsed[0];
    if (type === 'MULTIPOINT') {
      coordinates = parsed.map((item: unknown) =>
        Array.isArray(item) && Array.isArray(item[0]) ? item[0] : item,
      );
    }
    return { type: names[type], coordinates };
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
  const { kml } = await import('@tmcw/togeojson');
  const document = new DOMParser().parseFromString(text, 'text/xml');
  if (document.getElementsByTagName('parsererror').length) {
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
  const names = Object.keys(files).sort((a, b) =>
    a.toLowerCase() === 'doc.kml' ? -1 : b.toLowerCase() === 'doc.kml' ? 1 : a.localeCompare(b),
  );
  if (!names.length) throw new Error('The KMZ file has no KML document.');
  return kmlText(strFromU8(files[names[0]]), 'kmz');
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
  const result = String(typeof value === 'object' ? JSON.stringify(value) : value).trim();
  return result || null;
}

const code = (value: unknown) => text(value)?.toLowerCase() ?? null;

/**
 * Values typed by the asset type schema: numeric text becomes a number and yes/no text a boolean
 * (CSV and DBF cells are text); anything else is kept as read.
 */
export function coerceProperties(
  properties: Record<string, unknown>,
  schema: PropertiesSchema | null | undefined,
): Record<string, unknown> {
  const declared = schema?.properties ?? {};
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    const kind = declared[key]?.type;
    if (kind === 'number' && typeof value === 'string' && value.trim()) {
      const parsed = number(value);
      result[key] = Number.isFinite(parsed) ? parsed : value;
    } else if (kind === 'boolean' && typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      result[key] = ['true', '1', 'sim', 'yes', 's', 'y'].includes(normalized)
        ? true
        : ['false', '0', 'nao', 'não', 'no', 'n'].includes(normalized)
          ? false
          : value;
    } else if (kind === 'string' && typeof value === 'number') {
      result[key] = String(value);
    } else {
      result[key] = value;
    }
  }
  return result;
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
    const properties = mapping.keepProperties
      ? Object.fromEntries(
          Object.entries(feature.properties).filter(
            ([key, item]) =>
              !mapped.has(key) && !EXPORT_META.has(key) && item !== null && item !== '',
          ),
        )
      : {};
    return {
      row: feature.row,
      name: (text(value(mapping.name)) ?? externalId ?? fallbackName(feature.row)).slice(0, 160),
      externalId,
      layerCode: code(value(mapping.layerCode)),
      typeCode,
      statusCode: code(value(mapping.statusCode)) ?? mapping.fixedStatusCode,
      properties: Object.keys(properties).length
        ? coerceProperties(properties, typeCode ? schemas.get(typeCode) : null)
        : null,
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
