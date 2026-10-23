import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  QuickCreateRegistryKey,
  quickCreateFor,
} from '../../../shared/crud/configurable-crud/quick-create';

export type InfraGisResourceKey =
  'projects' | 'layers' | 'categories' | 'asset-types' | 'statuses' | 'assets';

// Canonical geometry types of a layer; MIXED accepts assets of any type.
const geometries = [
  { value: 'POINT', label: 'Point' },
  { value: 'LINE', label: 'Line' },
  { value: 'POLYGON', label: 'Polygon' },
  { value: 'MIXED', label: 'Mixed' },
];
const geometryLabel = (value: unknown) =>
  geometries.find((option) => option.value === value)?.label ??
  (typeof value === 'string' ? value : '');

const statusField = (source: string): ConfigurableCrudField => ({
  key: 'status',
  source,
  label: 'Status',
  type: 'status',
  span: 1,
});
const sortOrderField = (source: string): ConfigurableCrudField => ({
  key: 'sortOrder',
  source,
  label: 'Sort Order',
  type: 'number',
  span: 1,
});
/** Columns and fields shared by the coded catalogs (column prefix `Iac`, `Igt`, `Igs`, `Igl`). */
const nameColumn = (prefix: string) => ({
  id: 'name',
  label: 'Name',
  field: `${prefix}Name`,
  uuidField: `${prefix}UUID`,
  kind: 'identity' as const,
});
const codeColumn = (prefix: string) => ({
  id: 'code',
  label: 'Code',
  field: `${prefix}Code`,
  translateValue: false,
});
const colorColumn = (field: string) => ({
  id: 'color',
  label: 'Color',
  field,
  translateValue: false,
});
const statusColumn = (prefix: string) => ({
  id: 'status',
  label: 'Status',
  field: `${prefix}Status`,
  kind: 'status' as const,
});
function codedFields(prefix: string, codeLabel: string): ConfigurableCrudField[] {
  return [
    statusField(`${prefix}Status`),
    { key: 'code', source: `${prefix}Code`, label: codeLabel, required: true, span: 1 },
    { key: 'name', source: `${prefix}Name`, label: 'Name', required: true, span: 1 },
    sortOrderField(`${prefix}SortOrder`),
  ];
}

const lookup = (
  key: string,
  source: string,
  label: string,
  endpoint: string,
  uuidField: string,
  labelField: string,
  selectedLabelField: string,
  tab: ConfigurableCrudField['tab'],
  required = false,
  parameters?: Readonly<Record<string, string>>,
): ConfigurableCrudField => ({
  key,
  source,
  label,
  type: 'search-select',
  required,
  remoteLookup: { endpoint, uuidField, labelField, selectedLabelField, parameters },
  quickCreate: quickCreateFor(source as QuickCreateRegistryKey),
  tab,
  span: 2,
});

const common = { bulkDelete: true } as const;
const initial = { status: 1, sortOrder: 1000 } as const;
const visualInitial = { ...initial, color: '#22C55E' } as const;

