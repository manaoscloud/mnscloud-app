import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const radiusDictionaries = ['mikrotik', 'huawei', 'juniper', 'cisco', 'accel-ppp', 'generic'].map(
  (value) => ({ value, label: value }),
);

const config = defineCrud({
  endpoint: 'system/isp/catalog-vendors',
  uuidField: 'IcvUUID',
  serverSidePagination: true,
  serverSideSorting: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; there is no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['IcvRevision']) }),
  pageTitle: 'isp.catalogVendors',
  pageDescription: 'isp.catalogVendorsDescription',
  initialValues: {
    status: 1,
    code: '',
    name: '',
    website: '',
    radiusDictionary: '',
    sortOrder: 0,
    notes: '',
  },
  payload: (values, editing) => {
    const payload: ConfigurableCrudRecord = {
      ...values,
      status: Number(values['status']),
      sortOrder: Number(values['sortOrder'] ?? 0),
      radiusDictionary: values['radiusDictionary'] || null,
      website: values['website'] || null,
    };
    // The code is a slug fixed at creation.
    if (editing) delete payload['code'];
    else delete payload['revision'];
    return payload;
  },
  columns: [
    { id: 'name', label: 'Name', field: 'IcvName', uuidField: 'IcvUUID', kind: 'identity' },
    { id: 'code', label: 'Code', field: 'IcvCode', translateValue: false },
    {
      id: 'radiusDictionary',
      label: 'isp.radiusDictionary',
      field: 'IcvRadiusDictionary',
      translateValue: false,
    },
    { id: 'sortOrder', label: 'isp.sortOrder', field: 'IcvSortOrder' },
    { id: 'status', label: 'Status', field: 'IcvStatus', kind: 'status' },
  ],
  fields: [
    { key: 'revision', source: 'IcvRevision', label: 'Revision', type: 'number', hidden: true },
    { key: 'status', source: 'IcvStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'code',
      source: 'IcvCode',
      label: 'Code',
      required: true,
      span: 1,
      help: 'isp.catalogCodeHelp',
      disabledWhen: ({ editing }) => editing,
    },
    { key: 'name', source: 'IcvName', label: 'Name', required: true, span: 1 },
    { key: 'website', source: 'IcvWebsite', label: 'Website', span: 1 },
    {
      key: 'radiusDictionary',
      source: 'IcvRadiusDictionary',
      label: 'isp.radiusDictionary',
      type: 'select',
      options: radiusDictionaries,
      span: 1,
    },
    { key: 'sortOrder', source: 'IcvSortOrder', label: 'isp.sortOrder', type: 'number', span: 1 },
    {
      key: 'notes',
      source: 'IcvNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
});

@Component({
  selector: 'app-isp-catalog-vendors',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class IspCatalogVendorsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
