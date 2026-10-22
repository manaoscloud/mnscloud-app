import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
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
  fields: [
    { key: 'status', source: 'Status', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'Name', label: 'Name', required: true, span: 1 },
  ],
  columns: [
    { id: 'name', field: 'Name', label: 'Name', kind: 'identity' },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status' },
  ],
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
