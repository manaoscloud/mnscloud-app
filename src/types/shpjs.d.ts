// shpjs 6 ships no type declarations: zipped shapefile buffer → GeoJSON (reprojected to WGS 84
// from the .prj); a zip with several shapefiles yields one FeatureCollection per file.
declare module 'shpjs' {
  type FeatureCollection = {
    type: 'FeatureCollection';
    features: { type: 'Feature'; geometry: unknown; properties: Record<string, unknown> }[];
    fileName?: string;
  };
  export default function shp(
    input: ArrayBuffer | Uint8Array | string,
  ): Promise<FeatureCollection | FeatureCollection[]>;
}
