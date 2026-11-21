import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const modelTypes = ['OLT', 'ONU', 'NAS', 'CPE', 'OPTICAL_CABLE', 'UTP_CABLE', 'SPLITTER'].map(
  (value) => ({ value, label: value }),
);

const config = defineCrud({
  endpoint: 'system/isp/catalog-models',
  uuidField: 'IcmUUID',
  serverSidePagination: true,
  serverSideSorting: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; there is no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['IcmRevision']) }),
  pageTitle: 'isp.catalogModels',
  pageDescription: 'isp.catalogModelsDescription',
  initialValues: {
    status: 1,
    vendorUUID: '',
    code: '',
    name: '',
    type: 'OLT',
    oltDriver: '',
    tr069: 0,
    notes: '',
  },
  payload: (values, editing) => {
    const payload: ConfigurableCrudRecord = {
      ...values,
      status: Number(values['status']),
      tr069: Number(values['tr069'] ?? 0),
      oltDriver: values['oltDriver'] || null,
    };
    // Vendor and code are fixed at creation.
    if (editing) {
      delete payload['vendorUUID'];
      delete payload['code'];
    } else delete payload['revision'];
    return payload;
  },
  columns: [
    { id: 'name', label: 'Model', field: 'IcmName', uuidField: 'IcmUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'IcmCode', translateValue: false },
    { id: 'type', label: 'Type', field: 'IcmType', translateValue: false },
    { id: 'vendor', label: 'Vendor', field: 'IcvName' },
    { id: 'status', label: 'Status', field: 'IcmStatus', kind: 'status' },
  ],
  fields: [
    { key: 'revision', source: 'IcmRevision', label: 'Revision', type: 'number', hidden: true },
    { key: 'status', source: 'IcmStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'vendorUUID',
      source: 'IspCatalogVendorIcvUUID',
      label: 'Vendor',
      type: 'search-select',
      required: true,
      remoteLookup: {
        endpoint: 'system/isp/catalog-vendors',
        uuidField: 'IcvUUID',
        labelField: 'IcvName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'Catalog vendors are platform data managed in the ISP catalog page itself.',
      span: 1,
      disabledWhen: ({ editing }) => editing,
    },
    {
      key: 'code',
      source: 'IcmCode',
      label: 'Code',
      required: true,
      span: 1,
      help: 'isp.catalogCodeHelp',
      disabledWhen: ({ editing }) => editing,
    },
    { key: 'name', source: 'IcmName', label: 'Model', required: true, span: 1 },
    {
      key: 'type',
      source: 'IcmType',
      label: 'Type',
      type: 'select',
      required: true,
      options: modelTypes,
      span: 1,
    },
    { key: 'oltDriver', source: 'IcmOltDriver', label: 'isp.oltDriver', span: 1 },
    {
      key: 'tr069',
      source: 'IcmTr069',
      label: 'isp.tr069',
      type: 'select',
      translateOptions: true,
      options: [
        { value: 0, label: 'No' },
        { value: 1, label: 'Yes' },
      ],
      span: 1,
    },
    {
      key: 'notes',
      source: 'IcmNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-catalog-models',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspCatalogModelsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
