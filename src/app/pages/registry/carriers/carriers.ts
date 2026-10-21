import { Component } from '@angular/core';

import {
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  CONFIGURABLE_CRUD_IMPORTS,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { registryPartyColumns, registryPartyFields, registryPartyValues } from '../registry-fields';

const CARRIER_CONFIG: ConfigurableCrudConfig = {
  endpoint: 'registry/carriers',
  uuidField: 'CarrierUUID',
  pageTitle: 'Carriers',
  pageDescription: 'Manage carriers and logistics contact data.',
  createTitle: 'New carrier',
  editTitle: 'Edit carrier',
  dialogDescription: 'Maintain carrier registration, contact and address data.',
  searchPlaceholder: 'Search',
  emptyLabel: 'No carriers found.',
  deleteTitle: 'Delete carrier',
  deleteMessage: 'Are you sure you want to delete this carrier?',
  deleteSelectedTitle: 'Delete selected carriers',
  deleteSelectedMessage: 'Delete {count} selected carriers?',
  savedMessage: 'Carrier saved successfully.',
  deletedMessage: 'Carrier deleted successfully.',
  deleteFailedMessage: 'Failed to delete carrier.',
  statusMode: 'number',
  activeValue: 1,
  inactiveValue: 0,
  initialValues: registryPartyValues(),
  columns: registryPartyColumns('CarrierUUID'),
  fields: registryPartyFields(),
};

@Component({
  selector: 'app-registry-carriers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegCarrierPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CARRIER_CONFIG);
  }
}
