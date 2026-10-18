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

// The nature decides the fiscal document (goods -> NF-e/NFC-e, communication -> NFCom,
// services -> NFS-e); it is the real nature of the item, never the module that sells it.
const fiscalNatures = [
  { value: '', label: 'Not classified' },
  { value: 'goods', label: 'Goods' },
  { value: 'communication', label: 'Communication service' },
  { value: 'telephony', label: 'Telephony service' },
  { value: 'sva', label: 'Value-added service (SVA)' },
  { value: 'hosting', label: 'Hosting service' },
  { value: 'processing', label: 'Data processing service' },
  { value: 'storage', label: 'Storage service' },
  { value: 'licensing', label: 'Software licensing' },
  { value: 'support', label: 'Technical support service' },
  { value: 'service', label: 'Other service' },
];

const fiscalOrigins = [
  { value: '', label: 'Not informed' },
  { value: 0, label: '0 - National' },
  { value: 1, label: '1 - Foreign, direct import' },
  { value: 2, label: '2 - Foreign, bought in the domestic market' },
  { value: 3, label: '3 - National, import content over 40%' },
  { value: 4, label: '4 - National, basic production processes' },
  { value: 5, label: '5 - National, import content up to 40%' },
  { value: 6, label: '6 - Foreign, direct import without national similar' },
  { value: 7, label: '7 - Foreign, domestic market without national similar' },
  { value: 8, label: '8 - National, import content over 70%' },
];

const SERVICE_NATURES = new Set([
  'sva',
  'hosting',
  'processing',
  'storage',
  'licensing',
  'support',
  'service',
]);
const isGoods = (values: ConfigurableCrudRecord) => values['fiscalNature'] === 'goods';
const isService = (values: ConfigurableCrudRecord) =>
  SERVICE_NATURES.has(String(values['fiscalNature'] ?? ''));
const isCommunication = (values: ConfigurableCrudRecord) =>
  ['communication', 'telephony'].includes(String(values['fiscalNature'] ?? ''));

// Additional barcodes: packaging codes (with the quantity they hold) and internal codes. The main
// GTIN is the product barcode; a code is unique per tenant across both.
function barcodes(product: ConfigurableCrudRecord) {
  const productUUID = String(product['SprUUID']);
  return defineCrud({
    endpoint: `sale/products/${productUUID}/barcodes`,
    uuidField: 'SpbUUID',
    pageTitle: 'Barcodes',
    pageDescription: 'Additional barcodes of the product, such as packaging and internal codes.',
    createTitle: 'New barcode',
    editTitle: 'Edit barcode',
    bulkDelete: false,
    statusFilter: false,
    initialValues: { barcode: '', kind: 'packaging', unitUUID: '', quantity: 1 },
    columns: [
      {
        id: 'barcode',
        label: 'Barcode',
        field: 'SpbBarcode',
        kind: 'identity',
        uuidField: 'SpbUUID',
      },
      { id: 'kind', label: 'Kind', field: 'SpbKind', options: barcodeKinds },
      { id: 'unit', label: 'Unit', field: 'SaleUnitName' },
      { id: 'quantity', label: 'Quantity', field: 'SpbQuantity', kind: 'number' },
    ],
    fields: [
      { key: 'barcode', source: 'SpbBarcode', label: 'Barcode', required: true, span: 2 },
      {
        key: 'kind',
        source: 'SpbKind',
        label: 'Kind',
        type: 'select',
        options: barcodeKinds,
        required: true,
        span: 1,
      },
      {
        key: 'quantity',
        source: 'SpbQuantity',
        label: 'Quantity',
        type: 'number',
        required: true,
        help: 'Sale units contained in the packaging read by this code.',
        span: 1,
      },
      {
        key: 'unitUUID',
        source: 'SaleUnitSunUUID',
        label: 'Packaging unit',
        type: 'search-select',
        remoteLookup: {
          endpoint: 'sale/units',
          uuidField: 'SunUUID',
          labelField: 'SunName',
          selectedLabelField: 'SaleUnitName',
        },
        span: 2,
      },
    ],
  });
}

