import type {
  ConfigurableCrudColumn,
  ConfigurableCrudField,
  ConfigurableCrudListFilter,
} from '../crud/configurable-crud/configurable-crud-page-base';

const sectorLookup = {
  endpoint: 'registry/economic-sectors',
  uuidField: 'RecUUID',
  labelField: 'RecName',
};
const industryLookup = {
  endpoint: 'registry/industries',
  uuidField: 'RinUUID',
  labelField: 'RinName',
  descriptionField: 'SectorName',
};
export function economicSectorFilter(): ConfigurableCrudListFilter {
  return {
    key: 'RegEconomicSectorRecUUID',
    paramKey: 'RegEconomicSectorRecUUID',
    label: 'registry.economy.sector',
    type: 'search-select',
    span: 1,
    remoteLookup: sectorLookup,
  };
}
export function economicClassificationFilters(): ConfigurableCrudListFilter[] {
  return [
    economicSectorFilter(),
    {
      key: 'RegIndustryRinUUID',
      paramKey: 'RegIndustryRinUUID',
      label: 'registry.economy.industries',
      type: 'search-select',
      span: 1,
      remoteLookup: industryLookup,
    },
  ];
}
export function industryReferenceField(): ConfigurableCrudField {
  return {
    key: 'RegIndustryRinUUID',
    source: 'RegIndustryRinUUID',
    label: 'registry.economy.industries',
    span: 1,
    type: 'search-select',
    remoteLookup: { ...industryLookup, selectedLabelField: 'RegIndustryRinUUIDName' },
  };
}
export function industryReferenceColumn(): ConfigurableCrudColumn {
  return {
    id: 'RegIndustryRinUUID',
    field: 'RegIndustryRinUUIDName',
    label: 'registry.economy.industries',
    kind: 'text',
  };
}
export function economicCatalogFields(prefix: 'Rec' | 'Rin'): ConfigurableCrudField[] {
  return [
    { key: prefix + 'Status', source: prefix + 'Status', label: 'Status', type: 'status', span: 1 },
    { key: prefix + 'Name', source: prefix + 'Name', label: 'Name', required: true, span: 2 },
    ...(prefix === 'Rin'
      ? [
          {
            key: 'RegEconomicSectorRecUUID',
            source: 'RegEconomicSectorRecUUID',
            label: 'registry.economy.sector',
            required: true,
            type: 'search-select' as const,
            span: 1 as const,
            remoteLookup: { ...sectorLookup, selectedLabelField: 'SectorName' },
          },
        ]
      : []),
    {
      key: prefix + 'Description',
      source: prefix + 'Description',
      label: 'Description',
      type: 'textarea',
      rows: 4,
      span: 4,
    },
    { key: prefix + 'Revision', source: prefix + 'Revision', label: 'Revision', hidden: true },
  ];
}
export function economicCatalogColumns(prefix: 'Rec' | 'Rin'): ConfigurableCrudColumn[] {
  return [
    { id: 'name', field: prefix + 'Name', label: 'Name', kind: 'identity' },
    ...(prefix === 'Rin'
      ? [
          {
            id: 'sector',
            field: 'SectorName',
            label: 'registry.economy.sector',
            kind: 'text' as const,
          },
        ]
      : []),
    { id: 'description', field: prefix + 'Description', label: 'Description', kind: 'text' },
    { id: 'status', field: prefix + 'Status', label: 'Status', kind: 'status' },
  ];
}
