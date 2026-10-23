import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import {
  REGISTRY_STATUS_FIELD,
  REGISTRY_STATUS_COLUMN,
  registryNameField,
  registryNameColumn,
} from '../registry-fields';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

export const CONTACT_SECTORS_CONFIG = defineCrud({
  endpoint: 'registry/contact-sectors',
  uuidField: 'ContactSectorUUID',
  pageTitle: 'registry.sectors',
  serverSidePagination: true,
  createTitle: 'registry.newSector',
  editTitle: 'registry.editSector',
  // Page Description Contract: say what the resource is for, then add the key in PT/EN/ES.
  pageDescription: 'registry.sectorDescription',
  initialValues: { name: '', status: 1 },
  fields: [REGISTRY_STATUS_FIELD, registryNameField({ span: 1 })],
  columns: [registryNameColumn('ContactSectorUUID'), REGISTRY_STATUS_COLUMN],
});

@Component({
  selector: 'app-contact-sectors',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegContactSectorPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(CONTACT_SECTORS_CONFIG);
  }
}
