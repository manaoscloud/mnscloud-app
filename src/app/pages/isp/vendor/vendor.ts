import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { quickCreateFor } from '../../../shared/crud/configurable-crud/quick-create';

const config = defineCrud({
  endpoint: 'isp/vendors',
  uuidField: 'VendorUUID',
  pageTitle: 'Vendors',
  pageDescription: 'Equipment vendors linked to ISP inventory.',
  bulkDelete: true,
  initialValues: {
    status: 1,
    name: '',
    supplierUUID: '',
    website: '',
    supportEmail: '',
    supportPhone: '',
    notes: '',
  },
  columns: [
    { id: 'name', label: 'Name', field: 'VendorName', uuidField: 'VendorUUID', kind: 'identity' },
    { id: 'supplier', label: 'Supplier', field: 'SupplierName' },
    { id: 'website', label: 'Website', field: 'VendorWebsite' },
    { id: 'supportEmail', label: 'Support Email', field: 'VendorSupportEmail' },
    { id: 'status', label: 'Status', field: 'VendorStatus', kind: 'status' },
  ],
  fields: [
    { key: 'status', source: 'VendorStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'VendorName', label: 'Name', required: true, span: 1 },
    {
      key: 'supplierUUID',
      source: 'SupplierUUID',
      label: 'Supplier',
      type: 'search-select',
      remoteLookup: { endpoint: 'erp/suppliers', uuidField: 'SupplierUUID', labelField: 'Name' },
      quickCreate: quickCreateFor('ErpSupplierSupUUID'),
      span: 1,
    },
    { key: 'website', source: 'VendorWebsite', label: 'Website', span: 1 },
    {
      key: 'supportEmail',
      source: 'VendorSupportEmail',
      label: 'Support Email',
      type: 'email',
      span: 1,
    },
    {
      key: 'supportPhone',
      source: 'VendorSupportPhone',
      label: 'Support Phone',
      type: 'phone',
      span: 1,
    },
    {
      key: 'notes',
      source: 'VendorNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-vendor',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspVendorPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord): ConfigurableCrudRecord {
    return {
      ...payload,
      supplierUUID: payload['supplierUUID'] || null,
      status: Number(payload['status']),
    };
  }
}
