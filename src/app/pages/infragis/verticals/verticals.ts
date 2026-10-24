import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRelatedCollection,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { emptyToNull } from '../infragis-properties';

// Kinds of a package item: what applying the package copies into a project and the tenant catalog.
export const VERTICAL_ITEM_KINDS = [
  { value: 'LAYER', label: 'Layer' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'TYPE', label: 'Asset type' },
  { value: 'STATUS', label: 'Status' },
];
const geometries = [
  { value: 'POINT', label: 'Point' },
  { value: 'LINE', label: 'Line' },
  { value: 'POLYGON', label: 'Polygon' },
  { value: 'MIXED', label: 'Mixed' },
];
const kindIs =
  (...kinds: string[]) =>
  ({ values }: { values: ConfigurableCrudRecord }) =>
    !kinds.includes(String(values['kind'] ?? ''));

const itemFields: ConfigurableCrudField[] = [
  { key: 'status', source: 'IviStatus', label: 'Status', type: 'status', span: 1 },
  {
    key: 'kind',
    source: 'IviKind',
    label: 'Kind',
    type: 'select',
    options: VERTICAL_ITEM_KINDS,
    required: true,
    disabledWhen: ({ editing }) => editing,
    help: 'Layers are copied into the project; categories, asset types and statuses into the tenant catalog when the tenant lacks the code.',
    span: 1,
  },
  { key: 'code', source: 'IviCode', label: 'Code', required: true, span: 1 },
  { key: 'name', source: 'IviName', label: 'Name', required: true, span: 1 },
  { key: 'color', source: 'IviColor', label: 'Color', span: 1 },
  {
    key: 'icon',
    source: 'IviIcon',
    label: 'Icon',
    hiddenWhen: kindIs('CATEGORY', 'TYPE'),
    help: 'Material Symbols icon name, for example settings_input_component.',
    span: 1,
  },
  {
    key: 'geometryType',
    source: 'IviGeometryType',
    label: 'Geometry',
    type: 'select',
    options: geometries,
    hiddenWhen: kindIs('LAYER'),
    span: 1,
  },
  {
    key: 'categoryCode',
    source: 'IviCategoryCode',
    label: 'Category code',
    hiddenWhen: kindIs('TYPE'),
    help: 'Code of a category of this package.',
    span: 1,
  },
  {
    key: 'layerCode',
    source: 'IviLayerCode',
    label: 'Suggested layer code',
    hiddenWhen: kindIs('TYPE'),
    help: 'Code of a layer of this package; imports place assets of the type there.',
    span: 1,
  },
  { key: 'sortOrder', source: 'IviSortOrder', label: 'Sort Order', type: 'number', span: 1 },
  {
    key: 'propertiesSchemaJson',
    source: 'IviPropertiesSchemaJson',
    label: 'Properties schema',
    type: 'textarea',
    format: 'json',
    rows: 8,
    hiddenWhen: kindIs('TYPE'),
    help: 'JSON Schema of the asset properties: an object with properties (each with type string, number or boolean and optional title, enum, minimum, maximum, maxLength and x-unit) and required (list of keys).',
    span: 4,
  },
];

const items: ConfigurableCrudRelatedCollection = {
  key: 'items',
  label: 'Items',
  emptyLabel: 'No items in this package.',
  addLabel: 'Add',
  createTitle: 'New package item',
  editTitle: 'Edit package item',
  endpoint: (vertical) => `system/infragis/verticals/${vertical}/items`,
  updateEndpoint: (vertical) => `system/infragis/verticals/${vertical}/items`,
  deleteEndpoint: (vertical, row) =>
    `system/infragis/verticals/${vertical}/items/${row['IviUUID']}`,
  uuidField: 'IviUUID',
  initialValues: {
    status: 1,
    kind: 'TYPE',
    color: '#22C55E',
    geometryType: 'MIXED',
    sortOrder: 1000,
  },
  fields: itemFields,
  columns: [
    {
      id: 'kind',
      label: 'Kind',
      field: 'IviKind',
      value: (row, t) =>
        t(VERTICAL_ITEM_KINDS.find((kind) => kind.value === row['IviKind'])?.label ?? ''),
    },
    { id: 'name', label: 'Name', field: 'IviName', uuidField: 'IviUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'IviCode' },
    { id: 'category', label: 'Category code', field: 'IviCategoryCode' },
    { id: 'layer', label: 'Suggested layer code', field: 'IviLayerCode' },
    { id: 'status', label: 'Status', field: 'IviStatus', kind: 'status' },
  ],
  payload: emptyToNull,
};

const config = defineCrud({
  bulkDelete: false,
  endpoint: 'system/infragis/verticals',
  uuidField: 'IgvUUID',
  pageTitle: 'Vertical packages',
  pageDescription:
    'Packages of layers, categories, asset types and statuses that tenants apply to InfraGIS projects.',
  initialValues: { status: 1, sortOrder: 1000 },
  tabLabels: { notes: 'Description' },
  columns: [
    { id: 'name', label: 'Name', field: 'IgvName', uuidField: 'IgvUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'IgvCode', translateValue: false },
    { id: 'items', label: 'Items', field: 'ItemCount', kind: 'number' },
    { id: 'projects', label: 'Projects', field: 'ProjectCount', kind: 'number' },
    { id: 'status', label: 'Status', field: 'IgvStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'IgvStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'code', source: 'IgvCode', label: 'Code', required: true, span: 1 },
    { key: 'name', source: 'IgvName', label: 'Name', required: true, span: 1 },
    { key: 'sortOrder', source: 'IgvSortOrder', label: 'Sort Order', type: 'number', span: 1 },
    {
      key: 'description',
      source: 'IgvDescription',
      label: 'Description',
      type: 'textarea',
      rows: 4,
      tab: 'notes',
      span: 4,
    },
  ],
  relatedCollections: [items],
});

/**
 * System › InfraGIS › Vertical packages (platform only). Tenants apply a package to a project and
 * receive a copy: editing a package never changes what projects already copied.
 */
@Component({
  selector: 'app-infragis-verticals',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class InfraGisVerticalsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return emptyToNull(payload);
  }
}
