import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudColumn,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { openGeneratedRecords } from '../generated-records';

const ENDPOINT = 'system/dns/host-zones';

const RECORDS_ACTION: ConfigurableCrudRowAction = {
  key: 'records',
  label: 'dns.hostRecords',
  icon: 'dns',
  tooltip: 'dns.hostRecordsTooltip',
};

const HOST_ZONE_COLUMNS: ConfigurableCrudColumn[] = [
  { id: 'zone', field: 'ZoneName', label: 'dns.hostZoneDomain', kind: 'identity' },
  { id: 'environment', field: 'EnvironmentName', label: 'dns.hostZoneEnvironment', kind: 'text' },
  { id: 'records', field: 'RecordCount', label: 'dns.hostRecords', kind: 'text' },
  { id: 'synced', field: 'DhzSyncedAt', label: 'dns.hostZoneSyncedAt', kind: 'datetime' },
  { id: 'status', field: 'DhzEnabled', label: 'Status', kind: 'status' },
];

/** Platform host records (PD4): a private platform zone receives the records of the platform Agents. */
const config = defineCrud({
  endpoint: ENDPOINT,
  uuidField: 'DhzUUID',
  pageTitle: 'dns.hostZones',
  pageDescription: 'dns.hostZonesDescription',
  dialogDescription: 'dns.hostZonesDescription',
  bulkDelete: false,
  deletePayload: (row) => ({ revision: Number(row['DhzRevision']) }),
  initialValues: { status: 1, domainUUID: '', environmentUUID: '', revision: 1 },
  payload: (values, editing) => ({
    domainUUID: values['domainUUID'],
    environmentUUID: values['environmentUUID'],
    enabled: Number(values['status']) === 1 ? 1 : 0,
    ...(editing ? { revision: Number(values['revision']) } : {}),
  }),
  fields: [
    { key: 'status', source: 'DhzEnabled', label: 'Status', type: 'status', span: 1 },
    {
      key: 'domainUUID',
      source: 'DomainUUID',
      label: 'dns.hostZoneDomain',
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: 'system/hosting/dns/domains',
        uuidField: 'HddUUID',
        labelField: 'HddName',
      },
      quickCreate: false,
      quickCreateExemptReason:
        'The zone is a platform domain on MNSCloud DNS made private in DNS › Zonas › Domínios.',
      disabledWhen: ({ editing }) => editing,
      help: 'dns.hostZoneDomainHelp',
    },
    {
      key: 'environmentUUID',
      source: 'EnvironmentUUID',
      label: 'dns.hostZoneEnvironment',
      required: true,
      type: 'search-select',
      remoteLookup: {
        endpoint: `${ENDPOINT}/environments`,
        uuidField: 'EnvironmentUUID',
        labelField: 'EnvironmentName',
      },
      quickCreate: false,
      quickCreateExemptReason: 'Environments own the enrolled Agents; they are never created here.',
      help: 'dns.hostZoneEnvironmentHelp',
    },
    { key: 'revision', source: 'DhzRevision', label: 'Revision', type: 'number', hidden: true },
  ],
  columns: HOST_ZONE_COLUMNS,
  rowActions: [RECORDS_ACTION],
});

@Component({
  standalone: true,
  selector: 'app-dns-host-zones',
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
  imports: CONFIGURABLE_CRUD_IMPORTS,
})
export class DnsHostZonesPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  override async handleRowAction(action: ConfigurableCrudRowAction, row: ConfigurableCrudRecord) {
    if (action.key !== 'records') return;
    try {
      await openGeneratedRecords(
        this.api,
        this.dialog,
        `${ENDPOINT}/${this.recordUUID(row)}/records`,
        {
          title: 'dns.hostRecords',
          description: 'dns.hostRecordsDescription',
          zone: 'dns.hostZoneDomain',
          syncedAt: 'dns.hostZoneSyncedAt',
          empty: 'dns.hostRecordsEmpty',
        },
      );
    } catch (error) {
      this.snack.error(this.t(this.errorMessage(error)));
    }
  }
}