const barcodeKinds = [
  { value: 'packaging', label: 'Packaging' },
  { value: 'internal', label: 'Internal code' },
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
    fiscalNature: '',
    fiscalRevision: null,
    fiscalNcm: '',
    fiscalCest: '',
    fiscalOrigin: '',
    fiscalExTipi: '',
    fiscalServiceCode: '',
    fiscalMunicipalServiceCode: '',
    fiscalNbs: '',
    fiscalCommunicationClass: '',
    fiscalTaxClassCode: '',
  },
  columns: [
    { id: 'image', label: 'Image', field: 'CoverUrl', kind: 'image' },
    { id: 'name', label: 'Name', field: 'SprName', uuidField: 'SprUUID', kind: 'identity' },
    { id: 'type', label: 'Type', field: 'SprType', options: productTypes },
    { id: 'category', label: 'Category', field: 'SaleCategoryName' },
    { id: 'brand', label: 'Brand', field: 'SaleBrandName' },
    { id: 'price', label: 'Price', field: 'SprPrice', kind: 'currency' },
    { id: 'nature', label: 'Fiscal nature', field: 'FicNature', options: fiscalNatures },
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
    {
      key: 'fiscalNature',
      source: 'FicNature',
      label: 'Fiscal nature',
      type: 'select',
      options: fiscalNatures,
      fromRecord: (value) => String(value ?? ''),
      help: 'Real nature of the item; it decides which fiscal document is issued for it.',
      tab: 'fiscal',
      span: 2,
    },
    {
      key: 'fiscalRevision',
      source: 'FicRevision',
      label: 'Revision',
      hidden: true,
      tab: 'fiscal',
    },
    {
      key: 'fiscalNcm',
      source: 'FicNcm',
      label: 'NCM',
      translateLabel: false,
      placeholder: '0000.00.00',
      requiredWhen: ({ values }) => isGoods(values),
      hiddenWhen: ({ values }) => !isGoods(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalOrigin',
      source: 'FicOrigin',
      label: 'Goods origin',
      type: 'select',
      options: fiscalOrigins,
      fromRecord: (value) => (value === null || value === undefined ? '' : Number(value)),
      requiredWhen: ({ values }) => isGoods(values),
      hiddenWhen: ({ values }) => !isGoods(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalCest',
      source: 'FicCest',
      label: 'CEST',
      translateLabel: false,
      hiddenWhen: ({ values }) => !isGoods(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalExTipi',
      source: 'FicExTipi',
      label: 'EX TIPI',
      translateLabel: false,
      hiddenWhen: ({ values }) => !isGoods(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalServiceCode',
      source: 'FicServiceCode',
      label: 'Service list item (LC 116)',
      placeholder: '00.00',
      hiddenWhen: ({ values }) => !isService(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalMunicipalServiceCode',
      source: 'FicMunicipalServiceCode',
      label: 'Municipal service code',
      hiddenWhen: ({ values }) => !isService(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalNbs',
      source: 'FicNbs',
      label: 'NBS',
      translateLabel: false,
      hiddenWhen: ({ values }) => !isService(values) && !isCommunication(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalCommunicationClass',
      source: 'FicCommunicationClass',
      label: 'Communication item class (cClass)',
      hiddenWhen: ({ values }) => !isCommunication(values),
      tab: 'fiscal',
      span: 1,
    },
    {
      key: 'fiscalTaxClassCode',
      source: 'FicTaxClassCode',
      label: 'IBS/CBS classification (cClassTrib)',
      hiddenWhen: ({ values }) => !values['fiscalNature'],
      tab: 'fiscal',
      span: 1,
    },
  ],
  rowActions: [
    { key: 'images', label: 'Images', icon: 'photo_library', collection: images },
    { key: 'barcodes', label: 'Barcodes', icon: 'qr_code_scanner', collection: barcodes },
  ],
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
      fiscalNature: String(payload['fiscalNature'] ?? '').trim() || null,
      fiscalOrigin:
        payload['fiscalOrigin'] === '' || payload['fiscalOrigin'] === null
          ? null
          : Number(payload['fiscalOrigin']),
      fiscalRevision:
        payload['fiscalRevision'] === null || payload['fiscalRevision'] === undefined
          ? null
          : Number(payload['fiscalRevision']),
    };
  }
}
