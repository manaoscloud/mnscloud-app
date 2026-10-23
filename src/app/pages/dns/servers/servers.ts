import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudField,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  RuntimeServerCrudPage,
  runtimeServerClusterField,
  runtimeServerColumns,
  runtimeServerRowActions,
} from '../../../shared/runtime-server/runtime-server-crud';
import { DNS_BOOLEAN_OPTIONS, dnsPayload, dnsRoles } from '../dns-input';

/** Roles decide which engines are installed; they cannot change after creation. */
function roleField(
  key: string,
  source: string,
  labelKey: string,
  helpKey: string,
): ConfigurableCrudField {
  return {
    key,
    source,
    label: labelKey,
    span: 1,
    required: true,
    type: 'select',
    translateOptions: true,
    options: DNS_BOOLEAN_OPTIONS,
    tab: 'network',
    disabledWhen: ({ editing }) => editing,
    help: helpKey,
  };
}

const config = defineCrud({
  endpoint: 'system/dns/servers',
  uuidField: 'DsvUUID',
  pageTitle: 'dns.servers',
  pageDescription: 'dns.serverSetupDescription',
  dialogDescription: 'dns.serverSetupDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DsvRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    // A server is activated by its verified installation, never by the form.
    status: 0,
    roleRecursive: 1,
    roleAuthoritative: 0,
    roleEdge: 1,
    revision: 1,
    DnsClusterDncUUID: '',
  },
  payload: (values, editing) => dnsPayload(values, editing),
  rowActions: runtimeServerRowActions('Dsv', 'dns'),
  fields: [
    {
      key: 'status',
      source: 'DsvStatus',
      label: 'Status',
      type: 'status',
      span: 1,
      help: 'dns.serverStatusHelp',
      hiddenWhen: ({ editing }) => !editing,
    },
    runtimeServerClusterField('DnsClusterDncUUID', 'system/dns/clusters', 'Dnc', 'dns'),
    { key: 'name', source: 'DsvName', label: 'Name', required: true, span: 1 },
    { key: 'revision', source: 'DsvRevision', label: 'Revision', type: 'number', hidden: true },
    roleField('roleRecursive', 'DsvRoleRecursive', 'dns.roles.recursive', 'dns.roleRecursiveHelp'),
    roleField(
      'roleAuthoritative',
      'DsvRoleAuthoritative',
      'dns.roles.authoritative',
      'dns.roleAuthoritativeHelp',
    ),
    roleField('roleEdge', 'DsvRoleEdge', 'dns.roles.edge', 'dns.roleEdgeHelp'),
    {
      hiddenWhen: ({ editing }) => !editing,
      key: 'notes',
      source: 'DsvNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { network: 'dns.rolesTab' },
  columns: [
    { id: 'name', field: 'DsvName', label: 'Name', kind: 'identity' },
    {
      id: 'roles',
      field: 'DsvRoleRecursive',
      label: 'dns.roles.title',
      kind: 'text',
      value: (row, translate) => dnsRoles(row, translate),
    },
    ...runtimeServerColumns('Dsv', 'dns', 'DnsClusterDncUUID', (o) => [
      o['nodeAddress'],
      o['operatingSystem'],
      o['architecture'],
      o['version'],
      o['recursorVersion'] ?? o['authoritativeVersion'],
    ]),
  ],
});

@Component({
  selector: 'app-dns-servers',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsServerPage extends RuntimeServerCrudPage {
  protected readonly installation = {
    endpoint: config.endpoint,
    prefix: 'Dsv',
    i18n: 'dns',
    module: 'DNS',
    runtime: 'dns',
  };
  constructor() {
    super(config);
  }
}
