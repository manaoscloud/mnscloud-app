import { Component } from '@angular/core';

import { injectPlatformScope } from '../../../core/scope/route-scope';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  PLATFORM_SITE_KIND_OPTIONS,
  SITE_KIND_OPTIONS,
  crudRights,
  crudTexts,
  formText,
  formTexts,
  injectNetworkPermission,
  networkBase,
  optionColumn,
  recordState,
  stateFields,
  statusField,
} from '../network-options';

/**
 * Where network devices live: the tenant's own network, customer premises, data centers, POPs
 * and offices. Platform sites (`/system/network/sites`) never have a customer.
 */
function siteConfig(
  platform: boolean,
  can: (permission: string) => boolean,
): ConfigurableCrudConfig {
  const kinds = platform ? PLATFORM_SITE_KIND_OPTIONS : SITE_KIND_OPTIONS;
  return defineCrud({
    endpoint: `${networkBase(platform)}/sites`,
    uuidField: 'NwsUUID',
    pageTitle: platform ? 'network.platformSites' : 'network.sites',
    pageDescription: platform ? 'network.platformSitesDescription' : 'network.sitesDescription',
    ...crudTexts('Site'),
    // The API has no bulk endpoint: each deletion carries its own revision and a site with
    // devices is refused.
    bulkDelete: false,
    ...crudRights(can, 'sites', 'NwsRevision'),
    listFilters: [
      {
        key: 'kind',
        label: 'network.siteKindLabel',
        paramKey: 'kind',
        type: 'select',
        span: 1,
        options: [{ value: '', label: 'All' }, ...kinds],
        translateOptions: true,
      },
    ],
    initialValues: {
      status: 1,
      name: '',
      kind: platform ? 'datacenter' : 'internal',
      customerUUID: '',
      city: '',
      country: '',
      address: '',
      facilityCode: '',
      revision: null,
      notes: '',
    },
    fields: [
      statusField('Nws'),
      {
        key: 'name',
        source: 'NwsName',
        label: 'Name',
        required: true,
        span: 1,
        placeholder: 'network.siteNamePlaceholder',
      },
      {
        key: 'kind',
        source: 'NwsKind',
        label: 'network.siteKindLabel',
        type: 'select',
        options: kinds,
        required: true,
        span: 1,
        help: platform ? 'network.platformSiteKindHelp' : 'network.siteKindHelp',
      },
      {
        key: 'customerUUID',
        source: 'RegCustomerRcuUUID',
        label: 'Customer',
        type: 'search-select',
        span: 1,
        hiddenWhen: ({ values }) => platform || values['kind'] !== 'customer',
        requiredWhen: ({ values }) => !platform && values['kind'] === 'customer',
        help: 'network.siteCustomerHelp',
        remoteLookup: {
          endpoint: 'registry/customers?status=1',
          uuidField: 'CustomerUUID',
          labelField: 'Name',
          selectedLabelField: 'CustomerName',
        },
      },
      { key: 'city', source: 'NwsCity', label: 'City', span: 1 },
      {
        key: 'country',
        source: 'NwsCountry',
        label: 'Country',
        span: 1,
        placeholder: 'BR',
        help: 'network.countryHelp',
      },
      { key: 'address', source: 'NwsAddress', label: 'network.address', span: 1 },
      {
        key: 'facilityCode',
        source: 'NwsFacilityCode',
        label: 'network.facilityCode',
        span: 1,
        help: 'network.facilityCodeHelp',
      },
      ...stateFields('Nws'),
    ],
    columns: [
      { id: 'name', label: 'Name', kind: 'identity', field: 'NwsName', uuidField: 'NwsUUID' },
      optionColumn(
        { id: 'kind', label: 'network.siteKindLabel', field: 'NwsKind' },
        SITE_KIND_OPTIONS,
      ),
      ...(platform
        ? []
        : [
            {
              id: 'customer',
              label: 'Customer',
              field: 'CustomerName',
              kind: 'related' as const,
              uuidField: 'RegCustomerRcuUUID',
            },
          ]),
      { id: 'city', label: 'City', field: 'NwsCity' },
      { id: 'country', label: 'Country', field: 'NwsCountry', width: 'xs' },
      {
        id: 'facilityCode',
        label: 'network.facilityCode',
        field: 'NwsFacilityCode',
        optional: true,
      },
      { id: 'devices', label: 'network.devices', field: 'DeviceCount', kind: 'number' },
      { id: 'status', label: 'Status', field: 'NwsStatus', kind: 'status' },
    ],
    // PUT replaces the text fields: the whole form is sent.
    payload: (values) => {
      const kind = formText(values['kind']);
      return {
        ...formTexts(values, ['name', 'city', 'address', 'facilityCode']),
        kind,
        customerUUID: !platform && kind === 'customer' ? formText(values['customerUUID']) : null,
        country: formText(values['country'])?.toUpperCase() ?? null,
        ...recordState(values),
      };
    },
  });
}

@Component({
  selector: 'app-network-sites',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class NetworkSitesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const platform = injectPlatformScope();
    super(siteConfig(platform, injectNetworkPermission(platform)));
  }
}
