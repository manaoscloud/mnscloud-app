import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  runtimeClusterColumns,
  runtimeClusterFields,
} from '../../../shared/runtime-server/runtime-server-crud';
import { DNS_BOOLEAN_OPTIONS, dnsPayload } from '../dns-input';

/** Cluster settings (resolver, filter) read right before their form opens (revision included). */
const SETTINGS = ['resolver', 'filter', 'authority'];
let settingsValues: ConfigurableCrudRecord = {};

const FILTER_CATEGORIES = [
  { value: 'threats', label: 'dns.filterCategoryThreats' },
  { value: 'gambling', label: 'dns.filterCategoryGambling' },
  { value: 'adult', label: 'dns.filterCategoryAdult' },
  { value: 'social', label: 'dns.filterCategorySocial' },
  { value: 'fakenews', label: 'dns.filterCategoryFakenews' },
] as const;

type CrudConfig = Parameters<typeof defineCrud>[0];

/** Settings form of one cluster (`/clusters/:uuid/<setting>`): a single save, no list. */
function settingsForm(
  row: ConfigurableCrudRecord,
  setting: string,
  title: string,
  description: string,
  form: Pick<CrudConfig, 'initialValues' | 'payload' | 'fields'>,
) {
  return defineCrud({
    endpoint: `system/dns/clusters/${row['DncUUID']}/${setting}`,
    uuidField: 'DnsClusterDncUUID',
    pageTitle: title,
    pageDescription: description,
    createTitle: title,
    dialogDescription: description,
    canEdit: false,
    canDelete: false,
    bulkDelete: false,
    columns: [],
    ...form,
  });
}

/** Yes/No field of a settings form. */
const yesNo = (key: string, label: string, span: 1 | 2) => ({
  key,
  label,
  type: 'select' as const,
  required: true,
  span,
  translateOptions: true,
  options: DNS_BOOLEAN_OPTIONS,
  help: `${label}Help`,
});

const config = defineCrud({
  endpoint: 'system/dns/clusters',
  uuidField: 'DncUUID',
  pageTitle: 'dns.clusters',
  pageDescription: 'dns.clustersDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision and dependency check; no bulk deletion contract.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DncRevision']) }),
  initialValues: { name: '', notes: '', status: 1, revision: 1, region: '' },
  payload: (values, editing) => dnsPayload(values, editing),
  rowActions: [
    {
      key: 'resolver',
      label: 'dns.resolverSettings',
      icon: 'dns',
      form: (row) =>
        settingsForm(row, 'resolver', 'dns.resolverSettings', 'dns.resolverSettingsDescription', {
          initialValues: {
            serviceEnabled: Number(settingsValues['DcrServiceEnabled'] ?? 0),
            dns64Prefix: settingsValues['DcrDns64Prefix'] ?? '',
            revision: Number(settingsValues['DcrRevision'] ?? 0),
          },
          payload: (values) => ({
            serviceEnabled: Number(values['serviceEnabled']),
            dns64Prefix: String(values['dns64Prefix'] ?? '').trim() || null,
            revision: Number(values['revision']),
          }),
          fields: [
            yesNo('serviceEnabled', 'dns.resolverService', 2),
            {
              key: 'dns64Prefix',
              label: 'dns.resolverDns64',
              span: 2,
              help: 'dns.resolverDns64Help',
            },
            { key: 'revision', label: 'Revision', type: 'number', hidden: true },
          ],
        }),
    },
    {
      key: 'filter',
      label: 'dns.filterSettings',
      icon: 'filter_alt',
      form: (row) =>
        settingsForm(row, 'filter', 'dns.filterSettings', 'dns.filterSettingsDescription', {
          initialValues: {
            enabled: Number(settingsValues['DcfEnabled'] ?? 0),
            categories: Array.isArray(settingsValues['DcfCategoriesJson'])
              ? settingsValues['DcfCategoriesJson']
              : [],
            safeSearch: Number(settingsValues['DcfSafeSearch'] ?? 0),
            revision: Number(settingsValues['DcfRevision'] ?? 0),
          },
          payload: (values) => ({
            enabled: Number(values['enabled']),
            categories: Array.isArray(values['categories']) ? values['categories'] : [],
            safeSearch: Number(values['safeSearch']),
            revision: Number(values['revision']),
          }),
          fields: [
            yesNo('enabled', 'dns.filterEnabled', 1),
            yesNo('safeSearch', 'dns.filterSafeSearch', 1),
            {
              key: 'categories',
              label: 'dns.filterCategories',
              type: 'multi-select',
              span: 2,
              translateOptions: true,
              options: FILTER_CATEGORIES,
              help: 'dns.filterCategoriesHelp',
            },
            { key: 'revision', label: 'Revision', type: 'number', hidden: true },
          ],
        }),
    },
    {
      key: 'authority',
      label: 'dns.authoritySettings',
      icon: 'public',
      form: (row) =>
        settingsForm(
          row,
          'authority',
          'dns.authoritySettings',
          'dns.authoritySettingsDescription',
          {
            initialValues: {
              enabled: Number(settingsValues['DcaEnabled'] ?? 0),
              nameservers: Array.isArray(settingsValues['DcaNameserversJson'])
                ? settingsValues['DcaNameserversJson'].join(', ')
                : '',
              hostmaster: settingsValues['DcaHostmaster'] ?? '',
              revision: Number(settingsValues['DcaRevision'] ?? 0),
            },
            payload: (values) => ({
              enabled: Number(values['enabled']),
              nameservers: String(values['nameservers'] ?? ''),
              hostmaster: String(values['hostmaster'] ?? '').trim(),
              revision: Number(values['revision']),
            }),
            fields: [
              yesNo('enabled', 'dns.authorityEnabled', 2),
              {
                key: 'nameservers',
                label: 'dns.authorityNameservers',
                required: true,
                span: 2,
                help: 'dns.authorityNameserversHelp',
              },
              {
                key: 'hostmaster',
                label: 'dns.authorityHostmaster',
                type: 'email',
                required: true,
                span: 2,
                help: 'dns.authorityHostmasterHelp',
              },
              { key: 'revision', label: 'Revision', type: 'number', hidden: true },
            ],
          },
        ),
    },
  ],
  fields: runtimeClusterFields('Dnc', 'dns'),
  columns: runtimeClusterColumns('Dnc', 'dns'),
});

@Component({
  selector: 'app-dns-clusters',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsClusterPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  /** The resolver, filter and authority forms open with the saved settings and their revision. */
  override async runRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (SETTINGS.includes(action.key)) {
      try {
        const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
          `system/dns/clusters/${row['DncUUID']}/${action.key}`,
        );
        settingsValues = response?.data ?? {};
      } catch (error) {
        this.snack.error(this.t(this.errorMessage(error)));
        return;
      }
    }
    await super.runRowAction(action, row);
  }
}
