import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'isp/nas',
  uuidField: 'InsUUID',
  pageTitle: 'NAS',
  pageDescription: 'Network Access Servers connected to your POPs.',
  bulkDelete: true,
  initialValues: {
    status: 1,
    popUUID: '',
    name: '',
    ip: '',
    vendorUUID: '',
    vendorModelUUID: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'InsName', uuidField: 'InsUUID', kind: 'identity' },
    { id: 'ip', label: 'IP', field: 'InsIp' },
    { id: 'vendor', label: 'Vendor', field: 'InsVendorName' },
    { id: 'model', label: 'Model', field: 'InsVendorModelName' },
    { id: 'pop', label: 'POP', field: 'IppName' },
    { id: 'status', label: 'Status', field: 'InsStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'InsStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'popUUID',
      source: 'IspPopIppUUID',
      label: 'POP',
      type: 'search-select',
      required: true,
      remoteLookup: { endpoint: 'isp/pops', uuidField: 'IppUUID', labelField: 'IppName' },
      span: 1,
    },
    { key: 'name', source: 'InsName', label: 'Name', required: true, span: 1 },
    { key: 'ip', source: 'InsIp', label: 'IP', required: true, span: 1 },
    {
      key: 'vendorUUID',
      source: 'IspVendorIveUUID',
      label: 'Vendor',
      type: 'search-select',
      required: true,
      remoteLookup: { endpoint: 'isp/vendors', uuidField: 'VendorUUID', labelField: 'VendorName' },
      span: 1,
    },
    {
      key: 'vendorModelUUID',
      source: 'IspVendorModelIvmUUID',
      label: 'Model',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'isp/vendor-models?type=NAS',
        uuidField: 'VendorModelUUID',
        labelField: 'VendorModelName',
      },
      span: 1,
    },
    {
      key: 'notes',
      source: 'InsNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-nas',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspNasPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return { ...payload, status: Number(payload['status']) };
  }
}
