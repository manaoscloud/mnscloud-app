import { Component, inject } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { resaleAccountRowActions } from '../../../shared/crud/configurable-crud/account-resale-actions';
import { logsPayload, logsTenantColumns } from '../logs-input';

const config = defineCrud({
  endpoint: 'logs/accounts',
  uuidField: 'LgaUUID',
  pageTitle: 'logs.accounts',
  pageDescription: 'logs.accountsDescription',
  serverSidePagination: true,
  initialPageSize: 50,
  // Each deletion carries its own revision; an account with sources cannot be deleted.
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['LgaRevision']) }),
  initialValues: {
    name: '',
    notes: '',
    status: 1,
    revision: 1,
    LogClusterLgcUUID: '',
    customerUUID: null,
    dailyCapMb: '',
    warnPercent: 80,
  },
  payload: (values, editing) => {
    // The resale customer is fixed at creation; empty = internal use.
    const payload = logsPayload(values, editing);
    if (editing) delete payload['customerUUID'];
    else payload['customerUUID'] ||= null;
    return payload;
  },
  fields: [
    { key: 'status', source: 'LgaStatus', label: 'Status', type: 'status', span: 1 },
    {
      key: 'LogClusterLgcUUID',
      source: 'LogClusterLgcUUID',
      label: 'logs.cluster',
      span: 1,
      required: true,
      type: 'search-select',
      remoteLookup: { endpoint: 'logs/clusters', uuidField: 'LgcUUID', labelField: 'LgcName' },
      disabledWhen: ({ editing }) => editing,
      help: 'logs.accountClusterHelp',
    },
    { key: 'name', source: 'LgaName', label: 'Name', required: true, span: 1 },
    {
      key: 'customerUUID',
      source: 'RegCustomerRcuUUID',
      label: 'Customer',
      type: 'search-select',
      span: 1,
      help: 'logs.accountCustomerHelp',
      disabledWhen: ({ editing }) => editing,
      remoteLookup: {
        endpoint: 'registry/customers?status=1',
        uuidField: 'CustomerUUID',
        labelField: 'Name',
        selectedLabelField: 'CustomerName',
      },
    },
    { key: 'revision', source: 'LgaRevision', label: 'Revision', type: 'number', hidden: true },
    {
      key: 'dailyCapMb',
      source: 'LgaDailyCapMb',
      label: 'logs.dailyCapMb',
      type: 'number',
      span: 1,
      tab: 'limits',
      help: 'logs.dailyCapHelp',
    },
    {
      key: 'warnPercent',
      source: 'LgaWarnPercent',
      label: 'logs.warnPercent',
      type: 'number',
      span: 1,
      required: true,
      tab: 'limits',
      help: 'logs.warnPercentHelp',
    },
    {
      key: 'notes',
      source: 'LgaNotes',
      label: 'Notes',
      type: 'textarea',
      tab: 'notes',
      span: 4,
      rows: 4,
    },
  ],
  tabLabels: { limits: 'logs.limitsTab' },
  columns: logsTenantColumns(
    'Lga',
    { id: 'cluster', field: 'ClusterName', label: 'logs.cluster', uuidField: 'LogClusterLgcUUID' },
    [
      { id: 'customer', field: 'CustomerName', label: 'Customer' },
      {
        id: 'publication',
        field: 'LgaPortalEnabled',
        label: 'logs.portalEnabled',
        kind: 'status',
      },
      { id: 'sources', field: 'SourceCount', label: 'logs.sources', kind: 'text' },
      {
        id: 'usage',
        field: 'UsageTodayMb',
        label: 'logs.usageToday',
        kind: 'text',
        value: (row) =>
          row['LgaDailyCapMb'] == null
            ? `${row['UsageTodayMb'] ?? 0} MB`
            : `${row['UsageTodayMb'] ?? 0} / ${row['LgaDailyCapMb']} MB`,
      },
      {
        id: 'capState',
        field: 'CapState',
        label: 'logs.capState',
        kind: 'text',
        // A suspended customer contract pauses the account like the daily cap.
        value: (row, translate) =>
          translate(
            Number(row['ServiceAvailable'] ?? 1) === 0 && Number(row['LgaStatus']) === 1
              ? 'logs.capStates.suspended'
              : 'logs.capStates.' + String(row['CapState'] ?? 'ok'),
          ),
      },
    ],
  ),
});

@Component({
  selector: 'app-logs-accounts',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class LogsAccountPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    const auth = inject(AuthService);
    // Operators restricted to assigned accounts are refused by the API (tenant-wide scope only).
    const canManage = () =>
      hasEffectivePermission(auth.user()?.permissions ?? [], 'tenant.logs.write');
    super({
      ...config,
      rowActions: resaleAccountRowActions({
        module: 'logs',
        uuidField: 'LgaUUID',
        revisionField: 'LgaRevision',
        portalField: 'LgaPortalEnabled',
        kindField: 'LgaKind',
        memberUuidField: 'LamUUID',
        memberStatusField: 'LamStatus',
        publicationLabel: 'logs.publication',
        publicationTitle: 'logs.publication',
        publicationDescription: 'logs.publicationDescription',
        portalEnabledLabel: 'logs.portalEnabled',
        assignLabel: 'logs.assignOperator',
        assignTitle: 'logs.assignOperator',
        operatorsLabel: 'logs.operators',
        operatorsTitle: 'logs.operators',
        operatorsDescription: 'logs.operatorsDescription',
        canManage,
      }),
    });
  }
}
