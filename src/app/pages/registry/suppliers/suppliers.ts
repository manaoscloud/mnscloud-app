import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { registryPartyColumns, registryPartyFields, registryPartyValues } from '../registry-fields';

const SUPPLIER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/suppliers',
  uuidField: 'SupplierUUID',
  pageTitle: 'Suppliers',
  pageDescription: 'Manage suppliers, documents, contacts and addresses.',
  createTitle: 'New supplier',
  editTitle: 'Edit supplier',
  dialogDescription: 'Maintain supplier registration and commercial contact data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No suppliers found.',
  deleteTitle: 'Delete supplier',
  deleteMessage: 'Are you sure you want to delete this supplier?',
  deleteSelectedTitle: 'Delete selected suppliers',
  deleteSelectedMessage: 'Delete {count} selected suppliers?',
  savedMessage: 'Supplier saved successfully.',
  deletedMessage: 'Supplier deleted successfully.',
  deleteFailedMessage: 'Failed to delete supplier.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: registryPartyValues(),
  columns: registryPartyColumns('SupplierUUID'),
  fields: registryPartyFields(),
};

@Component({
  selector: 'app-registry-suppliers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegSupplierPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(SUPPLIER_CONFIG);
  }
}
