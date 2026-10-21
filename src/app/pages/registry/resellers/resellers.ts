import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { registryPartyColumns, registryPartyFields, registryPartyValues } from '../registry-fields';

const RESELLER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/resellers',
  uuidField: 'ResellerUUID',
  pageTitle: 'Resellers',
  pageDescription: 'Manage reseller records and contact data.',
  createTitle: 'New reseller',
  editTitle: 'Edit reseller',
  dialogDescription: 'Maintain reseller registration, contact and address data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No resellers found.',
  deleteTitle: 'Delete reseller',
  deleteMessage: 'Are you sure you want to delete this reseller?',
  deleteSelectedTitle: 'Delete selected resellers',
  deleteSelectedMessage: 'Delete {count} selected resellers?',
  savedMessage: 'Reseller saved successfully.',
  deletedMessage: 'Reseller deleted successfully.',
  deleteFailedMessage: 'Failed to delete reseller.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: registryPartyValues(),
  columns: registryPartyColumns('ResellerUUID'),
  fields: registryPartyFields(),
};

@Component({
  selector: 'app-registry-resellers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegResellerPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(RESELLER_CONFIG);
  }
}
