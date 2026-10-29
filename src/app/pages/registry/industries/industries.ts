import {
  economicCatalogFields,
  economicCatalogColumns,
  economicSectorFilter,
} from '../economic-classification';
import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';

const config = defineCrud({
  endpoint: 'registry/industries',
  uuidField: 'RinUUID',
  pageTitle: 'registry.economy.industries',
  pageDescription: 'registry.economy.industries.description',
  serverSidePagination: true,
  initialValues: { RinName: '', RinDescription: '', RinStatus: 1 },
  fields: economicCatalogFields('Rin'),
  columns: economicCatalogColumns('Rin'),
  listFilters: [economicSectorFilter()],
  quickCreateLabelField: 'RinName',
});

@Component({
  selector: 'app-industries',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class RegIndustryPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }
}
