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

/** Resolver settings read right before the form opens (revision included). */
let resolverValues: ConfigurableCrudRecord = {};

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
        defineCrud({
          endpoint: `system/dns/clusters/${row['DncUUID']}/resolver`,
          uuidField: 'DnsClusterDncUUID',
          pageTitle: 'dns.resolverSettings',
          pageDescription: 'dns.resolverSettingsDescription',
          createTitle: 'dns.resolverSettings',
          dialogDescription: 'dns.resolverSettingsDescription',
          canEdit: false,
          canDelete: false,
          bulkDelete: false,
          columns: [],
          initialValues: {
            serviceEnabled: Number(resolverValues['DcrServiceEnabled'] ?? 0),
            dns64Prefix: resolverValues['DcrDns64Prefix'] ?? '',
            revision: Number(resolverValues['DcrRevision'] ?? 0),
          },
          payload: (values) => ({
            serviceEnabled: Number(values['serviceEnabled']),
            dns64Prefix: String(values['dns64Prefix'] ?? '').trim() || null,
            revision: Number(values['revision']),
          }),
          fields: [
            {
              key: 'serviceEnabled',
              label: 'dns.resolverService',
              type: 'select',
              required: true,
              span: 2,
              translateOptions: true,
              options: DNS_BOOLEAN_OPTIONS,
              help: 'dns.resolverServiceHelp',
            },
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

  /** The resolver form opens with the saved settings and their revision. */
  override async runRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key === 'resolver') {
      try {
        const response = await this.api.get<{ data?: ConfigurableCrudRecord }>(
          `system/dns/clusters/${row['DncUUID']}/resolver`,
        );
        resolverValues = response?.data ?? {};
      } catch (error) {
        this.snack.error(this.t(this.errorMessage(error)));
        return;
      }
    }
    await super.runRowAction(action, row);
  }
}
