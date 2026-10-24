import { addProtocol, type RequestTransformFunction, type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';

/** Map base of the platform, as returned by `GET /infragis/map/config`. */
export type InfraGisMapConfig = {
  provider: 'style' | 'pmtiles' | 'mapbox' | 'none';
  styleUrl: string | null;
  pmtilesUrl: string | null;
  attribution: string | null;
  centerLatitude: number | string;
  centerLongitude: number | string;
  zoom: number | string;
  accessToken: string | null;
};

export type InfraGisMapBase = {
  style: string | StyleSpecification;
  transformRequest?: RequestTransformFunction;
  attribution: string | null;
  center: [number, number];
  zoom: number;
};

// Fonts and sprites of the Protomaps basemap flavors (public assets of the Protomaps project).
const PROTOMAPS_ASSETS = 'https://protomaps.github.io/basemaps-assets';
const OSM_ATTRIBUTION = '© OpenStreetMap';

let pmtilesProtocol = false;

function blankStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef1f4' } }],
  };
}

function pmtilesStyle(url: string, lang: string): StyleSpecification {
  if (!pmtilesProtocol) {
    addProtocol('pmtiles', new Protocol().tile);
    pmtilesProtocol = true;
  }
  return {
    version: 8,
    glyphs: `${PROTOMAPS_ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${PROTOMAPS_ASSETS}/sprites/v4/light`,
    sources: {
      protomaps: { type: 'vector', url: `pmtiles://${url}`, attribution: OSM_ATTRIBUTION },
    },
    layers: layers('protomaps', namedFlavor('light'), { lang }),
  };
}

/**
 * MapProvider boundary of InfraGIS (`docs/infragis.md` → Map Provider Boundary): turns the platform
 * settings into a MapLibre style. `style` is any MapLibre style URL, `pmtiles` an own PMTiles file
 * rendered with the Protomaps light flavor, `mapbox` an https Mapbox style whose requests receive
 * the public token, and `none` a plain background (assets only).
 */
export function infraGisMapBase(config: InfraGisMapConfig, lang = 'pt'): InfraGisMapBase {
  const center: [number, number] = [
    Number(config.centerLongitude) || -51.9253,
    Number(config.centerLatitude) || -14.235,
  ];
  const zoom = Number(config.zoom);
  const base = {
    attribution: config.attribution,
    center,
    zoom: Number.isFinite(zoom) ? zoom : 3.5,
  };
  if (config.provider === 'pmtiles' && config.pmtilesUrl) {
    return { ...base, style: pmtilesStyle(config.pmtilesUrl, lang) };
  }
  if (config.provider === 'mapbox' && config.styleUrl) {
    const token = config.accessToken;
    return {
      ...base,
      style: config.styleUrl,
      transformRequest: (url) =>
        token && url.startsWith('https://api.mapbox.com/')
          ? {
              url: `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
            }
          : { url },
    };
  }
  if (config.provider === 'style' && config.styleUrl) return { ...base, style: config.styleUrl };
  return { ...base, style: blankStyle() };
}
