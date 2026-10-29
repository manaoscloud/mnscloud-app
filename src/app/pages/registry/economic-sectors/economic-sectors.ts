import {
  economicCatalogFields,
  economicCatalogColumns,
} from '../../../shared/registry/economic-classification';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'registry/economic-sectors',
  uuidField: 'RecUUID',
  pageTitle: 'registry.economy.economic-sectors',
  pageDescription: 'registry.economy.economic-sectors.description',
  serverSidePagination: true,
  initialValues: { RecName: '', RecDescription: '', RecStatus: 1 },
  fields: economicCatalogFields('Rec'),
  columns: economicCatalogColumns('Rec'),
  quickCreateLabelField: 'RecName',
});

@Component({
  selector: 'app-economic-sectors',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegEconomicSectorPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