// One routed page per InfraGIS catalog (route data `resource`), replacing the former tabbed
// management screen. All catalogs share the generic CRUD surface.
const CONFIGS: Record<InfraGisResourceKey, ConfigurableCrudConfig> = {
  projects: defineCrud({
    ...common,
    initialValues: initial,
    endpoint: 'infragis/projects',
    uuidField: 'IprUUID',
    pageTitle: 'Projects',
    pageDescription: 'InfraGIS projects grouping layers and assets.',
    tabLabels: { notes: 'Description' },
    columns: [
      { id: 'name', label: 'Name', field: 'IprName', uuidField: 'IprUUID', kind: 'identity' },
      { id: 'vertical', label: 'Vertical', field: 'VerticalProfileName' },
      { id: 'layers', label: 'Layers', field: 'LayerCount', kind: 'number' },
      { id: 'assets', label: 'Assets', field: 'AssetCount', kind: 'number' },
      { id: 'status', label: 'Status', field: 'IprStatus', kind: 'status' },
    ],
    fields: [
      statusField('IprStatus'),
      { key: 'name', source: 'IprName', label: 'Name', required: true, span: 2 },
      sortOrderField('IprSortOrder'),
      {
        key: 'description',
        source: 'IprDescription',
        label: 'Description',
        type: 'textarea',
        rows: 5,
        tab: 'notes',
        span: 4,
      },
    ],
  }),
  layers: defineCrud({
    ...common,
    initialValues: { ...initial, geometryType: 'POINT' },
    endpoint: 'infragis/layers',
    uuidField: 'IglUUID',
    pageTitle: 'Layers',
    pageDescription: 'Map layers of each InfraGIS project.',
    tabLabels: { match: 'Assignment', transform: 'Style' },
    columns: [
      nameColumn('Igl'),
      { id: 'project', label: 'Project', field: 'ProjectName' },
      {
        id: 'geometry',
        label: 'Geometry',
        field: 'IglGeometryType',
        value: (row, t) => t(geometryLabel(row['IglGeometryType'])),
      },
      { id: 'assets', label: 'Assets', field: 'AssetCount', kind: 'number' },
      statusColumn('Igl'),
    ],
    fields: [
      ...codedFields('Igl', 'Code'),
      lookup(
        'projectUUID',
        'InfraGisProjectIprUUID',
        'Project',
        'infragis/projects',
        'IprUUID',
        'IprName',
        'ProjectName',
        'match',
        true,
      ),
      {
        key: 'geometryType',
        source: 'IglGeometryType',
        label: 'Geometry',
        type: 'select',
        options: geometries,
        required: true,
        tab: 'match',
        span: 1,
      },
      {
        key: 'styleJson',
        source: 'IglStyleJson',
        label: 'Style JSON',
        type: 'textarea',
        format: 'json',
        rows: 6,
        tab: 'transform',
        span: 4,
      },
    ],
  }),
  categories: defineCrud({
    ...common,
    initialValues: visualInitial,
    endpoint: 'infragis/categories',
    uuidField: 'IacUUID',
    pageTitle: 'Categories',
    pageDescription: 'Asset categories used to classify InfraGIS asset types.',
    tabLabels: { transform: 'Visual' },
    columns: [nameColumn('Iac'), codeColumn('Iac'), colorColumn('IacColor'), statusColumn('Iac')],
    fields: [
      ...codedFields('Iac', 'Category Code'),
      { key: 'color', source: 'IacColor', label: 'Color', tab: 'transform', span: 1 },
      { key: 'icon', source: 'IacIcon', label: 'Icon', tab: 'transform', span: 2 },
    ],
  }),
  'asset-types': defineCrud({
    ...common,
    initialValues: visualInitial,
    endpoint: 'infragis/asset-types',
    uuidField: 'IgtUUID',
    pageTitle: 'Asset Types',
    pageDescription: 'Asset types with their category, color and icon.',
    tabLabels: { match: 'Classification' },
    columns: [
      nameColumn('Igt'),
      codeColumn('Igt'),
      { id: 'category', label: 'Category', field: 'CategoryName' },
      colorColumn('IgtDefaultColor'),
      statusColumn('Igt'),
    ],
    fields: [
      ...codedFields('Igt', 'Asset Type Code'),
      lookup(
        'categoryUUID',
        'InfraGisAssetCategoryIacUUID',
        'Category',
        'infragis/categories',
        'IacUUID',
        'IacName',
        'CategoryName',
        'match',
      ),
      { key: 'color', source: 'IgtDefaultColor', label: 'Color', tab: 'match', span: 1 },
      { key: 'icon', source: 'IgtDefaultIcon', label: 'Icon', tab: 'match', span: 1 },
    ],
  }),
  statuses: defineCrud({
    ...common,
    initialValues: visualInitial,
    endpoint: 'infragis/statuses',
    uuidField: 'IgsUUID',
    pageTitle: 'Statuses',
    pageDescription: 'Operational statuses available for InfraGIS assets.',
    tabLabels: { transform: 'Visual' },
    columns: [nameColumn('Igs'), codeColumn('Igs'), colorColumn('IgsColor'), statusColumn('Igs')],
    fields: [
      ...codedFields('Igs', 'Status Code'),
      { key: 'color', source: 'IgsColor', label: 'Color', tab: 'transform', span: 1 },
    ],
  }),
  assets: defineCrud({
    ...common,
    initialValues: initial,
    endpoint: 'infragis/assets',
    uuidField: 'IgaUUID',
    pageTitle: 'Assets',
    pageDescription: 'Georeferenced InfraGIS assets.',
    tabLabels: { match: 'Assignment', monitoring: 'Geometry', transform: 'Advanced' },
    columns: [
      { id: 'name', label: 'Name', field: 'IgaName', uuidField: 'IgaUUID', kind: 'identity' },
      { id: 'project', label: 'Project', field: 'ProjectName' },
      { id: 'layer', label: 'Layer', field: 'LayerName' },
      { id: 'type', label: 'Type', field: 'AssetTypeName' },
      { id: 'assetStatus', label: 'Asset Status', field: 'AssetStatusName' },
      { id: 'status', label: 'Status', field: 'IgaStatus', kind: 'status' },
    ],
    fields: [
      statusField('IgaStatus'),
      { key: 'name', source: 'IgaName', label: 'Name', required: true, span: 2 },
      { key: 'externalID', source: 'IgaExternalID', label: 'External ID', span: 1 },
      lookup(
        'projectUUID',
        'InfraGisProjectIprUUID',
        'Project',
        'infragis/projects',
        'IprUUID',
        'IprName',
        'ProjectName',
        'match',
        true,
      ),
      lookup(
        'layerUUID',
        'InfraGisLayerIglUUID',
        'Layer',
        'infragis/layers',
        'IglUUID',
        'IglName',
        'LayerName',
        'match',
        true,
        { projectUUID: 'projectUUID' },
      ),
      lookup(
        'assetTypeUUID',
        'InfraGisAssetTypeIgtUUID',
        'Asset Type',
        'infragis/asset-types',
        'IgtUUID',
        'IgtName',
        'AssetTypeName',
        'match',
      ),
      lookup(
        'assetStatusUUID',
        'InfraGisAssetStatusIgsUUID',
        'Asset Status',
        'infragis/statuses',
        'IgsUUID',
        'IgsName',
        'AssetStatusName',
        'match',
      ),
      {
        key: 'latitude',
        source: 'IgmLatitude',
        label: 'Latitude',
        type: 'number',
        tab: 'monitoring',
        span: 1,
      },
      {
        key: 'longitude',
        source: 'IgmLongitude',
        label: 'Longitude',
        type: 'number',
        tab: 'monitoring',
        span: 1,
      },
      {
        key: 'geoJson',
        source: 'IgmGeoJson',
        label: 'GeoJSON',
        type: 'textarea',
        format: 'json',
        rows: 5,
        tab: 'monitoring',
        span: 4,
      },
      {
        key: 'propertiesJson',
        source: 'IgaPropertiesJson',
        label: 'Properties JSON',
        type: 'textarea',
        format: 'json',
        rows: 6,
        tab: 'transform',
        span: 4,
      },
    ],
  }),
};

@Component({
  selector: 'app-infragis-management',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InfraGisManagementPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const resource = inject(ActivatedRoute).snapshot.data['resource'] as InfraGisResourceKey;
    super(CONFIGS[resource] ?? CONFIGS.projects);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    const next: ConfigurableCrudRecord = { ...payload, status: Number(payload['status'] ?? 1) };
    for (const [key, value] of Object.entries(next)) if (value === '') next[key] = null;
    return next;
  }
}
