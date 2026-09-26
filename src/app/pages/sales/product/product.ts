import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const productTypes = [
  { value: 'COMMERCE', label: 'Commerce' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'MANUFACTURING', label: 'Manufacturing' },
  { value: 'RAW_MATERIAL', label: 'Raw material' },
  { value: 'ASSET', label: 'Asset' },
  { value: 'CONSUMABLE', label: 'Consumable' },
];

// Product images are an upload-only child collection: create uploads the image as multipart,
// rows can be deleted or promoted to the product cover.
function images(product: ConfigurableCrudRecord) {
  const productUUID = String(product['SprUUID']);
  return defineCrud({
    endpoint: `sale/products/${productUUID}/images`,
    deleteEndpoint: 'sale/products/images',
    uuidField: 'SpiUUID',
    pageTitle: 'Images',
    pageDescription: 'Upload product images and choose the cover.',
    createTitle: 'Upload image',
    bulkDelete: false,
    statusFilter: false,
    canEdit: false,
    createUpload: { fileField: 'image', formField: 'image' },
    initialValues: { image: null },
    columns: [
      { id: 'image', label: 'Image', field: 'SpiUrl', kind: 'image' },
      { id: 'cover', label: 'Cover', field: 'SpiIsCover', kind: 'boolean' },
    ],
    fields: [
      {
        key: 'image',
        label: 'Image',
        type: 'file',
        accept: 'image/*',
        required: true,
        span: 4,
      },
    ],
    rowActions: [
      {
        key: 'cover',
        label: 'Set cover',
        icon: 'star',
        tooltip: 'Set cover',
        visible: (row) => Number(row['SpiIsCover']) !== 1,
        request: {
          method: 'put',
          endpoint: (row) => `sale/products/images/${row['SpiUUID']}/cover`,
          successMessage: 'Cover image updated.',
        },
      },
    ],
  });
}

const config = defineCrud({
  endpoint: 'sale/products',
  uuidField: 'SprUUID',
  pageTitle: 'Product',
  pageDescription: 'Manage products with pricing, attributes, and images.',
  bulkDelete: true,
  initialValues: {
    status: 1,
    name: '',
    description: '',
    type: 'COMMERCE',
    saleUnitUUID: '',
    saleCategoryUUID: '',
    saleBrandUUID: '',
    price: 0,
    barcode: '',
    tags: '',
  },
  columns: [
    { id: 'image', label: 'Image', field: 'CoverUrl', kind: 'image' },
    { id: 'name', label: 'Name', field: 'SprName', uuidField: 'SprUUID', kind: 'identity' },
    { id: 'type', label: 'Type', field: 'SprType', options: productTypes },
    { id: 'category', label: 'Category', field: 'SaleCategoryName' },
    { id: 'brand', label: 'Brand', field: 'SaleBrandName' },
    { id: 'price', label: 'Price', field: 'SprPrice', kind: 'currency' },
    { id: 'status', label: 'Status', field: 'SprStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'SprStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'SprName', label: 'Name', required: true, span: 1 },
    {
      key: 'type',
      source: 'SprType',
      label: 'Type',
      type: 'select',
      options: productTypes,
      required: true,
      span: 1,
    },
    { key: 'price', source: 'SprPrice', label: 'Price', type: 'currency', required: true, span: 1 },
    {
      key: 'saleUnitUUID',
      source: 'SaleUnitSunUUID',
      label: 'Unit',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'sale/units',
        uuidField: 'SunUUID',
        labelField: 'SunName',
        selectedLabelField: 'SaleUnitName',
      },
      span: 1,
    },
    {
      key: 'saleCategoryUUID',
      source: 'SaleCategoryScaUUID',
      label: 'Category',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'sale/categories',
        uuidField: 'ScaUUID',
        labelField: 'ScaName',
        selectedLabelField: 'SaleCategoryName',
      },
      span: 1,
    },
    {
      key: 'saleBrandUUID',
      source: 'SaleBrandSbrUUID',
      label: 'Brand',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'sale/brands',
        uuidField: 'SbrUUID',
        labelField: 'SbrName',
        selectedLabelField: 'SaleBrandName',
      },
      span: 1,
    },
    { key: 'barcode', source: 'SprBarcode', label: 'Barcode', span: 1 },
    { key: 'description', source: 'SprDescription', label: 'Description', required: true, span: 4 },
    { key: 'tags', source: 'SprTags', label: 'Tags (CSV)', span: 4 },
  ],
  rowActions: [{ key: 'images', label: 'Images', icon: 'photo_library', collection: images }],
});

@Component({
  selector: 'app-sale-product',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class SaleProductPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      price: Number(payload['price']),
      status: Number(payload['status']),
      tags: String(payload['tags'] ?? '').trim() || null,
      barcode: String(payload['barcode'] ?? '').trim() || null,
    };
  }
}
