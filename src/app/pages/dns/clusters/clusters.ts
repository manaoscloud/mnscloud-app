import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  runtimeClusterColumns,
  runtimeClusterFields,
} from '../../../shared/runtime-server/runtime-server-crud';
import { dnsPayload } from '../dns-input';

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
}
