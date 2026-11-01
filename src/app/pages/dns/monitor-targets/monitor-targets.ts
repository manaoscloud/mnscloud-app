import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudFilterAction,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { dnsMonitorTargetPayload } from '../dns-input';

const isResolver = (values: ConfigurableCrudRecord) => values['kind'] === 'resolver';

const config = defineCrud({
  endpoint: 'system/dns/monitor/targets',
  uuidField: 'DmtUUID',
  pageTitle: 'dns.monitorTargets',
  pageDescription: 'dns.monitorTargetsDescription',
  dialogDescription: 'dns.monitorTargetsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DmtRevision']) }),
  initialValues: {
    name: '',
    kind: 'service',
    target: '',
    queryName: 'www.google.com',
    queryType: 'A',
    status: 1,
    revision: 1,
  },
  payload: (values, editing) => dnsMonitorTargetPayload(values, editing),
  filterActions: [{ key: 'defaults', label: 'dns.monitorDefaults', icon: 'playlist_add' }],
  fields: [
    { key: 'status', source: 'DmtStatus', label: 'Status', type: 'status', span: 1 },
    { key: 'name', source: 'DmtName', label: 'Name', required: true, span: 1 },
    {
      key: 'kind',
      source: 'DmtKind',
      label: 'dns.monitorKind',
      type: 'select',
      required: true,
      span: 1,
      translateOptions: true,
      options: [
        { value: 'service', label: 'dns.monitorKinds.service' },
        { value: 'resolver', label: 'dns.monitorKinds.resolver' },
      ],
      disabledWhen: ({ editing }) => editing,
      help: 'dns.monitorKindHelp',
    },
    { key: 'revision', source: 'DmtRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'target',
      source: 'DmtTarget',
      label: 'dns.monitorTarget',
      required: true,
      helpWhen: ({ values }) =>
        isResolver(values) ? 'dns.monitorResolverTargetHelp' : 'dns.monitorServiceTargetHelp',
    },
    {
      key: 'queryName',
      source: 'DmtQueryName',
      label: 'dns.monitorQueryName',
      span: 1,
      requiredWhen: ({ values }) => isResolver(values),
      hiddenWhen: ({ values }) => !isResolver(values),
      help: 'dns.monitorQueryNameHelp',
    },
    {
      key: 'queryType',
      source: 'DmtQueryType',
      label: 'dns.monitorQueryType',
      type: 'select',
      span: 1,
      translateOptions: false,
      options: [
        { value: 'A', label: 'A' },
        { value: 'AAAA', label: 'AAAA' },
        { value: 'NS', label: 'NS' },
      ],
      requiredWhen: ({ values }) => isResolver(values),
      hiddenWhen: ({ values }) => !isResolver(values),
    },
  ],
  columns: [
    { id: 'name', field: 'DmtName', label: 'Name', kind: 'identity' },
    {
      id: 'kind',
      field: 'DmtKind',
      label: 'dns.monitorKind',
      kind: 'text',
      value: (row, translate) => translate(`dns.monitorKinds.${row['DmtKind']}`),
    },
    {
      id: 'target',
      field: 'DmtTarget',
      label: 'dns.monitorTarget',
      kind: 'text',
      value: (row) =>
        row['DmtKind'] === 'resolver'
          ? `${row['DmtTarget']} · ${row['DmtQueryType']} ${row['DmtQueryName']}`
          : String(row['DmtTarget'] ?? ''),
    },
    { id: 'status', field: 'DmtStatus', label: 'Status', kind: 'status' },
  ],
});

@Component({
  selector: 'app-dns-monitor-targets',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class DnsMonitorTargetsPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  /** Adds the recommended catalog (names already active are kept as they are). */
  override async handleFilterAction(action: ConfigurableCrudFilterAction): Promise<void> {
    if (action.key !== 'defaults') return;
    try {
      const response = await this.api.post<{ data?: { added?: number } }>(
        'system/dns/monitor/defaults',
        {},
      );
      this.snack.success(
        this.t('dns.monitorDefaultsAdded', { count: Number(response?.data?.added ?? 0) }),
      );
      this.refreshList();
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
