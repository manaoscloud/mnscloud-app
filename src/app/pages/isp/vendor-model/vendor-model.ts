import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const modelTypes = ['OLT', 'ONU', 'NAS', 'CPE', 'OPTICAL_CABLE', 'UTP_CABLE', 'SPLITTER'].map(
  (value) => ({ value, label: value }),
);

const config = defineCrud({
  endpoint: 'isp/vendor-models',
  uuidField: 'VendorModelUUID',
  pageTitle: 'Vendor Models',
  pageDescription: 'Map vendor equipment models to your ISP inventory.',
  bulkDelete: true,
  initialValues: { status: 1, vendorUUID: '', name: '', type: 'OLT', notes: '' },
  columns: [
    {
      id: 'name',
      label: 'Model',
      field: 'VendorModelName',
      uuidField: 'VendorModelUUID',
      kind: 'identity',
    },
    { id: 'type', label: 'Type', field: 'VendorModelType', translateValue: false },
    { id: 'vendor', label: 'Vendor', field: 'VendorName' },
    { id: 'status', label: 'Status', field: 'VendorModelStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'VendorModelStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'vendorUUID',
      source: 'VendorUUID',
      label: 'Vendor',
      type: 'search-select',
      required: true,
      remoteLookup: { endpoint: 'isp/vendors', uuidField: 'VendorUUID', labelField: 'VendorName' },
      quickCreate: quickCreateFor('IspVendorIveUUID'),
      span: 1,
    },
    { key: 'name', source: 'VendorModelName', label: 'Model', required: true, span: 1 },
    {
      key: 'type',
      source: 'VendorModelType',
      label: 'Type',
      type: 'select',
      required: true,
      options: modelTypes,
      span: 1,
    },
    {
      key: 'notes',
      source: 'VendorModelNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-vendor-model',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspVendorModelPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
