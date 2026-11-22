import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  ispCatalogCodeField,
  ispCatalogHeadFields,
  ispCatalogListOptions,
  ispCatalogNotesField,
  ispCatalogPayload,
} from '../catalog-crud';

const radiusDictionaries = ['mikrotik', 'huawei', 'juniper', 'cisco', 'accel-ppp', 'generic'].map(
  (value) => ({ value, label: value }),
);

const config = defineCrud({
  endpoint: 'system/isp/catalog-vendors',
  uuidField: 'IcvUUID',
  ...ispCatalogListOptions('Icv'),
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
  payload: (values, editing) => ({
    ...ispCatalogPayload(values, editing, ['code'], ['radiusDictionary', 'website']),
    sortOrder: Number(values['sortOrder'] ?? 0),
  }),
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
    ...ispCatalogHeadFields('Icv'),
    ispCatalogCodeField('Icv'),
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
    ispCatalogNotesField('Icv'),
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
