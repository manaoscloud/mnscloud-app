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
  fields: [
    { key: 'RinStatus', source: 'RinStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'RinName', source: 'RinName', label: 'Name', required: true, span: 2 },
    {
      key: 'RegEconomicSectorRecUUID',
      source: 'RegEconomicSectorRecUUID',
      label: 'registry.economy.sector',
      required: true,
      type: 'search-select',
      span: 1,
      remoteLookup: {
        endpoint: 'registry/economic-sectors',
        uuidField: 'RecUUID',
        labelField: 'RecName',
        selectedLabelField: 'SectorName',
      },
    },
    {
      key: 'RinDescription',
      source: 'RinDescription',
      label: 'Description',
      type: 'textarea',
      span: 4,
    },
    { key: 'RinRevision', source: 'RinRevision', label: 'Revision', hidden: true },
  ],
  columns: [
    { id: 'name', field: 'RinName', label: 'Name', kind: 'identity' },
    { id: 'sector', field: 'SectorName', label: 'registry.economy.sector', kind: 'text' },
    { id: 'description', field: 'RinDescription', label: 'Description', kind: 'text' },
    { id: 'status', field: 'RinStatus', label: 'Status', kind: 'status' },
  ],
  listFilters: [
    {
      key: 'RegEconomicSectorRecUUID',
      paramKey: 'RegEconomicSectorRecUUID',
      label: 'registry.economy.sector',
      type: 'search-select',
      span: 1,
      remoteLookup: {
        endpoint: 'registry/economic-sectors',
        uuidField: 'RecUUID',
        labelField: 'RecName',
      },
    },
  ],
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
